import enum
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime, date


class ReportPeriod(str, enum.Enum):
    TODAY = "today"
    YESTERDAY = "yesterday"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    LAST_MONTH = "last_month"
    YEARLY = "yearly"
    CUSTOM = "custom"


class SalesReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: ReportPeriod
    start_date: datetime
    end_date: datetime
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    gross_revenue: Decimal
    total_tax: Decimal
    total_discount: Decimal
    net_revenue: Decimal
    average_order_value: Decimal
    payment_method_breakdown: Dict[str, Decimal]  # e.g. {"CASH": 1200.00, "CARD": 500.00, "UPI": 850.00}


class ItemSalesPerformance(BaseModel):
    menu_item_id: int
    menu_item_name: str
    category_name: Optional[str] = None
    total_quantity_sold: int
    total_revenue: Decimal
    average_price: Decimal


class CategorySalesPerformance(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    total_items_sold: int
    total_revenue: Decimal
    sales_percentage: float  # Share of total sales (e.g. 35.5%)


class COGSProfitabilityReport(BaseModel):
    net_sales: Decimal
    total_cogs: Decimal  # Cost of Goods Sold based on raw ingredient costs
    gross_profit: Decimal  # Net Sales - COGS
    profit_margin_percentage: float  # (Gross Profit / Net Sales) * 100


class HourlySalesTrend(BaseModel):
    hour: int  # 0 to 23
    order_count: int
    total_sales: Decimal
