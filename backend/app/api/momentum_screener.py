"""
Alpha India - Multi-Timeframe Bollinger Band & Triple-RSI Momentum Screener API
Endpoints for scanning and querying institutional momentum opportunities.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.momentum_screener_service import MomentumScreenerService
from app.services.momentum_universe_scanner import (
    MomentumUniverseScanner,
    MomentumIntradayMonitor,
    is_market_hours,
    is_off_market_window,
    NEAR_BREAKOUT_THRESHOLD,
    BREAKOUT_TRIGGER_THRESHOLD,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/momentum-screener", tags=["Multi-Timeframe Momentum Screener"])


@router.get("", response_model=Dict[str, Any])
def get_momentum_opportunities(
    min_matches: int = Query(default=9, ge=1, le=10, description="Minimum conditions matched"),
    require_strict: bool = Query(default=False, description="Require all core 9 filters to pass"),
    search: Optional[str] = Query(default=None, description="Filter by stock symbol or company name"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    sort_by: str = Query(default="match_count", description="Column to sort by"),
    sort_order: str = Query(default="desc", description="Sort order: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=25, ge=1, le=100, description="Page size limit"),
    db: Session = Depends(get_db),
):
    """
    Returns multi-timeframe momentum opportunities matching the Chartink criteria.
    """
    scan_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=False)
    opportunities = scan_data.get("opportunities", [])
    metadata = scan_data.get("metadata", {})

    filtered = opportunities

    # 1. Filter by minimum matches or strict mode
    if require_strict:
        filtered = [opp for opp in filtered if opp.get("core_9_passed", False)]
    elif min_matches > 0:
        filtered = [opp for opp in filtered if opp.get("match_count", 0) >= min_matches]

    # 2. Filter by search term
    if search:
        s_lower = search.strip().lower()
        filtered = [
            opp for opp in filtered
            if s_lower in opp.get("symbol", "").lower() or s_lower in opp.get("company_name", "").lower()
        ]

    # 3. Filter by sector
    if sector and sector.upper() != "ALL":
        sec_clean = sector.strip().lower()
        filtered = [
            opp for opp in filtered
            if sec_clean in opp.get("sector", "").lower()
        ]

    # 4. Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "match_count":
        filtered.sort(key=lambda x: (x.get("match_count", 0), x["indicators"].get("daily_rsi", 0)), reverse=reverse)
    elif sort_by == "daily_rsi":
        filtered.sort(key=lambda x: x["indicators"].get("daily_rsi", 0), reverse=reverse)
    elif sort_by == "weekly_rsi":
        filtered.sort(key=lambda x: x["indicators"].get("weekly_rsi", 0), reverse=reverse)
    elif sort_by == "monthly_rsi":
        filtered.sort(key=lambda x: x["indicators"].get("monthly_rsi", 0), reverse=reverse)
    elif sort_by == "cmp":
        filtered.sort(key=lambda x: x.get("cmp", 0), reverse=reverse)
    elif sort_by == "day_change_pct":
        filtered.sort(key=lambda x: x.get("day_change_pct", 0), reverse=reverse)
    elif sort_by == "volume_surge_ratio":
        filtered.sort(key=lambda x: x["indicators"].get("volume_surge_ratio", 0), reverse=reverse)
    else:
        filtered.sort(key=lambda x: x.get("match_count", 0), reverse=reverse)

    # 5. Pagination
    total_count = len(filtered)
    total_pages = max(1, (total_count + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_items = filtered[start_idx:end_idx]

    from app.services.stock_trend_enricher import StockTrendEnricher
    StockTrendEnricher.enrich(db, paginated_items, symbol_key="symbol", cmp_key="cmp")

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "items": paginated_items,
    }


@router.post("/scan", response_model=Dict[str, Any])
def trigger_momentum_scan(db: Session = Depends(get_db)):
    """
    Triggers an immediate fresh scan across the multi-timeframe universe.
    """
    scan_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=True)
    return {
        "status": "SUCCESS",
        "message": "Multi-timeframe momentum scan completed.",
        "metadata": scan_data.get("metadata", {}),
        "total_opportunities": len(scan_data.get("opportunities", [])),
    }


@router.get("/filters", response_model=Dict[str, Any])
def get_filter_options(db: Session = Depends(get_db)):
    """
    Returns available sector filters, match count tiers, and strategy condition definitions.
    """
    scan_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=False)
    opportunities = scan_data.get("opportunities", [])
    sectors = sorted(list(set(opp.get("sector", "Diversified") for opp in opportunities)))

    conditions = [
        {"id": "vol_gt_sma20", "label": "Daily Volume > Daily SMA(Volume, 20)", "timeframe": "Daily", "default_active": True},
        {"id": "daily_close_gt_bb_upper", "label": "Daily Close > Daily Upper Bollinger Band (20, 2)", "timeframe": "Daily", "default_active": True},
        {"id": "weekly_close_gt_bb_upper", "label": "Weekly Close > Weekly Upper Bollinger Band (20, 2)", "timeframe": "Weekly", "default_active": True},
        {"id": "daily_rsi_gt_60", "label": "Daily RSI (14) > 60", "timeframe": "Daily", "default_active": True},
        {"id": "weekly_rsi_gt_60", "label": "Weekly RSI (14) > 60", "timeframe": "Weekly", "default_active": True},
        {"id": "monthly_rsi_gt_60", "label": "Monthly RSI (14) > 60", "timeframe": "Monthly", "default_active": True},
        {"id": "weekly_wma_cross", "label": "Weekly WMA (30) Crossed Above or > WMA (50)", "timeframe": "Weekly", "default_active": True},
        {"id": "weekly_wma30_gt_60", "label": "Weekly WMA (30) > 60", "timeframe": "Weekly", "default_active": True},
        {"id": "weekly_wma50_gt_60", "label": "Weekly WMA (50) > 60", "timeframe": "Weekly", "default_active": True},
        {"id": "daily_close_gt_open", "label": "Daily Close > Daily Open (Bull Candle)", "timeframe": "Daily", "default_active": False},
    ]

    return {
        "sectors": sectors,
        "conditions": conditions,
        "metadata": scan_data.get("metadata", {}),
    }


@router.get("/funnel", response_model=Dict[str, Any])
def get_momentum_stage_funnel(db: Session = Depends(get_db)):
    """
    Returns the stage-by-stage filter attrition waterfall for the Multi-Timeframe Momentum Screener.
    Shows the exact count of candidates entered, passed, and filtered out at each condition stage.
    """
    scan_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=False)
    metadata = scan_data.get("metadata", {})
    stage_funnel = metadata.get("stage_funnel")
    if not stage_funnel:
        opportunities = scan_data.get("opportunities", [])
        stage_funnel = MomentumScreenerService.compute_stage_funnel(
            opportunities, metadata.get("total_scanned", len(opportunities))
        )

    return {
        "status": "SUCCESS",
        "metadata": metadata,
        "stage_funnel": stage_funnel,
    }



# ─────────────────────────────────────────────────────────────────
# Universe Scan Endpoints (Full NSE/BSE Universe — Off-Market Deep Scan)
# ─────────────────────────────────────────────────────────────────

@router.get("/universe/status", response_model=Dict[str, Any])
def get_universe_scan_status(db: Session = Depends(get_db)):
    """
    Returns the current status of the full-universe off-market scanner:
    - Whether a scan is currently in progress
    - Last scan metadata (from disk cache)
    - Market hours status
    - Watchlist summary from DB
    """
    cache_data = MomentumUniverseScanner.load_universe_cache()
    watchlist_summary = MomentumIntradayMonitor.get_watchlist_summary(db)

    return {
        "is_market_hours": is_market_hours(),
        "is_off_market_window": is_off_market_window(),
        "universe_scan_in_progress": MomentumUniverseScanner.is_scan_in_progress(),
        "near_breakout_threshold": NEAR_BREAKOUT_THRESHOLD,
        "breakout_trigger_threshold": BREAKOUT_TRIGGER_THRESHOLD,
        "last_universe_scan": cache_data.get("metadata") if cache_data else None,
        "watchlist_summary": watchlist_summary,
    }


@router.post("/universe/scan", response_model=Dict[str, Any])
def trigger_universe_scan(db: Session = Depends(get_db)):
    """
    Triggers an off-market full universe sweep in the background.
    Scans ALL active NSE/BSE equities, promotes ≥7/10 condition matches
    into the live intraday watchlist.
    """
    result = MomentumUniverseScanner.trigger_background_universe_scan(db=db)
    return {
        **result,
        "is_market_hours": is_market_hours(),
        "near_breakout_threshold": NEAR_BREAKOUT_THRESHOLD,
    }


@router.get("/universe/results", response_model=Dict[str, Any])
def get_universe_scan_results(
    min_matches: int = Query(default=7, ge=1, le=10, description="Minimum conditions matched"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    min_mcap: float = Query(default=1000.0, ge=0.0, description="Minimum market cap in Rs Cr"),
    min_price: float = Query(default=20.0, ge=0.0, description="Minimum CMP (penny stock filter)"),
    min_turnover_lakhs: float = Query(default=50.0, ge=0.0, description="Minimum 20d turnover in Rs Lakhs"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns the last full-universe scan results filtered by minimum match count,
    market cap (>= 1,000 Cr), non-penny price (>= Rs 20), and liquidity (turnover >= Rs 50L).
    """
    cache_data = MomentumUniverseScanner.load_universe_cache()
    if not cache_data:
        return {
            "status": "NO_CACHE",
            "message": "No universe scan results yet. Trigger /universe/scan to start.",
            "metadata": {},
            "items": [],
            "total_count": 0,
            "total_pages": 0,
        }

    results = cache_data.get("results", [])
    metadata = dict(cache_data.get("metadata", {}))

    # Apply institutional filters
    filtered = []
    for r in results:
        if r.get("match_count", 0) < min_matches:
            continue
        cmp = r.get("cmp") or 0.0
        if cmp < min_price:
            continue
        turnover = r.get("turnover_lakhs")
        if turnover is not None and turnover < min_turnover_lakhs:
            continue
        mcap = r.get("market_cap_cr")
        if mcap is not None and mcap < min_mcap:
            continue
        if sector and sector.upper() != "ALL":
            sec_lower = sector.strip().lower()
            if sec_lower not in (r.get("sector") or "").lower():
                continue
        filtered.append(r)

    total_count = len(filtered)
    total_pages = max(1, (total_count + limit - 1) // limit)
    start = (page - 1) * limit
    items = filtered[start:start + limit]

    from app.services.stock_trend_enricher import StockTrendEnricher
    StockTrendEnricher.enrich(db, items, symbol_key="symbol", cmp_key="cmp")

    return {
        "status": "SUCCESS",
        "metadata": {
            **metadata,
            "filtered_count": total_count,
            "min_mcap_applied": min_mcap,
            "min_price_applied": min_price,
            "min_turnover_applied": min_turnover_lakhs,
        },
        "items": items,
        "total_count": total_count,
        "total_pages": total_pages,
        "page": page,
        "limit": limit,
    }


# ─────────────────────────────────────────────────────────────────
# Watchlist & Intraday Breakout Monitor Endpoints
# ─────────────────────────────────────────────────────────────────

@router.get("/watchlist", response_model=Dict[str, Any])
def get_momentum_watchlist(db: Session = Depends(get_db)):
    """
    Returns today's watchlist candidates — stocks that passed ≥7/10 conditions
    in the last off-market universe scan and are now being monitored live.
    """
    summary = MomentumIntradayMonitor.get_watchlist_summary(db)
    return {
        "status": "SUCCESS",
        "is_market_hours": is_market_hours(),
        **summary,
    }


@router.get("/intraday-breakouts", response_model=Dict[str, Any])
def get_intraday_breakouts(db: Session = Depends(get_db)):
    """
    Returns live intraday breakout status for all watchlist candidates.
    Serves cached results (60s TTL) to enable high-frequency frontend polling.
    Breakout = watchlist stock now scoring ≥9/10 conditions during market hours.
    """
    result = MomentumIntradayMonitor.run_intraday_scan(db=db, force=False)
    return {
        "is_market_hours": is_market_hours(),
        **result,
    }


@router.post("/intraday-breakouts/refresh", response_model=Dict[str, Any])
def refresh_intraday_breakouts(db: Session = Depends(get_db)):
    """
    Forces a fresh re-scoring of all watchlist candidates.
    Useful for manual refresh during market hours.
    """
    MomentumIntradayMonitor.trigger_background_intraday_scan(db=db)
    return {
        "status": "STARTED",
        "message": "Intraday breakout rescan launched in background.",
        "is_market_hours": is_market_hours(),
    }
