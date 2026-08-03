import enum
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin, TimestampMixin


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_KITCHEN = "in_kitchen"
    SERVED = "served"
    CANCELLED = "cancelled"


class Order(Base, IDMixin, TimestampMixin):
    __tablename__ = "orders"

    table_session_id = Column(
        Integer, ForeignKey("table_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    status = Column(
        SQLEnum(
            OrderStatus,
            name="orderstatus",
            values_callable=lambda x: [e.value for e in x]
        ),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True
    )
    
    subtotal = Column(Float, default=0.0, nullable=False)
    tax = Column(Float, default=0.0, nullable=False)
    total = Column(Float, default=0.0, nullable=False)

    # Relationships
    session = relationship("TableSession", back_populates="orders")
    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<Order {self.order_number} (Session: {self.table_session_id}, Status: {self.status})>"
