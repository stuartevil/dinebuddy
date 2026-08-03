from pydantic import BaseModel, Field
from typing import Optional

class RestaurantSettingsRead(BaseModel):
    tax_percentage: Optional[float] = None
    service_charge: Optional[float] = None
    auto_accept_orders: bool
    order_preparation_time: Optional[int] = None

    class Config:
        from_attributes = True

class RestaurantRead(BaseModel):
    # existing fields...
    settings: Optional[RestaurantSettingsRead] = None


class RestaurantSettingsUpdateRequest(BaseModel):
    tax_percentage: Optional[float] = Field(None, ge=0, le=100)
    service_charge: Optional[float] = Field(None, ge=0, le=100)
    auto_accept_orders: Optional[bool] = None
    order_preparation_time: Optional[int] = Field(None, ge=1, le=240)