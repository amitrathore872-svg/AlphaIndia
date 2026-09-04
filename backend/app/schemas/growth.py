from datetime import date

from pydantic import BaseModel


class GrowthScreenerItem(BaseModel):
    company: str
    symbol: str
    sector: str
    marketCap: str
    quarter: str
    resultDate: date
    revenueGrowth: float
    patGrowth: float
    roce: float
    growthScore: float


class GrowthScreenerResponse(BaseModel):
    items: list[GrowthScreenerItem]
    page: int
    limit: int
    totalItems: int
    totalPages: int
    sectors: list[str]


class DashboardLeader(BaseModel):
    name: str
    score: float


class DashboardSummary(BaseModel):
    companiesTracked: int
    resultsToday: int
    averageGrowthScore: float
    currentLeader: DashboardLeader | None
    highGrowthStocks: int
