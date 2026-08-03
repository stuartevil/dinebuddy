import enum
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base, IDMixin, TimestampMixin


class TableStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    OUT_OF_SERVICE = "out_of_service"


class RestaurantTable(Base, IDMixin, TimestampMixin):
    __tablename__ = "restaurant_tables"

    restaurant_id = Column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_number = Column(String(50), nullable=False)
    capacity = Column(Integer, default=4, nullable=False)
    status = Column(
        SQLEnum(
            TableStatus,
            name="tablestatus",
            values_callable=lambda x: [e.value for e in x]
        ),
        default=TableStatus.AVAILABLE,
        nullable=False,
        index=True
    )
    qr_code_token = Column(String(100), unique=True, nullable=True, index=True)

    # Relationships
    sessions = relationship(
        "TableSession",
        back_populates="table",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<RestaurantTable {self.table_number} ({self.status})>"
