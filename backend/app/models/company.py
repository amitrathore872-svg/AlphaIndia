from sqlalchemy import Column, Integer, String, Float, Date
from app.db.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    # Master identifiers
    isin = Column(String(20), unique=True, index=True)
    symbol = Column(String(30), index=True)
    bse_code = Column(String(20), index=True)

    company = Column(String(255), nullable=False)

    exchange = Column(String(20), default="NSE")

    sector = Column(String(150))
    industry = Column(String(200))

    series = Column(String(20))
    listing_date = Column(Date)

    market_cap = Column(String(50))
    market_cap_category = Column(String(30))

    face_value = Column(Float)

    listing_status = Column(String(20), default="Active")

    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)

    ai_score = Column(Float, default=0)