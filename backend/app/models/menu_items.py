from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    ForeignKey,
    Numeric,
    Index,
)
from app.db.base import Base, TimestampMixin
from sqlalchemy import Time
from datetime import time


class MenuItem(Base, TimestampMixin):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    category_id = Column(
        Integer,
        ForeignKey("menu_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    price = Column(Numeric(10, 2), nullable=False)

    image_url = Column(String(512), nullable=True)

    is_available = Column(Boolean, nullable=False, server_default="true")
    is_vegetarian = Column(Boolean, nullable=False, server_default="false")
    available_from = Column(Time, nullable=True)  # e.g. 07:00
    available_to = Column(Time, nullable=True)
    preparation_time_minutes = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_menu_items_restaurant_category", "restaurant_id", "category_id"),
        Index("ix_menu_items_availability", "is_available"),
        Index("ix_menu_items_time_window", "available_from", "available_to"),
    )