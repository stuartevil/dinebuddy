import pytest
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.models.restaurant import Restaurant
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.stock_transaction import TransactionType
from app.schemas.inventory_schema import (
    IngredientCreate,
    IngredientUpdate,
    RecipeItemCreate,
)
from app.services import inventory_service


@pytest.fixture
def db_session():
    """Create in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Create dummy restaurant
    restaurant = Restaurant(name="Test Bistro", slug="test-bistro", phone="1234567890")
    db.add(restaurant)
    db.commit()


    yield db
    db.close()


def test_create_and_get_ingredient(db_session):
    ing_data = IngredientCreate(
        name="Whole Milk",
        category="Dairy",
        unit="litre",
        current_stock_qty=Decimal("10.000"),
        reorder_threshold=Decimal("2.000"),
        reorder_qty=Decimal("5.000"),
        cost_per_unit=Decimal("50.00"),
        supplier_name="Fresh Dairy Co",
    )
    result = inventory_service.create_ingredient(db_session, restaurant_id=1, data=ing_data)

    assert result.id is not None
    assert result.name == "Whole Milk"
    assert result.current_stock_qty == Decimal("10.000")
    assert result.is_low_stock is False
    assert result.is_out_of_stock is False
    assert result.total_valuation == Decimal("500.00")

    # Check that initial Purchase transaction was created
    txs, total = inventory_service.get_stock_transactions(db_session, restaurant_id=1, ingredient_id=result.id)
    assert total == 1
    assert txs[0].type == TransactionType.PURCHASE
    assert txs[0].quantity == Decimal("10.000")


def test_stock_transaction_and_low_stock_trigger(db_session):
    ing_data = IngredientCreate(
        name="Coffee Beans",
        category="Coffee",
        unit="kg",
        current_stock_qty=Decimal("5.000"),
        reorder_threshold=Decimal("2.000"),
        cost_per_unit=Decimal("400.00"),
    )
    ing = inventory_service.create_ingredient(db_session, restaurant_id=1, data=ing_data)

    # Log Wastage of 3.5 kg
    tx = inventory_service.record_stock_transaction(
        db=db_session,
        restaurant_id=1,
        ingredient_id=ing.id,
        type=TransactionType.WASTAGE,
        quantity=Decimal("-3.500"),
        notes="Spilled batch",
    )
    assert tx.stock_after == Decimal("1.500")

    # Fetch ingredient and check low stock flag
    updated_ing = inventory_service.get_ingredient(db_session, restaurant_id=1, ingredient_id=ing.id)
    assert updated_ing.current_stock_qty == Decimal("1.500")
    assert updated_ing.is_low_stock is True
    assert updated_ing.is_out_of_stock is False


def test_inventory_summary(db_session):
    # Ingredient 1: In Stock
    inventory_service.create_ingredient(
        db_session, 1, IngredientCreate(name="Tea Leaves", unit="kg", current_stock_qty=Decimal("10"), cost_per_unit=Decimal("100"))
    )
    # Ingredient 2: Low Stock (stock 1 <= threshold 2)
    inventory_service.create_ingredient(
        db_session, 1, IngredientCreate(name="Sugar", unit="kg", current_stock_qty=Decimal("1"), reorder_threshold=Decimal("2"), cost_per_unit=Decimal("40"))
    )
    # Ingredient 3: Out of Stock
    inventory_service.create_ingredient(
        db_session, 1, IngredientCreate(name="Butter", unit="kg", current_stock_qty=Decimal("0"), reorder_threshold=Decimal("1"), cost_per_unit=Decimal("200"))
    )

    summary = inventory_service.get_inventory_summary(db_session, restaurant_id=1)
    assert summary.total_ingredients == 3
    assert summary.low_stock_count == 1
    assert summary.out_of_stock_count == 1
    assert summary.total_valuation == Decimal("1040.00")  # (10*100) + (1*40) + (0*200)


def test_recipe_and_auto_deduction(db_session):
    # Create menu category & menu item
    cat = MenuCategory(name="Beverages", restaurant_id=1)
    db_session.add(cat)
    db_session.commit()

    menu_item = MenuItem(name="Cappuccino", price=150.00, restaurant_id=1, category_id=cat.id)
    db_session.add(menu_item)
    db_session.commit()

    # Create ingredient: Milk (1000 ml)
    milk = inventory_service.create_ingredient(
        db_session, 1, IngredientCreate(name="Milk", unit="ml", current_stock_qty=Decimal("1000.000"), reorder_threshold=Decimal("200.000"))
    )

    # Create recipe: 1 Cappuccino uses 150 ml Milk
    inventory_service.create_or_update_recipe_item(
        db_session, 1, menu_item_id=menu_item.id, data=RecipeItemCreate(ingredient_id=milk.id, quantity_used=Decimal("150.000"))
    )

    # Create Order for 2 Cappuccinos
    order = Order(table_session_id=1, order_number="ORD-TEST-001", status=OrderStatus.PENDING)
    db_session.add(order)
    db_session.commit()

    order_item = OrderItem(order_id=order.id, menu_item_id=menu_item.id, quantity=2, unit_price=150.00, total_price=300.00)
    db_session.add(order_item)
    db_session.commit()

    # Execute auto-deduction
    txs = inventory_service.deduct_inventory_for_order(db_session, restaurant_id=1, order_id=order.id)
    assert len(txs) == 1
    assert txs[0].type == TransactionType.SALE_DEDUCTION
    assert txs[0].quantity == Decimal("-300.000")  # 2 * 150ml

    # Check updated ingredient stock: 1000 - 300 = 700 ml
    updated_milk = inventory_service.get_ingredient(db_session, restaurant_id=1, ingredient_id=milk.id)
    assert updated_milk.current_stock_qty == Decimal("700.000")


def test_custom_alert_threshold_and_active_alerts(db_session):
    from app.schemas.inventory_schema import IngredientThresholdUpdate

    # Create ingredient with initial stock 10, initial threshold 2
    ing = inventory_service.create_ingredient(
        db_session, 1, IngredientCreate(name="Syrup", unit="ml", current_stock_qty=Decimal("10.000"), reorder_threshold=Decimal("2.000"))
    )

    # User updates custom minimum threshold to 12.000
    updated = inventory_service.update_ingredient_threshold(
        db_session, 1, ing.id, IngredientThresholdUpdate(reorder_threshold=Decimal("12.000"), reorder_qty=Decimal("20.000"))
    )
    assert updated.reorder_threshold == Decimal("12.000")
    assert updated.is_low_stock is True  # stock (10) <= threshold (12)

    # Fetch active alerts
    alerts = inventory_service.get_active_stock_alerts(db_session, restaurant_id=1)
    assert len(alerts) == 1
    assert alerts[0].ingredient_id == ing.id
    assert alerts[0].severity == "WARNING"
    assert "Low Stock Alert!" in alerts[0].alert_message

