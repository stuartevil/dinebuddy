from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin, TimestampMixin


class RecipeItem(Base, IDMixin, TimestampMixin):
    __tablename__ = "recipe_items"

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_id = Column(
        Integer,
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity_used = Column(Numeric(12, 3), nullable=False)

    # Relationships
    menu_item = relationship("MenuItem", foreign_keys=[menu_item_id])
    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])

    __table_args__ = (
        Index("ix_recipe_items_menu_ingredient", "menu_item_id", "ingredient_id", unique=True),
    )

    def __repr__(self):
        return f"<RecipeItem menu_item_id={self.menu_item_id} ingredient_id={self.ingredient_id} qty={self.quantity_used}>"
