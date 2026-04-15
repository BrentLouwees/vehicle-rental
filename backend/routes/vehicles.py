"""
routes/vehicles.py
------------------
Vehicle CRUD and availability search.
Public: GET list (with availability filter), GET single vehicle.
Staff/manager: POST, PUT.
Manager only: DELETE (soft delete to maintenance).
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.booking import Booking
from models.review import Review
from models.user import User
from models.vehicle import Vehicle
from schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate
from services.auth_service import get_current_user, require_manager, require_staff

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    type: str | None = Query(None),
    location_id: int | None = Query(None),
    pickup_date: date | None = Query(None),
    return_date: date | None = Query(None),
    min_price: Decimal | None = Query(None),
    max_price: Decimal | None = Query(None),
    transmission: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    List vehicles with optional filters.
    When pickup_date and return_date are provided, only vehicles with no
    conflicting confirmed/active/pending bookings are returned.
    """
    query = db.query(Vehicle).filter(Vehicle.status != "maintenance")

    if type:
        query = query.filter(Vehicle.type == type)
    if location_id:
        query = query.filter(Vehicle.location_id == location_id)
    if transmission:
        query = query.filter(Vehicle.transmission == transmission)
    if min_price is not None:
        query = query.filter(Vehicle.daily_rate >= min_price)
    if max_price is not None:
        query = query.filter(Vehicle.daily_rate <= max_price)

    # Date-range availability filter
    if pickup_date and return_date:
        if return_date <= pickup_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="return_date must be after pickup_date",
            )
        # Exclude vehicle IDs that have a conflicting booking
        conflicting = (
            db.query(Booking.vehicle_id)
            .filter(
                Booking.pickup_date < return_date,
                Booking.return_date > pickup_date,
                Booking.status.notin_(["cancelled"]),
            )
            .subquery()
        )
        query = query.filter(Vehicle.id.notin_(conflicting))

    vehicles = query.all()

    # Attach average rating to each vehicle
    result = []
    for v in vehicles:
        avg = (
            db.query(func.avg(Review.rating))
            .filter(Review.vehicle_id == v.id)
            .scalar()
        )
        out = VehicleOut.model_validate(v)
        out.avg_rating = round(float(avg), 2) if avg else None
        result.append(out)

    return result


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """Return a single vehicle with its average rating."""
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    avg = (
        db.query(func.avg(Review.rating))
        .filter(Review.vehicle_id == vehicle_id)
        .scalar()
    )
    out = VehicleOut.model_validate(vehicle)
    out.avg_rating = round(float(avg), 2) if avg else None
    return out


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Create a new vehicle record (staff or manager)."""
    vehicle = Vehicle(**body.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return VehicleOut.model_validate(vehicle)


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Update vehicle details (staff or manager)."""
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)
    return VehicleOut.model_validate(vehicle)


@router.delete("/{vehicle_id}", status_code=status.HTTP_200_OK)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Soft-delete a vehicle by setting its status to 'maintenance'.
    Hard deletes are not allowed because booking history references the vehicle.
    """
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    vehicle.status = "maintenance"
    db.commit()
    return {"detail": "Vehicle removed from service"}
