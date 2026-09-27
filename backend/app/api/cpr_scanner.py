"""
Alpha India - Narrow CPR Compression Scanner API
Sprint 38.5 Institutional Quant Scanner (Engine #11)

Endpoints:
- GET  /scanner/cpr: Paginated filtered list of CPR setups
- GET  /scanner/cpr/top: Top 25 narrowest compression candidates
- GET  /scanner/cpr/triple: Triple CPR confluence stocks
- GET  /scanner/cpr/watchlist: Breakout-ready setups
- GET  /scanner/cpr/summary: Discovery Engine telemetry card
- GET  /scanner/cpr/alerts: Recent real-time intraday alerts
- GET  /scanner/cpr/{symbol}: Comprehensive CPR deep-dive analysis
- POST /scanner/cpr/scan: On-demand universe recalculation
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.cpr_engine_service import CPREngineService
from app.services.cpr_alert_service import CPRAlertService

router = APIRouter(
    prefix="/scanner/cpr",
    tags=["CPR Compression Scanner"],
)


@router.get("", response_model=Dict[str, Any])
def get_cpr_scanner_results(
    width_max: Optional[float] = Query(None, description="Maximum CPR width % (e.g. 0.25)"),
    score_min: Optional[float] = Query(None, description="Minimum Compression Score (0-100)"),
    sector: Optional[str] = Query(None, description="Sector name filter"),
    marketcap: Optional[str] = Query(None, description="Market Cap Category: LARGE, MID, SMALL, MICRO"),
    min_marketcap_cr: Optional[float] = Query(1000.0, description="Minimum Market Cap in ₹ Crores (default 1000 Cr)"),
    min_price: Optional[float] = Query(30.0, description="Minimum share price in ₹ to filter penny stocks"),
    min_volume: Optional[float] = Query(25000.0, description="Minimum daily volume to filter illiquid stocks"),
    category: Optional[str] = Query(None, description="Compression Category: Ultra Compression, Very Strong, Strong, Average"),
    triple_cpr_only: bool = Query(False, description="Filter only Triple CPR stocks"),
    volume_dryup_only: bool = Query(False, description="Filter only Volume Dry-up stocks"),
    bullish_trend_only: bool = Query(False, description="Filter only stocks with Bullish Supertrend & 20 DMA"),
    search: Optional[str] = Query(None, description="Search ticker symbol or company name"),
    sort_by: str = Query("cpr_rank", description="Field to sort by: cpr_rank, cpr_width_pct, compression_score, breakout_score, current_price, volume"),
    sort_order: str = Query("asc", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated, multi-filtered CPR Compression setups with institutional rankings.
    """
    return CPREngineService.get_cpr_records(
        db=db,
        width_max=width_max,
        score_min=score_min,
        sector=sector,
        marketcap=marketcap,
        min_marketcap_cr=min_marketcap_cr,
        min_price=min_price,
        min_volume=min_volume,
        category=category,
        triple_cpr_only=triple_cpr_only,
        volume_dryup_only=volume_dryup_only,
        bullish_trend_only=bullish_trend_only,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


@router.get("/top", response_model=List[Dict[str, Any]])
def get_top_cpr_compression(
    limit: int = Query(25, ge=1, le=100, description="Number of top candidates"),
    db: Session = Depends(get_db),
):
    """
    Returns the Top 25 narrowest compression candidates across the entire NSE universe.
    """
    return CPREngineService.get_top_cpr_stocks(db=db, limit=limit)


@router.get("/triple", response_model=List[Dict[str, Any]])
def get_triple_cpr_candidates(
    limit: int = Query(50, ge=1, le=100, description="Number of triple CPR stocks"),
    db: Session = Depends(get_db),
):
    """
    Returns equities displaying simultaneous Daily, Weekly, and Monthly CPR Compression.
    """
    return CPREngineService.get_triple_cpr_stocks(db=db, limit=limit)


@router.get("/watchlist", response_model=List[Dict[str, Any]])
def get_cpr_breakout_watchlist(
    limit: int = Query(50, ge=1, le=100, description="Watchlist size"),
    db: Session = Depends(get_db),
):
    """
    Returns breakout-ready setups with High Compression Score and confirmed Bullish Trend.
    """
    return CPREngineService.get_cpr_watchlist(db=db, limit=limit)


@router.get("/transitions", response_model=List[Dict[str, Any]])
def get_cpr_transitions(
    timeframe: str = Query("monthly", description="Timeframe: daily, weekly, or monthly"),
    min_turnover_cr: float = Query(1.0, description="Minimum turnover in Crores to filter penny/illiquid stocks (default 1.0 Cr)"),
    min_marketcap_cr: float = Query(1000.0, description="Minimum Market Cap in ₹ Crores (default 1000 Cr to filter small illiquids)"),
    min_price: float = Query(30.0, description="Minimum share price in ₹ to filter penny stocks"),
    min_volume: float = Query(25000.0, description="Minimum 20-day average volume to filter illiquid stocks"),
    filter_mode: str = Query("elite_only", description="Filter mode: elite_only (all 8 gaps fixed), breakout_only, retest_only, coiled_only, all"),
    limit: int = Query(50, ge=1, le=100, description="Number of transition setups"),
    db: Session = Depends(get_db),
):
    """
    Returns stocks transitioning from Broad CPR (wide volatility) to Ultra-Narrow CPR zone
    across Daily, Weekly, or Monthly timelines with high expansion probability.
    Filters out penny stocks (< ₹30), illiquid stocks (< 1.0 Cr turnover, < 25k vol),
    and enforces Market Cap >= 1,000 Cr.
    """
    return CPREngineService.get_cpr_transitions(
        db=db,
        timeframe=timeframe,
        min_turnover_cr=min_turnover_cr,
        min_marketcap_cr=min_marketcap_cr,
        min_price=min_price,
        min_volume=min_volume,
        filter_mode=filter_mode,
        limit=limit,
    )


@router.get("/zerodha", response_model=List[Dict[str, Any]])
def get_zerodha_cpr_scanner(
    timeframe: str = Query("daily", description="Timeframe: hourly, daily, weekly, or monthly"),
    max_width_pct: Optional[float] = Query(None, description="Max CPR Width % threshold for 3 lines close (e.g. 0.25)"),
    max_dist_pct: Optional[float] = Query(None, description="Max distance % from CMP to CPR (e.g. 1.0)"),
    min_turnover_cr: float = Query(1.0, description="Minimum turnover in ₹ Cr (default 1.0 Cr)"),
    min_marketcap_cr: float = Query(1000.0, description="Minimum Market Cap in ₹ Cr (default 1000 Cr)"),
    min_price: float = Query(30.0, description="Minimum CMP in ₹ to filter penny stocks (default 30)"),
    sort_by: str = Query("cpr_width_pct", description="Sort by: cpr_width_pct, dist_to_cpr_pct, turnover_cr, market_cap_cr"),
    limit: int = Query(60, ge=1, le=150, description="Number of results"),
    db: Session = Depends(get_db),
):
    """
    Zerodha Kite identical CPR scanner across Hourly, Daily, Weekly, and Monthly timeframes.
    Scans for:
    1. 3 Lines Close (Narrow CPR: |TC - BC| / CMP * 100 <= max_width_pct)
    2. Stock Close to CPR (min(|CMP - TC|, |CMP - BC|, |CMP - Pivot|) / CMP * 100 <= max_dist_pct)
    Enforces Market Cap >= 1,000 Cr, CMP >= ₹30, Turnover >= ₹1 Cr.
    """
    return CPREngineService.scan_zerodha_cpr(
        db=db,
        timeframe=timeframe,
        max_width_pct=max_width_pct,
        max_dist_pct=max_dist_pct,
        min_turnover_cr=min_turnover_cr,
        min_marketcap_cr=min_marketcap_cr,
        min_price=min_price,
        sort_by=sort_by,
        limit=limit,
    )



@router.get("/summary", response_model=Dict[str, Any])
def get_cpr_discovery_summary(db: Session = Depends(get_db)):
    """
    Returns live Discovery Engine card metrics for the CPR Compression Scanner:
    Stocks Scanned, Ultra Compression, Triple CPR, Breakout Today, Alerts Triggered, Top Compression Stock.
    """
    records = CPREngineService.get_cpr_records(db=db, limit=5, sort_by="cpr_rank", sort_order="asc")
    summary = records.get("summary", {})
    top_stock = records.get("items", [{}])[0] if records.get("items") else None

    alerts = CPRAlertService.get_recent_alerts(limit=50)
    breakouts_today = sum(1 for a in alerts if "BREAKOUT" in a.get("alert_type", ""))

    return {
        "engine_id": "cpr_compression_engine",
        "engine_name": "CPR Compression Engine (Engine #11)",
        "status": "ONLINE",
        "stocks_scanned": summary.get("total_universe", 0),
        "ultra_compression_stocks": summary.get("ultra_compression", 0),
        "very_strong_stocks": summary.get("very_strong", 0),
        "triple_cpr_stocks": summary.get("triple_cpr", 0),
        "volume_dryup_stocks": summary.get("volume_dryup", 0),
        "breakout_today": breakouts_today,
        "alerts_triggered_count": len(alerts),
        "top_compression_stock": {
            "symbol": top_stock.get("symbol"),
            "cpr_width_pct": top_stock.get("cpr_width_pct"),
            "category": top_stock.get("category"),
            "compression_score": top_stock.get("compression_score"),
            "breakout_score": top_stock.get("breakout_score"),
            "cmp": top_stock.get("current_price"),
            "tc": top_stock.get("tc"),
            "target1": top_stock.get("target1"),
        } if top_stock else None,
        "last_scan_date": summary.get("date"),
    }


@router.get("/alerts", response_model=List[Dict[str, Any]])
def get_cpr_alerts_feed(
    limit: int = Query(50, ge=1, le=100),
):
    """
    Returns the real-time stream of fired intraday CPR breakout and retest alerts.
    """
    return CPRAlertService.get_recent_alerts(limit=limit)


@router.post("/scan", response_model=Dict[str, Any])
def trigger_cpr_universe_scan(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Triggers an immediate asynchronous or synchronous full NSE universe scan.
    """
    res = CPREngineService.execute_full_scan(db=db, persist=True)
    return res


@router.get("/{symbol}", response_model=Dict[str, Any])
def get_single_stock_cpr_analysis(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Returns granular CPR analysis, daily/weekly/monthly pivots, quality indicators,
    and trading plan for a specific equity.
    """
    detail = CPREngineService.get_stock_cpr_detail(symbol=symbol, db=db)
    if not detail:
        raise HTTPException(
            status_code=404,
            detail=f"CPR data for symbol '{symbol.upper()}' not found in active universe.",
        )
    return detail
