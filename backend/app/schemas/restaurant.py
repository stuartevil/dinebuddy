from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from app.utils.validators import validate_business_hours_format

class RestaurantCreateRequest(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    timezone: Optional[str] = "Asia/Kolkata"
    currency: Optional[str] = "INR"
    business_hours: Optional[dict] = None
    description: Optional[str] = None
    cuisine_type: Optional[str] = None
    is_active: Optional[bool] = True
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_password: Optional[str] = None

    @field_validator('business_hours')
    @classmethod
    def validate_business_hours(cls, v):
        return validate_business_hours_format(v)


class RestaurantUpdateRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    business_hours: Optional[dict] = None
    description: Optional[str] = None
    cuisine_type: Optional[str] = None

    @field_validator('business_hours')
    @classmethod
    def validate_business_hours(cls, v):
        return validate_business_hours_format(v)


class RestaurantProfileUpdateRequest(BaseModel):
    """Schema for updating restaurant profile (business_hours, description, cuisine_type)"""
    business_hours: Optional[dict] = None
    description: Optional[str] = None
    cuisine_type: Optional[str] = None

    @field_validator('business_hours')
    @classmethod
    def validate_business_hours(cls, v):
        return validate_business_hours_format(v)


class RestaurantRead(BaseModel):
    id: int
    name: str
    slug: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    timezone: Optional[str] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    cuisine_type: Optional[str] = None

    class Config:
        from_attributes = True

class RestaurantResponse(BaseModel):
    status: bool
    message: str
    data: RestaurantRead


class RestaurantListResponse(BaseModel):
    status: bool
    message: str
    data: List[RestaurantRead]
    meta: Dict[str, int]


class RestaurantDetailResponse(BaseModel):
    status: bool
    message: str
    data: Optional[RestaurantRead] = None


class RestaurantStaffAddRequest(BaseModel):
    """Request body to add a staff user to a restaurant"""
    user_id: int
