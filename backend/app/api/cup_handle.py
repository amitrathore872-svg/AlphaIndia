"""
Alpha India — Cup & Handle Pattern API Router
/api/v1/cup-handle
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.cup_handle.cup_handle_orchestrator import (
    scan_patterns,
    compute_stage_funnel,
)
from app.services.cup_handle.cup_handle_scheduler import CupHandleUniverseScheduler
from app.services.cup_handle.cup_handle_scan_state import get_state_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cup-handle", tags=["Cup & Handle AI Engine"])


# ---------------------------------------------------------------------------
# GET /cup-handle — Paginated, filtered, sorted pattern list
# ---------------------------------------------------------------------------

@router.get("", response_model=Dict[str, Any])
def get_cup_handle_patterns(
    min_score: int = Query(default=60, ge=0, le=100, description="Minimum AI conviction score"),
    conviction_tier: Optional[str] = Query(
        default=None, description="Filter: ELITE | HIGH CONVICTION | DEVELOPING"
    ),
    search: Optional[str] = Query(default=None, description="Filter by symbol or company name"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    breakout_only: bool = Query(default=False, description="Only show breakout-confirmed patterns"),
    sort_by: str = Query(default="ai_conviction_score", description="Sort column"),
    sort_order: str = Query(default="desc", description="asc | desc"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns AI-scored Cup & Handle breakout candidates.
    All 8 stages must pass; only high-conviction patterns surface here.
    """
    scan_data = scan_patterns(db=db, force_refresh=False)
    patterns = scan_data.get("patterns", [])
    metadata = scan_data.get("metadata", {})

    filtered = patterns

    # 1. Minimum conviction score
    filtered = [p for p in filtered if p.get("ai_conviction_score", 0) >= min_score]

    # 2. Conviction tier
    if conviction_tier:
        tier_lower = conviction_tier.strip().lower()
        filtered = [
            p for p in filtered
            if tier_lower in p.get("conviction_tier", "").lower()
        ]

    # 3. Search
    if search:
        s = search.strip().lower()
        filtered = [
            p for p in filtered
            if s in p.get("symbol", "").lower() or s in p.get("company_name", "").lower()
        ]

    # 4. Sector
    if sector and sector.upper() != "ALL":
        sec = sector.strip().lower()
        filtered = [p for p in filtered if sec in p.get("sector", "").lower()]

    # 5. Breakout confirmed only
    if breakout_only:
        filtered = [p for p in filtered if p.get("volume", {}).get("breakout_confirmed", False)]

    # 6. Sort
    reverse = sort_order.lower() == "desc"
    sort_keys = {
        "ai_conviction_score": lambda x: x.get("ai_conviction_score", 0),
        "cmp": lambda x: x.get("cmp", 0),
        "day_change_pct": lambda x: x.get("day_change_pct", 0),
        "cup_depth": lambda x: x.get("cup", {}).get("depth_pct", 0),
        "handle_depth": lambda x: x.get("handle", {}).get("depth_pct", 0),
        "symmetry": lambda x: x.get("cup", {}).get("symmetry_score", 0),
        "breakout_vol_ratio": lambda x: x.get("volume", {}).get("breakout_vol_ratio", 0),
        "risk_reward": lambda x: x.get("risk_reward", 0),
        "weekly_rsi": lambda x: x.get("trend", {}).get("weekly_rsi", 0),
    }
    key_fn = sort_keys.get(sort_by, lambda x: x.get("ai_conviction_score", 0))
    filtered.sort(key=key_fn, reverse=reverse)

    # 7. Paginate
    total_count = len(filtered)
    total_pages = max(1, (total_count + limit - 1) // limit)
    start = (page - 1) * limit
    items = filtered[start : start + limit]

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "items": items,
    }


# ---------------------------------------------------------------------------
# POST /cup-handle/scan — Trigger fresh scan
# ---------------------------------------------------------------------------

@router.post("/scan", response_model=Dict[str, Any])
def trigger_cup_handle_scan(db: Session = Depends(get_db)):
    """
    Forces an immediate fresh scan across the liquid NSE universe.
    Returns stale cache instantly and triggers scan in background.
    """
    scan_data = scan_patterns(db=db, force_refresh=True)
    return {
        "status": "SUCCESS",
        "message": "Cup & Handle scan triggered in background. Results will refresh shortly.",
        "metadata": scan_data.get("metadata", {}),
        "patterns_found": len(scan_data.get("patterns", [])),
    }


# ---------------------------------------------------------------------------
# GET /cup-handle/filters — Filter options
# ---------------------------------------------------------------------------

@router.get("/filters", response_model=Dict[str, Any])
def get_filter_options(db: Session = Depends(get_db)):
    """Returns sector list, conviction tiers, and stage definitions."""
    scan_data = scan_patterns(db=db, force_refresh=False)
    patterns = scan_data.get("patterns", [])

    sectors = sorted(list(set(p.get("sector", "Diversified") for p in patterns)))

    tiers = [
        {"id": "ELITE",           "label": "ELITE (score ≥ 82)",           "color": "emerald"},
        {"id": "HIGH CONVICTION", "label": "HIGH CONVICTION (score 70–81)", "color": "cyan"},
        {"id": "DEVELOPING",      "label": "DEVELOPING (score 60–69)",      "color": "amber"},
    ]

    stages = [
        {"id": "cup_geometry",         "label": "Cup Geometry",         "description": "U-shape with 15–50% depth, ≥ 7 week width, ≥ 85% right-lip recovery"},
        {"id": "handle_geometry",      "label": "Handle Geometry",      "description": "1–6 week drift 5–15%, in upper half of cup, volume contracting"},
        {"id": "volume_signature",     "label": "Volume Signature",     "description": "Base drying up + recovery surge + handle contraction + breakout confirmation"},
        {"id": "trend_integrity",      "label": "Trend Integrity",      "description": "Daily RSI 55–80, Weekly RSI ≥ 55, Monthly RSI ≥ 55, above 10-week EMA"},
        {"id": "base_quality",         "label": "Base Quality",         "description": "Handle std < 3.5%, inside bars, no gap-downs, volatility contracting"},
        {"id": "relative_strength",    "label": "Relative Strength",    "description": "12-week RS vs Nifty 500 outperformance"},
        {"id": "fundamentals",         "label": "Fundamental Quality",  "description": "Revenue growth > 0, PAT positive, ROCE > 10%, health score > 50"},
        {"id": "conviction_threshold", "label": "AI Conviction ≥ 60",   "description": "Composite AI score across all 8 dimensions"},
    ]

    return {
        "sectors": sectors,
        "conviction_tiers": tiers,
        "stages": stages,
        "metadata": scan_data.get("metadata", {}),
    }


# ---------------------------------------------------------------------------
# GET /cup-handle/funnel — Stage attrition waterfall
# ---------------------------------------------------------------------------

@router.get("/funnel", response_model=Dict[str, Any])
def get_stage_funnel(db: Session = Depends(get_db)):
    """
    Returns the 8-stage attrition waterfall showing how many stocks
    pass/fail each detection gate.
    """
    scan_data = scan_patterns(db=db, force_refresh=False)
    metadata = scan_data.get("metadata", {})
    stage_funnel = metadata.get("stage_funnel")

    if not stage_funnel:
        patterns = scan_data.get("patterns", [])
        stage_funnel = compute_stage_funnel(
            patterns, metadata.get("total_scanned", len(patterns))
        )

    return {
        "status": "SUCCESS",
        "metadata": metadata,
        "stage_funnel": stage_funnel,
    }


# ---------------------------------------------------------------------------
# GET /cup-handle/pattern/{symbol} — Deep-dive for single symbol
# ---------------------------------------------------------------------------

@router.get("/pattern/{symbol}", response_model=Dict[str, Any])
def get_pattern_detail(symbol: str, db: Session = Depends(get_db)):
    """
    Returns full Cup & Handle analysis for a single symbol.
    Runs a fresh analysis on-demand (bypasses scan cache).
    """
    from app.services.cup_handle.cup_handle_engine import analyze_symbol
    from app.services.cup_handle.cup_handle_orchestrator import _fetch_nifty_close

    clean_sym = symbol.strip().upper()
    nifty_close = _fetch_nifty_close()

    result = analyze_symbol(
        symbol=clean_sym,
        db=db,
        nifty_close=nifty_close,
    )

    if result is None:
        return {
            "status": "NOT_FOUND",
            "symbol": clean_sym,
            "message": (
                "No valid Cup & Handle pattern detected for this symbol. "
                "Pattern may not meet geometry, volume, or conviction thresholds."
            ),
            "pattern": None,
        }

    return {
        "status": "SUCCESS",
        "symbol": clean_sym,
        "pattern": result,
    }


# ---------------------------------------------------------------------------
# GET /cup-handle/elite — Only ELITE tier patterns
# ---------------------------------------------------------------------------

@router.get("/elite", response_model=Dict[str, Any])
def get_elite_patterns(db: Session = Depends(get_db)):
    """
    Returns only ELITE-tier Cup & Handle patterns (AI conviction score >= 82).
    These are the highest-conviction institutional breakout setups.
    """
    scan_data = scan_patterns(db=db, force_refresh=False)
    patterns = scan_data.get("patterns", [])
    metadata = scan_data.get("metadata", {})

    elite = [p for p in patterns if p.get("ai_conviction_score", 0) >= 82]
    elite.sort(key=lambda x: x.get("ai_conviction_score", 0), reverse=True)

    return {
        "metadata": metadata,
        "elite_count": len(elite),
        "patterns": elite,
    }


# ---------------------------------------------------------------------------
# GET /cup-handle/scheduler/status — Full-universe scheduler telemetry
# ---------------------------------------------------------------------------

@router.get("/scheduler/status", response_model=Dict[str, Any])
def get_scheduler_status():
    """
    Returns the full-universe tiered scheduler telemetry:
    - Universe size (total symbols tracked)
    - Symbols due for scan right now
    - Count per tier (ACTIVE, NEAR_BREAKOUT, DEVELOPING, EARLY_STAGE, ELIMINATED)
    - Last tick stats
    """
    telemetry = CupHandleUniverseScheduler.get_telemetry()
    return {
        "status": "SUCCESS",
        "scheduler_running": CupHandleUniverseScheduler.is_running(),
        "telemetry": telemetry,
        "tier_cooldowns": {
            "ACTIVE":        "10 minutes",
            "NEAR_BREAKOUT": "20 minutes",
            "DEVELOPING":    "6 hours",
            "EARLY_STAGE":   "3 days",
            "ELIMINATED":    "14 days",
        },
    }


# ---------------------------------------------------------------------------
# POST /cup-handle/scheduler/start — Start universe scheduler
# POST /cup-handle/scheduler/stop  — Stop universe scheduler
# ---------------------------------------------------------------------------

@router.post("/scheduler/start", response_model=Dict[str, Any])
def start_scheduler():
    """Starts the full-universe tiered background scheduler."""
    if CupHandleUniverseScheduler.is_running():
        return {"status": "ALREADY_RUNNING", "message": "Scheduler is already active."}
    CupHandleUniverseScheduler.start()
    return {"status": "STARTED", "message": "Full-universe Cup & Handle scheduler started."}


@router.post("/scheduler/stop", response_model=Dict[str, Any])
def stop_scheduler():
    """Stops the full-universe tiered background scheduler."""
    CupHandleUniverseScheduler.stop()
    return {"status": "STOPPED", "message": "Scheduler stopped."}


# ---------------------------------------------------------------------------
# GET /cup-handle/universe/stats — Universe composition stats
# ---------------------------------------------------------------------------

@router.get("/universe/stats", response_model=Dict[str, Any])
def get_universe_stats(db: Session = Depends(get_db)):
    """
    Returns NSE/BSE universe composition from the companies DB table.
    Shows how many symbols are tracked vs the total available.
    """
    from app.services.cup_handle.cup_handle_universe import get_universe_stats as _stats
    state_mgr = get_state_manager()
    db_stats = _stats(db)
    scan_stats = state_mgr.get_stats()
    return {
        "status": "SUCCESS",
        "db_universe": db_stats,
        "scan_state": scan_stats,
    }

