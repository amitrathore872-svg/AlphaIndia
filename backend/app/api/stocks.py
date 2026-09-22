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


@router.get("/search", summary="Search Equities for Quick Symbol Switcher")
def search_stocks(
    q: str = Query(..., min_length=1, description="Symbol or Company name prefix"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Autocomplete endpoint for symbol search bar on the Technical Overview page.
    """
    clean_q = q.strip()
    results = (
        db.query(ScreenerGrowthRecord)
        .filter(
            or_(
                ScreenerGrowthRecord.symbol.ilike(f"{clean_q}%"),
                ScreenerGrowthRecord.company_name.ilike(f"%{clean_q}%"),
            )
        )
        .limit(limit)
        .all()
    )

    if not results:
        # Fallback to Company master table
        comp_results = (
            db.query(Company)
            .filter(
                or_(
                    Company.symbol.ilike(f"{clean_q}%"),
                    Company.company.ilike(f"%{clean_q}%"),
                )
            )
            .limit(limit)
            .all()
        )
        return [
            {
                "symbol": c.symbol,
                "company_name": c.company or c.symbol,
                "sector": c.sector or "General",
                "current_price": 100.0,
            }
            for c in comp_results
        ]

    return [
        {
            "symbol": r.symbol,
            "company_name": r.company_name or r.symbol,
            "sector": r.sector or "General",
            "current_price": r.current_price or 0.0,
        }
        for r in results
    ]
