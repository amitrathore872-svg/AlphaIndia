from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialImportAudit(Base):
    """
    Alpha India Financial Warehouse Audit

    One audit record per imported company.
    Used for warehouse health monitoring and repair engine.
    """

    __tablename__ = "financial_import_audit"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    symbol = Column(
        String(30),
        nullable=False,
        unique=True,
        index=True,
    )

    quarter_count = Column(Integer, default=0)

    missing_revenue = Column(Integer, default=0)
    missing_profit = Column(Integer, default=0)
    missing_eps = Column(Integer, default=0)
    missing_period = Column(Integer, default=0)

    duplicate_quarters = Column(Integer, default=0)

    health_score = Column(Integer, default=100)

    status = Column(
        String(20),
        default="UNKNOWN",
        index=True,
    )

    audited_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company")