from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.restaurant_table import TableStatus


class TableBase(BaseModel):
    table_number: str = Field(..., example="Table 1")
    capacity: int = Field(default=4, ge=1, example=4)


class TableCreate(TableBase):
    restaurant_id: int = Field(..., example=1)


class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[TableStatus] = None


class TableResponse(TableBase):
    id: int
    restaurant_id: int
    status: TableStatus
    qr_code_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
