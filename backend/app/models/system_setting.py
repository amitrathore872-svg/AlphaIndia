"""
Alpha India System Settings Model
Stores scheduler configuration and application settings.
"""

from sqlalchemy import Column, Integer, String

from app.db.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    setting_key = Column(String(100), unique=True, index=True)

    setting_value = Column(String(255))