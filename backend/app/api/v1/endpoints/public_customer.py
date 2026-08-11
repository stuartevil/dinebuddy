from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.restaurant_table import RestaurantTable
from app.models.restaurant import Restaurant
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.customer import Customer
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderResponse
from app.services.billing_service import BillingService

router = APIRouter(prefix="/public/tables", tags=["Public Customer QR"])


class PublicCustomerOrderPayload(BaseModel):
    items: List[dict]
    phone: Optional[str] = None
    name: Optional[str] = None


@router.get("/{table_id}/info")
def get_public_table_and_menu(table_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint for customers scanning a table QR code.
    Returns table information, restaurant details, menu categories, and menu items.
    """
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found."
        )

    restaurant = db.query(Restaurant).filter(Restaurant.id == table.restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found."
        )

    categories = (
        db.query(MenuCategory)
        .filter(
            (MenuCategory.restaurant_id == restaurant.id) | (MenuCategory.is_global == True)
        )
        .all()
    )

    items = (
        db.query(MenuItem)
        .filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available == True
        )
        .all()
    )

    return {
        "table": {
            "id": table.id,
            "table_number": table.table_number,
            "capacity": table.capacity,
            "status": table.status,
            "restaurant_id": table.restaurant_id,
        },
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "logo_url": restaurant.logo_url,
            "address": restaurant.address,
            "phone": restaurant.phone,
        },
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "is_global": c.is_global,
            }
            for c in categories
        ],
        "menu_items": [
            {
                "id": i.id,
                "name": i.name,
                "description": i.description,
                "price": float(i.price) if i.price else 0.0,
                "image_url": i.image_url,
                "is_veg": i.is_veg,
                "category_id": i.category_id,
            }
            for i in items
        ]
    }


@router.post("/{table_id}/order", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def place_public_customer_order(
    table_id: int,
    payload: PublicCustomerOrderPayload,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to place food order from a customer table QR code.
    Auto-opens table session, links customer phone (if provided), and transmits order to POS/Kitchen KDS.
    """
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found."
        )

    customer_id = None
    if payload.phone:
        clean_phone = payload.phone.strip()
        customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if not customer:
            customer = Customer(
                phone=clean_phone,
                name=payload.name.strip() if payload.name else None,
                total_orders=1
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
        else:
            if payload.name:
                customer.name = payload.name.strip()
            customer.total_orders = (customer.total_orders or 0) + 1
            db.commit()
        customer_id = customer.id

    # Open table session with customer_id attached if session doesn't exist
    session = BillingService.open_table_session(db, table_id, customer_id=customer_id)
    if customer_id and not session.customer_id:
        session.customer_id = customer_id
        db.commit()

    # Convert items payload to OrderCreate schema
    order_create_payload = OrderCreate(items=payload.items)

    # Add order to session
    order = BillingService.add_order_to_session(db, table_id, order_create_payload)
    return order


@router.get("/orders/{order_id}/status", response_model=OrderResponse)
def get_public_order_status(order_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint for customers to track real-time order status (pending, in_kitchen, ready, served).
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order ticket not found."
        )
    return order
