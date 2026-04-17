"""
schemas/booking.py
------------------
Pydantic v2 schemas for booking endpoints.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


# ── Addon schemas ──────────────────────────────────────────────────────────────

ADDON_TYPES = Literal["insurance", "gps", "extra_driver", "child_seat"]


class AddonRequest(BaseModel):
    addon_type: ADDON_TYPES


class AddonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    addon_type: str
    price_per_day: Decimal
    total_price: Decimal


# ── Booking request schemas ────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    vehicle_id: int
    pickup_location_id: int
    return_location_id: int
    pickup_date: date
    return_date: date
    addons: list[AddonRequest] = []
    notes: str | None = None

    @model_validator(mode="after")
    def dates_are_valid(self) -> "BookingCreate":
        if self.return_date <= self.pickup_date:
            raise ValueError("return_date must be after pickup_date")
        if self.pickup_date < date.today():
            raise ValueError("pickup_date cannot be in the past")
        return self


# ── Booking response schemas ───────────────────────────────────────────────────

class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    vehicle_id: int
    pickup_location_id: int
    return_location_id: int
    pickup_date: date
    return_date: date
    status: str
    daily_rate_snapshot: Decimal
    duration_days: int
    subtotal: Decimal
    addons_total: Decimal
    total_amount: Decimal
    cancellation_fee: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime
    addons: list[AddonOut] = []


class VehicleSummary(BaseModel):
    """Minimal vehicle info nested inside booking list responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    brand: str
    model: str
    plate_number: str


class CustomerSummary(BaseModel):
    """Minimal customer info nested inside booking list responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str


class BookingListOut(BaseModel):
    """Lightweight schema for list responses (no nested addons)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    vehicle_id: int
    pickup_date: date
    return_date: date
    status: str
    total_amount: Decimal
    created_at: datetime
    vehicle: VehicleSummary | None = None
    customer: CustomerSummary | None = None
