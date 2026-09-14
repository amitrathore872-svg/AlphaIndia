from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class EarlyStageCandidate(Base):
    __tablename__ = "early_stage_candidate"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), nullable=False)
    tentative_ticker = Column(String(20), nullable=True)
    source = Column(String(100), nullable=False)  # e.g., 'Moneycontrol', 'Reddit', etc.
    first_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    mention_count = Column(Integer, default=0, nullable=False)
    trend_score = Column(Float, default=0.0, nullable=False)
    sentiment = Column(Enum('positive', 'neutral', 'negative', name='sentiment_enum'), default='neutral')
    status = Column(Enum('suggested', 'imported', 'ignored', name='candidate_status'), default='suggested')
    sector = Column(String(100), nullable=True)
