"""
models/vehicle.py
-----------------
ORM model for the `vehicles` table.
"""

from datetime import datetime, UTC
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("locations.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(
        Enum("car", "motorcycle", name="vehicle_type"), nullable=False
    )
    brand: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    plate_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(40), nullable=False)
    seats: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    transmission: Mapped[str] = mapped_column(
        Enum("manual", "automatic", name="transmission_type"), nullable=False
    )
    fuel_type: Mapped[str] = mapped_column(
        Enum("petrol", "diesel", "electric", "hybrid", name="fuel_type"),
        nullable=False,
        default="petrol",
    )
    daily_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("available", "rented", "maintenance", name="vehicle_status"),
        nullable=False,
        default="available",
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    # Relationships
    location: Mapped["Location"] = relationship("Location", back_populates="vehicles")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="vehicle")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="vehicle")
