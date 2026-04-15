"""
schemas/user.py
---------------
Pydantic v2 schemas for user-related request and response bodies.
password_hash is never included in any response schema.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


# ── Request schemas ────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Fields a user can update on their own profile."""
    full_name: str | None = None
    phone: str | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


# ── Response schemas ───────────────────────────────────────────────────────────

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    role: str
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    """Returned after register or login."""
    token: str
    user: UserOut


class RegisterOut(BaseModel):
    user_id: int
    email: str
    role: str
    token: str
