from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.db.database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)

    symbol = Column(String(30), nullable=False, index=True)

    company = Column(String(200), nullable=False)

    announcement_type = Column(String(100), nullable=False)

    quarter = Column(String(20), nullable=True)

    published_at = Column(DateTime, nullable=False)

    source_url = Column(String(500), nullable=True)

    status = Column(String(30), default="NEW")

    created_at = Column(DateTime, server_default=func.now())