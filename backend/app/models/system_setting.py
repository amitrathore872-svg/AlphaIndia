from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime

from app.db.database import Base


class SystemSetting(Base):
    """
    Stores configurable application settings.
    Everything in Alpha India Monitoring Engine will read from this table.
    """

    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Unique setting identifier
    setting_key = Column(String(100), unique=True, nullable=False, index=True)

    # Value stored as string. We'll convert based on setting_type.
    setting_value = Column(String(255), nullable=False)

    # Supported types:
    # boolean, integer, string, time
    setting_type = Column(String(30), nullable=False)

    description = Column(String(500))

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )