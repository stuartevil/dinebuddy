from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Numeric,
    Date,
    ForeignKey,
    Index,
)
from app.db.base import Base, IDMixin, TimestampMixin


class Ingredient(Base, IDMixin, TimestampMixin):
    __tablename__ = "ingredients"

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    unit = Column(String(50), nullable=False)  # kg, g, litre, ml, piece
    current_stock_qty = Column(Numeric(12, 3), nullable=False, server_default="0.000")
    reorder_threshold = Column(Numeric(12, 3), nullable=False, server_default="0.000")
    reorder_qty = Column(Numeric(12, 3), nullable=False, server_default="0.000")
    cost_per_unit = Column(Numeric(10, 2), nullable=False, server_default="0.00")
    supplier_name = Column(String(255), nullable=True)
    supplier_contact = Column(String(255), nullable=True)
    track_expiry = Column(Boolean, nullable=False, server_default="false")
    expiry_date = Column(Date, nullable=True)

    __table_args__ = (
        Index("ix_ingredients_restaurant_category", "restaurant_id", "category"),
        Index("ix_ingredients_restaurant_name", "restaurant_id", "name"),
    )

    def __repr__(self):
        return f"<Ingredient id={self.id} name='{self.name}' stock={self.current_stock_qty} {self.unit}>"
