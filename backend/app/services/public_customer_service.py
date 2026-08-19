from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.restaurant_table import RestaurantTable
from app.models.restaurant import Restaurant
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.customer import Customer
from app.models.order import Order
from app.schemas.order import OrderCreate
from app.schemas.public_customer_schema import PublicCustomerOrderPayload
from app.services.billing_service import BillingService


class PublicCustomerService:

    @staticmethod
    def _resolve_table(db: Session, table_identifier: Any) -> RestaurantTable:
        """
        Resolves table by table_number (e.g. 'OT-01'), qr_code_token, or integer ID.
        """
        ident_str = str(table_identifier).strip()

        # 1. Try finding by table_number (exact or case-insensitive)
        table = db.query(RestaurantTable).filter(RestaurantTable.table_number.ilike(ident_str)).first()
        if table:
            return table

        # 2. Try finding by qr_code_token
        table = db.query(RestaurantTable).filter(RestaurantTable.qr_code_token == ident_str).first()
        if table:
            return table

        # 3. Try finding by integer ID if numeric
        if ident_str.isdigit():
            table = db.query(RestaurantTable).filter(RestaurantTable.id == int(ident_str)).first()
            if table:
                return table

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_identifier}' not found."
        )

    @staticmethod
    def get_table_and_menu_info(db: Session, table_identifier: Any) -> Dict[str, Any]:
        """
        Fetches table information, restaurant details, menu categories, and menu items.
        Supports lookup by table_number (e.g. OT-01) or table_id.
        """
        table = PublicCustomerService._resolve_table(db, table_identifier)

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

    @staticmethod
    def place_order(db: Session, table_identifier: Any, payload: PublicCustomerOrderPayload) -> Order:
        """
        Auto-opens table session, registers/links customer phone, and places order.
        Supports lookup by table_number (e.g. OT-01) or table_id.
        """
        table = PublicCustomerService._resolve_table(db, table_identifier)

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

        # Open table session with customer_id attached
        session = BillingService.open_table_session(db, table_id, customer_id=customer_id)
        if customer_id and not session.customer_id:
            session.customer_id = customer_id
            db.commit()

        items_dict = [item.dict() for item in payload.items]
        order_create_payload = OrderCreate(items=items_dict)

        # Add order to table session
        order = BillingService.add_order_to_session(db, table_id, order_create_payload)
        return order

    @staticmethod
    def get_order_status(db: Session, order_id: int) -> Order:
        """
        Retrieves real-time order status for live tracking.
        """
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order ticket not found."
            )
        return order
