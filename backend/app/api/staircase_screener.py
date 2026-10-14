"""
Alpha India - Staircase Momentum & Creeping Bull Screener API Router
Endpoints for querying institutional low-volatility staircase runners (The Cupid Archetype).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.staircase_screener_service import StaircaseScreenerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/staircase-screener", tags=["Staircase Momentum Radar"])


@router.get("", response_model=Dict[str, Any])
def get_staircase_opportunities(
    min_score: int = Query(default=50, ge=20, le=100, description="Minimum conviction score"),
    tier: Optional[str] = Query(default="ALL", description="ALL, STEALTH_ACCUMULATOR, EARLY_STAIRCASE, ESTABLISHED_RUNNER, EXTENDED_RUNNER"),
    tennis_ball_only: bool = Query(default=False, description="Filter only stocks resilient on Nifty down days"),
    search: Optional[str] = Query(default=None, description="Filter by stock symbol"),
    sort_by: str = Query(default="conviction_score", description="Column to sort by: conviction_score, ker_10d, green_days_10d, cmp, day_change_pct, down_day_alpha_pct, down_day_rs_ratio_pct"),
    sort_order: str = Query(default="desc", description="Sort order: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=25, ge=1, le=100, description="Page size limit"),
    db: Session = Depends(get_db),
):
    """
    Returns screened staircase / creeping bull opportunities filtered by conviction, tier, and Tennis Ball RS.
    """
    scan_data = StaircaseScreenerService.scan_universe(db=db, force_refresh=False)
    opportunities = scan_data.get("opportunities", [])
    metadata = scan_data.get("metadata", {})

    filtered = opportunities

    # 1. Filter by minimum score
    if min_score > 0:
        filtered = [opp for opp in filtered if opp.get("conviction_score", 0) >= min_score]

    # 2. Filter by tier
    if tier and tier.upper() != "ALL":
        t_clean = tier.upper().strip()
        if t_clean in ("CUPID_ARCHETYPE", "STEALTH_ACCUMULATOR"):
            filtered = [opp for opp in filtered if opp.get("setup_tier") in ("STEALTH_ACCUMULATOR", "CUPID_ARCHETYPE")]
        else:
            filtered = [opp for opp in filtered if opp.get("setup_tier") == t_clean]

    # 3. Filter by Tennis Ball RS
    if tennis_ball_only:
        filtered = [opp for opp in filtered if opp.get("metrics", {}).get("is_tennis_ball", False)]

    # 4. Filter by search query
    if search and search.strip():
        q = search.strip().upper()
        filtered = [opp for opp in filtered if q in opp.get("symbol", "").upper()]

    # 5. Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "conviction_score":
        filtered.sort(key=lambda x: x.get("conviction_score", 0), reverse=reverse)
    elif sort_by == "ker_10d":
        filtered.sort(key=lambda x: x.get("metrics", {}).get("ker_10d", 0), reverse=reverse)
    elif sort_by == "green_days_10d":
        filtered.sort(key=lambda x: x.get("metrics", {}).get("green_days_10d", 0), reverse=reverse)
    elif sort_by == "cmp":
        filtered.sort(key=lambda x: x.get("cmp", 0), reverse=reverse)
    elif sort_by == "day_change_pct":
        filtered.sort(key=lambda x: x.get("day_change_pct", 0), reverse=reverse)
    elif sort_by == "distance_from_base_pct":
        filtered.sort(key=lambda x: x.get("metrics", {}).get("distance_from_base_pct", 0), reverse=reverse)
    elif sort_by == "down_day_alpha_pct":
        filtered.sort(key=lambda x: x.get("metrics", {}).get("down_day_alpha_pct", 0), reverse=reverse)
    elif sort_by == "down_day_rs_ratio_pct":
        filtered.sort(key=lambda x: x.get("metrics", {}).get("down_day_rs_ratio_pct", 0), reverse=reverse)

    # 5. Pagination
    total_count = len(filtered)
    start_idx = (page - 1) * limit
    paginated_items = filtered[start_idx : start_idx + limit]

    default_metadata = {
        "total_scanned": len(opportunities),
        "total_opportunities": len(opportunities),
        "stealth_accumulator_count": 0,
        "cupid_archetype_count": 0,
        "early_staircase_count": 0,
        "established_count": 0,
        "tennis_ball_count": 0,
        "avg_ker_10d": 0.0,
        "last_scan_time": "",
    }
    merged_metadata = {
        **default_metadata,
        **metadata,
        "total_filtered": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
    }

    return {
        "opportunities": paginated_items,
        "metadata": merged_metadata,
        "cached": scan_data.get("cached", False),
    }


@router.post("/refresh", response_model=Dict[str, Any])
def refresh_staircase_scan(db: Session = Depends(get_db)):
    """
    Forces an immediate live rescan of the universe.
    """
    scan_data = StaircaseScreenerService.scan_universe(db=db, force_refresh=True)
    return {
        "status": "success",
        "message": f"Scan completed. Found {len(scan_data.get('opportunities', []))} staircase setups.",
        "metadata": scan_data.get("metadata", {}),
    }
