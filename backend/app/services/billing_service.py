import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.restaurant_table import RestaurantTable, TableStatus
from app.models.table_session import TableSession, SessionStatus, PaymentMethod
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.menu_items import MenuItem
from app.models.menu_item_variant import MenuItemVariant
from app.schemas.order import OrderCreate
from app.schemas.table_session import CheckoutRequest, LiveBillSummary, LiveBillItemSummary

DEFAULT_TAX_PERCENTAGE = 5.0  # 5% GST default


class BillingService:
    """Service to handle Table Session Billing and Order Appending"""

    @staticmethod
    def _get_restaurant_tax_percentage(db: Session, restaurant_id: int) -> float:
        try:
            from app.models.restaurant_settings import RestaurantSettings
            settings = db.query(RestaurantSettings).filter(RestaurantSettings.restaurant_id == restaurant_id).first()
            if settings and settings.tax_percentage is not None:
                return float(settings.tax_percentage)
        except Exception:
            pass
        return DEFAULT_TAX_PERCENTAGE

    @staticmethod
    def get_active_session_for_table(db: Session, table_id: int) -> Optional[TableSession]:
        return (
            db.query(TableSession)
            .filter(
                TableSession.table_id == table_id,
                TableSession.status.in_([SessionStatus.OPEN, SessionStatus.PAYMENT_PENDING, "open", "payment_pending"])
            )
            .order_by(TableSession.opened_at.desc(), TableSession.id.desc())
            .first()
        )

    @staticmethod
    def open_table_session(db: Session, table_id: int, customer_id: Optional[int] = None) -> TableSession:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant table not found."
            )

        # Check if table already has an active open session
        active_session = BillingService.get_active_session_for_table(db, table_id)
        if active_session:
            return active_session

        # Create new open session
        session = TableSession(
            restaurant_id=table.restaurant_id,
            table_id=table.id,
            customer_id=customer_id,
            status=SessionStatus.OPEN,
            subtotal=0.0,
            tax=0.0,
            discount=0.0,
            total_amount=0.0,
            opened_at=datetime.utcnow()
        )
        db.add(session)
        
        # Mark table as occupied
        table.status = TableStatus.OCCUPIED
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def add_order_to_session(db: Session, table_id: int, order_data: OrderCreate) -> Order:
        # Get active open session or auto-open one if needed
        session = BillingService.get_active_session_for_table(db, table_id)
        if not session:
            session = BillingService.open_table_session(db, table_id)

        if not order_data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order must contain at least one item."
            )

        order_number = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        order = Order(
            table_session_id=session.id,
            order_number=order_number,
            status=OrderStatus.PENDING,
            subtotal=0.0,
            tax=0.0,
            total=0.0
        )
        db.add(order)
        db.flush()

        order_subtotal = 0.0

        for item_data in order_data.items:
            menu_item = db.query(MenuItem).filter(MenuItem.id == item_data.menu_item_id).first()
            if not menu_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Menu item ID {item_data.menu_item_id} not found."
                )

            price = float(menu_item.price)
            if item_data.variant_id:
                variant = db.query(MenuItemVariant).filter(MenuItemVariant.id == item_data.variant_id).first()
                if variant:
                    price = float(variant.price)

            total_item_price = round(price * item_data.quantity, 2)
            order_subtotal += total_item_price

            order_item = OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                variant_id=item_data.variant_id,
                quantity=item_data.quantity,
                unit_price=price,
                total_price=total_item_price,
                special_instructions=item_data.special_instructions
            )
            db.add(order_item)

        tax_pct = BillingService._get_restaurant_tax_percentage(db, session.restaurant_id)
        order_tax = round(order_subtotal * (tax_pct / 100.0), 2)
        order.subtotal = round(order_subtotal, 2)
        order.tax = order_tax
        order.total = round(order_subtotal + order_tax, 2)

        # Recalculate TableSession running bill totals
        BillingService._recalculate_session_totals(db, session)

        db.commit()
        db.refresh(order)

        # Trigger inventory auto-deduction for recipe ingredients
        try:
            from app.services import inventory_service
            inventory_service.deduct_inventory_for_order(
                db=db,
                restaurant_id=session.restaurant_id,
                order_id=order.id
            )
        except Exception:
            # Fallback gracefully if inventory tables/recipes not set
            pass

        return order

    @staticmethod
    def update_order_status(
        db: Session,
        order_id: int,
        new_status: OrderStatus,
        cancellation_reason: Optional[str] = None
    ) -> Order:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order ID #{order_id} not found."
            )

        order.status = new_status
        if new_status == OrderStatus.CANCELLED:
            order.cancellation_reason = cancellation_reason or "Cancelled by user"

        try:
            db.commit()
        except Exception as err:
            db.rollback()
            # Handle production Postgres enum missing 'ready' status
            conn_engine = db.get_bind().name
            if conn_engine == 'postgresql':
                try:
                    raw_conn = db.get_bind().raw_connection()
                    raw_conn.set_isolation_level(0)  # autocommit mode
                    cur = raw_conn.cursor()
                    cur.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'ready';")
                    cur.close()
                except Exception:
                    pass
                # Retry status update
                db.query(Order).filter(Order.id == order_id).update({
                    "status": new_status.value if hasattr(new_status, 'value') else str(new_status)
                })
                db.commit()
            else:
                raise err

        db.refresh(order)

        # Recalculate session running bill if session exists
        if order.table_session_id:
            session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
            if session:
                BillingService._recalculate_session_totals(db, session)
                db.commit()

        return order


    @staticmethod
    def _recalculate_session_totals(db: Session, session: TableSession):
        active_orders = (
            db.query(Order)
            .filter(
                Order.table_session_id == session.id,
                Order.status != OrderStatus.CANCELLED
            )
            .all()
        )

        subtotal = sum(order.subtotal for order in active_orders)
        subtotal_after_discount = max(0.0, subtotal - session.discount)
        tax_pct = BillingService._get_restaurant_tax_percentage(db, session.restaurant_id)
        tax_calculated = round(subtotal_after_discount * (tax_pct / 100.0), 2)
        
        raw_total = max(0.0, subtotal_after_discount + tax_calculated)
        rounded_total = float(round(raw_total))
        
        session.subtotal = round(subtotal, 2)
        session.tax = tax_calculated
        session.total_amount = rounded_total

    @staticmethod
    def get_live_bill_summary(db: Session, table_id: int) -> LiveBillSummary:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant table not found."
            )

        session = BillingService.get_active_session_for_table(db, table_id)
        if not session:
            return LiveBillSummary(
                session_id=0,
                table_id=table.id,
                table_number=table.table_number,
                status=SessionStatus.OPEN,
                total_orders_count=0,
                items_summary=[],
                subtotal=0.0,
                tax=0.0,
                discount=0.0,
                round_off=0.0,
                total_amount=0.0,
                opened_at=datetime.utcnow()
            )

        orders = (
            db.query(Order)
            .filter(
                Order.table_session_id == session.id,
                Order.status != OrderStatus.CANCELLED
            )
            .all()
        )

        # Consolidate items
        items_map = {}
        for order in orders:
            for item in order.items:
                menu_item = item.menu_item or db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
                item_name = menu_item.name if menu_item else f"Item #{item.menu_item_id}"
                variant_name = item.variant.name if (item.variant_id and item.variant) else None
                key = (item.menu_item_id, item.variant_id, item.special_instructions or "")
                if key not in items_map:
                    items_map[key] = {
                        "menu_item_id": item.menu_item_id,
                        "item_name": item_name,
                        "variant_name": variant_name,
                        "quantity": 0,
                        "unit_price": float(item.unit_price or 0.0),
                        "total_price": 0.0,
                        "special_instructions": item.special_instructions
                    }
                items_map[key]["quantity"] += item.quantity
                items_map[key]["total_price"] = round(items_map[key]["total_price"] + float(item.total_price or 0.0), 2)

        items_summary = [LiveBillItemSummary(**val) for val in items_map.values()]
        raw_total = max(0.0, float(session.subtotal or 0.0) - float(session.discount or 0.0)) + float(session.tax or 0.0)
        round_off = round(float(session.total_amount or 0.0) - raw_total, 2)

        return LiveBillSummary(
            session_id=session.id,
            table_id=table.id,
            table_number=table.table_number,
            status=session.status,
            total_orders_count=len(orders),
            items_summary=items_summary,
            subtotal=float(session.subtotal or 0.0),
            tax=float(session.tax or 0.0),
            discount=float(session.discount or 0.0),
            round_off=round_off,
            total_amount=float(session.total_amount or 0.0),
            opened_at=session.opened_at or datetime.utcnow()
        )

    @staticmethod
    def checkout_and_close_session(db: Session, table_id: int, checkout_data: CheckoutRequest) -> TableSession:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant table not found."
            )

        session = BillingService.get_active_session_for_table(db, table_id)
        if not session:
            table.status = TableStatus.AVAILABLE
            db.commit()
            return TableSession(
                restaurant_id=table.restaurant_id,
                table_id=table.id,
                status=SessionStatus.PAID,
                subtotal=0.0,
                tax=0.0,
                discount=0.0,
                total_amount=0.0,
                opened_at=datetime.utcnow(),
                closed_at=datetime.utcnow()
            )

        if checkout_data.discount is not None:
            session.discount = checkout_data.discount

        BillingService._recalculate_session_totals(db, session)

        session.status = SessionStatus.PAID
        session.payment_method = checkout_data.payment_method
        session.payment_notes = checkout_data.payment_notes
        session.closed_at = datetime.utcnow()

        # Reset table status back to AVAILABLE
        table = session.table or table
        table.status = TableStatus.AVAILABLE

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_orders_for_restaurant(db: Session, restaurant_id: int) -> List[dict]:
        orders = (
            db.query(Order)
            .join(TableSession, Order.table_session_id == TableSession.id)
            .filter(TableSession.restaurant_id == restaurant_id)
            .order_by(Order.created_at.desc())
            .all()
        )

        result = []
        for order in orders:
            table_num = order.session.table.table_number if (order.session and order.session.table) else "Takeaway"
            items_list = []
            for item in order.items:
                menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
                item_name = menu_item.name if menu_item else f"Item #{item.menu_item_id}"
                items_list.append({
                    "id": item.id,
                    "menu_item_id": item.menu_item_id,
                    "name": item_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price,
                    "special_instructions": item.special_instructions
                })

            result.append({
                "id": order.id,
                "order_number": order.order_number,
                "table_number": table_num,
                "status": order.status,
                "subtotal": order.subtotal,
                "tax": order.tax,
                "total": order.total,
                "cancellation_reason": order.cancellation_reason,
                "items": items_list,
                "created_at": order.created_at
            })
        return result

