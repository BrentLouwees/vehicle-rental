"""
tests/test_bookings.py
----------------------
Tests for booking business logic: availability, pricing, cancellation fees,
and input validation.

All tests use an in-memory SQLite database (via conftest.py fixtures) and are
fully independent — each test gets a fresh database.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TODAY = date.today()


def _booking_payload(vehicle_id: int, location_id: int, pickup_date: date, return_date: date, addons=None):
    """Return a minimal valid BookingCreate payload as a dict."""
    return {
        "vehicle_id": vehicle_id,
        "pickup_location_id": location_id,
        "return_location_id": location_id,
        "pickup_date": pickup_date.isoformat(),
        "return_date": return_date.isoformat(),
        "addons": addons or [],
    }


def _post_booking(client, headers, payload):
    return client.post("/api/v1/bookings", json=payload, headers=headers)


def _confirm_booking(client, staff_headers, booking_id: int):
    """Staff helper: PUT /bookings/{id}/confirm."""
    return client.put(f"/api/v1/bookings/{booking_id}/confirm", headers=staff_headers)


def _cancel_booking(client, headers, booking_id: int):
    """Cancel a booking and return the response."""
    return client.put(f"/api/v1/bookings/{booking_id}/cancel", headers=headers)


# ---------------------------------------------------------------------------
# 1. Double-booking prevention (overlapping dates)
# ---------------------------------------------------------------------------

def test_booking_prevents_double_booking(client, auth_headers, create_vehicle, create_location):
    """
    Booking B for overlapping dates on the same vehicle must be rejected with
    HTTP 409 Conflict.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)

    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    # Booking A: 2027-01-10 to 2027-01-15
    payload_a = _booking_payload(vehicle.id, location.id, date(2027, 1, 10), date(2027, 1, 15))
    resp_a = _post_booking(client, customer_headers, payload_a)
    assert resp_a.status_code == 201, resp_a.text

    # Confirm A so its status is not 'cancelled'
    _confirm_booking(client, staff_headers, resp_a.json()["id"])

    # Booking B: 2027-01-12 to 2027-01-18 — overlaps with A
    payload_b = _booking_payload(vehicle.id, location.id, date(2027, 1, 12), date(2027, 1, 18))
    resp_b = _post_booking(client, customer_headers, payload_b)
    assert resp_b.status_code == 409, resp_b.text


def test_booking_prevents_double_booking_exact_same_dates(client, auth_headers, create_vehicle, create_location):
    """
    A second booking for the exact same vehicle and dates must be rejected
    with HTTP 409 Conflict.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)

    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    payload = _booking_payload(vehicle.id, location.id, date(2027, 2, 1), date(2027, 2, 5))

    resp_a = _post_booking(client, customer_headers, payload)
    assert resp_a.status_code == 201, resp_a.text
    _confirm_booking(client, staff_headers, resp_a.json()["id"])

    resp_b = _post_booking(client, customer_headers, payload)
    assert resp_b.status_code == 409, resp_b.text


# ---------------------------------------------------------------------------
# 3. Adjacent (non-overlapping) dates are allowed
# ---------------------------------------------------------------------------

def test_booking_allowed_for_non_overlapping_dates(client, auth_headers, create_vehicle, create_location):
    """
    Booking B starting exactly on the return_date of booking A is NOT an
    overlap (return_date is exclusive). Both bookings must succeed.

    Overlap condition from booking_service:
        existing.pickup_date < requested.return_date
        AND existing.return_date > requested.pickup_date

    When booking B pickup_date == booking A return_date:
        A.return_date (2027-03-05) > B.pickup_date (2027-03-05) → False
    So there is NO overlap.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)

    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    # Booking A: 2027-03-01 to 2027-03-05
    payload_a = _booking_payload(vehicle.id, location.id, date(2027, 3, 1), date(2027, 3, 5))
    resp_a = _post_booking(client, customer_headers, payload_a)
    assert resp_a.status_code == 201, resp_a.text
    _confirm_booking(client, staff_headers, resp_a.json()["id"])

    # Booking B: 2027-03-05 to 2027-03-10 — adjacent, not overlapping
    payload_b = _booking_payload(vehicle.id, location.id, date(2027, 3, 5), date(2027, 3, 10))
    resp_b = _post_booking(client, customer_headers, payload_b)
    assert resp_b.status_code in (200, 201), resp_b.text


# ---------------------------------------------------------------------------
# 4. Pickup date must be today or future
# ---------------------------------------------------------------------------

def test_booking_requires_future_pickup_date(client, auth_headers, create_vehicle, create_location):
    """
    A booking with a pickup_date in the past must be rejected.
    The BookingCreate schema raises a ValueError which FastAPI converts to 422.
    """
    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")

    yesterday = TODAY - timedelta(days=1)
    # return_date must be after pickup_date to avoid triggering the other validator first
    payload = _booking_payload(vehicle.id, location.id, yesterday, yesterday + timedelta(days=2))

    resp = _post_booking(client, customer_headers, payload)
    assert resp.status_code in (400, 422), resp.text


# ---------------------------------------------------------------------------
# 5–8. Cancellation fee tiers
#
# Policy (from booking_service.calculate_cancellation_fee):
#   > 7 days before pickup  →  0%
#   3–7 days before pickup  →  25% of subtotal
#   1–2 days before pickup  →  50% of subtotal
#   Same day or past        →  100% of subtotal
# ---------------------------------------------------------------------------

def _make_confirmed_booking(client, customer_headers, staff_headers, vehicle, location, pickup_date: date):
    """
    Create and confirm a booking. Returns the full booking JSON dict.
    Return date is always pickup + 3 days so duration_days == 3.
    """
    return_date = pickup_date + timedelta(days=3)
    payload = _booking_payload(vehicle.id, location.id, pickup_date, return_date)
    resp = _post_booking(client, customer_headers, payload)
    assert resp.status_code == 201, resp.text
    booking = resp.json()

    confirm_resp = _confirm_booking(client, staff_headers, booking["id"])
    assert confirm_resp.status_code == 200, confirm_resp.text

    return confirm_resp.json()


def test_booking_cancellation_fee_zero_percent(client, auth_headers, create_vehicle, create_location):
    """
    Cancelling more than 7 days before pickup incurs no fee (0%).
    pickup_date = today + 8 days → days_until_pickup = 8 > 7 → 0%
    """
    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    pickup = TODAY + timedelta(days=8)
    booking = _make_confirmed_booking(client, customer_headers, staff_headers, vehicle, location, pickup)

    resp = _cancel_booking(client, customer_headers, booking["id"])
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["status"] == "cancelled"
    assert Decimal(str(data["cancellation_fee"])) == Decimal("0.00")


def test_booking_cancellation_fee_twenty_five_percent(client, auth_headers, create_vehicle, create_location):
    """
    Cancelling 3–7 days before pickup incurs a 25% fee.
    pickup_date = today + 5 days → days_until_pickup = 5 → 25%
    """
    location = create_location()
    vehicle = create_vehicle(daily_rate=Decimal("500.00"), location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    pickup = TODAY + timedelta(days=5)
    booking = _make_confirmed_booking(client, customer_headers, staff_headers, vehicle, location, pickup)

    resp = _cancel_booking(client, customer_headers, booking["id"])
    assert resp.status_code == 200, resp.text
    data = resp.json()

    subtotal = Decimal(str(data["subtotal"]))
    expected_fee = (subtotal * Decimal("0.25")).quantize(Decimal("0.01"))
    actual_fee = Decimal(str(data["cancellation_fee"]))

    assert data["status"] == "cancelled"
    assert actual_fee == expected_fee, f"Expected 25% fee {expected_fee}, got {actual_fee}"


def test_booking_cancellation_fee_fifty_percent(client, auth_headers, create_vehicle, create_location):
    """
    Cancelling 1 or 2 days before pickup incurs a 50% fee.
    pickup_date = today + 2 days → days_until_pickup = 2 → 50%
    """
    location = create_location()
    vehicle = create_vehicle(daily_rate=Decimal("500.00"), location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    pickup = TODAY + timedelta(days=2)
    booking = _make_confirmed_booking(client, customer_headers, staff_headers, vehicle, location, pickup)

    resp = _cancel_booking(client, customer_headers, booking["id"])
    assert resp.status_code == 200, resp.text
    data = resp.json()

    subtotal = Decimal(str(data["subtotal"]))
    expected_fee = (subtotal * Decimal("0.50")).quantize(Decimal("0.01"))
    actual_fee = Decimal(str(data["cancellation_fee"]))

    assert data["status"] == "cancelled"
    assert actual_fee == expected_fee, f"Expected 50% fee {expected_fee}, got {actual_fee}"


def test_booking_cancellation_fee_one_hundred_percent(client, auth_headers, create_vehicle, create_location):
    """
    Cancelling on the same day as pickup incurs a 100% fee (full subtotal).
    pickup_date = today → days_until_pickup = 0 → 100%

    Note: the BookingCreate validator rejects pickup_date < today, but today
    itself is allowed. We use today as pickup_date.
    """
    location = create_location()
    vehicle = create_vehicle(daily_rate=Decimal("500.00"), location=location)
    customer_headers = auth_headers("customer")
    staff_headers = auth_headers("staff")

    pickup = TODAY  # same-day pickup
    # return_date must be strictly after pickup_date
    return_date = pickup + timedelta(days=3)
    payload = _booking_payload(vehicle.id, location.id, pickup, return_date)

    resp = _post_booking(client, customer_headers, payload)
    assert resp.status_code == 201, resp.text
    booking_id = resp.json()["id"]

    _confirm_booking(client, staff_headers, booking_id)

    resp = _cancel_booking(client, customer_headers, booking_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    subtotal = Decimal(str(data["subtotal"]))
    actual_fee = Decimal(str(data["cancellation_fee"]))

    assert data["status"] == "cancelled"
    assert actual_fee == subtotal.quantize(Decimal("0.01")), (
        f"Expected 100% fee {subtotal}, got {actual_fee}"
    )


# ---------------------------------------------------------------------------
# 9. Add-on pricing
# ---------------------------------------------------------------------------

def test_addon_prices_calculated_correctly(client, auth_headers, create_vehicle, create_location):
    """
    A 3-day booking with the 'insurance' add-on (₱15/day) must have:
        addons_total = 15.00 × 3 = 45.00
        total_amount = (vehicle.daily_rate × 3) + 45.00
    """
    location = create_location()
    daily_rate = Decimal("500.00")
    vehicle = create_vehicle(daily_rate=daily_rate, location=location)
    customer_headers = auth_headers("customer")

    pickup = TODAY + timedelta(days=10)
    return_date = pickup + timedelta(days=3)  # 3-day rental

    payload = _booking_payload(
        vehicle.id, location.id, pickup, return_date,
        addons=[{"addon_type": "insurance"}]
    )
    resp = _post_booking(client, customer_headers, payload)
    assert resp.status_code == 201, resp.text

    data = resp.json()
    assert data["duration_days"] == 3
    assert Decimal(str(data["addons_total"])) == Decimal("45.00"), (
        f"Expected addons_total 45.00, got {data['addons_total']}"
    )
    expected_total = daily_rate * 3 + Decimal("45.00")
    assert Decimal(str(data["total_amount"])) == expected_total, (
        f"Expected total_amount {expected_total}, got {data['total_amount']}"
    )


# ---------------------------------------------------------------------------
# 10. Non-existent vehicle
# ---------------------------------------------------------------------------

def test_booking_requires_valid_vehicle(client, auth_headers, create_location):
    """
    Booking a vehicle that does not exist must return HTTP 404.
    """
    location = create_location()
    customer_headers = auth_headers("customer")

    payload = _booking_payload(99999, location.id, TODAY + timedelta(days=5), TODAY + timedelta(days=8))
    resp = _post_booking(client, customer_headers, payload)
    assert resp.status_code == 404, resp.text
