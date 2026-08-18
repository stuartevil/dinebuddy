from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


class RecipeItemBase(BaseModel):
    ingredient_id: int
    quantity_used: Decimal = Field(..., gt=0, example=150.000)


class RecipeItemCreate(RecipeItemBase):
    pass


class RecipeItemRead(RecipeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: int
    menu_item_id: int
    ingredient_name: Optional[str] = None
    ingredient_unit: Optional[str] = None
    ingredient_cost_per_unit: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime


class RecipeBulkItem(BaseModel):
    ingredient_id: int
    quantity_used: Decimal = Field(..., gt=0)


class RecipeBulkSaveRequest(BaseModel):
    description: Optional[str] = None
    preparation_time_minutes: Optional[int] = None
    items: List[RecipeBulkItem] = []
