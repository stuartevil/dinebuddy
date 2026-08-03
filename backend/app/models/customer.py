"""
Customer model - OTP-based authentication for food ordering
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from datetime import datetime

from app.db.base import Base, IDMixin, TimestampMixin


class Customer(Base, IDMixin, TimestampMixin):
    
    __tablename__ = "customers"
    
    # Contact Info (Primary identifier)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    
    # Optional Profile Info
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
 
    # Tracking
    last_order_at = Column(DateTime, nullable=True)
    total_orders = Column(Integer, default=0, nullable=False)


