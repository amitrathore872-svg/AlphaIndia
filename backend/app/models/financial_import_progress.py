"""
Alpha India Financial Import Progress Model
Sprint 31.4.2
"""

from sqlalchemy import Column, Integer, String, Float, DateTime

from app.db.database import Base


class FinancialImportProgress(Base):
    __tablename__ = "financial_import_progress"

    id = Column(Integer, primary_key=True, index=True)

    status = Column(String(20), default="IDLE")

    processed = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    failed = Column(Integer, default=0)

    current_symbol = Column(String(30))

    started_at = Column(DateTime)
    updated_at = Column(DateTime)

    eta_minutes = Column(Float, default=0)