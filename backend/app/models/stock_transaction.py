import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin


class TransactionType(str, enum.Enum):
    PURCHASE = "Purchase"
    SALE_DEDUCTION = "Sale_Deduction"
    WASTAGE = "Wastage"
    ADJUSTMENT = "Adjustment"


class StockTransaction(Base, IDMixin):
    __tablename__ = "stock_transactions"

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_id = Column(
        Integer,
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(
        SQLEnum(
            TransactionType,
            name="transactiontype",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )
    quantity = Column(Numeric(12, 3), nullable=False)  # Negative for deductions/wastage
    stock_after = Column(Numeric(12, 3), nullable=False)
    reference_id = Column(String(100), nullable=True, index=True)  # order_id or reference doc
    staff_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    staff = relationship("User", foreign_keys=[staff_id])

    __table_args__ = (
        Index("ix_stock_tx_restaurant_ingredient", "restaurant_id", "ingredient_id"),
        Index("ix_stock_tx_type", "type"),
    )

    def __repr__(self):
        return f"<StockTransaction id={self.id} type={self.type} qty={self.quantity} ingredient_id={self.ingredient_id}>"
