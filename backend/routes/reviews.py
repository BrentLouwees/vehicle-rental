"""
routes/reviews.py
-----------------
Customers can post a review for a completed booking.
Anyone can read reviews for a vehicle.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models.booking import Booking
from models.review import Review
from models.user import User
from schemas.review import ReviewCreate, ReviewOut
from services.auth_service import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a review for a completed booking.
    The booking must be 'completed' and belong to the current user.
    One review per booking is enforced.
    """
    booking = db.get(Booking, body.booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if booking.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can only review completed bookings",
        )

    existing = db.query(Review).filter(Review.booking_id == body.booking_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this booking",
        )

    review = Review(
        booking_id=body.booking_id,
        customer_id=current_user.id,
        vehicle_id=booking.vehicle_id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.get("/vehicle/{vehicle_id}", response_model=list[ReviewOut])
def get_vehicle_reviews(
    vehicle_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Return paginated reviews for a specific vehicle (public)."""
    offset = (page - 1) * limit
    return (
        db.query(Review)
        .filter(Review.vehicle_id == vehicle_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
