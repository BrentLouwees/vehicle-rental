"""
database.py
-----------
Creates the SQLAlchemy engine and session factory.
All routes receive a DB session via the `get_db` dependency.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

# pool_pre_ping detects stale connections (important on Render where MySQL may
# close idle connections after a few minutes).
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,  # recycle connections every 30 minutes
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


def get_db():
    """
    FastAPI dependency that yields a database session and closes it afterwards.
    Usage in a route: `db: Session = Depends(get_db)`
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
