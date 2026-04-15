"""
tests/conftest.py
-----------------
Shared fixtures for the entire test suite.

Uses a dedicated MySQL database (vehicle_rental_test) — completely separate
from the production database — so tests never touch real data.

How isolation works:
  - All tables are created once when the test session starts.
  - After every test, all rows are deleted (TRUNCATE with FK checks disabled).
  - This gives each test a clean slate without recreating the schema each time.
"""

import sys
import os
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# SECRET_KEY must be set before importing the app (config.py raises
# RuntimeError at startup if it's missing).
# ---------------------------------------------------------------------------
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

# ---------------------------------------------------------------------------
# Make sure the backend root is on sys.path so imports match uvicorn's view.
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ---------------------------------------------------------------------------
# Import app components AFTER sys.path and SECRET_KEY are set.
# All model modules must be imported so Base.metadata knows every table.
# ---------------------------------------------------------------------------
from config import settings                       # noqa: E402
from database import Base, get_db                 # noqa: E402
from main import app                              # noqa: E402
from models.user import User                      # noqa: E402
from models.vehicle import Vehicle                # noqa: E402
from models.location import Location              # noqa: E402
from models.booking import Booking                # noqa: E402
from models.payment import Payment                # noqa: E402
from models.review import Review                  # noqa: E402
from services.auth_service import hash_password, create_access_token  # noqa: E402

# ---------------------------------------------------------------------------
# Build the test database URL by swapping the database name in the
# existing DATABASE_URL (keeps the same host/user/password).
# e.g. mysql+pymysql://root:password@localhost/vehicle_rental
#   →  mysql+pymysql://root:password@localhost/vehicle_rental_test
# ---------------------------------------------------------------------------
TEST_DB_NAME = "vehicle_rental_test"
_url_without_db = settings.DATABASE_URL.rsplit("/", 1)[0]
TEST_DB_URL = f"{_url_without_db}/{TEST_DB_NAME}"

# ---------------------------------------------------------------------------
# Create the test database if it doesn't already exist, then create tables.
# ---------------------------------------------------------------------------
_admin_engine = create_engine(
    f"{_url_without_db}/",
    isolation_level="AUTOCOMMIT",
)
with _admin_engine.connect() as conn:
    conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{TEST_DB_NAME}`"))
_admin_engine.dispose()

test_engine = create_engine(TEST_DB_URL)
Base.metadata.create_all(test_engine)

TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clear_all_tables():
    """Delete every row from every table. Called after each test."""
    with test_engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        conn.commit()


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    """Yield a database session; wipe all data after the test."""
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        _clear_all_tables()


@pytest.fixture()
def client(db):
    """
    FastAPI TestClient with get_db overridden to use the test MySQL session.
    No patching needed — real MySQL supports SELECT FOR UPDATE.
    """
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def create_user(db):
    """
    Factory: call create_user(role) to insert a user directly into the DB.
    Use this for staff/manager roles that the registration API won't create.
    """
    _counter = {"n": 0}

    def _factory(role: str = "customer") -> User:
        _counter["n"] += 1
        n = _counter["n"]
        user = User(
            full_name=f"Test User {n}",
            email=f"user{n}@test.com",
            phone=f"0912345{n:04d}",
            password_hash=hash_password("password123"),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _factory


@pytest.fixture()
def auth_headers(create_user):
    """Factory: returns Authorization headers for a user of the given role."""
    def _factory(role: str = "customer") -> dict:
        user = create_user(role)
        token = create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}

    return _factory


@pytest.fixture()
def create_location(db):
    """Factory: insert and return a Location row."""
    _counter = {"n": 0}

    def _factory(name: str | None = None) -> Location:
        _counter["n"] += 1
        n = _counter["n"]
        loc = Location(
            name=name or f"Branch {n}",
            address=f"{n} Test Street",
            city="Test City",
            phone=f"02-{n:07d}",
        )
        db.add(loc)
        db.commit()
        db.refresh(loc)
        return loc

    return _factory


@pytest.fixture()
def create_vehicle(db, create_location):
    """Factory: insert and return a Vehicle row (creates a location if none given)."""
    _counter = {"n": 0}

    def _factory(
        daily_rate: Decimal = Decimal("500.00"),
        status: str = "available",
        location: Location | None = None,
    ) -> Vehicle:
        _counter["n"] += 1
        n = _counter["n"]
        if location is None:
            location = create_location()
        v = Vehicle(
            location_id=location.id,
            type="car",
            brand="Toyota",
            model="Vios",
            year=2022,
            plate_number=f"TST-{n:04d}",
            color="White",
            seats=5,
            transmission="automatic",
            fuel_type="petrol",
            daily_rate=daily_rate,
            status=status,
        )
        db.add(v)
        db.commit()
        db.refresh(v)
        return v

    return _factory
