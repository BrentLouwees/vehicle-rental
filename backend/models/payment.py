"""
models/payment.py
-----------------
ORM model for the `payments` table.
"""

from datetime import datetime, UTC
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bookings.id"), nullable=False, unique=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    method: Mapped[str] = mapped_column(
        Enum("credit_card", "debit_card", "bank_transfer", "cash", name="payment_method"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Enum("pending", "paid", "refunded", "failed", name="payment_status"),
        nullable=False,
        default="pending",
    )
    reference_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="payment")
