from sqlalchemy import (Column, Integer, String, Numeric, Boolean, ForeignKey, Index)
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class AddonGroup(Base, TimestampMixin):
    __tablename__ = "addon_groups"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)
    min_selectable = Column(Integer, default=0, nullable=False)
    max_selectable = Column(Integer, default=10, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    options = relationship("AddonOption", back_populates="group", cascade="all, delete-orphan", lazy="joined")
    restaurant = relationship("Restaurant")


class AddonOption(Base, TimestampMixin):
    __tablename__ = "addon_options"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer,
        ForeignKey("addon_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False, default=0.00)
    is_available = Column(Boolean, default=True, nullable=False)

    # Relationship
    group = relationship("AddonGroup", back_populates="options")


class MenuItemAddonGroupMap(Base, TimestampMixin):
    __tablename__ = "menu_item_addon_group_map"

    item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id = Column(
        Integer,
        ForeignKey("addon_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
