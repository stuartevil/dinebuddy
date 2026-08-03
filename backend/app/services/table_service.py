import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.restaurant_table import RestaurantTable, TableStatus
from app.schemas.restaurant_table import TableCreate, TableUpdate


class TableService:
    """Service to handle Table management"""

    @staticmethod
    def create_table(db: Session, data: TableCreate) -> RestaurantTable:
        # Check if table_number already exists in this restaurant
        existing = (
            db.query(RestaurantTable)
            .filter(
                RestaurantTable.restaurant_id == data.restaurant_id,
                RestaurantTable.table_number == data.table_number
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Table '{data.table_number}' already exists in this restaurant."
            )

        token = f"tbl_{uuid.uuid4().hex[:12]}"
        table = RestaurantTable(
            restaurant_id=data.restaurant_id,
            table_number=data.table_number,
            capacity=data.capacity,
            status=TableStatus.AVAILABLE,
            qr_code_token=token
        )
        db.add(table)
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def get_table_by_id(db: Session, table_id: int) -> RestaurantTable:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant table not found."
            )
        return table

    @staticmethod
    def list_tables(db: Session, restaurant_id: int) -> List[RestaurantTable]:
        return (
            db.query(RestaurantTable)
            .filter(RestaurantTable.restaurant_id == restaurant_id)
            .order_by(RestaurantTable.table_number.asc())
            .all()
        )

    @staticmethod
    def update_table(db: Session, table_id: int, data: TableUpdate) -> RestaurantTable:
        table = TableService.get_table_by_id(db, table_id)
        if data.table_number is not None:
            table.table_number = data.table_number
        if data.capacity is not None:
            table.capacity = data.capacity
        if data.status is not None:
            table.status = data.status
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def delete_table(db: Session, table_id: int) -> bool:
        table = TableService.get_table_by_id(db, table_id)
        db.delete(table)
        db.commit()
        return True
