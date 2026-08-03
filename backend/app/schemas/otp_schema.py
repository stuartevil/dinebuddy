from pydantic import BaseModel, Field, field_validator
import re

PHONE_REGEX = r"^[6-9]\d{9}$"   # Indian mobile numbers (10 digits)


class OTPRequest(BaseModel):
    phone: str = Field(..., example="9876543210")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(PHONE_REGEX, v):
            raise ValueError("Invalid phone number format")
        return v


class OTPVerify(BaseModel):
    phone: str = Field(..., example="9876543210")
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(PHONE_REGEX, v):
            raise ValueError("Invalid phone number format")
        return v
