import enum
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin, TimestampMixin


class SessionStatus(str, enum.Enum):
    OPEN = "open"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    OTHER = "other"


class TableSession(Base, IDMixin, TimestampMixin):
    __tablename__ = "table_sessions"

    restaurant_id = Column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id = Column(
        Integer, ForeignKey("restaurant_tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id = Column(
        Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    status = Column(
        SQLEnum(
            SessionStatus,
            name="sessionstatus",
            values_callable=lambda x: [e.value for e in x]
        ),
        default=SessionStatus.OPEN,
        nullable=False,
        index=True
    )
    
    subtotal = Column(Float, default=0.0, nullable=False)
    tax = Column(Float, default=0.0, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    
    payment_method = Column(
        SQLEnum(
            PaymentMethod,
            name="paymentmethod",
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=True
    )
    payment_notes = Column(String(255), nullable=True)
    
    opened_at = Column(DateTime, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    # Relationships
    table = relationship("RestaurantTable", back_populates="sessions")
    orders = relationship(
        "Order",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<TableSession {self.id} (Table: {self.table_id}, Status: {self.status})>"
