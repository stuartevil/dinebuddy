import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db, SessionLocal
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user


from app.db.base import Base
from app.core.database import engine

# Ensure tables exist for test sqlite database
Base.metadata.create_all(bind=engine)


# Mock current user for integration tests

def mock_get_current_user():
    user = User(
        id=1,
        email="admin@dinebuddy.com",
        full_name="Admin User",
        role=UserRole.RESTAURANT_ADMIN,
        is_active=True,
    )
    return user


app.dependency_overrides[get_current_user] = mock_get_current_user


def test_inventory_api_flow(client: TestClient):
    # 1. Create ingredient
    response = client.post(
        "/api/v1/restaurants/1/inventory/ingredients",
        json={
            "name": "Coffee Beans 1kg",
            "category": "Coffee",
            "unit": "kg",
            "current_stock_qty": 5.0,
            "reorder_threshold": 2.0,
            "reorder_qty": 5.0,
            "cost_per_unit": 500.0,
            "supplier_name": "Bean Masters",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    ing_id = data["id"]
    assert data["name"] == "Coffee Beans 1kg"
    assert data["is_low_stock"] is False

    # 2. Get list of ingredients
    list_res = client.get("/api/v1/restaurants/1/inventory/ingredients")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Post stock transaction (Wastage of 3.5kg -> stock drops to 1.5kg, triggering low stock)
    tx_res = client.post(
        f"/api/v1/restaurants/1/inventory/ingredients/{ing_id}/transactions",
        json={
            "ingredient_id": ing_id,
            "type": "Wastage",
            "quantity": -3.5,
            "notes": "Accidental spill",
        },
    )
    assert tx_res.status_code == 201, tx_res.text
    tx_data = tx_res.json()
    assert float(tx_data["stock_after"]) == 1.5

    # 4. Verify low-stock alert in ingredient details
    get_res = client.get(f"/api/v1/restaurants/1/inventory/ingredients/{ing_id}")
    assert get_res.status_code == 200
    ing_detail = get_res.json()
    assert ing_detail["is_low_stock"] is True

    # 5. Get summary
    sum_res = client.get("/api/v1/restaurants/1/inventory/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["low_stock_count"] >= 1
