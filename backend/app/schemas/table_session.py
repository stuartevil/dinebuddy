from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.table_session import SessionStatus, PaymentMethod
from app.schemas.order import OrderResponse


class SessionCreate(BaseModel):
    customer_id: Optional[int] = None


class CheckoutRequest(BaseModel):
    payment_method: PaymentMethod = Field(default=PaymentMethod.CASH)
    discount: float = Field(default=0.0, ge=0.0)
    payment_notes: Optional[str] = None


class TableSessionResponse(BaseModel):
    id: int
    restaurant_id: int
    table_id: int
    customer_id: Optional[int] = None
    status: SessionStatus
    subtotal: float
    tax: float
    discount: float
    total_amount: float
    payment_method: Optional[PaymentMethod] = None
    payment_notes: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    orders: List[OrderResponse] = []

    class Config:
        from_attributes = True


class LiveBillItemSummary(BaseModel):
    menu_item_id: int
    item_name: str
    variant_name: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float
    special_instructions: Optional[str] = None


class LiveBillSummary(BaseModel):
    session_id: int
    table_id: int
    table_number: str
    status: SessionStatus
    total_orders_count: int
    items_summary: List[LiveBillItemSummary]
    subtotal: float
    tax: float
    discount: float
    round_off: float = 0.0
    total_amount: float
    opened_at: datetime
