from sqlalchemy import (Column,Integer,String,Numeric,Boolean,ForeignKey, Index)
from app.db.base import Base, TimestampMixin


class MenuItemVariant(Base, TimestampMixin):
    __tablename__ = "menu_item_variants"

    id = Column(Integer, primary_key=True)

    item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(100), nullable=False)  # Small / Medium / Large
    price_adjustment = Column(Numeric(10, 2), nullable=False, default=0)
    is_default = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        # Fast lookup of variants per item
        Index("ix_menu_item_variants_item_id", "item_id"),

        # Prevent duplicate variant names per menu item
        Index(
            "uq_menu_item_variants_item_name",
            "item_id",
            "name",
            unique=True,
        ),
    )
