from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    func,
)

from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialMetric(Base):
    __tablename__ = "financial_metrics"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )

    period = Column(String(20), nullable=False)
    period_type = Column(String(20), default="Quarterly")

    revenue = Column(Numeric(18, 2))
    revenue_growth = Column(Numeric(10, 2))

    pat = Column(Numeric(18, 2))
    pat_growth = Column(Numeric(10, 2))

    ebitda_margin = Column(Numeric(10, 2))

    roce = Column(Numeric(10, 2))
    roe = Column(Numeric(10, 2))

    debt_equity = Column(Numeric(10, 2))
    promoter_holding = Column(Numeric(10, 2))

    eps = Column(Numeric(10, 2))
    eps_growth = Column(Numeric(10, 2))

    pe_ratio = Column(Numeric(10, 2))

    ai_score = Column(Numeric(10, 2), default=0)

    scanned_at = Column(DateTime, server_default=func.now())

    company = relationship("Company")