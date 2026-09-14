"""
Alpha India — Early Stage Temp Cache Model
Stores raw payloads from discovery collectors. Rows are
automatically purged every 30 minutes by the cache eviction job.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.database import Base


class EarlyStageTempCache(Base):
    __tablename__ = "early_stage_temp_cache"

    id         = Column(Integer, primary_key=True, index=True)
    source     = Column(String(100), nullable=False, index=True)
    payload    = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
