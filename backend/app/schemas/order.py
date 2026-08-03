from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    menu_item_id: int = Field(..., example=1)
    variant_id: Optional[int] = Field(None, example=1)
    quantity: int = Field(default=1, ge=1, example=2)
    special_instructions: Optional[str] = Field(None, example="Less spicy")


class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    variant_id: Optional[int] = None
    quantity: int
    unit_price: float
    total_price: float
    special_instructions: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]


class OrderResponse(BaseModel):
    id: int
    table_session_id: int
    order_number: str
    status: OrderStatus
    subtotal: float
    tax: float
    total: float
    items: List[OrderItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
