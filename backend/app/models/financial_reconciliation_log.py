"""
Alpha India Financial Reconciliation Log Model
Sprint 23 — Mission Control Pipeline Validation
Tracks all Screener.in vs official NSE corporate filing comparisons, variance %,
difference diagnosis, and actions taken under the ±2% tolerance rule.
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.db.database import Base


class FinancialReconciliationLog(Base):
    __tablename__ = "financial_reconciliation_log"

    id = Column(Integer, primary_key=True, index=True)

    company_symbol = Column(String(20), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    quarter = Column(String(50), nullable=False, index=True)  # e.g., "Q1 FY25" or "Jun 2024"
    field_name = Column(String(100), nullable=False, index=True)  # Revenue, PAT, EPS, etc.

    screener_value = Column(Float, nullable=True)
    nse_value = Column(Float, nullable=True)
    variance_pct = Column(Float, nullable=True)  # ((nse - screener) / abs(screener)) * 100

    diagnosis = Column(String(100), nullable=False)
    # ROUND_OFF, UNIT_CONVERSION, PARSER_EXTRACTION_ERROR, REVISED_NSE_FILING, MISSING_SCREENER_VALUE, EXACT_MATCH

    action_taken = Column(String(100), nullable=False)
    # EXACT_MATCH_NO_UPDATE, WITHIN_TOLERANCE_NO_UPDATE, UPDATED_FROM_NSE, FILLED_FROM_NSE, PARSE_ERROR_SENT_TO_AUDIT

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
