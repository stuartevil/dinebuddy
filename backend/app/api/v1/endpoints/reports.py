from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, check_restaurant_access
from app.models.user import User
from app.schemas.sales_report_schema import (
    ReportPeriod,
    SalesReportSummary,
    ItemSalesPerformance,
    CategorySalesPerformance,
    COGSProfitabilityReport,
    HourlySalesTrend,
)
from app.services import sales_report_service

router = APIRouter(
    prefix="/restaurants/{restaurant_id}/reports",
    tags=["Sales Reports & Analytics"],
)


@router.get(
    "/sales-summary",
    response_model=SalesReportSummary,
    summary="Get revenue and sales summary report",
)
def get_sales_summary(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY, description="Period preset (today, yesterday, weekly, monthly, last_month, yearly, custom)"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD) for custom period"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD) for custom period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve comprehensive sales summary including gross/net revenue, order counts, tax, discounts, and payment methods."""
    check_restaurant_access(restaurant_id, current_user, db)
    return sales_report_service.get_sales_summary(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )



@router.get(
    "/top-items",
    response_model=List[ItemSalesPerformance],
    summary="Get top-selling dishes performance",
)
def get_top_selling_items(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY, description="Period preset"),
    start_date: Optional[date] = Query(None, description="Start date for custom period"),
    end_date: Optional[date] = Query(None, description="End date for custom period"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rank menu items by quantity sold and revenue generated."""
    check_restaurant_access(restaurant_id, current_user, db)
    return sales_report_service.get_top_selling_items(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get(
    "/category-performance",
    response_model=List[CategorySalesPerformance],
    summary="Get category-wise sales distribution",
)
def get_category_sales(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get category-wise revenue breakdown and sales percentage distribution."""
    check_restaurant_access(restaurant_id, current_user, db)
    return sales_report_service.get_category_sales(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/profitability",
    response_model=COGSProfitabilityReport,
    summary="Get COGS & profit margin analysis",
)
def get_cogs_profitability(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate Cost of Goods Sold (COGS) based on raw ingredient recipes and estimated gross profit margin."""
    check_restaurant_access(restaurant_id, current_user, db)
    return sales_report_service.get_cogs_profitability(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/hourly-trends",
    response_model=List[HourlySalesTrend],
    summary="Get hourly sales trend (Rush hours analysis)",
)
def get_hourly_sales_trend(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze sales distribution across hours of the day (0-23) to identify rush hours."""
    check_restaurant_access(restaurant_id, current_user, db)
    return sales_report_service.get_hourly_sales_trend(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/export/csv",
    summary="Download sales report as CSV file",
)
def export_sales_csv_report(
    restaurant_id: int,
    period: ReportPeriod = Query(ReportPeriod.MONTHLY),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download itemized sales report, revenue summary, and profitability in CSV format."""
    check_restaurant_access(restaurant_id, current_user, db)
    csv_data = sales_report_service.generate_sales_csv_report(
        db=db,
        restaurant_id=restaurant_id,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    filename = f"dinebuddy_sales_report_{period.value}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

