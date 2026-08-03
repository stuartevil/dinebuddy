from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from app.db.base import Base


class MenuItemImportJob(Base):
    __tablename__ = "bulk_import_items"

    id = Column(Integer, primary_key=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",  # PENDING | PROCESSING | COMPLETED | FAILED
    )

    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    errors = Column(JSON, default=list)
