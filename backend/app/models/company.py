from sqlalchemy import Column, Float, Integer, String

from app.db.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    symbol = Column(String(30), unique=True, nullable=False, index=True)
    company = Column(String(200), nullable=False)
    sector = Column(String(120), nullable=False)

    market_cap = Column(String(50), default="Unknown")

    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)

    ai_score = Column(Float, default=0)