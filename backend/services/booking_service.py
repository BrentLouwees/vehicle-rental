"""
services/booking_service.py
---------------------------
All business logic for bookings:
  - Availability checking (with SELECT FOR UPDATE to prevent race conditions)
  - Price calculation
  - Cancellation fee calculation
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from models.booking import Booking

# Prices charged per day for each optional add-on
ADDON_PRICES: dict[str, Decimal] = {
    "insurance": Decimal("15.00"),
    "gps": Decimal("5.00"),
    "extra_driver": Decimal("10.00"),
    "child_seat": Decimal("8.00"),
}


def check_availability(
    db: Session,
    vehicle_id: int,
    pickup_date: date,
    return_date: date,
    exclude_booking_id: int | None = None,
) -> bool:
    """
    Check whether a vehicle is free for the requested date range.

    Uses a raw SELECT ... FOR UPDATE so that concurrent requests cannot
    both pass the availability check at the same time (prevents double-booking).
    Must be called inside an open transaction.

    Overlap condition: an existing booking conflicts when
        existing.pickup_date < requested.return_date
        AND existing.return_date > requested.pickup_date

    Returns True if the vehicle is available, False if there is a conflict.
    """
    # Build the query — optionally exclude a booking we are modifying
    sql = text("""
        SELECT id FROM bookings
        WHERE vehicle_id   = :vehicle_id
          AND pickup_date  < :return_date
          AND return_date  > :pickup_date
          AND status NOT IN ('cancelled')
          AND (:exclude_id IS NULL OR id != :exclude_id)
        LIMIT 1
        FOR UPDATE
    """)

    result = db.execute(
        sql,
        {
            "vehicle_id": vehicle_id,
            "pickup_date": pickup_date,
            "return_date": return_date,
            "exclude_id": exclude_booking_id,
        },
    ).fetchone()

    return result is None  # None means no conflicting booking found


def calculate_price(
    daily_rate: Decimal,
    pickup_date: date,
    return_date: date,
    addons: list[str],
) -> dict:
    """
    Calculate the full price breakdown for a booking.

    Args:
        daily_rate: The vehicle's daily_rate at time of booking.
        pickup_date: Start date (inclusive).
        return_date: End date (exclusive — customer returns the car on this day).
        addons: List of addon_type strings, e.g. ["insurance", "gps"].

    Returns a dict with keys:
        duration_days, subtotal, addons_total, total_amount
    """
    duration_days = (return_date - pickup_date).days
    subtotal = daily_rate * duration_days

    addons_total = Decimal("0.00")
    for addon_type in addons:
        if addon_type not in ADDON_PRICES:
            raise ValueError(f"Unknown addon type: {addon_type}")
        price_per_day = ADDON_PRICES[addon_type]
        addons_total += price_per_day * duration_days

    total_amount = subtotal + addons_total

    return {
        "duration_days": duration_days,
        "subtotal": subtotal,
        "addons_total": addons_total,
        "total_amount": total_amount,
    }


def calculate_cancellation_fee(booking: Booking, cancel_date: date) -> Decimal:
    """
    Calculate the cancellation fee based on how far in advance the customer cancels.

    Policy:
        > 7 days before pickup  →  no fee (0 %)
        3–7 days before pickup  →  25 % of subtotal
        < 3 days before pickup  →  50 % of subtotal
        same day or past        →  100 % of subtotal
    """
    days_until_pickup = (booking.pickup_date - cancel_date).days
    subtotal = Decimal(str(booking.subtotal))

    if days_until_pickup > 7:
        return Decimal("0.00")
    elif days_until_pickup >= 3:
        return (subtotal * Decimal("0.25")).quantize(Decimal("0.01"))
    elif days_until_pickup > 0:
        return (subtotal * Decimal("0.50")).quantize(Decimal("0.01"))
    else:
        # Same day or customer is trying to cancel after the pickup date
        return subtotal.quantize(Decimal("0.01"))
