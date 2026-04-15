"""
routes/locations.py
-------------------
Public read of locations; create/update restricted to manager.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.location import Location
from models.user import User
from schemas.location import LocationCreate, LocationOut, LocationUpdate
from services.auth_service import require_manager

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    """Return all active locations."""
    return db.query(Location).filter(Location.is_active == True).all()


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    body: LocationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """Create a new rental location (manager only)."""
    location = Location(**body.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    body: LocationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """Update a location's details (manager only)."""
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(location, field, value)

    db.commit()
    db.refresh(location)
    return location
