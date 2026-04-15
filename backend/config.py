"""
config.py
---------
Reads all configuration from environment variables.
Load a .env file locally; on Render, set these in the dashboard.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Central config object. Import `settings` everywhere instead of os.getenv."""

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@localhost/vehicle_rental",
    )

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    @property
    def database_url(self) -> str:
        """Return DATABASE_URL, ensuring the pymysql driver is used."""
        url = self.DATABASE_URL
        if url.startswith("mysql://"):
            url = "mysql+pymysql://" + url[len("mysql://"):]
        return url

    SECRET_KEY: str = os.getenv("SECRET_KEY")

    def __init__(self):
        if not self.SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY environment variable is not set. "
                "Set it to a long random string before starting the app."
            )

    # Minutes a JWT stays valid. Default = 24 hours.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24))
    )

    # Comma-separated list of allowed CORS origins.
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")
    ]

    ALGORITHM: str = "HS256"


settings = Settings()
