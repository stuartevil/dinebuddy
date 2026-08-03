from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    role: UserRole

    @field_validator("password")
    @classmethod
    def check_password_bytes(cls, value: str) -> str:
        byte_len = len(value.encode("utf-8"))
        if byte_len > 72:
            raise ValueError(
                f"Password too long: {byte_len} bytes. Max allowed is 72 bytes."
            )
        return value


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True  # Pydantic v2 (better than orm_mode)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
