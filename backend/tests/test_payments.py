"""
tests/test_payments.py
----------------------
Tests for payment creation, blocked states, and method validation.

Notes on method validation:
    PaymentCreate.method is a plain `str` field — Pydantic does NOT validate
    it against the allowed enum values. The validation would normally happen
    at the DB layer (MySQL ENUM column). SQLite does not enforce enums, so an
    invalid method like "crypto" would be stored without error.

    To handle this properly without touching production code, the test for
    invalid method validation checks that either:
      a) The API returns 422 (if a Pydantic validator is ever added), OR
      b) The API accepts it but the payment record's method field reflects
         what was stored — we assert the behaviour matches the spec's intent.

    Currently test_payment_method_validation verifies that "crypto" is NOT
    accepted by the API (422), which is the correct documented behaviour.
    If the production code does not validate this, the test will fail and
    that is intentional — it documents a missing validation.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

BASE = "/api/v1"
TODAY = date.today()

VALID_METHODS = ["credit_card", "debit_card", "bank_transfer", "cash"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_booking(client, customer_headers, staff_headers, vehicle, location, pickup_offset_days=10):
    """Create and confirm a booking. Returns confirmed booking JSON."""
    pickup = TODAY + timedelta(days=pickup_offset_days)
    return_date = pickup + timedelta(days=3)

    payload = {
        "vehicle_id": vehicle.id,
        "pickup_location_id": location.id,
        "return_location_id": location.id,
        "pickup_date": pickup.isoformat(),
        "return_date": return_date.isoformat(),
        "addons": [],
    }
    resp = client.post(f"{BASE}/bookings", json=payload, headers=customer_headers)
    assert resp.status_code == 201, f"Booking creation failed: {resp.text}"
    booking = resp.json()

    confirm = client.put(f"{BASE}/bookings/{booking['id']}/confirm", headers=staff_headers)
    assert confirm.status_code == 200, f"Booking confirmation failed: {confirm.text}"

    return confirm.json()


def _pay(client, customer_headers, booking_id: int, method: str = "cash"):
    return client.post(f"{BASE}/payments", json={
        "booking_id": booking_id,
        "method": method,
    }, headers=customer_headers)


# ---------------------------------------------------------------------------
# 1. Payment creates successfully
# ---------------------------------------------------------------------------

def test_payment_creates_successfully(client, auth_headers, create_vehicle, create_location):
    """
    Creating a payment for a confirmed booking must return HTTP 201 and
    include the booking_id and a non-null reference_code.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    booking = _make_booking(client, customer_headers, staff_headers, vehicle, location)

    resp = _pay(client, customer_headers, booking["id"])
    assert resp.status_code == 201, resp.text

    data = resp.json()
    assert data["booking_id"] == booking["id"]
    assert data["status"] == "paid"
    assert data["reference_code"] is not None
    assert Decimal(str(data["amount"])) == Decimal(str(booking["total_amount"]))


# ---------------------------------------------------------------------------
# 2. Payment blocked on a cancelled booking
# ---------------------------------------------------------------------------

def test_payment_blocked_on_cancelled_booking(client, auth_headers, create_vehicle, create_location):
    """
    Attempting to pay for a cancelled booking must return HTTP 409 Conflict.

    The route checks: booking.status not in ('pending', 'confirmed') → 409.
    A cancelled booking has status='cancelled', which is not in that list.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    # Create and confirm, then cancel
    booking = _make_booking(client, customer_headers, staff_headers, vehicle, location)
    booking_id = booking["id"]

    cancel_resp = client.put(f"{BASE}/bookings/{booking_id}/cancel", headers=customer_headers)
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["status"] == "cancelled"

    # Attempt payment on the now-cancelled booking
    resp = _pay(client, customer_headers, booking_id)
    assert resp.status_code == 409, resp.text


# ---------------------------------------------------------------------------
# 3. Payment method validation
# ---------------------------------------------------------------------------

def test_payment_method_validation(client, auth_headers, create_vehicle, create_location):
    """
    Submitting an invalid payment method ("crypto") must be rejected.

    The Payment model's `method` column is an ENUM("credit_card", "debit_card",
    "bank_transfer", "cash"). An invalid value should not be accepted.

    Currently, PaymentCreate uses a plain str field with no Pydantic validator,
    so validation depends on the DB layer. With SQLite (used in tests), the
    ENUM is not enforced at the DB level.

    This test is written to assert the *intended* behaviour (rejection with 422).
    If this test fails, it signals that route-level validation for payment
    method is missing and should be added to PaymentCreate or the route handler.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    booking = _make_booking(client, customer_headers, staff_headers, vehicle, location)

    resp = _pay(client, customer_headers, booking["id"], method="crypto")
    # 422 = Pydantic validation error (ideal), 400 = explicit route rejection
    assert resp.status_code in (400, 422), (
        f"Expected 400 or 422 for invalid payment method 'crypto', got {resp.status_code}. "
        f"This indicates missing method validation in PaymentCreate schema or the route handler."
    )
