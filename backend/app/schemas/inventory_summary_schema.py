from pydantic import BaseModel
from decimal import Decimal


class InventorySummaryRead(BaseModel):
    total_ingredients: int
    total_valuation: Decimal
    low_stock_count: int
    out_of_stock_count: int
