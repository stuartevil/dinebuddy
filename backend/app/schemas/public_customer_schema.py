from typing import List, Optional
from pydantic import BaseModel, Field


class PublicTableSchema(BaseModel):
    id: int
    table_number: str
    capacity: int
    status: str
    restaurant_id: int


class PublicRestaurantSchema(BaseModel):
    id: int
    name: str
    logo_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class PublicCategorySchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_global: bool


class PublicMenuItemSchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_veg: bool
    category_id: Optional[int] = None


class PublicTableInfoResponse(BaseModel):
    table: PublicTableSchema
    restaurant: PublicRestaurantSchema
    categories: List[PublicCategorySchema]
    menu_items: List[PublicMenuItemSchema]


class PublicCustomerOrderItem(BaseModel):
    menu_item_id: int
    quantity: int = Field(gt=0, description="Quantity must be greater than 0")
    special_instructions: Optional[str] = None


class PublicCustomerOrderPayload(BaseModel):
    items: List[PublicCustomerOrderItem]
    phone: Optional[str] = None
    name: Optional[str] = None
