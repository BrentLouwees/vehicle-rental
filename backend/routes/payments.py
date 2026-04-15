"""
routes/payments.py
------------------
Payment creation, lookup, and refund.
"""

import uuid
from datetime import datetime, UTC
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models.booking import Booking
from models.payment import Payment
from models.user import User
from schemas.payment import PaymentCreate, PaymentOut
from services.auth_service import get_current_user, require_staff

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a payment for a booking.
    Only the booking owner can pay for their own booking.
    The booking must be in 'confirmed' status before payment.
    """
    booking = db.get(Booking, body.booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot pay for a cancelled booking",
        )

    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot pay for a booking with status '{booking.status}'",
        )

    # Prevent duplicate payment
    existing = db.query(Payment).filter(Payment.booking_id == body.booking_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A payment record already exists for this booking",
        )

    payment = Payment(
        booking_id=body.booking_id,
        amount=booking.total_amount,
        method=body.method,
        status="paid",
        reference_code=str(uuid.uuid4()).replace("-", "").upper()[:16],
        paid_at=datetime.now(UTC),
    )
    db.add(payment)

    # Auto-confirm the booking when payment is received
    if booking.status == "pending":
        booking.status = "confirmed"

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{booking_id}", response_model=PaymentOut)
def get_payment(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the payment for a specific booking.
    Customers can only see payments for their own bookings.
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if current_user.role == "customer" and booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No payment found for this booking")

    return payment


@router.put("/{payment_id}/refund")
def refund_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """
    Mark a payment as refunded (staff/manager only).
    Only 'paid' payments can be refunded.
    If the booking has a cancellation fee, the refund amount is reduced accordingly.
    """
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if payment.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot refund a payment with status '{payment.status}'",
        )

    booking = db.get(Booking, payment.booking_id)
    cancellation_fee = Decimal(str(booking.cancellation_fee)) if booking and booking.cancellation_fee else Decimal("0.00")
    refund_amount = max(Decimal(str(payment.amount)) - cancellation_fee, Decimal("0.00"))

    payment.status = "refunded"
    db.commit()
    db.refresh(payment)

    return JSONResponse(content={
        "id": payment.id,
        "booking_id": payment.booking_id,
        "amount": str(payment.amount),
        "method": payment.method,
        "status": payment.status,
        "reference_code": payment.reference_code,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        "created_at": payment.created_at.isoformat(),
        "refund_amount": str(refund_amount),
        "cancellation_fee_deducted": str(cancellation_fee),
    })
