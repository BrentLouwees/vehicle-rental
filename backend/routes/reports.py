"""
routes/reports.py
-----------------
Manager-only analytics endpoints.
All queries use aggregation SQL via session.execute() — rows are never
loaded into memory individually.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.reports import CustomerSpend, RevenueByType, RevenueReport, VehicleUtilization
from services.auth_service import require_manager

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/revenue", response_model=RevenueReport)
def revenue_report(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    location_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Total revenue, booking count, and breakdown by vehicle type.
    Filters: date range on pickup_date, and optionally a pickup location.
    Manager only.
    """
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")

    # Build dynamic WHERE clauses
    filters = ["b.status NOT IN ('cancelled', 'pending')"]
    params: dict = {}

    if from_date:
        filters.append("b.pickup_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        filters.append("b.pickup_date <= :to_date")
        params["to_date"] = to_date
    if location_id:
        filters.append("b.pickup_location_id = :location_id")
        params["location_id"] = location_id

    where = " AND ".join(filters)

    # Overall totals
    totals_sql = text(f"""
        SELECT
            COALESCE(SUM(b.total_amount), 0) AS total_revenue,
            COUNT(b.id) AS booking_count
        FROM bookings b
        WHERE {where}
    """)
    totals_row = db.execute(totals_sql, params).fetchone()

    # Breakdown by vehicle type
    by_type_sql = text(f"""
        SELECT
            v.type           AS vehicle_type,
            COALESCE(SUM(b.total_amount), 0) AS total_revenue,
            COUNT(b.id)      AS booking_count
        FROM bookings b
        JOIN vehicles v ON v.id = b.vehicle_id
        WHERE {where}
        GROUP BY v.type
    """)
    by_type_rows = db.execute(by_type_sql, params).fetchall()

    return RevenueReport(
        total_revenue=totals_row.total_revenue,
        booking_count=totals_row.booking_count,
        by_vehicle_type=[
            RevenueByType(
                vehicle_type=row.vehicle_type,
                total_revenue=row.total_revenue,
                booking_count=row.booking_count,
            )
            for row in by_type_rows
        ],
    )


@router.get("/vehicles", response_model=list[VehicleUtilization])
def vehicle_utilization_report(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Utilization report: total bookings, days rented, and revenue per vehicle.
    Manager only.
    """
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")

    filters = ["b.status NOT IN ('cancelled', 'pending')"]
    params: dict = {}

    if from_date:
        filters.append("b.pickup_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        filters.append("b.pickup_date <= :to_date")
        params["to_date"] = to_date

    where = " AND ".join(filters)

    sql = text(f"""
        SELECT
            v.id                          AS vehicle_id,
            v.brand,
            v.model,
            v.plate_number,
            COUNT(b.id)                   AS total_bookings,
            COALESCE(SUM(b.duration_days), 0)  AS total_days_rented,
            COALESCE(SUM(b.total_amount), 0)   AS total_revenue
        FROM vehicles v
        LEFT JOIN bookings b ON b.vehicle_id = v.id AND {where}
        GROUP BY v.id, v.brand, v.model, v.plate_number
        ORDER BY total_revenue DESC
    """)
    rows = db.execute(sql, params).fetchall()

    return [
        VehicleUtilization(
            vehicle_id=row.vehicle_id,
            brand=row.brand,
            model=row.model,
            plate_number=row.plate_number,
            total_bookings=row.total_bookings,
            total_days_rented=row.total_days_rented,
            total_revenue=row.total_revenue,
        )
        for row in rows
    ]


@router.get("/customers", response_model=list[CustomerSpend])
def customer_spend_report(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Top customers ranked by total spend.
    Manager only.
    """
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")

    filters = ["b.status NOT IN ('cancelled', 'pending')"]
    params: dict = {}

    if from_date:
        filters.append("b.pickup_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        filters.append("b.pickup_date <= :to_date")
        params["to_date"] = to_date

    where = " AND ".join(filters)

    sql = text(f"""
        SELECT
            u.id             AS customer_id,
            u.full_name,
            u.email,
            COUNT(b.id)      AS total_bookings,
            COALESCE(SUM(b.total_amount), 0) AS total_spent
        FROM users u
        JOIN bookings b ON b.customer_id = u.id AND {where}
        WHERE u.role = 'customer'
        GROUP BY u.id, u.full_name, u.email
        ORDER BY total_spent DESC
        LIMIT 50
    """)
    rows = db.execute(sql, params).fetchall()

    return [
        CustomerSpend(
            customer_id=row.customer_id,
            full_name=row.full_name,
            email=row.email,
            total_bookings=row.total_bookings,
            total_spent=row.total_spent,
        )
        for row in rows
    ]
