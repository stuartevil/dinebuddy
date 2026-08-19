"""
RestaurantCustomer model - Tracks per-restaurant customer verification & visit metrics
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base, IDMixin, TimestampMixin


class RestaurantCustomer(Base, IDMixin, TimestampMixin):
    __tablename__ = "restaurant_customers"

    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    phone = Column(String(20), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    visit_count = Column(Integer, default=1, nullable=False)
    last_visit_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    restaurant = relationship("Restaurant", backref="restaurant_customers")
    customer = relationship("Customer", backref="restaurant_memberships")
