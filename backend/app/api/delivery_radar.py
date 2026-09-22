"""
Alpha India - Delivery Breakout & Institutional Radar API Router
Endpoints for scanning institutional delivery spikes, 50-day breakout setups,
and trade execution blueprints.
"""

from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Query, HTTPException
from app.services.delivery_screener_service import DeliveryScreenerService

router = APIRouter(
    prefix="/delivery-radar",
    tags=["Delivery Breakout Radar"],
)


@router.get("/opportunities", summary="Get Institutional Delivery Breakout Opportunities")
def get_delivery_opportunities(
    lookback_sessions: int = Query(1, ge=1, le=10, description="Number of recent market sessions to scan (1 = latest session)"),
    min_spike: float = Query(2.5, ge=1.0, description="Minimum delivery volume multiplier (e.g. 2.5x 10-day SMA)"),
    min_deliv_per: float = Query(65.0, ge=30.0, le=100.0, description="Minimum delivery percentage (e.g. 65%)"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    setup_type: Optional[str] = Query("ALL", description="ALL, 50D_BREAKOUT, NEAR_PIVOT_BASE"),
    min_conviction: Optional[float] = Query(None, description="Minimum conviction score (0 - 100)"),
    sort_by: str = Query("conviction_score", description="conviction_score, delivery_per, delivery_spike_x, current_price, day_change_pct"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
) -> Dict[str, Any]:
    raw_data = DeliveryScreenerService.scan_opportunities(
        force_refresh=False,
        min_spike=min_spike,
        min_deliv_per=min_deliv_per,
        lookback_sessions=lookback_sessions,
    )
    items = raw_data.get("opportunities", [])
    metadata = raw_data.get("metadata", {})

    # 1. Search filter
    if search:
        s_lower = search.strip().lower()
        items = [
            x for x in items
            if s_lower in x["symbol"].lower() or s_lower in x["company_name"].lower()
        ]

    # 2. Sector filter
    if sector and sector.upper() != "ALL":
        items = [x for x in items if x.get("sector", "").lower() == sector.lower()]

    # 3. Setup type filter
    if setup_type and setup_type.upper() != "ALL":
        items = [x for x in items if x["setup_type"] == setup_type.upper()]

    # 4. Conviction filter
    if min_conviction is not None:
        items = [x for x in items if x["conviction_score"] >= min_conviction]

    # 5. Sorting
    reverse_sort = (sort_order.lower() == "desc")
    if sort_by in ["conviction_score", "delivery_per", "delivery_spike_x", "current_price", "day_change_pct", "turnover_cr"]:
        items.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse_sort)

    total_count = len(items)
    total_pages = max(1, (total_count + limit - 1) // limit)
    offset = (page - 1) * limit
    paginated_items = items[offset:offset + limit]

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "items": paginated_items,
    }


@router.post("/scan", summary="Trigger Fresh Delivery Scan")
def trigger_fresh_scan(
    lookback_sessions: int = Query(1, ge=1, le=10),
    min_spike: float = Query(2.5, ge=1.0),
    min_deliv_per: float = Query(65.0, ge=30.0),
) -> Dict[str, Any]:
    """Forces recalculation of the latest delivery breakouts."""
    raw_data = DeliveryScreenerService.scan_opportunities(
        force_refresh=True,
        min_spike=min_spike,
        min_deliv_per=min_deliv_per,
        lookback_sessions=lookback_sessions,
    )
    return {
        "message": "Fresh delivery breakout scan completed successfully.",
        "metadata": raw_data.get("metadata", {}),
        "total_opportunities": len(raw_data.get("opportunities", [])),
    }


@router.get("/stats", summary="Get Telemetry Stats Ribbon")
def get_delivery_stats() -> Dict[str, Any]:
    return DeliveryScreenerService.get_radar_stats()
