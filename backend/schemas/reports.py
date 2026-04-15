"""
schemas/reports.py
------------------
Pydantic v2 schemas for manager report responses.
"""

from decimal import Decimal
from pydantic import BaseModel


class RevenueByType(BaseModel):
    vehicle_type: str
    total_revenue: Decimal
    booking_count: int


class RevenueReport(BaseModel):
    total_revenue: Decimal
    booking_count: int
    by_vehicle_type: list[RevenueByType]


class VehicleUtilization(BaseModel):
    vehicle_id: int
    brand: str
    model: str
    plate_number: str
    total_bookings: int
    total_days_rented: int
    total_revenue: Decimal


class CustomerSpend(BaseModel):
    customer_id: int
    full_name: str
    email: str
    total_bookings: int
    total_spent: Decimal
