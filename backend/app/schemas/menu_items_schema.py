from typing import Optional
from pydantic import BaseModel, Field, condecimal, model_validator
from decimal import Decimal
from datetime import time
from pydantic import condecimal

PriceDecimal = condecimal(max_digits=10, decimal_places=2)

class MenuItemBase(BaseModel):
    category_id: int
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    price: PriceDecimal = Field(..., ge=0)
    image_url: Optional[str] = None
    is_available: bool = True
    is_vegetarian: bool = False
    preparation_time_minutes: Optional[int] = None
    available_from: Optional[time] = None
    available_to: Optional[time] = None

    @model_validator(mode='after')
    def validate_timing_fields(self):
        """Ensure available_from and available_to are both set or both None"""
        has_from = self.available_from is not None
        has_to = self.available_to is not None
        
        if has_from != has_to:
            raise ValueError(
                "available_from and available_to must be set together. "
                "Either both must be provided or both must be None."
            )
        
        return self


class MenuItemCreate(MenuItemBase):
    restaurant_id: Optional[int] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: PriceDecimal | None = Field(None, ge=0)
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    is_vegetarian: Optional[bool] = None
    preparation_time_minutes: Optional[int] = None
    restaurant_id: Optional[int] = None
    category_id: Optional[int] = None
    available_from: Optional[time] = None
    available_to: Optional[time] = None

    @model_validator(mode='after')
    def validate_timing_fields(self):
        """Ensure available_from and available_to are both set or both None"""
        # Only validate if at least one timing field is being updated
        has_from = self.available_from is not None
        has_to = self.available_to is not None
        
        # If neither is set, that's fine (they're optional updates)
        # If one is set but not the other, that's an error
        if has_from != has_to:
            raise ValueError(
                "available_from and available_to must be set together. "
                "Either both must be provided or both must be None."
            )
        
        return self


class MenuItemRead(MenuItemBase):
    id: int
    restaurant_id: Optional[int]

    class Config:
        from_attributes = True


class MenuItemAvailabilityUpdate(BaseModel):
    is_available: bool
    model_config = {"from_attributes": True}


class MenuItemTimingUpdate(BaseModel):
    available_from: Optional[time] = None
    available_to: Optional[time] = None

    @model_validator(mode='after')
    def validate_timing_fields(self):
        """Ensure available_from and available_to are both set or both None"""
        has_from = self.available_from is not None
        has_to = self.available_to is not None
        
        if has_from != has_to:
            raise ValueError(
                "available_from and available_to must be set together. "
                "Either both must be provided or both must be None."
            )
        
        return self
