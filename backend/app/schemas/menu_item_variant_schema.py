from decimal import Decimal
from pydantic import BaseModel, Field


# -----------------------------
# Base
# -----------------------------
class MenuItemVariantBase(BaseModel):
    name: str = Field(..., max_length=100, example="Medium")
    price_adjustment: Decimal = Field(0, example=40.00)
    is_default: bool = False


# -----------------------------
# Create
# -----------------------------
class MenuItemVariantCreate(MenuItemVariantBase):
    pass


# -----------------------------
# Update
# -----------------------------
class MenuItemVariantUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    price_adjustment: Decimal | None = None
    is_default: bool | None = None


# -----------------------------
# Read
# -----------------------------
class MenuItemVariantRead(MenuItemVariantBase):
    id: int
    item_id: int

    class Config:
        from_attributes = True
