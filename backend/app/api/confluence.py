"""
Alpha India - Apex Confluence API Router
/api/v1/confluence
Institutional Radar identifying high-probability confluence across 6 quantitative engines.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.confluence_engine import ConfluenceEngine

logger = logging.getLogger("alpha_india.api.confluence")

router = APIRouter(prefix="/confluence", tags=["Apex Confluence Radar"])


@router.get("", summary="Get institutional multi-engine confluence opportunities")
def get_confluence_radar(
    tier: Optional[str] = Query(None, description="APEX_TRIPLE, HIGH_DUAL, SOLITARY, or ALL"),
    min_score: float = Query(0.0, ge=0.0, le=100.0, description="Minimum Confluence Score (0-100)"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    force_refresh: bool = Query(False, description="Bypass cache and force recalculation"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns high-probability confluence candidates where 2 or more institutional engines
    (VCP, Cup & Handle, Chart Patterns, Momentum, Pre-Breakout, Delivery) independently concur.
    """
    data = ConfluenceEngine.get_confluence_matrix(db=db, force_refresh=force_refresh)

    apex_list = data.get("apex_candidates", [])
    dual_list = data.get("dual_candidates", [])
    solitary_list = data.get("solitary_alpha", [])

    def _matches_filters(item: Dict[str, Any]) -> bool:
        if min_score > 0 and item.get("confluence_score", 0) < min_score:
            return False
        if search:
            q = search.strip().upper()
            sym = item.get("symbol", "").upper()
            comp = item.get("company_name", "").upper()
            if q not in sym and q not in comp:
                return False
        if sector and sector.lower() != "all":
            if item.get("sector", "").lower() != sector.lower():
                return False
        return True

    filt_apex = [x for x in apex_list if _matches_filters(x)]
    filt_dual = [x for x in dual_list if _matches_filters(x)]
    filt_solitary = [x for x in solitary_list if _matches_filters(x)]

    # Flat list sorted by concurrence_count desc, confluence_score desc
    all_filtered = filt_apex + filt_dual + filt_solitary
    if tier:
        t_clean = tier.strip().upper()
        if "TRIPLE" in t_clean or "APEX" in t_clean:
            all_filtered = filt_apex
        elif "DUAL" in t_clean:
            all_filtered = filt_dual
        elif "SOLITARY" in t_clean:
            all_filtered = filt_solitary

    return {
        "status": "SUCCESS",
        "metadata": {
            **data.get("metadata", {}),
            "filtered_total": len(all_filtered),
            "apex_count": len(filt_apex),
            "dual_count": len(filt_dual),
            "solitary_count": len(filt_solitary),
        },
        "apex_candidates": filt_apex,
        "dual_candidates": filt_dual,
        "solitary_alpha": filt_solitary,
        "items": all_filtered,
    }
