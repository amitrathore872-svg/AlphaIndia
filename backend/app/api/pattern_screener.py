"""
Alpha India — Multi-Pattern Screener API
=========================================
Endpoints for querying institutional-grade chart patterns across NSE/BSE:
  - Flat Base
  - Double Bottom (W)
  - Ascending Triangle
  - Bull Flag
  - High Tight Flag
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.pattern_engine.pattern_orchestrator import (
    get_pattern_results,
    analyze_all_patterns,
    _run_quick_scan,
)
from app.services.pattern_engine.pattern_core import sanitize_json
from app.services.pattern_engine.pattern_scheduler import PatternUniverseScheduler

logger = logging.getLogger("alpha_india.api.pattern_screener")

router = APIRouter(prefix="/chart-patterns", tags=["Chart Pattern Screener"])


@router.get("", summary="Get detected institutional chart patterns")
def list_patterns(
    pattern_type: Optional[str] = Query(None, description="FLAT_BASE, DOUBLE_BOTTOM, ASCENDING_TRIANGLE, BULL_FLAG, HIGH_TIGHT_FLAG"),
    min_score: float = Query(0.0, ge=0.0, le=100.0, description="Minimum AI Conviction Score (0-100)"),
    exchange: Optional[str] = Query(None, description="NSE or BSE"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    search: Optional[str] = Query(None, description="Symbol or Company name substring"),
    is_breakout: Optional[bool] = Query(None, description="Filter only active breakout candidates"),
    sort_by: str = Query("ai_conviction_score", description="Sort column: ai_conviction_score, breakout_distance_pct, daily_rsi, relative_strength_score"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    force_refresh: bool = Query(False, description="Trigger synchronous rescan"),
    db: Session = Depends(get_db),
):
    """
    Returns filtered and sorted institutional chart patterns.
    """
    res = get_pattern_results(db=db, force_refresh=force_refresh)
    patterns: List[Dict[str, Any]] = res.get("patterns", [])
    metadata: Dict[str, Any] = res.get("metadata", {})

    # 1. Filter by pattern_type
    if pattern_type:
        pt = pattern_type.upper().replace("-", "_").replace(" ", "_")
        patterns = [p for p in patterns if p.get("pattern_type") == pt]

    # 2. Filter by min_score
    if min_score > 0:
        patterns = [p for p in patterns if p.get("ai_conviction_score", 0) >= min_score]

    # 3. Filter by exchange
    if exchange:
        ex = exchange.upper()
        patterns = [p for p in patterns if p.get("exchange", "NSE").upper() == ex]

    # 4. Filter by sector
    if sector and sector.lower() != "all":
        patterns = [p for p in patterns if sector.lower() in p.get("sector", "").lower()]

    # 5. Filter by search
    if search:
        q = search.strip().upper()
        patterns = [
            p for p in patterns
            if q in p.get("symbol", "").upper() or q in p.get("company_name", "").upper()
        ]

    # 6. Filter by breakout status
    if is_breakout is not None:
        if is_breakout:
            patterns = [
                p for p in patterns
                if p.get("breakout_distance_pct", 999) <= 2.0 or p.get("is_breakout", False)
            ]

    # 7. Sort
    reverse = sort_order == "desc"

    def get_sort_key(p: Dict[str, Any]):
        val = p.get(sort_by)
        if val is None:
            # Check inside nested objects if relevant
            trend = p.get("trend", {})
            if isinstance(trend, dict) and sort_by in trend:
                val = trend[sort_by]
            breakout = p.get("breakout", {})
            if isinstance(breakout, dict) and sort_by in breakout:
                val = breakout[sort_by]
        if val is None:
            return -999999.0 if reverse else 999999.0
        try:
            return float(val)
        except (ValueError, TypeError):
            return str(val).lower()

    patterns.sort(key=get_sort_key, reverse=reverse)

    # 8. Paginate
    total_count = len(patterns)
    start_idx = (page - 1) * limit
    paged = patterns[start_idx : start_idx + limit]

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
        "patterns": paged,
    }


@router.get("/summary", summary="Aggregate summary of detected patterns")
def get_pattern_summary(db: Session = Depends(get_db)):
    """
    Returns breakdown across all 5 pattern categories, elite counts, and freshness.
    """
    res = get_pattern_results(db=db, force_refresh=False)
    patterns = res.get("patterns", [])
    metadata = res.get("metadata", {})

    breakdown = {
        "FLAT_BASE": 0,
        "DOUBLE_BOTTOM": 0,
        "ASCENDING_TRIANGLE": 0,
        "BULL_FLAG": 0,
        "HIGH_TIGHT_FLAG": 0,
    }
    for p in patterns:
        pt = p.get("pattern_type")
        if pt in breakdown:
            breakdown[pt] += 1

    elite = [p for p in patterns if p.get("ai_conviction_score", 0) >= 82]
    near_breakout = [p for p in patterns if p.get("breakout_distance_pct", 999) <= 2.5]

    return {
        "metadata": metadata,
        "total_detected": len(patterns),
        "elite_count": len(elite),
        "near_breakout_count": len(near_breakout),
        "breakdown": breakdown,
        "top_elite": elite[:5],
        "top_near_breakout": near_breakout[:5],
    }


@router.get("/scheduler/status", summary="Get background universe scan status")
def get_scheduler_status():
    """
    Returns telemetry for the full-universe pattern scanner.
    """
    return PatternUniverseScheduler.get_telemetry()


@router.post("/scheduler/start", summary="Start background universe scanner")
def start_scheduler():
    """Starts the full-universe scanner if stopped."""
    PatternUniverseScheduler.start()
    return {"status": "RUNNING", "message": "Pattern universe scheduler activated."}


@router.post("/scheduler/stop", summary="Stop background universe scanner")
def stop_scheduler():
    """Pauses the full-universe scanner."""
    PatternUniverseScheduler.stop()
    return {"status": "STOPPED", "message": "Pattern universe scheduler paused."}


@router.post("/scan-symbol", summary="On-demand live scan for a single symbol")
def scan_single_symbol(
    symbol: str = Query(..., description="NSE or BSE stock symbol, e.g. TRENT, ZOMATO"),
    exchange: str = Query("NSE", description="NSE or BSE"),
):
    """
    Executes live multi-pattern detection on a single stock and returns all matches.
    """
    matches = analyze_all_patterns(symbol=symbol.strip().upper(), exchange=exchange)
    return sanitize_json({
        "symbol": symbol.strip().upper(),
        "exchange": exchange,
        "matched_count": len(matches),
        "patterns": matches,
    })


@router.get("/pattern/{symbol}", summary="Get detected patterns for a specific symbol")
@router.get("/{symbol}", summary="Get detected patterns for a specific symbol")
def get_symbol_patterns(symbol: str, db: Session = Depends(get_db)):
    """
    Returns any currently active patterns for the given symbol from cache or live scan.
    """
    clean = symbol.strip().upper()
    res = get_pattern_results(db=db, force_refresh=False)
    matches = [p for p in res.get("patterns", []) if p.get("symbol") == clean]

    if not matches:
        # Fall back to quick on-demand scan
        matches = analyze_all_patterns(symbol=clean)

    return sanitize_json({
        "symbol": clean,
        "matched_count": len(matches),
        "patterns": matches,
    })
