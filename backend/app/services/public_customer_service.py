import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from datetime import datetime
from app.models.restaurant_table import RestaurantTable
from app.models.restaurant import Restaurant
from app.models.restaurant_settings import RestaurantSettings
from app.models.menu_category import MenuCategory
from app.models.menu_items import MenuItem
from app.models.customer import Customer
from app.models.restaurant_customer import RestaurantCustomer
from app.models.order import Order
from app.schemas.order import OrderCreate
from app.schemas.public_customer_schema import (
    PublicCustomerOrderPayload,
    CustomerCheckStatusResponse
)
from app.services.billing_service import BillingService

logger = logging.getLogger(__name__)


class PublicCustomerService:

    @staticmethod
    def _resolve_restaurant(db: Session, restaurant_identifier: Any) -> Restaurant:
        """
        Resolves restaurant by integer ID or slug/name.
        """
        ident_str = str(restaurant_identifier).strip()
        restaurant = None

        if ident_str.isdigit():
            restaurant = db.query(Restaurant).filter(Restaurant.id == int(ident_str)).first()

        if not restaurant:
            restaurant = db.query(Restaurant).filter(Restaurant.slug == ident_str).first()

        if not restaurant:
            restaurant = db.query(Restaurant).filter(Restaurant.name.ilike(ident_str)).first()

        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant '{restaurant_identifier}' not found."
            )
        return restaurant

    @staticmethod
    def _resolve_table_in_restaurant(db: Session, restaurant_id: int, table_identifier: Any) -> RestaurantTable:
        """
        Resolves a table belonging to a specific restaurant.
        """
        ident_str = str(table_identifier).strip()

        # 1. Search in this specific restaurant by table_number
        table = db.query(RestaurantTable).filter(
            RestaurantTable.restaurant_id == restaurant_id,
            RestaurantTable.table_number.ilike(ident_str)
        ).first()
        if table:
            return table

        # 2. Search by qr_code_token
        table = db.query(RestaurantTable).filter(
            RestaurantTable.restaurant_id == restaurant_id,
            RestaurantTable.qr_code_token == ident_str
        ).first()
        if table:
            return table

        # 3. Search by integer ID
        if ident_str.isdigit():
            table = db.query(RestaurantTable).filter(
                RestaurantTable.restaurant_id == restaurant_id,
                RestaurantTable.id == int(ident_str)
            ).first()
            if table:
                return table

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_identifier}' not found for restaurant ID {restaurant_id}."
        )

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
    def get_restaurant_table_and_menu_info(
        db: Session,
        restaurant_identifier: Any,
        table_identifier: Any
    ) -> Dict[str, Any]:
        """
        Fetches table information, restaurant details, menu categories, and menu items
        specifically for the given restaurant and table.
        """
        restaurant = PublicCustomerService._resolve_restaurant(db, restaurant_identifier)
        table = PublicCustomerService._resolve_table_in_restaurant(db, restaurant.id, table_identifier)

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

        settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant.id).first()
        tax_pct = float(settings.tax_percentage) if (settings and settings.tax_percentage is not None) else 5.0

        return {
            "table": {
                "id": table.id,
                "table_number": table.table_number,
                "capacity": table.capacity,
                "status": str(table.status.value if hasattr(table.status, "value") else table.status),
                "restaurant_id": table.restaurant_id,
            },
            "restaurant": {
                "id": restaurant.id,
                "name": restaurant.name,
                "logo_url": restaurant.logo_url,
                "address": restaurant.address,
                "phone": restaurant.phone,
                "tax_percentage": tax_pct,
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
                    "is_veg": bool(getattr(i, "is_vegetarian", False)),
                    "category_id": i.category_id,
                }
                for i in items
            ]
        }

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

        settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant.id).first()
        tax_pct = float(settings.tax_percentage) if (settings and settings.tax_percentage is not None) else 5.0

        return {
            "table": {
                "id": table.id,
                "table_number": table.table_number,
                "capacity": table.capacity,
                "status": str(table.status.value if hasattr(table.status, "value") else table.status),
                "restaurant_id": table.restaurant_id,
            },
            "restaurant": {
                "id": restaurant.id,
                "name": restaurant.name,
                "logo_url": restaurant.logo_url,
                "address": restaurant.address,
                "phone": restaurant.phone,
                "tax_percentage": tax_pct,
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
                    "is_veg": bool(getattr(i, "is_vegetarian", False)),
                    "category_id": i.category_id,
                }
                for i in items
            ]
        }

    @staticmethod
    def check_customer_status(
        db: Session,
        phone: str,
        restaurant_identifier: Optional[Any] = None
    ) -> CustomerCheckStatusResponse:
        """
        Checks if customer phone is already verified for this specific restaurant.
        If verified at this restaurant, requires_otp is False.
        """
        clean_phone = "".join(filter(str.isdigit, str(phone)))
        if len(clean_phone) > 10 and clean_phone.startswith("91"):
            clean_phone = clean_phone[-10:]

        if not clean_phone or len(clean_phone) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid 10-digit mobile number."
            )

        if restaurant_identifier:
            restaurant = PublicCustomerService._resolve_restaurant(db, restaurant_identifier)
            rc = db.query(RestaurantCustomer).filter(
                RestaurantCustomer.restaurant_id == restaurant.id,
                RestaurantCustomer.phone == clean_phone
            ).first()

            if rc and rc.is_verified:
                return CustomerCheckStatusResponse(
                    phone=clean_phone,
                    exists=True,
                    requires_otp=False,
                    name=rc.name,
                    visit_count=rc.visit_count or 1
                )

            # Check global customer record just to pre-fill known name
            global_cust = db.query(Customer).filter(Customer.phone == clean_phone).first()
            return CustomerCheckStatusResponse(
                phone=clean_phone,
                exists=False,
                requires_otp=True,
                name=global_cust.name if global_cust else None,
                visit_count=0
            )

        # Generic lookup
        global_cust = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if global_cust:
            return CustomerCheckStatusResponse(
                phone=clean_phone,
                exists=True,
                requires_otp=False,
                name=global_cust.name,
                visit_count=global_cust.total_orders or 1
            )

        return CustomerCheckStatusResponse(
            phone=clean_phone,
            exists=False,
            requires_otp=True,
            name=None,
            visit_count=0
        )

    @staticmethod
    def register_verified_customer(
        db: Session,
        phone: str,
        name: Optional[str] = None,
        restaurant_identifier: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Registers a customer as verified for a specific restaurant after 1st successful OTP verification.
        """
        clean_phone = "".join(filter(str.isdigit, str(phone)))
        if len(clean_phone) > 10 and clean_phone.startswith("91"):
            clean_phone = clean_phone[-10:]

        if not clean_phone or len(clean_phone) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid 10-digit mobile number."
            )

        clean_name = name.strip() if name else None

        # 1. Update/Create global customer
        customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if not customer:
            customer = Customer(
                phone=clean_phone,
                name=clean_name,
                total_orders=0,
                is_active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
        elif clean_name and not customer.name:
            customer.name = clean_name
            db.commit()

        visit_count = 1
        # 2. Update/Create per-restaurant customer record
        if restaurant_identifier:
            restaurant = PublicCustomerService._resolve_restaurant(db, restaurant_identifier)
            rc = db.query(RestaurantCustomer).filter(
                RestaurantCustomer.restaurant_id == restaurant.id,
                RestaurantCustomer.phone == clean_phone
            ).first()

            if not rc:
                rc = RestaurantCustomer(
                    restaurant_id=restaurant.id,
                    customer_id=customer.id,
                    phone=clean_phone,
                    name=clean_name or customer.name,
                    is_verified=True,
                    visit_count=1,
                    last_visit_at=datetime.utcnow()
                )
                db.add(rc)
                db.commit()
            else:
                rc.is_verified = True
                if clean_name:
                    rc.name = clean_name
                rc.last_visit_at = datetime.utcnow()
                visit_count = rc.visit_count or 1
                db.commit()

        return {
            "status": "success",
            "phone": clean_phone,
            "name": clean_name or (customer.name if customer else None),
            "visit_count": visit_count
        }

    @staticmethod
    def place_restaurant_table_order(
        db: Session,
        restaurant_identifier: Any,
        table_identifier: Any,
        payload: PublicCustomerOrderPayload
    ) -> Order:
        """
        Places order for a specific restaurant and table.
        """
        restaurant = PublicCustomerService._resolve_restaurant(db, restaurant_identifier)
        table = PublicCustomerService._resolve_table_in_restaurant(db, restaurant.id, table_identifier)

        customer_id = None
        if payload.phone:
            clean_phone = "".join(filter(str.isdigit, str(payload.phone)))
            if len(clean_phone) > 10 and clean_phone.startswith("91"):
                clean_phone = clean_phone[-10:]

            clean_name = payload.name.strip() if payload.name else None

            # Global customer
            customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
            if not customer:
                customer = Customer(
                    phone=clean_phone,
                    name=clean_name,
                    total_orders=1
                )
                db.add(customer)
                db.commit()
                db.refresh(customer)
            else:
                if clean_name:
                    customer.name = clean_name
                customer.total_orders = (customer.total_orders or 0) + 1
                customer.last_order_at = datetime.utcnow()
                db.commit()
            customer_id = customer.id

            # Restaurant-specific customer tracking
            rc = db.query(RestaurantCustomer).filter(
                RestaurantCustomer.restaurant_id == restaurant.id,
                RestaurantCustomer.phone == clean_phone
            ).first()

            if not rc:
                rc = RestaurantCustomer(
                    restaurant_id=restaurant.id,
                    customer_id=customer.id,
                    phone=clean_phone,
                    name=clean_name or customer.name,
                    is_verified=True,
                    visit_count=1,
                    last_visit_at=datetime.utcnow()
                )
                db.add(rc)
                db.commit()
            else:
                rc.visit_count = (rc.visit_count or 0) + 1
                rc.last_visit_at = datetime.utcnow()
                if clean_name:
                    rc.name = clean_name
                db.commit()

        # Open table session with customer_id attached
        session = BillingService.open_table_session(db, table.id, customer_id=customer_id)
        if customer_id and not session.customer_id:
            session.customer_id = customer_id
            db.commit()

        items_dict = [item.dict() for item in payload.items]
        order_create_payload = OrderCreate(items=items_dict)

        # Add order to table session
        order = BillingService.add_order_to_session(db, table.id, order_create_payload)
        return order

    @staticmethod
    def place_order(db: Session, table_identifier: Any, payload: PublicCustomerOrderPayload) -> Order:
        """
        Auto-opens table session, registers/links customer phone, and places order.
        Supports lookup by table_number (e.g. OT-01) or table_id.
        """
        table = PublicCustomerService._resolve_table(db, table_identifier)

        customer_id = None
        if payload.phone:
            clean_phone = "".join(filter(str.isdigit, str(payload.phone)))
            if len(clean_phone) > 10 and clean_phone.startswith("91"):
                clean_phone = clean_phone[-10:]

            clean_name = payload.name.strip() if payload.name else None

            customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
            if not customer:
                customer = Customer(
                    phone=clean_phone,
                    name=clean_name,
                    total_orders=1
                )
                db.add(customer)
                db.commit()
                db.refresh(customer)
            else:
                if clean_name:
                    customer.name = clean_name
                customer.total_orders = (customer.total_orders or 0) + 1
                customer.last_order_at = datetime.utcnow()
                db.commit()
            customer_id = customer.id

            # Restaurant-specific tracking
            rc = db.query(RestaurantCustomer).filter(
                RestaurantCustomer.restaurant_id == table.restaurant_id,
                RestaurantCustomer.phone == clean_phone
            ).first()

            if not rc:
                rc = RestaurantCustomer(
                    restaurant_id=table.restaurant_id,
                    customer_id=customer.id,
                    phone=clean_phone,
                    name=clean_name or customer.name,
                    is_verified=True,
                    visit_count=1,
                    last_visit_at=datetime.utcnow()
                )
                db.add(rc)
                db.commit()
            else:
                rc.visit_count = (rc.visit_count or 0) + 1
                rc.last_visit_at = datetime.utcnow()
                if clean_name:
                    rc.name = clean_name
                db.commit()

        # Open table session with customer_id attached
        session = BillingService.open_table_session(db, table.id, customer_id=customer_id)
        if customer_id and not session.customer_id:
            session.customer_id = customer_id
            db.commit()

        items_dict = [item.dict() for item in payload.items]
        order_create_payload = OrderCreate(items=items_dict)

        # Add order to table session
        order = BillingService.add_order_to_session(db, table.id, order_create_payload)
        return order

    @staticmethod
    def request_bill(db: Session, table_identifier: Any, restaurant_identifier: Optional[Any] = None) -> Dict[str, Any]:
        """
        Registers a customer request for printed bill at table.
        """
        if restaurant_identifier:
            restaurant = PublicCustomerService._resolve_restaurant(db, restaurant_identifier)
            table = PublicCustomerService._resolve_table_in_restaurant(db, restaurant.id, table_identifier)
        else:
            table = PublicCustomerService._resolve_table(db, table_identifier)

        return {
            "status": "success",
            "message": f"Bill requested for Table {table.table_number}. Waiter notified."
        }

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
