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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/momentum-screener", tags=["Multi-Timeframe Momentum Screener"])


@router.get("", response_model=Dict[str, Any])
def get_momentum_opportunities(
    min_matches: int = Query(default=6, ge=1, le=10, description="Minimum conditions matched"),
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
