
from pydantic import BaseModel
from typing import Optional


class CompanyResponse(BaseModel):
    id: int
    symbol: Optional[str] = None
    bse_code: Optional[str] = None
    isin: Optional[str] = None

    company: str

    exchange: Optional[str] = None

    sector: Optional[str] = None
    industry: Optional[str] = None
    
    market_cap: Optional[str] = None
    market_cap_category: Optional[str] = None

    revenue_growth: float = 0
    pat_growth: float = 0
    roce: float = 0
    ai_score: float = 0

    class Config:
        from_attributes = True