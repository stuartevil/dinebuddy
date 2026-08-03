from sqlalchemy import (Column,Integer,String,Boolean,ForeignKey,UniqueConstraint)
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class MenuCategory(Base, TimestampMixin):
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True)
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=True,  # NULL allowed for global categories
        index=True,
    )

    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_global = Column(Boolean, default=False, nullable=False)

    restaurant = relationship("Restaurant", back_populates="menu_categories")