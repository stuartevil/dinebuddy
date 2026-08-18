from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal


class AddonOptionBase(BaseModel):
    name: str
    price: Decimal = Decimal("0.00")
    is_available: bool = True


class AddonOptionCreate(AddonOptionBase):
    pass


class AddonOptionUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[Decimal] = None
    is_available: Optional[bool] = None


class AddonOptionRead(AddonOptionBase):
    id: int
    group_id: int

    class Config:
        from_attributes = True


class AddonGroupBase(BaseModel):
    name: str
    min_selectable: int = 0
    max_selectable: int = 10
    is_active: bool = True


class AddonGroupCreate(AddonGroupBase):
    options: Optional[List[AddonOptionCreate]] = []
    category_ids: Optional[List[int]] = []


class AddonGroupUpdate(BaseModel):
    name: Optional[str] = None
    min_selectable: Optional[int] = None
    max_selectable: Optional[int] = None
    is_active: Optional[bool] = None
    category_ids: Optional[List[int]] = None


class AddonGroupRead(AddonGroupBase):
    id: int
    restaurant_id: int
    options: List[AddonOptionRead] = []
    category_ids: List[int] = []

    class Config:
        from_attributes = True


class AttachAddonGroupsToItem(BaseModel):
    group_ids: List[int]


class AttachAddonGroupsToCategory(BaseModel):
    group_ids: List[int]


class AttachCategoriesToAddonGroup(BaseModel):
    category_ids: List[int]

