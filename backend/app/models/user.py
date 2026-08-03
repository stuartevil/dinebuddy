"""
User model - Basic customer/admin authentication
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum   
from sqlalchemy.orm import relationship
import enum

from app.db.base import Base, IDMixin, TimestampMixin


class UserRole(str, enum.Enum):
    """User roles for authenticated users (credential-based login)"""
    ADMIN = "admin"
    RESTAURANT_ADMIN = "restaurant_admin"  # restaurant owner/manager
    RESTAURANT_STAFF = "restaurant_staff"


class User(Base, IDMixin, TimestampMixin):
    """
    User model for authenticated staff (credential-based login)
    
    Supports two roles:
    - ADMIN: Platform administrators (you and your team)
    - RESTAURANT_STAFF: Restaurant employees who manage orders
    
    Note: Customers are in a separate table with OTP-based authentication.
    """
    __tablename__ = "users"
    
    # Authentication (credential-based)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # Role & Status
    role = Column(
        SQLEnum(
            UserRole,
            name="userrole",
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Tracking
    last_login = Column(DateTime, nullable=True)
    
    # Relation between user and restaurant
    restaurants = relationship(
        "Restaurant",
        secondary="user_restaurants_map",
        back_populates="users",
    )

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
    
    @property
    def is_admin(self) -> bool:
        """Check if user is a platform admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_restaurant_staff(self) -> bool:
        """Check if user is restaurant staff"""
        return self.role == UserRole.RESTAURANT_STAFF

    @property
    def is_restaurant_admin(self) -> bool:
        """Check if user is restaurant admin"""
        return self.role == UserRole.RESTAURANT_ADMIN