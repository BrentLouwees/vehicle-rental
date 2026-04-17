"""
routes/bookings.py
------------------
Booking lifecycle: create, list, view, confirm, cancel, pickup, return.
State machine transitions are enforced here before any DB write.
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.booking import Booking, BookingAddon
from models.location import Location
from models.user import User
from models.vehicle import Vehicle
from schemas.booking import BookingCreate, BookingListOut, BookingOut
from services.auth_service import get_current_user, require_staff
from services.booking_service import (
    ADDON_PRICES,
    calculate_cancellation_fee,
    calculate_price,
    check_availability,
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ── Helper ─────────────────────────────────────────────────────────────────────

def _assert_transition(booking: Booking, allowed_from: list[str], action: str) -> None:
    """Raise HTTP 409 if the booking is not in one of the allowed_from states."""
    if booking.status not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot {action} a booking with status '{booking.status}'",
        )


# ── Create booking ─────────────────────────────────────────────────────────────

@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new booking for the authenticated customer.
    Checks availability inside a transaction with SELECT FOR UPDATE
    to prevent double-bookings under concurrent load.
    """
    # Validate addon types and locations before entering the transaction
    # (these checks don't need the DB lock and fail fast on bad input)
    addon_types = [a.addon_type for a in body.addons]

    for addon_type in addon_types:
        if addon_type not in ADDON_PRICES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown addon type: {addon_type}",
            )

    # --- Begin atomic availability check + insert ---
    try:
        # Flush any pending state so the FOR UPDATE sees a consistent snapshot
        db.flush()

        # Acquire the row-level lock FIRST (SELECT FOR UPDATE) before any other
        # reads so that concurrent requests cannot both pass the availability check.
        available = check_availability(
            db, body.vehicle_id, body.pickup_date, body.return_date
        )
        if not available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle is not available for the requested dates",
            )

        # All other validation reads happen after the lock is held.
        vehicle = db.get(Vehicle, body.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

        if vehicle.status == "maintenance":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle is not available for rental",
            )

        if not db.get(Location, body.pickup_location_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

        if not db.get(Location, body.return_location_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

        pricing = calculate_price(
            daily_rate=Decimal(str(vehicle.daily_rate)),
            pickup_date=body.pickup_date,
            return_date=body.return_date,
            addons=addon_types,
        )

        booking = Booking(
            customer_id=current_user.id,
            vehicle_id=body.vehicle_id,
            pickup_location_id=body.pickup_location_id,
            return_location_id=body.return_location_id,
            pickup_date=body.pickup_date,
            return_date=body.return_date,
            daily_rate_snapshot=vehicle.daily_rate,
            duration_days=pricing["duration_days"],
            subtotal=pricing["subtotal"],
            addons_total=pricing["addons_total"],
            total_amount=pricing["total_amount"],
            notes=body.notes,
        )
        db.add(booking)
        db.flush()  # get booking.id before inserting addons

        for addon_type in addon_types:
            price_per_day = ADDON_PRICES[addon_type]
            db.add(BookingAddon(
                booking_id=booking.id,
                addon_type=addon_type,
                price_per_day=price_per_day,
                total_price=price_per_day * pricing["duration_days"],
            ))

        db.commit()
        db.refresh(booking)
        return booking

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


# ── List bookings (staff/manager) ──────────────────────────────────────────────

@router.get("", response_model=list[BookingListOut])
def list_bookings(
    booking_status: str | None = Query(None, alias="status"),
    customer_id: int | None = Query(None),
    vehicle_id: int | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """List all bookings with optional filters (staff/manager only)."""
    query = db.query(Booking).options(
        joinedload(Booking.vehicle),
        joinedload(Booking.customer),
    )

    if booking_status:
        query = query.filter(Booking.status == booking_status)
    if customer_id:
        query = query.filter(Booking.customer_id == customer_id)
    if vehicle_id:
        query = query.filter(Booking.vehicle_id == vehicle_id)
    if from_date:
        query = query.filter(Booking.pickup_date >= from_date)
    if to_date:
        query = query.filter(Booking.pickup_date <= to_date)

    offset = (page - 1) * limit
    return query.order_by(Booking.created_at.desc()).offset(offset).limit(limit).all()


# ── My bookings (customer) ─────────────────────────────────────────────────────

@router.get("/my", response_model=list[BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all bookings belonging to the authenticated customer."""
    return (
        db.query(Booking)
        .filter(Booking.customer_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )


# ── Single booking ─────────────────────────────────────────────────────────────

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a single booking.
    Customers can only see their own booking; staff/manager can see any.
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if current_user.role == "customer" and booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return booking


# ── Status transitions ─────────────────────────────────────────────────────────

@router.put("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Confirm a pending booking (staff/manager)."""
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    _assert_transition(booking, ["pending"], "confirm")
    booking.status = "confirmed"
    db.commit()
    db.refresh(booking)
    return booking


@router.put("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel a pending or confirmed booking.
    Applies a cancellation fee based on proximity to pickup date.
    Customers can only cancel their own bookings.
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    # Ownership check for customers
    if current_user.role == "customer" and booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    _assert_transition(booking, ["pending", "confirmed"], "cancel")

    fee = calculate_cancellation_fee(booking, date.today())
    booking.cancellation_fee = fee
    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking


@router.put("/{booking_id}/pickup", response_model=BookingOut)
def pickup_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """
    Mark a booking as active when the customer picks up the vehicle.
    Also sets the vehicle status to 'rented' (staff/manager).
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    _assert_transition(booking, ["confirmed"], "activate")

    booking.status = "active"
    vehicle = db.get(Vehicle, booking.vehicle_id)
    if vehicle:
        vehicle.status = "rented"

    db.commit()
    db.refresh(booking)
    return booking


@router.put("/{booking_id}/return", response_model=BookingOut)
def return_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """
    Mark a booking as completed when the vehicle is returned.
    Also sets the vehicle status back to 'available' (staff/manager).
    """
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    _assert_transition(booking, ["active"], "complete")

    booking.status = "completed"
    vehicle = db.get(Vehicle, booking.vehicle_id)
    if vehicle:
        vehicle.status = "available"

    db.commit()
    db.refresh(booking)
    return booking
