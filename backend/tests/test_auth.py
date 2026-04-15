"""
tests/test_auth.py
------------------
Tests for authentication: registration, login, token validation,
and role-based access control.

All tests use a dedicated MySQL test database (vehicle_rental_test) via conftest.py fixtures.
"""

import pytest


BASE = "/api/v1"


# ---------------------------------------------------------------------------
# Helper: register a user via the API (returns the response)
# ---------------------------------------------------------------------------

def _register(client, email="alice@test.com", password="password123", role_note=None):
    """
    POST /auth/register. The API always creates customers; role_note is ignored
    (just a label for clarity in tests).
    """
    return client.post(f"{BASE}/auth/register", json={
        "full_name": "Alice Tester",
        "email": email,
        "phone": "09123456789",
        "password": password,
    })


def _login(client, email="alice@test.com", password="password123"):
    return client.post(f"{BASE}/auth/login", json={
        "email": email,
        "password": password,
    })


# ---------------------------------------------------------------------------
# 1. Register creates a user
# ---------------------------------------------------------------------------

def test_register_creates_user(client):
    """
    POST /auth/register with valid data must return HTTP 201 and include
    `user_id` and `email` in the response body.
    """
    resp = _register(client)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "user_id" in data
    assert data["email"] == "alice@test.com"
    assert "token" in data


# ---------------------------------------------------------------------------
# 2. Login returns a token
# ---------------------------------------------------------------------------

def test_login_returns_token(client):
    """
    After registering, POST /auth/login with correct credentials must return
    HTTP 200 and a non-empty `token`.
    """
    _register(client)
    resp = _login(client)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "token" in data
    assert len(data["token"]) > 10  # sanity check: token is a real JWT


# ---------------------------------------------------------------------------
# 3. Wrong password is rejected
# ---------------------------------------------------------------------------

def test_login_wrong_password_rejected(client):
    """
    Logging in with an incorrect password must return HTTP 401 Unauthorized.
    """
    _register(client)
    resp = _login(client, password="wrongpassword")
    assert resp.status_code == 401, resp.text


# ---------------------------------------------------------------------------
# 4. Protected route requires a token
# ---------------------------------------------------------------------------

def test_protected_route_requires_token(client):
    """
    GET /auth/me without an Authorization header must return HTTP 401.
    """
    resp = client.get(f"{BASE}/auth/me")
    assert resp.status_code == 401, resp.text


# ---------------------------------------------------------------------------
# 5. Customer cannot access a staff-only route
# ---------------------------------------------------------------------------

def test_customer_cannot_access_staff_route(client, auth_headers, create_vehicle, create_location):
    """
    A customer token must be rejected with HTTP 403 when calling a staff-only
    endpoint (PUT /bookings/{id}/confirm requires require_staff dependency).

    We create a booking as a customer, then the same customer tries to confirm
    it — only staff/manager may do that, so 403 is expected.
    """
    from datetime import date, timedelta

    location = create_location()
    vehicle = create_vehicle(location=location)
    customer_headers = auth_headers("customer")

    today = date.today()
    pickup = today + timedelta(days=10)
    return_date = pickup + timedelta(days=3)

    payload = {
        "vehicle_id": vehicle.id,
        "pickup_location_id": location.id,
        "return_location_id": location.id,
        "pickup_date": pickup.isoformat(),
        "return_date": return_date.isoformat(),
        "addons": [],
    }

    booking_resp = client.post(f"{BASE}/bookings", json=payload, headers=customer_headers)
    assert booking_resp.status_code == 201, booking_resp.text
    booking_id = booking_resp.json()["id"]

    # Customer tries to confirm their own booking — must get 403 (staff only)
    resp = client.put(f"{BASE}/bookings/{booking_id}/confirm", headers=customer_headers)
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# 6. Staff cannot access a manager-only route
# ---------------------------------------------------------------------------

def test_staff_cannot_access_manager_route(client, auth_headers):
    """
    A staff token must be rejected with HTTP 403 when calling a manager-only
    endpoint (GET /reports/revenue uses require_manager dependency).
    """
    staff_headers = auth_headers("staff")
    resp = client.get(f"{BASE}/reports/revenue", headers=staff_headers)
    assert resp.status_code == 403, resp.text
