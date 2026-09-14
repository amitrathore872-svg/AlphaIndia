"""
Alpha India — Early Stage Daily Summary Model  (Phase 3)
Compact time-series table used for trend sparklines and growth rate calculations.
One row per (candidate, date). Unique constraint prevents double-counting.
"""

from sqlalchemy import Column, Integer, Float, Date, ForeignKey, UniqueConstraint
from app.db.database import Base


class EarlyStageDaily(Base):
    __tablename__ = "early_stage_daily_summary"

    id            = Column(Integer, primary_key=True, index=True)
    candidate_id  = Column(Integer, ForeignKey("early_stage_candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    date          = Column(Date, nullable=False)
    mention_count = Column(Integer, nullable=False)
    trend_score   = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("candidate_id", "date", name="uq_esds_candidate_date"),
    )
