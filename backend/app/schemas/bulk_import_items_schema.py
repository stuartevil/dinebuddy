from pydantic import BaseModel
from typing import List, Optional


class MenuItemImportResponse(BaseModel):
    job_id: int
    status: str


class MenuItemImportJobRead(BaseModel):
    id: int
    restaurant_id: int
    status: str
    total_records: int
    success_count: int
    failed_count: int
    errors: list

    class Config:
        from_attributes = True
