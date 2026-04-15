"""
schemas/payment.py
------------------
Pydantic v2 schemas for payment endpoints.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict


class PaymentCreate(BaseModel):
    booking_id: int
    method: Literal["credit_card", "debit_card", "bank_transfer", "cash"]


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    amount: Decimal
    method: str
    status: str
    reference_code: str | None
    paid_at: datetime | None
    created_at: datetime
