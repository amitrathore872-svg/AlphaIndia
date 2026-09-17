"""
Institutional Smart Money & Mutual Fund Intelligence Router
Alpha India - Institutional Platform API
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.mf_analytics_service import MFAnalyticsService

router = APIRouter(
    prefix="/institutional",
    tags=["Institutional Intelligence"],
)


@router.get("/stats")
def get_macro_telemetry(db: Session = Depends(get_db)):
    """
    Returns top telemetry ribbon stats:
    - Smart Money Avg Score
    - Net Institutional Inflows (₹ Cr)
    - Active Schemes Flow (₹ Cr)
    - Stealth Base Alerts Count
    """
    return MFAnalyticsService.get_macro_stats(db)


@router.get("/schemes")
def get_all_schemes_catalog(db: Session = Depends(get_db)):
    """
    Returns complete master list of registered Mutual Fund Schemes with AMC details.
    """
    return MFAnalyticsService.get_all_schemes(db)


@router.get("/matrix")
def get_amc_scheme_matrix(
    market_cap_category: Optional[str] = Query("ALL", description="ALL, LARGE, MID, SMALL, MICRO"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    scheme_category: Optional[str] = Query("ALL", description="ALL, LARGE_CAP, MID_CAP, SMALL_CAP, FLEXI_CAP"),
    scheme_ids: Optional[str] = Query(None, description="Comma-separated scheme IDs"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    sort_by: str = Query("market_cap", description="Sort field: market_cap, total_mf_pct, symbol, total_value_cr, smart_money_score"),
    sort_order: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    """
    Cross-tabulated Full-Universe AMC Scheme Matrix with sticky left equity metadata
    and horizontal columns for 32+ AMC schemes.
    """
    parsed_scheme_ids: Optional[List[int]] = None
    if scheme_ids:
        try:
            parsed_scheme_ids = [int(sid.strip()) for sid in scheme_ids.split(",") if sid.strip()]
        except ValueError:
            parsed_scheme_ids = None

    return MFAnalyticsService.get_amc_matrix_data(
        db=db,
        market_cap_category=market_cap_category,
        search=search,
        sector=sector,
        scheme_category=scheme_category,
        scheme_ids=parsed_scheme_ids,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/fresh-entries")
def get_fresh_portfolio_entries(
    market_cap_category: Optional[str] = Query("ALL", description="ALL, LARGE, MID, SMALL, MICRO"),
    search: Optional[str] = Query(None, description="Search symbol, company, or scheme name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("market_value_cr", description="Sort field: market_value_cr, weight_pct, shares_held, symbol, amc_name"),
    sort_order: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    """
    Fresh Portfolio Entries Radar: newly initiated positions (NEW_ENTRY) in the latest reporting month.
    """
    return MFAnalyticsService.get_fresh_portfolio_entries(
        db=db,
        market_cap_category=market_cap_category,
        search=search,
        sector=sector,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/radar")
def get_institutional_screener(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    market_cap_category: Optional[str] = Query("ALL", description="Filter by cap: ALL, LARGE, MID, SMALL, MICRO"),
    filter_type: Optional[str] = Query(None, description="stealth, consensus, aggressive_add, pre_earnings"),
    sort_by: str = Query("smart_money_score", description="Sort field"),
    sort_order: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    """
    Server-side paginated screener ranked by Institutional Accumulation & Smart Money Score.
    """
    return MFAnalyticsService.get_institutional_radar_screener(
        db=db,
        page=page,
        limit=limit,
        search=search,
        sector=sector,
        market_cap_category=market_cap_category,
        filter_type=filter_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/stock/{symbol}")
def get_stock_institutional_intelligence(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Answers the 5 core institutional questions for any stock:
    1. Who is buying? Who is selling? Complete ownership table.
    2. Who increased or decreased holdings this month? Increase / Decrease tracker.
    3. Is institutional ownership increasing over time? Timeline graph.
    4. Why are funds buying? AI reasoning and primary driver.
    5. Is this a buy today? Entry zone + Target + Confidence.
    """
    result = MFAnalyticsService.get_stock_institutional_summary(db=db, symbol=symbol)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{symbol}' not found or no mutual fund data available.",
        )
    return result


@router.get("/sector-rotation")
def get_sector_rotation_matrix(db: Session = Depends(get_db)):
    """
    Returns monthly sector rotation matrix (Inflows/Outflows in ₹ Cr).
    """
    return MFAnalyticsService.get_sector_rotation_summary(db)


@router.get("/fund-managers")
def get_star_fund_managers_radar(db: Session = Depends(get_db)):
    """
    Returns top alpha fund managers and their recent accumulation setups.
    """
    return MFAnalyticsService.get_star_fund_managers(db)
