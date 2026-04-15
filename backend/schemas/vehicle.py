"""
schemas/vehicle.py
------------------
Pydantic v2 schemas for vehicle endpoints.
"""

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator


class VehicleCreate(BaseModel):
    location_id: int
    type: str
    brand: str
    model: str
    year: int
    plate_number: str
    color: str
    seats: int | None = None
    transmission: str
    fuel_type: str = "petrol"
    daily_rate: Decimal
    image_url: str | None = None
    description: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("car", "motorcycle"):
            raise ValueError("type must be 'car' or 'motorcycle'")
        return v

    @field_validator("daily_rate")
    @classmethod
    def validate_daily_rate(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("daily_rate must be positive")
        return v


class VehicleUpdate(BaseModel):
    location_id: int | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    color: str | None = None
    seats: int | None = None
    transmission: str | None = None
    fuel_type: str | None = None
    daily_rate: Decimal | None = None
    status: str | None = None
    image_url: str | None = None
    description: str | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_id: int
    type: str
    brand: str
    model: str
    year: int
    plate_number: str
    color: str
    seats: int | None
    transmission: str
    fuel_type: str
    daily_rate: Decimal
    status: str
    image_url: str | None
    description: str | None
    created_at: datetime
    avg_rating: float | None = None  # populated by the route, not from ORM directly
