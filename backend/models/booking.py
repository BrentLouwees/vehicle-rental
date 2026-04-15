"""
models/booking.py
-----------------
ORM models for `bookings` and `booking_addons` tables.
"""

from datetime import datetime, date, UTC
from sqlalchemy import (
    Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, SmallInteger, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    vehicle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("vehicles.id"), nullable=False
    )
    pickup_location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("locations.id"), nullable=False
    )
    return_location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("locations.id"), nullable=False
    )
    pickup_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("pending", "confirmed", "active", "completed", "cancelled", name="booking_status"),
        nullable=False,
        default="pending",
    )
    daily_rate_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    duration_days: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    addons_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cancellation_fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    # Relationships
    customer: Mapped["User"] = relationship("User", back_populates="bookings", foreign_keys=[customer_id])
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="bookings")
    pickup_location: Mapped["Location"] = relationship("Location", foreign_keys=[pickup_location_id])
    return_location: Mapped["Location"] = relationship("Location", foreign_keys=[return_location_id])
    addons: Mapped[list["BookingAddon"]] = relationship(
        "BookingAddon", back_populates="booking", cascade="all, delete-orphan"
    )
    payment: Mapped["Payment"] = relationship("Payment", back_populates="booking", uselist=False)
    review: Mapped["Review"] = relationship("Review", back_populates="booking", uselist=False)

    __table_args__ = (
        Index("idx_booking_vehicle_dates", "vehicle_id", "pickup_date", "return_date"),
    )


class BookingAddon(Base):
    __tablename__ = "booking_addons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    addon_type: Mapped[str] = mapped_column(
        Enum("insurance", "gps", "extra_driver", "child_seat", name="addon_type"),
        nullable=False,
    )
    price_per_day: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="addons")
