import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import User, UserRole
from app.models.restaurant import Restaurant
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.restaurant_table import TableStatus
from app.models.table_session import SessionStatus, PaymentMethod
from app.core.security import hash_password

ADMIN_TEST_EMAIL = "tableadmin@test.com"


@pytest.fixture
def billing_test_context():
    """Setup test DB data: admin user, restaurant, and menu items."""
    session = SessionLocal()
    
    # 1. Admin user
    admin = session.query(User).filter(User.email == ADMIN_TEST_EMAIL).first()
    if not admin:
        admin = User(
            email=ADMIN_TEST_EMAIL,
            full_name="Table Admin Tester",
            password_hash=hash_password("adminpass"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

    # 2. Restaurant
    restaurant = session.query(Restaurant).filter(Restaurant.slug == "table-test-resto").first()
    if not restaurant:
        restaurant = Restaurant(
            name="Table Test Resto",
            slug="table-test-resto",
            is_active=True
        )
        session.add(restaurant)
        session.commit()
        session.refresh(restaurant)

    # 3. Category & Menu Items
    category = session.query(MenuCategory).filter(MenuCategory.restaurant_id == restaurant.id).first()
    if not category:
        category = MenuCategory(
            name="General",
            restaurant_id=restaurant.id,
            is_active=True
        )
        session.add(category)
        session.commit()
        session.refresh(category)

    item1 = session.query(MenuItem).filter(MenuItem.name == "Paneer Tikka").first()
    if not item1:
        item1 = MenuItem(
            name="Paneer Tikka",
            price=250.0,
            restaurant_id=restaurant.id,
            category_id=category.id,
            is_available=True
        )
        session.add(item1)

    item2 = session.query(MenuItem).filter(MenuItem.name == "Butter Naan").first()
    if not item2:
        item2 = MenuItem(
            name="Butter Naan",
            price=50.0,
            restaurant_id=restaurant.id,
            category_id=category.id,
            is_available=True
        )
        session.add(item2)

    session.commit()
    session.refresh(item1)
    session.refresh(item2)

    def override_get_db():
        try:
            yield session
        finally:
            pass

    def override_get_current_user():
        return admin

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)
    yield {
        "client": client,
        "restaurant": restaurant,
        "item1": item1,
        "item2": item2,
        "session": session
    }

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    session.close()


class TestTableBillingWorkflow:
    """Integration test suite for Dine-In Table Management and Running Bill Session workflow."""

    def test_full_table_session_and_multiple_orders_lifecycle(self, billing_test_context):
        client: TestClient = billing_test_context["client"]
        restaurant: Restaurant = billing_test_context["restaurant"]
        item1: MenuItem = billing_test_context["item1"]
        item2: MenuItem = billing_test_context["item2"]

        # Step 1: Create a new table
        table_payload = {
            "restaurant_id": restaurant.id,
            "table_number": "Table 101",
            "capacity": 4
        }
        res_tbl = client.post("/api/v1/tables/", json=table_payload)
        assert res_tbl.status_code == 201
        tbl_data = res_tbl.json()
        table_id = tbl_data["id"]
        assert tbl_data["table_number"] == "Table 101"
        assert tbl_data["status"] == TableStatus.AVAILABLE.value

        # Step 2: Open session for Table 101
        res_sess = client.post(f"/api/v1/tables/{table_id}/open-session", json={})
        assert res_sess.status_code == 201
        sess_data = res_sess.json()
        assert sess_data["status"] == SessionStatus.OPEN.value

        # Verify Table 101 status is now OCCUPIED
        res_tbl_check = client.get(f"/api/v1/tables/{table_id}")
        assert res_tbl_check.status_code == 200
        assert res_tbl_check.json()["status"] == TableStatus.OCCUPIED.value

        # Step 3: Round 1 Order (Starters: 2x Paneer Tikka @ ₹250 = ₹500)
        round1_payload = {
            "items": [
                {"menu_item_id": item1.id, "quantity": 2, "special_instructions": "Extra green chutney"}
            ]
        }
        res_ord1 = client.post(f"/api/v1/tables/{table_id}/orders", json=round1_payload)
        assert res_ord1.status_code == 201
        ord1_data = res_ord1.json()
        assert ord1_data["subtotal"] == 500.0
        assert ord1_data["tax"] == 25.0  # 5% tax = 25.0
        assert ord1_data["total"] == 525.0

        # Step 4: Round 2 Order (Main Course: 4x Butter Naan @ ₹50 = ₹200)
        round2_payload = {
            "items": [
                {"menu_item_id": item2.id, "quantity": 4}
            ]
        }
        res_ord2 = client.post(f"/api/v1/tables/{table_id}/orders", json=round2_payload)
        assert res_ord2.status_code == 201
        ord2_data = res_ord2.json()
        assert ord2_data["subtotal"] == 200.0

        # Step 5: Get Live Combined Running Bill
        # Subtotal: 500 + 200 = 700.0, Tax (5%): 35.0, Net Total: 735.0
        res_bill = client.get(f"/api/v1/tables/{table_id}/current-bill")
        assert res_bill.status_code == 200
        bill_data = res_bill.json()
        assert bill_data["table_number"] == "Table 101"
        assert bill_data["total_orders_count"] == 2
        assert bill_data["subtotal"] == 700.0
        assert bill_data["tax"] == 35.0
        assert bill_data["total_amount"] == 735.0
        assert len(bill_data["items_summary"]) == 2

        # Step 6: Checkout & Pay Bill
        checkout_payload = {
            "payment_method": PaymentMethod.UPI.value,
            "discount": 35.0,  # ₹35 discount -> subtotal 665.0 -> tax 33.25 -> total 698.25
            "payment_notes": "Paid via GooglePay"
        }
        res_checkout = client.post(f"/api/v1/tables/{table_id}/checkout", json=checkout_payload)
        assert res_checkout.status_code == 200
        checkout_data = res_checkout.json()
        assert checkout_data["status"] == SessionStatus.PAID.value
        assert checkout_data["payment_method"] == PaymentMethod.UPI.value
        assert checkout_data["closed_at"] is not None

        # Verify Table 101 is now automatically reset to AVAILABLE
        res_tbl_final = client.get(f"/api/v1/tables/{table_id}")
        assert res_tbl_final.status_code == 200
        assert res_tbl_final.json()["status"] == TableStatus.AVAILABLE.value
