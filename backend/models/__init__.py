# Import all models here so Alembic and the seed script can discover them via Base.metadata.
from models.user import User
from models.location import Location
from models.vehicle import Vehicle
from models.booking import Booking, BookingAddon
from models.payment import Payment
from models.review import Review
