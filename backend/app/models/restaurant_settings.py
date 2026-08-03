from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin

class RestaurantSettings(Base, TimestampMixin):
    __tablename__ = "restaurant_settings"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), unique=True)

    tax_percentage = Column(Numeric(5, 2), nullable=True)
    service_charge = Column(Numeric(5, 2), nullable=True)
    auto_accept_orders = Column(Boolean, default=False, nullable=False)
    order_preparation_time = Column(Integer, nullable=True)  # in minutes

    # Back reference to Restaurant
    restaurant = relationship("Restaurant", back_populates="settings", uselist=False)
