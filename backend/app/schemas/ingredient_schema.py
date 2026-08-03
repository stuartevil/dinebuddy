from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime, date


class IngredientBase(BaseModel):
    name: str = Field(..., max_length=255, example="Milk")
    category: Optional[str] = Field(None, max_length=100, example="Dairy")
    unit: str = Field(..., max_length=50, example="litre")
    current_stock_qty: Decimal = Field(default=Decimal("0.000"), ge=0)
    reorder_threshold: Decimal = Field(default=Decimal("0.000"), ge=0)
    reorder_qty: Decimal = Field(default=Decimal("0.000"), ge=0)
    cost_per_unit: Decimal = Field(default=Decimal("0.00"), ge=0)
    supplier_name: Optional[str] = Field(None, max_length=255)
    supplier_contact: Optional[str] = Field(None, max_length=255)
    track_expiry: bool = False
    expiry_date: Optional[date] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    current_stock_qty: Optional[Decimal] = Field(None, ge=0)
    reorder_threshold: Optional[Decimal] = Field(None, ge=0)
    reorder_qty: Optional[Decimal] = Field(None, ge=0)
    cost_per_unit: Optional[Decimal] = Field(None, ge=0)
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    track_expiry: Optional[bool] = None
    expiry_date: Optional[date] = None


class IngredientRead(IngredientBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    is_low_stock: bool = False
    is_out_of_stock: bool = False
    total_valuation: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime


class IngredientThresholdUpdate(BaseModel):
    reorder_threshold: Decimal = Field(..., ge=0, example=5.0, description="Minimum stock level that triggers an alert")
    reorder_qty: Optional[Decimal] = Field(None, ge=0, example=10.0, description="Suggested amount to reorder")


class StockAlertItem(BaseModel):
    ingredient_id: int
    ingredient_name: str
    category: Optional[str] = None
    unit: str
    current_stock_qty: Decimal
    reorder_threshold: Decimal
    severity: str  # "CRITICAL" (out of stock) or "WARNING" (low stock)
    alert_message: str
    suggested_reorder_qty: Decimal
