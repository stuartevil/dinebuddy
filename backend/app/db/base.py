"""
Base class for SQLAlchemy models
Import all models here for Alembic auto-generation
"""
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, DateTime, Integer
from datetime import datetime


class Base(DeclarativeBase):
    """Base class for all database models"""
    pass


class TimestampMixin:
    """Mixin to add created_at and updated_at timestamps"""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class IDMixin:
    """Mixin to add auto-incrementing ID primary key"""
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)


# Import all models here so Alembic can detect them
from app.models.user import User  # noqa
from app.models.customer import Customer  # noqa
from app.models.restaurant import Restaurant  # noqa
from app.models.user_restaurant_map import UserRestaurant  # noqa
from app.models.menu_category import MenuCategory  # noqa
from app.models.menu_items import MenuItem  # noqa
from app.models.menu_item_variant import MenuItemVariant  # noqa
from app.models.restaurant_settings import RestaurantSettings  # noqa
from app.models.bulk_import_items import MenuItemImportJob  # noqa
from app.models.restaurant_table import RestaurantTable  # noqa
from app.models.table_session import TableSession  # noqa
from app.models.order import Order  # noqa
from app.models.order_item import OrderItem  # noqa
from app.models.ingredient import Ingredient  # noqa
from app.models.recipe_item import RecipeItem  # noqa
from app.models.stock_transaction import StockTransaction  # noqa