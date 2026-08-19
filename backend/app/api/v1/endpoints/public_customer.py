from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public_customer_schema import PublicCustomerOrderPayload, PublicTableInfoResponse
from app.schemas.order import OrderResponse
from app.services.public_customer_service import PublicCustomerService

router = APIRouter(prefix="/public", tags=["Public Customer QR"])


# ============================================================================
# RESTAURANT-SCOPED TABLE QR ENDPOINTS (Recommended: /public/restaurants/1/tables/OT-01/...)
# ============================================================================

@router.get("/restaurants/{restaurant_id}/tables/{table_id}/info", response_model=PublicTableInfoResponse)
def get_public_restaurant_table_and_menu(
    restaurant_id: str,
    table_id: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for customers scanning a specific restaurant table QR code.
    Returns restaurant details, specific table info, and only that restaurant's menu.
    """
    return PublicCustomerService.get_restaurant_table_and_menu_info(db, restaurant_id, table_id)


@router.post("/restaurants/{restaurant_id}/tables/{table_id}/order", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def place_public_restaurant_table_order(
    restaurant_id: str,
    table_id: str,
    payload: PublicCustomerOrderPayload,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to place food order from a specific restaurant table QR code.
    Auto-opens table session, links customer phone (if provided), and transmits order to POS/Kitchen KDS.
    """
    return PublicCustomerService.place_restaurant_table_order(db, restaurant_id, table_id, payload)


@router.post("/restaurants/{restaurant_id}/tables/{table_id}/request-bill")
def request_public_restaurant_table_bill(
    restaurant_id: str,
    table_id: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for customers to request their final printed bill at the table.
    """
    return PublicCustomerService.request_bill(db, table_id, restaurant_id)


# ============================================================================
# GLOBAL / SINGLE TABLE QR ENDPOINTS (Backward Compatible: /public/tables/12/...)
# ============================================================================

@router.get("/tables/{table_id}/info", response_model=PublicTableInfoResponse)
def get_public_table_and_menu(table_id: str, db: Session = Depends(get_db)):
    """
    Public endpoint for customers scanning a table QR code.
    Returns table information, restaurant details, menu categories, and menu items.
    Accepts table_number (e.g. 'OT-01') or database ID.
    """
    return PublicCustomerService.get_table_and_menu_info(db, table_id)


@router.post("/tables/{table_id}/order", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def place_public_customer_order(
    table_id: str,
    payload: PublicCustomerOrderPayload,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to place food order from a customer table QR code.
    Auto-opens table session, links customer phone (if provided), and transmits order to POS/Kitchen KDS.
    Accepts table_number (e.g. 'OT-01') or database ID.
    """
    return PublicCustomerService.place_order(db, table_id, payload)


@router.post("/tables/{table_id}/request-bill")
def request_public_table_bill(
    table_id: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for customers to request their final printed bill at the table.
    """
    return PublicCustomerService.request_bill(db, table_id)


@router.get("/tables/orders/{order_id}/status", response_model=OrderResponse)
@router.get("/orders/{order_id}/status", response_model=OrderResponse)
def get_public_order_status(order_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint for customers to track real-time order status (pending, in_kitchen, ready, served).
    """
    return PublicCustomerService.get_order_status(db, order_id)
