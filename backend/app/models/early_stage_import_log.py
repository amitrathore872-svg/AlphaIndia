"""
Alpha India — Early Stage Import Log Model  (Phase 4)
Records each bulk-import action: which candidate was imported,
which company was created, when, and from which source.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base


class EarlyStageImportLog(Base):
    __tablename__ = "early_stage_import_log"

    id           = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("early_stage_candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=False)
    imported_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source       = Column(String(100), nullable=False)
