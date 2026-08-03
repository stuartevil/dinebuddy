from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.restaurant_table import TableCreate, TableUpdate, TableResponse
from app.services.table_service import TableService

router = APIRouter()


@router.post("/", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    table_data: TableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new restaurant table (Admin or Staff)"""
    return TableService.create_table(db, table_data)


@router.get("/restaurant/{restaurant_id}", response_model=List[TableResponse])
def list_restaurant_tables(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tables for a specific restaurant"""
    return TableService.list_tables(db, restaurant_id)


@router.get("/{table_id}", response_model=TableResponse)
def get_table_details(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details of a single table"""
    return TableService.get_table_by_id(db, table_id)


@router.patch("/{table_id}", response_model=TableResponse)
def update_table(
    table_id: int,
    table_data: TableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update table information or status"""
    return TableService.update_table(db, table_id, table_data)


@router.delete("/{table_id}", status_code=status.HTTP_200_OK)
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a table from the restaurant floor plan"""
    TableService.delete_table(db, table_id)
    return {"status": True, "message": "Table deleted successfully"}
