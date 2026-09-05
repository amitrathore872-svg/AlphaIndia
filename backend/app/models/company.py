from sqlalchemy import Column, Date, Float, Integer, String

from app.db.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    # NSE Identity
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    company = Column(String(200), nullable=False)
    isin = Column(String(20), unique=True, nullable=True)

    # Classification
    sector = Column(String, nullable=True, default="Unknown")
    industry = Column(String, nullable=True, default="Unknown")
    series = Column(String(20), nullable=True)

    # Listing
    listing_date = Column(Date, nullable=True)

    # Market Metrics
    market_cap = Column(String(50), default="Unknown")
    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)
    ai_score = Column(Float, default=0)