from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin, TimestampMixin


class OrderItem(Base, IDMixin, TimestampMixin):
    __tablename__ = "order_items"

    order_id = Column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id = Column(
        Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id = Column(
        Integer, ForeignKey("menu_item_variants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    special_instructions = Column(String(255), nullable=True)

    # Relationships
    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", foreign_keys=[menu_item_id])

    @property
    def name(self) -> str:
        return self.menu_item.name if self.menu_item else f"Item #{self.menu_item_id}"

    def __repr__(self):
        return f"<OrderItem Item: {self.menu_item_id}, Qty: {self.quantity}, Price: {self.total_price}>"
