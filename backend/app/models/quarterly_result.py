"""
Alpha India Quarterly Financial Warehouse
Sprint 30.2 Production Model
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class QuarterlyResult(Base):
    __tablename__ = "quarterly_results"
    __table_args__ = (
        UniqueConstraint("company_id", "period_end", name="uq_quarterly_results_company_period"),
        Index("idx_qr_company_period", "company_id", "period_end"),
        Index("idx_qr_company_id", "company_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)


    # ----------------------------------------------------------------
    # Legacy Compatibility
    # ----------------------------------------------------------------
    quarter = Column(String(20), nullable=True)

    # ----------------------------------------------------------------
    # Financial Warehouse
    # ----------------------------------------------------------------
    fiscal_period = Column(String(20), index=True)
    period_end = Column(Date, index=True)
    result_date = Column(Date)

    revenue = Column(Float)
    operating_income = Column(Float)
    net_profit = Column(Float)
    eps = Column(Float)

    interest_income = Column(Float)
    interest_expense = Column(Float)
    net_interest_income = Column(Float)

    total_assets = Column(Float)
    total_equity = Column(Float)
    total_debt = Column(Float)

    book_value = Column(Float)

    operating_cash_flow = Column(Float)
    free_cash_flow = Column(Float)

    revenue_growth = Column(Float)
    pat_growth = Column(Float)
    roce = Column(Float)

    @property
    def operating_margin(self) -> Optional[float]:
        """Safe dynamic calculation of operating margin %."""
        if hasattr(self, "_operating_margin_override") and self._operating_margin_override is not None:
            return self._operating_margin_override
        if self.revenue and self.operating_income:
            return round((self.operating_income / self.revenue) * 100.0, 2)
        return None

    @operating_margin.setter
    def operating_margin(self, val: Optional[float]):
        self._operating_margin_override = val

    @property
    def net_profit_margin(self) -> Optional[float]:
        """Safe dynamic calculation of net profit margin %."""
        if hasattr(self, "_net_profit_margin_override") and self._net_profit_margin_override is not None:
            return self._net_profit_margin_override
        if self.revenue and self.net_profit:
            return round((self.net_profit / self.revenue) * 100.0, 2)
        return None

    @net_profit_margin.setter
    def net_profit_margin(self, val: Optional[float]):
        self._net_profit_margin_override = val

    source = Column(String(30), default="YAHOO_FINANCE")
    imported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    company = relationship("Company")