"""
database/seed.py
----------------
Populates the database with initial data for development and testing.
Safe to run multiple times — it skips inserts if data already exists.

Run from the backend/ directory:
    python database/seed.py
"""

import sys
import os

# Allow imports from the backend/ directory regardless of where the script is called from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
from models import User, Location, Vehicle  # registers all models with Base

from services.auth_service import hash_password


def seed():
    # Create tables if they don't exist yet (useful for a fresh database).
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        _seed_locations(db)
        _seed_users(db)
        _seed_vehicles(db)
        print("Seed completed successfully.")
    finally:
        db.close()


# ── Locations ──────────────────────────────────────────────────────────────────

def _seed_locations(db):
    locations_data = [
        {"name": "Downtown Branch",  "address": "123 Main Street",       "city": "Metro City",  "phone": "+1-555-0101"},
        {"name": "Airport Branch",   "address": "1 Airport Road, T2",    "city": "Metro City",  "phone": "+1-555-0102"},
        {"name": "Mall Branch",      "address": "456 Shopping Blvd",     "city": "Eastside",    "phone": "+1-555-0103"},
    ]

    for data in locations_data:
        exists = db.query(Location).filter(Location.name == data["name"]).first()
        if not exists:
            db.add(Location(**data))
            print(f"  + Location: {data['name']}")

    db.commit()


# ── Users ──────────────────────────────────────────────────────────────────────

def _seed_users(db):
    users_data = [
        # Managers
        {
            "full_name": "Admin Manager",
            "email": "manager@rental.com",
            "phone": "+1-555-1000",
            "password": "Manager123!",
            "role": "manager",
        },
        # Staff
        {
            "full_name": "Staff Member One",
            "email": "staff1@rental.com",
            "phone": "+1-555-1001",
            "password": "Staff123!",
            "role": "staff",
        },
        {
            "full_name": "Staff Member Two",
            "email": "staff2@rental.com",
            "phone": "+1-555-1002",
            "password": "Staff123!",
            "role": "staff",
        },
        # Customers
        {
            "full_name": "Alice Customer",
            "email": "customer1@test.com",
            "phone": "+1-555-2001",
            "password": "Customer123!",
            "role": "customer",
        },
        {
            "full_name": "Bob Customer",
            "email": "customer2@test.com",
            "phone": "+1-555-2002",
            "password": "Customer123!",
            "role": "customer",
        },
        {
            "full_name": "Carol Customer",
            "email": "customer3@test.com",
            "phone": "+1-555-2003",
            "password": "Customer123!",
            "role": "customer",
        },
        {
            "full_name": "David Customer",
            "email": "customer4@test.com",
            "phone": "+1-555-2004",
            "password": "Customer123!",
            "role": "customer",
        },
        {
            "full_name": "Eve Customer",
            "email": "customer5@test.com",
            "phone": "+1-555-2005",
            "password": "Customer123!",
            "role": "customer",
        },
    ]

    for data in users_data:
        exists = db.query(User).filter(User.email == data["email"]).first()
        if not exists:
            user = User(
                full_name=data["full_name"],
                email=data["email"],
                phone=data["phone"],
                password_hash=hash_password(data["password"]),
                role=data["role"],
            )
            db.add(user)
            print(f"  + User: {data['email']} ({data['role']})")

    db.commit()


# ── Vehicles ───────────────────────────────────────────────────────────────────

def _seed_vehicles(db):
    # Look up location IDs (created above, so they definitely exist by now)
    downtown = db.query(Location).filter(Location.name == "Downtown Branch").first()
    airport  = db.query(Location).filter(Location.name == "Airport Branch").first()
    mall     = db.query(Location).filter(Location.name == "Mall Branch").first()

    vehicles_data = [
        # Cars
        {
            "location_id": downtown.id,
            "type": "car",
            "brand": "Toyota",
            "model": "Camry",
            "year": 2022,
            "plate_number": "CAR-001",
            "color": "White",
            "seats": 5,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "55.00",
            "description": "Comfortable mid-size sedan, great for city driving.",
            "image_url": "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600",
        },
        {
            "location_id": downtown.id,
            "type": "car",
            "brand": "Honda",
            "model": "CR-V",
            "year": 2023,
            "plate_number": "CAR-002",
            "color": "Silver",
            "seats": 5,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "70.00",
            "description": "Spacious SUV with excellent fuel economy.",
            "image_url": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600",
        },
        {
            "location_id": airport.id,
            "type": "car",
            "brand": "BMW",
            "model": "3 Series",
            "year": 2023,
            "plate_number": "CAR-003",
            "color": "Black",
            "seats": 5,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "120.00",
            "description": "Premium sedan with sport package.",
            "image_url": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600",
        },
        {
            "location_id": airport.id,
            "type": "car",
            "brand": "Ford",
            "model": "Ranger",
            "year": 2022,
            "plate_number": "CAR-004",
            "color": "Red",
            "seats": 5,
            "transmission": "manual",
            "fuel_type": "petrol",
            "daily_rate": "95.00",
            "description": "Rugged pickup truck, perfect for adventure and hauling.",
            "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
        },
        {
            "location_id": mall.id,
            "type": "car",
            "brand": "Toyota",
            "model": "Fortuner",
            "year": 2023,
            "plate_number": "CAR-005",
            "color": "Blue",
            "seats": 7,
            "transmission": "automatic",
            "fuel_type": "diesel",
            "daily_rate": "60.00",
            "description": "Capable SUV with 7-seat capacity, ideal for family trips.",
            "image_url": "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600",
        },
        {
            "location_id": mall.id,
            "type": "car",
            "brand": "Mitsubishi",
            "model": "Xpander",
            "year": 2022,
            "plate_number": "CAR-006",
            "color": "Grey",
            "seats": 7,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "50.00",
            "description": "Spacious MPV with modern features and ample cargo room.",
            "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600",
        },
        # Motorcycles
        {
            "location_id": downtown.id,
            "type": "motorcycle",
            "brand": "Honda",
            "model": "Click 125i",
            "year": 2022,
            "plate_number": "MOTO-001",
            "color": "Red",
            "seats": None,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "35.00",
            "description": "Popular commuter scooter, fuel-efficient and easy to ride.",
            "image_url": "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600",
        },
        {
            "location_id": airport.id,
            "type": "motorcycle",
            "brand": "Yamaha",
            "model": "NMAX 155",
            "year": 2023,
            "plate_number": "MOTO-002",
            "color": "Black",
            "seats": None,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "45.00",
            "description": "Stylish maxi-scooter with sporty performance.",
            "image_url": "https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=600",
        },
        {
            "location_id": mall.id,
            "type": "motorcycle",
            "brand": "Kawasaki",
            "model": "KLX 150",
            "year": 2022,
            "plate_number": "MOTO-003",
            "color": "Green",
            "seats": None,
            "transmission": "manual",
            "fuel_type": "petrol",
            "daily_rate": "40.00",
            "description": "Trail bike ideal for both off-road adventures and city use.",
            "image_url": "https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=600",
        },
        {
            "location_id": downtown.id,
            "type": "motorcycle",
            "brand": "Vespa",
            "model": "GTS 300",
            "year": 2023,
            "plate_number": "MOTO-004",
            "color": "Cream",
            "seats": None,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "daily_rate": "30.00",
            "description": "Classic Italian scooter, automatic and easy to ride.",
            "image_url": "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600",
        },
    ]

    # Map plate numbers to image URLs for updating existing records
    image_url_map = {data["plate_number"]: data["image_url"] for data in vehicles_data}

    for data in vehicles_data:
        exists = db.query(Vehicle).filter(Vehicle.plate_number == data["plate_number"]).first()
        if not exists:
            db.add(Vehicle(**data))
            print(f"  + Vehicle: {data['brand']} {data['model']} ({data['plate_number']})")

    db.commit()

    # Update image_url for all vehicles (so re-running seed refreshes images)
    for plate, url in image_url_map.items():
        vehicle = db.query(Vehicle).filter(Vehicle.plate_number == plate).first()
        if vehicle and vehicle.image_url != url:
            vehicle.image_url = url
            print(f"  ~ Updated image: {plate}")

    db.commit()


if __name__ == "__main__":
    seed()
