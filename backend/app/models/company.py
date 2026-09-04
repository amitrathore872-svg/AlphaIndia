from sqlalchemy import Column, Float, Integer, String

from app.db.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    company = Column(String(150), nullable=False, unique=True)
    sector = Column(String(100), nullable=False)

    market_cap = Column(String(50))

    revenue_growth = Column(Float)
    pat_growth = Column(Float)
    roce = Column(Float)

    ai_score = Column(Float)