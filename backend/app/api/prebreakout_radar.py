"""
Alpha India - Pre-Breakout Cheat Radar API Router
Endpoints for querying and scanning pre-breakout contraction coils before they explode.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.prebreakout_radar_service import PreBreakoutRadarService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pre-breakout-radar", tags=["Pre-Breakout Cheat Radar"])


@router.get("", response_model=Dict[str, Any])
def get_prebreakout_opportunities(
    min_score: int = Query(default=60, ge=20, le=100, description="Minimum conviction score"),
    pattern: Optional[str] = Query(default="ALL", description="ALL, NR7, INSIDE_DAY, SUPER_COIL, VDU_CHEAT, BB_SQUEEZE"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
    search: Optional[str] = Query(default=None, description="Filter by stock symbol or company name"),
    sort_by: str = Query(default="conviction_score", description="Column to sort by"),
    sort_order: str = Query(default="desc", description="Sort order: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=25, ge=1, le=100, description="Page size limit"),
    db: Session = Depends(get_db),
):
    """
    Returns pre-breakout cheat opportunities filtered by conviction and pattern.
    """
    scan_data = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=False)
    opportunities = scan_data.get("opportunities", [])
    metadata = scan_data.get("metadata", {})

    filtered = opportunities

    # 1. Filter by minimum score
    if min_score > 0:
        filtered = [opp for opp in filtered if opp.get("conviction_score", 0) >= min_score]

    # 2. Filter by pattern tag
    if pattern and pattern.upper() != "ALL":
        p_clean = pattern.upper().strip()
        filtered = [
            opp for opp in filtered
            if opp.get("pattern_tag") == p_clean
            or p_clean in [b.upper().replace(" ", "_") for b in opp.get("pattern_badges", [])]
            or (p_clean == "NR7" and opp["metrics"].get("is_nr7"))
            or (p_clean == "INSIDE_DAY" and opp["metrics"].get("is_inside_day"))
            or (p_clean == "VDU_CHEAT" and opp["metrics"].get("is_vdu"))
            or (p_clean == "BB_SQUEEZE" and opp["metrics"].get("is_bb_squeeze"))
        ]

    # 3. Filter by sector
    if sector and sector.upper() != "ALL":
        s_clean = sector.strip().lower()
        filtered = [
            opp for opp in filtered
            if s_clean in opp.get("sector", "").lower()
        ]

    # 4. Filter by search term
    if search:
        s_term = search.strip().lower()
        filtered = [
            opp for opp in filtered
            if s_term in opp.get("symbol", "").lower() or s_term in opp.get("company_name", "").lower()
        ]

    # 5. Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "conviction_score":
        filtered.sort(key=lambda x: x.get("conviction_score", 0), reverse=reverse)
    elif sort_by == "dist_to_pivot_pct":
        filtered.sort(key=lambda x: x["metrics"].get("dist_to_pivot_pct", 99.0), reverse=reverse)
    elif sort_by == "vdu_ratio":
        filtered.sort(key=lambda x: x["metrics"].get("vdu_ratio", 1.0), reverse=reverse)
    elif sort_by == "cmp":
        filtered.sort(key=lambda x: x.get("cmp", 0), reverse=reverse)
    elif sort_by == "day_change_pct":
        filtered.sort(key=lambda x: x.get("day_change_pct", 0), reverse=reverse)
    elif sort_by == "risk_reward":
        filtered.sort(key=lambda x: x["blueprint"].get("risk_reward", 0), reverse=reverse)
    else:
        filtered.sort(key=lambda x: x.get("conviction_score", 0), reverse=reverse)

    # 6. Pagination
    total_count = len(filtered)
    total_pages = max(1, (total_count + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered[start_idx:end_idx]

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "items": paginated,
    }


@router.post("/scan", response_model=Dict[str, Any])
def trigger_prebreakout_scan(db: Session = Depends(get_db)):
    """
    Triggers an immediate live scan across the pre-breakout universe.
    """
    scan_data = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=True)
    return {
        "status": "SUCCESS",
        "message": "Pre-breakout cheat scan completed.",
        "metadata": scan_data.get("metadata", {}),
        "total_opportunities": len(scan_data.get("opportunities", [])),
    }


@router.get("/filters", response_model=Dict[str, Any])
def get_prebreakout_filter_options(db: Session = Depends(get_db)):
    """
    Returns available patterns and sectors.
    """
    scan_data = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=False)
    opportunities = scan_data.get("opportunities", [])
    sectors = sorted(list(set(opp.get("sector", "Diversified") for opp in opportunities)))

    patterns = [
        {"id": "ALL", "label": "All Pre-Breakout Coils"},
        {"id": "SUPER_COIL", "label": "NR7 + Inside Day (Super-Coil)"},
        {"id": "NR7", "label": "NR7 Range Contraction"},
        {"id": "INSIDE_DAY", "label": "Inside Day Compression"},
        {"id": "VDU_CHEAT", "label": "Volume Dry-Up (VDU Cheat)"},
        {"id": "BB_SQUEEZE", "label": "Bollinger Bandwidth Squeeze"},
    ]

    return {
        "sectors": sectors,
        "patterns": patterns,
        "metadata": scan_data.get("metadata", {}),
    }
