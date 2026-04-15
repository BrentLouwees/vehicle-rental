"""
main.py
-------
Application entry point.
Creates the FastAPI app, configures CORS, and registers all routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import auth, bookings, locations, payments, reports, reviews, vehicles

app = FastAPI(
    title="Vehicle Rental API",
    version="1.0.0",
    description="Backend API for a car and motorcycle rental platform.",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allow the frontend origin(s) defined in the environment variable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,      prefix=PREFIX)
app.include_router(vehicles.router,  prefix=PREFIX)
app.include_router(locations.router, prefix=PREFIX)
app.include_router(bookings.router,  prefix=PREFIX)
app.include_router(payments.router,  prefix=PREFIX)
app.include_router(reviews.router,   prefix=PREFIX)
app.include_router(reports.router,   prefix=PREFIX)


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """Quick liveness probe used by Render and load balancers."""
    return {"status": "ok"}
