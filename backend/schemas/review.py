"""
schemas/review.py
-----------------
Pydantic v2 schemas for review endpoints.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class ReviewCreate(BaseModel):
    booking_id: int
    rating: int
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("rating must be between 1 and 5")
        return v


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    customer_id: int
    vehicle_id: int
    rating: int
    comment: str | None
    created_at: datetime
