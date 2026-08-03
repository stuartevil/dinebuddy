import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.models.restaurant import Restaurant
from app.models.restaurant_table import RestaurantTable
from app.models.table_session import TableSession, SessionStatus, PaymentMethod
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.ingredient import Ingredient
from app.models.recipe_item import RecipeItem
from app.schemas.sales_report_schema import ReportPeriod
from app.services import sales_report_service, inventory_service


@pytest.fixture
def db_session():
    """Create in-memory SQLite database session with seed data for reports."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # 1. Create Restaurant
    restaurant = Restaurant(name="Gourmet Bistro", slug="gourmet-bistro", phone="9876543210")
    db.add(restaurant)
    db.commit()

    # 2. Create Table & Session
    table = RestaurantTable(restaurant_id=1, table_number="T-01", capacity=4)
    db.add(table)
    db.commit()

    session = TableSession(
        restaurant_id=1,
        table_id=table.id,
        status=SessionStatus.PAID,
        payment_method=PaymentMethod.UPI,
        subtotal=450.0,
        tax=22.5,
        discount=10.0,
        total_amount=462.5,
        opened_at=datetime.utcnow(),
        closed_at=datetime.utcnow(),
    )

    db.add(session)
    db.commit()

    # 3. Create Categories & Menu Items
    cat = MenuCategory(name="Coffee", restaurant_id=1)
    db.add(cat)
    db.commit()

    item1 = MenuItem(name="Cappuccino", price=150.0, restaurant_id=1, category_id=cat.id)
    item2 = MenuItem(name="Espresso", price=100.0, restaurant_id=1, category_id=cat.id)
    db.add_all([item1, item2])
    db.commit()

    # 4. Create Ingredients & Recipe
    milk = inventory_service.create_ingredient(
        db, 1, inventory_service.IngredientCreate(name="Milk", unit="ml", current_stock_qty=Decimal("1000"), cost_per_unit=Decimal("0.05"))
    )
    beans = inventory_service.create_ingredient(
        db, 1, inventory_service.IngredientCreate(name="Beans", unit="g", current_stock_qty=Decimal("500"), cost_per_unit=Decimal("0.40"))
    )

    # 1 Cappuccino uses 150ml milk + 15g beans => COGS = (150*0.05) + (15*0.40) = 7.5 + 6 = 13.5
    inventory_service.create_or_update_recipe_item(
        db, 1, item1.id, inventory_service.RecipeItemCreate(ingredient_id=milk.id, quantity_used=Decimal("150"))
    )
    inventory_service.create_or_update_recipe_item(
        db, 1, item1.id, inventory_service.RecipeItemCreate(ingredient_id=beans.id, quantity_used=Decimal("15"))
    )

    # 5. Create Order: 2x Cappuccino (300.0), 1x Espresso (100.0) => Subtotal = 400.0, Tax = 20.0
    order = Order(
        table_session_id=session.id,
        order_number="ORD-REPORT-1",
        status=OrderStatus.SERVED,
        subtotal=400.0,
        tax=20.0,
        total=420.0,
    )
    db.add(order)
    db.commit()

    order_item1 = OrderItem(order_id=order.id, menu_item_id=item1.id, quantity=2, unit_price=150.0, total_price=300.0)
    order_item2 = OrderItem(order_id=order.id, menu_item_id=item2.id, quantity=1, unit_price=100.0, total_price=100.0)
    db.add_all([order_item1, order_item2])
    db.commit()

    yield db
    db.close()


def test_date_range_resolution():
    s_dt, e_dt = sales_report_service.resolve_date_range(ReportPeriod.TODAY)
    assert s_dt.date() == datetime.utcnow().date()
    assert e_dt.date() == datetime.utcnow().date()

    s_dt, e_dt = sales_report_service.resolve_date_range(
        ReportPeriod.CUSTOM, start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
    )
    assert s_dt.date() == date(2026, 1, 1)
    assert e_dt.date() == date(2026, 1, 31)



def test_sales_summary(db_session):
    summary = sales_report_service.get_sales_summary(db_session, restaurant_id=1, period=ReportPeriod.MONTHLY)

    assert summary.total_orders == 1
    assert summary.completed_orders == 1
    assert summary.gross_revenue == Decimal("400.00")
    assert summary.total_tax == Decimal("20.00")
    assert summary.total_discount == Decimal("10.00")
    assert summary.net_revenue == Decimal("410.00")
    assert summary.payment_method_breakdown.get("upi") == Decimal("420.0")



def test_top_selling_items(db_session):
    items = sales_report_service.get_top_selling_items(db_session, restaurant_id=1, period=ReportPeriod.MONTHLY)
    assert len(items) == 2
    assert items[0].menu_item_name == "Cappuccino"
    assert items[0].total_quantity_sold == 2
    assert items[0].total_revenue == Decimal("300.00")


def test_cogs_and_profitability(db_session):
    report = sales_report_service.get_cogs_profitability(db_session, restaurant_id=1, period=ReportPeriod.MONTHLY)
    assert report.net_sales == Decimal("410.00")
    # COGS for 2x Cappuccino = 2 * 13.5 = 27.00
    assert report.total_cogs == Decimal("27.00")
    assert report.gross_profit == Decimal("383.00")
    assert report.profit_margin_percentage > 90.0


def test_csv_export_generation(db_session):
    csv_text = sales_report_service.generate_sales_csv_report(db_session, restaurant_id=1, period=ReportPeriod.MONTHLY)
    assert "DINEBUDDY SALES & ANALYTICS REPORT" in csv_text
    assert "EXECUTIVE SUMMARY" in csv_text
    assert "Cappuccino" in csv_text
    assert "Gross Revenue" in csv_text
