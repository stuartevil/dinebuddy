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


# Models are imported in app/models/__init__.py for Alembic autogenerate