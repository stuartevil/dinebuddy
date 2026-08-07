import csv
import io
from datetime import datetime, date, time, timedelta
from typing import Optional, List, Tuple, Dict
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table_session import TableSession, SessionStatus, PaymentMethod
from app.models.menu_items import MenuItem
from app.models.menu_category import MenuCategory
from app.models.recipe_item import RecipeItem
from app.models.ingredient import Ingredient
from app.schemas.sales_report_schema import (
    ReportPeriod,
    SalesReportSummary,
    ItemSalesPerformance,
    CategorySalesPerformance,
    COGSProfitabilityReport,
    HourlySalesTrend,
)


def resolve_date_range(
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Tuple[datetime, datetime]:
    now = datetime.utcnow()
    today_start = datetime.combine(now.date(), time.min)
    today_end = datetime.combine(now.date(), time.max)

    if period == ReportPeriod.TODAY:
        return today_start, today_end
    elif period == ReportPeriod.YESTERDAY:
        yesterday_date = now.date() - timedelta(days=1)
        return datetime.combine(yesterday_date, time.min), datetime.combine(yesterday_date, time.max)
    elif period == ReportPeriod.WEEKLY:
        week_start = today_start - timedelta(days=7)
        return week_start, today_end
    elif period == ReportPeriod.MONTHLY:
        month_start = datetime(now.year, now.month, 1, 0, 0, 0)
        return month_start, today_end
    elif period == ReportPeriod.LAST_MONTH:
        first_this_month = datetime(now.year, now.month, 1)
        last_month_end = first_this_month - timedelta(seconds=1)
        last_month_start = datetime(last_month_end.year, last_month_end.month, 1, 0, 0, 0)
        return last_month_start, last_month_end
    elif period == ReportPeriod.YEARLY:
        year_start = datetime(now.year, 1, 1, 0, 0, 0)
        return year_start, today_end
    elif period == ReportPeriod.CUSTOM:
        s_dt = datetime.combine(start_date, time.min) if start_date else datetime(now.year, now.month, 1)
        e_dt = datetime.combine(end_date, time.max) if end_date else today_end
        return s_dt, e_dt
    else:
        month_start = datetime(now.year, now.month, 1, 0, 0, 0)
        return month_start, today_end


def get_sales_summary(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> SalesReportSummary:
    start_dt, end_dt = resolve_date_range(period, start_date, end_date)

    orders_query = db.query(Order).join(TableSession, Order.table_session_id == TableSession.id).filter(
        TableSession.restaurant_id == restaurant_id,
        Order.created_at >= start_dt,
        Order.created_at <= end_dt,
    )

    all_orders = orders_query.all()

    total_orders = len(all_orders)
    completed_orders = 0
    cancelled_orders = 0
    gross_rev = 0.0
    total_tax = 0.0
    total_discount = 0.0

    payment_methods: Dict[str, float] = {}

    for order in all_orders:
        if order.status == OrderStatus.CANCELLED:
            cancelled_orders += 1
            continue

        completed_orders += 1
        gross_rev += float(order.subtotal or 0.0)
        total_tax += float(order.tax or 0.0)

        # Payment method breakdown from session
        session = order.session
        pm = session.payment_method.value if (session and session.payment_method) else "UNPAID"
        payment_methods[pm] = payment_methods.get(pm, 0.0) + float(order.total or 0.0)
        
        if session and session.discount:
            total_discount += float(session.discount or 0.0)

    net_rev = max(0.0, gross_rev + total_tax - total_discount)
    aov = (net_rev / completed_orders) if completed_orders > 0 else 0.0

    return SalesReportSummary(
        period=period,
        start_date=start_dt,
        end_date=end_dt,
        total_orders=total_orders,
        completed_orders=completed_orders,
        cancelled_orders=cancelled_orders,
        gross_revenue=Decimal(str(round(gross_rev, 2))),
        total_tax=Decimal(str(round(total_tax, 2))),
        total_discount=Decimal(str(round(total_discount, 2))),
        net_revenue=Decimal(str(round(net_rev, 2))),
        average_order_value=Decimal(str(round(aov, 2))),
        payment_method_breakdown={k: Decimal(str(round(v, 2))) for k, v in payment_methods.items()},
    )


def get_top_selling_items(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 10,
) -> List[ItemSalesPerformance]:
    start_dt, end_dt = resolve_date_range(period, start_date, end_date)

    query = (
        db.query(
            OrderItem.menu_item_id,
            MenuItem.name.label("menu_item_name"),
            MenuCategory.name.label("category_name"),
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.total_price).label("total_rev"),
            func.avg(OrderItem.unit_price).label("avg_price"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(TableSession, Order.table_session_id == TableSession.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .outerjoin(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .group_by(OrderItem.menu_item_id, MenuItem.name, MenuCategory.name)
        .order_by(func.sum(OrderItem.total_price).desc())
        .limit(limit)
    )

    results = query.all()
    output = []
    for row in results:
        qty = int(row.total_qty or 0)
        output.append(
            ItemSalesPerformance(
                menu_item_id=row.menu_item_id,
                menu_item_name=row.menu_item_name or f"Item #{row.menu_item_id}",
                item_name=row.menu_item_name or f"Item #{row.menu_item_id}",
                category_name=row.category_name,
                total_quantity_sold=qty,
                quantity_sold=qty,
                total_revenue=Decimal(str(round(row.total_rev or 0.0, 2))),
                average_price=Decimal(str(round(row.avg_price or 0.0, 2))),
            )
        )
    return output


def get_category_sales(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[CategorySalesPerformance]:
    start_dt, end_dt = resolve_date_range(period, start_date, end_date)

    query = (
        db.query(
            MenuItem.category_id,
            MenuCategory.name.label("category_name"),
            func.sum(OrderItem.quantity).label("total_items"),
            func.sum(OrderItem.total_price).label("total_rev"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(TableSession, Order.table_session_id == TableSession.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .outerjoin(MenuCategory, MenuItem.category_id == MenuCategory.id)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .group_by(MenuItem.category_id, MenuCategory.name)
        .order_by(func.sum(OrderItem.total_price).desc())
    )

    results = query.all()
    grand_total_sales = sum(float(r.total_rev or 0.0) for r in results)

    output = []
    for row in results:
        rev = float(row.total_rev or 0.0)
        percentage = round((rev / grand_total_sales * 100.0), 2) if grand_total_sales > 0 else 0.0
        output.append(
            CategorySalesPerformance(
                category_id=row.category_id,
                category_name=row.category_name or "Uncategorized",
                total_items_sold=int(row.total_items or 0),
                total_revenue=Decimal(str(round(rev, 2))),
                sales_percentage=percentage,
            )
        )
    return output


def get_cogs_profitability(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> COGSProfitabilityReport:
    summary = get_sales_summary(db, restaurant_id, period, start_date, end_date)
    start_dt, end_dt = resolve_date_range(period, start_date, end_date)

    # Fetch all sold items in period
    order_items = (
        db.query(OrderItem.menu_item_id, func.sum(OrderItem.quantity).label("qty_sold"))
        .join(Order, OrderItem.order_id == Order.id)
        .join(TableSession, Order.table_session_id == TableSession.id)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .group_by(OrderItem.menu_item_id)
        .all()
    )

    total_cogs = Decimal("0.00")

    for menu_item_id, qty_sold in order_items:
        recipes = db.query(RecipeItem, Ingredient.cost_per_unit).join(
            Ingredient, RecipeItem.ingredient_id == Ingredient.id
        ).filter(
            RecipeItem.restaurant_id == restaurant_id,
            RecipeItem.menu_item_id == menu_item_id,
        ).all()

        for recipe, ing_cost in recipes:
            used_qty = Decimal(str(recipe.quantity_used or 0))
            cost = Decimal(str(ing_cost or 0))
            total_cogs += used_qty * Decimal(str(qty_sold or 0)) * cost

    net_sales = summary.net_revenue
    gross_profit = net_sales - total_cogs
    profit_margin_pct = float(round((gross_profit / net_sales * Decimal("100.0")), 2)) if net_sales > Decimal("0") else 0.0

    return COGSProfitabilityReport(
        net_sales=net_sales,
        total_cogs=total_cogs,
        gross_profit=gross_profit,
        profit_margin_percentage=profit_margin_pct,
    )


def get_hourly_sales_trend(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[HourlySalesTrend]:
    start_dt, end_dt = resolve_date_range(period, start_date, end_date)

    results = (
        db.query(
            extract("hour", Order.created_at).label("hour_num"),
            func.count(Order.id).label("cnt"),
            func.sum(Order.total).label("sum_total"),
        )
        .join(TableSession, Order.table_session_id == TableSession.id)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .group_by(extract("hour", Order.created_at))
        .all()
    )

    hourly_map = {int(r.hour_num): (int(r.cnt), Decimal(str(round(r.sum_total or 0.0, 2)))) for r in results if r.hour_num is not None}

    output = []
    for h in range(24):
        cnt, total = hourly_map.get(h, (0, Decimal("0.00")))
        output.append(HourlySalesTrend(hour=h, order_count=cnt, total_sales=total))

    return output


def generate_sales_csv_report(
    db: Session,
    restaurant_id: int,
    period: ReportPeriod = ReportPeriod.MONTHLY,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> str:
    summary = get_sales_summary(db, restaurant_id, period, start_date, end_date)
    top_items = get_top_selling_items(db, restaurant_id, period, start_date, end_date, limit=50)
    profitability = get_cogs_profitability(db, restaurant_id, period, start_date, end_date)

    output = io.StringIO()
    writer = csv.writer(output)

    # 1. Header
    writer.writerow(["DINEBUDDY SALES & ANALYTICS REPORT"])
    writer.writerow(["Report Period", summary.period.value])
    writer.writerow(["Start Date", summary.start_date.strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow(["End Date", summary.end_date.strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])

    # 2. Executive Summary
    writer.writerow(["EXECUTIVE SUMMARY"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Orders", summary.total_orders])
    writer.writerow(["Completed Orders", summary.completed_orders])
    writer.writerow(["Cancelled Orders", summary.cancelled_orders])
    writer.writerow(["Gross Revenue", f"{summary.gross_revenue:.2f}"])
    writer.writerow(["Total Tax", f"{summary.total_tax:.2f}"])
    writer.writerow(["Total Discounts", f"{summary.total_discount:.2f}"])
    writer.writerow(["Net Revenue", f"{summary.net_revenue:.2f}"])
    writer.writerow(["Average Order Value (AOV)", f"{summary.average_order_value:.2f}"])
    writer.writerow(["Estimated COGS (Raw Materials)", f"{profitability.total_cogs:.2f}"])
    writer.writerow(["Gross Profit", f"{profitability.gross_profit:.2f}"])
    writer.writerow(["Profit Margin %", f"{profitability.profit_margin_percentage:.2f}%"])
    writer.writerow([])

    # 3. Payment Method Breakdown
    writer.writerow(["PAYMENT METHOD BREAKDOWN"])
    writer.writerow(["Method", "Total Collected"])
    for method, amt in summary.payment_method_breakdown.items():
        writer.writerow([method, f"{amt:.2f}"])
    writer.writerow([])

    # 4. Itemized Sales Performance
    writer.writerow(["TOP SELLING ITEMS"])
    writer.writerow(["Item ID", "Item Name", "Category", "Qty Sold", "Avg Price", "Total Revenue"])
    for item in top_items:
        writer.writerow([
            item.menu_item_id,
            item.menu_item_name,
            item.category_name or "Uncategorized",
            item.total_quantity_sold,
            f"{item.average_price:.2f}",
            f"{item.total_revenue:.2f}",
        ])

    return output.getvalue()
