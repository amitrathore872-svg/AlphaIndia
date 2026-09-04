from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class QuarterlyResult(Base):
    __tablename__ = "quarterly_results"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"))

    quarter = Column(String(20), nullable=False)
    result_date = Column(Date, nullable=False)

    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)

    eps = Column(Float, default=0)
    operating_margin = Column(Float, default=0)
    net_profit_margin = Column(Float, default=0)

    company = relationship("Company")