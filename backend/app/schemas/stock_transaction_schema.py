from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.stock_transaction import TransactionType


class StockTransactionCreate(BaseModel):
    ingredient_id: int
    type: TransactionType
    quantity: Decimal = Field(..., example=10.5)  # Positive for Purchase/Add, negative for Wastage/Deduction
    reference_id: Optional[str] = None
    notes: Optional[str] = None


class StockTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    ingredient_id: int
    ingredient_name: Optional[str] = None
    type: TransactionType
    quantity: Decimal
    stock_after: Decimal
    reference_id: Optional[str] = None
    staff_id: Optional[int] = None
    notes: Optional[str] = None
    alert_triggered: bool = False
    alert_message: Optional[str] = None
    created_at: datetime
