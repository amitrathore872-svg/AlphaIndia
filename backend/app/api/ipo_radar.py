"""
Alpha India — Mainboard IPO Radar API Router
============================================
Institutional screening endpoints for Mainboard NSE/BSE IPOs:
  - Blue-Sky Listing Day High (LDH) Breakouts
  - IPO Base & Cheat Pivots
  - SEBI 30-Day & 90-Day Anchor Lock-In Tracker
  - Broken Phoenix Turnaround Reclaims
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, BackgroundTasks
from pydantic import BaseModel

from app.services.ipo_radar_service import IPORadarService

logger = logging.getLogger("alpha_india.api.ipo_radar")

router = APIRouter(prefix="/v1/ipo-radar", tags=["Mainboard IPO Radar"])


@router.get("/summary", summary="Get high-level Mainboard IPO Radar statistics")
def get_summary():
    """
    Returns aggregate counts of monitored Mainboard IPOs and active setup breakdowns.
    """
    data = IPORadarService.scan_all(force_refresh=False)
    return data.get("summary", {})


@router.get("/setups", summary="List detected Mainboard IPO setups with filters and pagination")
def list_ipo_setups(
    setup_type: Optional[str] = Query(None, description="LDH_BREAKOUT, IPO_BASE_CHEAT, IPO_BASE, ANCHOR_SPRING, BROKEN_PHOENIX"),
    setup_status: Optional[str] = Query(None, description="READY, TRIGGERED, FORMING, PRE_CLIFF_WATCH"),
    min_score: float = Query(0.0, ge=0.0, le=100.0, description="Minimum Conviction Score"),
    market_cap_tier: Optional[str] = Query(None, description="ALL, LARGE, MID, SMALL"),
    listing_age: Optional[str] = Query(None, description="ALL, FRESH_30D, BASE_3M, BASE_1Y"),
    search: Optional[str] = Query(None, description="Filter by symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    sort_by: str = Query("conviction_score", description="Sort field"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    force_refresh: bool = Query(False, description="Force a live re-scan"),
):
    """
    Returns paginated, sorted, and filtered active Mainboard IPO setups.
    """
    data = IPORadarService.scan_all(force_refresh=force_refresh)
    candidates: List[Dict[str, Any]] = list(data.get("candidates", []))

    # 1. Filter by setup_type
    if isinstance(setup_type, str) and setup_type.strip() and setup_type != "ALL":
        st = setup_type.upper().strip()
        candidates = [c for c in candidates if st in c.get("setup_type", "").upper()]

    # 2. Filter by setup_status
    if isinstance(setup_status, str) and setup_status.strip() and setup_status != "ALL":
        ss = setup_status.upper().strip()
        candidates = [c for c in candidates if c.get("setup_status", "").upper() == ss]

    # 3. Filter by min_score
    if isinstance(min_score, (int, float)) and min_score > 0.0:
        candidates = [c for c in candidates if c.get("conviction_score", 0.0) >= min_score]

    # 4. Filter by market_cap_tier
    if isinstance(market_cap_tier, str) and market_cap_tier.strip() and market_cap_tier != "ALL":
        mct = market_cap_tier.upper().strip()
        if mct == "LARGE":
            candidates = [c for c in candidates if (c.get("market_cap") or 0) >= 20000]
        elif mct == "MID":
            candidates = [c for c in candidates if 5000 <= (c.get("market_cap") or 0) < 20000]
        elif mct == "SMALL":
            candidates = [c for c in candidates if 0 < (c.get("market_cap") or 0) < 5000]

    # 5. Filter by listing_age
    if isinstance(listing_age, str) and listing_age.strip() and listing_age != "ALL":
        la = listing_age.upper().strip()
        if la == "FRESH_30D":
            candidates = [c for c in candidates if (c.get("days_since_listing") or 999) <= 30]
        elif la == "BASE_3M":
            candidates = [c for c in candidates if 30 < (c.get("days_since_listing") or 0) <= 90]
        elif la == "BASE_1Y":
            candidates = [c for c in candidates if 90 < (c.get("days_since_listing") or 0) <= 365]

    # 6. Filter by search
    if isinstance(search, str) and search.strip():
        s = search.lower().strip()
        candidates = [
            c for c in candidates
            if s in c.get("symbol", "").lower() or s in c.get("company", "").lower()
        ]

    # 7. Filter by sector
    if isinstance(sector, str) and sector.strip() and sector != "ALL":
        sec = sector.lower().strip()
        candidates = [c for c in candidates if sec in c.get("sector", "").lower()]

    # 8. Sorting
    reverse = (sort_order == "desc")
    valid_sort_keys = [
        "conviction_score", "cmp", "day_change_pct", "risk_pct", "days_since_listing",
        "rvol", "return_90d_pct", "distance_to_pivot_pct", "pivot_price", "trigger_price",
        "trigger_date", "days_since_trigger", "target_1", "stop_loss", "market_cap",
        "symbol", "ath", "drawdown_from_ath"
    ]
    if sort_by in valid_sort_keys:
        candidates.sort(key=lambda x: (x.get(sort_by) if x.get(sort_by) is not None else -999999), reverse=reverse)
    else:
        candidates.sort(key=lambda x: x.get("conviction_score", 0.0), reverse=True)

    # 9. Pagination
    total = len(candidates)
    start_idx = (page - 1) * limit
    paged = candidates[start_idx : start_idx + limit]

    return {
        "summary": data.get("summary", {}),
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
        "items": paged,
    }


@router.get("/lockin-calendar", summary="Get upcoming SEBI 30-Day and 90-Day Anchor Lock-In dates")
def get_lockin_calendar(
    days_window: int = Query(45, ge=1, le=90, description="Window of days ahead to track")
):
    """
    Returns calendar of upcoming anchor unlock dates for Mainboard equities.
    """
    data = IPORadarService.scan_all(force_refresh=False)
    candidates = data.get("candidates", [])
    
    cliff_list = []
    for c in candidates:
        d30 = c.get("anchor_30d_days_left", 999)
        d90 = c.get("anchor_90d_days_left", 999)
        cmp_val = c.get("cmp", 0.0)
        d1_low = c.get("day1_low", 0.0)
        
        status_calc = lambda d: "IMMINENT" if 0 <= d <= 3 else ("TODAY" if d == 0 else "ABSORPTION_ZONE" if d < 0 else "APPROACHING")
        profit_calc = "IN_PROFIT" if cmp_val >= d1_low else "UNDERWATER"

        if -7 <= d30 <= days_window:
            cliff_list.append({
                "symbol": c["symbol"],
                "company": c["company"],
                "listing_date": c["listing_date"],
                "cliff_type": "30-Day (50% Quota)",
                "unlock_date": c["anchor_30d_date"],
                "days_left": d30,
                "cmp": cmp_val,
                "status": status_calc(d30),
                "profit_status": profit_calc,
                "day1_high": c["day1_high"],
                "day1_low": d1_low,
                "sparkline": c.get("sparkline", []),
                "return_90d_pct": c.get("return_90d_pct", 0.0),
            })
        elif -7 <= d90 <= days_window:
            cliff_list.append({
                "symbol": c["symbol"],
                "company": c["company"],
                "listing_date": c["listing_date"],
                "cliff_type": "90-Day (100% Quota)",
                "unlock_date": c["anchor_90d_date"],
                "days_left": d90,
                "cmp": cmp_val,
                "status": status_calc(d90),
                "profit_status": profit_calc,
                "day1_high": c["day1_high"],
                "day1_low": d1_low,
                "sparkline": c.get("sparkline", []),
                "return_90d_pct": c.get("return_90d_pct", 0.0),
            })

    cliff_list.sort(key=lambda x: x["days_left"])
    return {
        "total_upcoming": len(cliff_list),
        "calendar": cliff_list
    }


@router.post("/rescan", summary="Trigger a fresh synchronous scan of the Mainboard IPO universe")
def trigger_rescan():
    """
    Forces an immediate rescan of all candidate Mainboard IPOs.
    """
    data = IPORadarService.scan_all(force_refresh=True)
    return {
        "status": "success",
        "message": "IPO Radar re-scanned successfully",
        "summary": data.get("summary", {})
    }


class IPOTelegramDispatchRequest(BaseModel):
    symbol: str
    force: bool = True


@router.post("/dispatch-telegram", summary="Dispatch Telegram Alert for a specific Mainboard IPO Setup")
def dispatch_ipo_telegram(
    req: IPOTelegramDispatchRequest
):
    """
    Immediately formats and dispatches an institutional Telegram alert for the specified IPO setup.
    """
    cand = IPORadarService.get_candidate_by_symbol(req.symbol)
    if not cand:
        return {"success": False, "error": f"Candidate setup for '{req.symbol}' not found in active IPO radar universe."}

    res = IPORadarService.dispatch_telegram_alert(cand, force=req.force)
    return res

