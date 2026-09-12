from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialImportQueue(Base):
    """
    Queue for Yahoo Finance warehouse imports.
    Sprint 31.1
    """

    __tablename__ = "financial_import_queue"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )

    symbol = Column(String(20), nullable=False, unique=True, index=True)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    attempts = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    imported_at = Column(DateTime, nullable=True)

    last_error = Column(String(500), nullable=True)

    company = relationship("Company")