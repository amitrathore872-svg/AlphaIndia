"""
Alpha India - Stocks API Router
Endpoints for complete institutional Stock Technical Overview, peer comparisons,
historical seasonality, and fast symbol search.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import get_db
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.stock_technical_service import StockTechnicalService

router = APIRouter(prefix="/api/stocks", tags=["Stock Technical Overview"])


@router.get("/{symbol}/technical-overview", summary="Get Complete Institutional Technical Overview for Stock")
def get_stock_technical_overview(
    symbol: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns complete multi-dimensional technical overview:
    - Setup Readiness & Score
    - Scenario Key Price References (Pivot, Trigger, Stop Loss, Targets, R:R)
    - Market Structure & Smart Money Concepts (ICT/SMC)
    - Setup Quality Gauges & Radar Metrics
    - Seasonality Matrix
    - AI Strategic Trade Insights & Structured FAQ
    - Sector Peer Comparison
    """
    data = StockTechnicalService.get_stock_technical_overview(symbol=symbol, db=db)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"Stock symbol '{symbol}' not found in Alpha India master database",
        )
    return data


POPULAR_WATCHLIST_SYMBOLS = [
    "RELIANCE",
    "TCS",
    "HDFCBANK",
    "INFY",
    "BHARTIARTL",
    "GENSOL",
    "ICICIBANK",
    "TATAMOTORS",
    "TATASTEEL",
    "LT",
]


@router.get("/search", summary="Search Equities for Quick Symbol Switcher & Screener Search")
def search_stocks(
    q: Optional[str] = Query(default="", description="Symbol or Company name search query"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Institutional autocomplete and company search endpoint (screener.in style).
    Searches across Master Companies universe (8,600+ equities) with smart relevance ranking:
    1. Exact symbol match
    2. Symbol prefix match
    3. Company name prefix match
    4. Substring symbol match
    5. Substring name match
    Prioritizes active equities and attaches live/warehouse market price.
    """
    from sqlalchemy import case, desc, func

    clean_q = (q or "").strip()

    if not clean_q:
        # Return popular bellwether / trending equities
        companies = (
            db.query(Company)
            .filter(Company.symbol.in_(POPULAR_WATCHLIST_SYMBOLS))
            .all()
        )
        # Order by position in POPULAR_WATCHLIST_SYMBOLS
        comp_map = {c.symbol: c for c in companies}
        ordered_comps = [comp_map[sym] for sym in POPULAR_WATCHLIST_SYMBOLS if sym in comp_map]

        symbols = [c.symbol for c in ordered_comps]
        prices_map = dict(
            db.query(ScreenerGrowthRecord.symbol, ScreenerGrowthRecord.current_price)
            .filter(ScreenerGrowthRecord.symbol.in_(symbols))
            .all()
        )

        return [
            {
                "symbol": c.symbol,
                "company_name": c.company or c.symbol,
                "sector": c.sector if c.sector and c.sector != "Unknown" else "Equities",
                "industry": c.industry if c.industry and c.industry != "Unknown" else "",
                "exchange": c.exchange or "NSE",
                "market_cap": c.market_cap if c.market_cap and c.market_cap != "Unknown" else None,
                "current_price": prices_map.get(c.symbol) or 0.0,
                "is_trending": True,
            }
            for c in ordered_comps
        ]

    # Smart Ranking expression
    rank_expr = case(
        (func.lower(Company.symbol) == clean_q.lower(), 0),
        (func.lower(Company.symbol).like(f"{clean_q.lower()}%"), 1),
        (func.lower(Company.company).like(f"{clean_q.lower()}%"), 2),
        (func.lower(Company.symbol).like(f"%{clean_q.lower()}%"), 3),
        else_=4,
    )
    active_expr = case((Company.listing_status == "Active", 0), else_=1)

    companies = (
        db.query(Company)
        .filter(
            or_(
                Company.symbol.ilike(f"%{clean_q}%"),
                Company.company.ilike(f"%{clean_q}%"),
            )
        )
        .order_by(
            rank_expr,
            active_expr,
            desc(case((Company.market_cap.isnot(None), 1), else_=0)),
        )
        .limit(limit)
        .all()
    )

    if not companies:
        # Fallback search directly in ScreenerGrowthRecord if any synthetic record exists
        screener_res = (
            db.query(ScreenerGrowthRecord)
            .filter(
                or_(
                    ScreenerGrowthRecord.symbol.ilike(f"%{clean_q}%"),
                    ScreenerGrowthRecord.company_name.ilike(f"%{clean_q}%"),
                )
            )
            .limit(limit)
            .all()
        )
        return [
            {
                "symbol": r.symbol,
                "company_name": r.company_name or r.symbol,
                "sector": r.sector or "General",
                "industry": "",
                "exchange": "NSE",
                "market_cap": getattr(r, "market_cap", None),
                "current_price": r.current_price or 0.0,
                "is_trending": False,
            }
            for r in screener_res
        ]

    symbols = [c.symbol for c in companies]
    prices_map = dict(
        db.query(ScreenerGrowthRecord.symbol, ScreenerGrowthRecord.current_price)
        .filter(ScreenerGrowthRecord.symbol.in_(symbols))
        .all()
    )

    return [
        {
            "symbol": c.symbol,
            "company_name": c.company or c.symbol,
            "sector": c.sector if c.sector and c.sector != "Unknown" else "Equities",
            "industry": c.industry if c.industry and c.industry != "Unknown" else "",
            "exchange": c.exchange or "NSE",
            "market_cap": c.market_cap if c.market_cap and c.market_cap != "Unknown" else None,
            "current_price": prices_map.get(c.symbol) or 0.0,
            "is_trending": False,
        }
        for c in companies
    ]

