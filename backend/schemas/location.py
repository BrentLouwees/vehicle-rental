"""
schemas/location.py
-------------------
Pydantic v2 schemas for location endpoints.
"""

from pydantic import BaseModel, ConfigDict


class LocationCreate(BaseModel):
    name: str
    address: str
    city: str
    phone: str


class LocationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    city: str
    phone: str
    is_active: bool
