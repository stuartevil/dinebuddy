from sqlalchemy import Column, String, Boolean, JSON
from app.db.base import Base, IDMixin, TimestampMixin
from sqlalchemy.orm import relationship


class Restaurant(Base, IDMixin, TimestampMixin):
    __tablename__ = "restaurants"

    name = Column(
        String,
        nullable=False,
        unique=True,
        doc="The unique name of the restaurant."
    )

    slug = Column(
        String,
        nullable=False,
        unique=True,
        index=True,
        doc="URL-safe unique slug"
    )

    address = Column(String, nullable=True)
    city = Column(String, nullable=True, doc="City where the restaurant is located")
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    timezone = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    business_hours = Column(JSON, nullable=True, doc="Business hours as JSON dict with day: time-range format")
    description = Column(String, nullable=True)
    cuisine_type = Column(String, nullable=True)

    # Relation between user and Restaurant
    users = relationship(
        "User",
        secondary="user_restaurants_map",
        back_populates="restaurants")

    settings = relationship(
        "RestaurantSettings",
        back_populates="restaurant",
        uselist=False,  # One-to-one
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    menu_categories = relationship(
        "MenuCategory",
        back_populates="restaurant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
