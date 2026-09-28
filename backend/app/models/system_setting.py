"""
Alpha India System Settings Model
Stores scheduler configuration and application settings.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime

from app.db.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    setting_key = Column(String(100), unique=True, index=True)

    setting_value = Column(Text, nullable=True)

    setting_type = Column(String(30), default="json", nullable=False)

    description = Column(String(500), nullable=True)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)