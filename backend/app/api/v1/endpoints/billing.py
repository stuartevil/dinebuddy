from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse
from app.schemas.table_session import (
    SessionCreate,
    TableSessionResponse,
    LiveBillSummary,
    CheckoutRequest
)
from app.services.billing_service import BillingService

router = APIRouter()


@router.post("/tables/{table_id}/open-session", response_model=TableSessionResponse, status_code=status.HTTP_201_CREATED)
def open_table_session(
    table_id: int,
    session_data: SessionCreate = SessionCreate(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start an active open session for a table (Status -> Occupied)"""
    return BillingService.open_table_session(db, table_id, customer_id=session_data.customer_id)


@router.post("/tables/{table_id}/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def add_order_to_table_session(
    table_id: int,
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Append a new order round (starters, main course, etc.) to the active open table session"""
    return BillingService.add_order_to_session(db, table_id, order_data)


@router.get("/tables/{table_id}/current-bill", response_model=LiveBillSummary)
def get_live_table_bill(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time live running bill summary for a table"""
    return BillingService.get_live_bill_summary(db, table_id)


@router.post("/tables/{table_id}/checkout", response_model=TableSessionResponse)
def checkout_table_bill(
    table_id: int,
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete final payment, mark bill as PAID, and vacate table (Status -> Available)"""
    return BillingService.checkout_and_close_session(db, table_id, checkout_data)
