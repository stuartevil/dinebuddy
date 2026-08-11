from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public_customer_schema import PublicCustomerOrderPayload, PublicTableInfoResponse
from app.schemas.order import OrderResponse
from app.services.public_customer_service import PublicCustomerService

router = APIRouter(prefix="/public/tables", tags=["Public Customer QR"])


@router.get("/{table_id}/info", response_model=PublicTableInfoResponse)
def get_public_table_and_menu(table_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint for customers scanning a table QR code.
    Returns table information, restaurant details, menu categories, and menu items.
    """
    return PublicCustomerService.get_table_and_menu_info(db, table_id)


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
    return PublicCustomerService.place_order(db, table_id, payload)


@router.get("/orders/{order_id}/status", response_model=OrderResponse)
def get_public_order_status(order_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint for customers to track real-time order status (pending, in_kitchen, ready, served).
    """
    return PublicCustomerService.get_order_status(db, order_id)
