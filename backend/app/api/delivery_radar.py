"""
Alpha India - Delivery Breakout & Institutional Radar API Router
Endpoints for scanning institutional delivery spikes, 50-day breakout setups,
and trade execution blueprints.
"""

from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.delivery_screener_service import DeliveryScreenerService

router = APIRouter(
    prefix="/delivery-radar",
    tags=["Delivery Breakout Radar"],
)


@router.get("/opportunities", summary="Get Institutional Delivery Breakout Opportunities")
def get_delivery_opportunities(
    lookback_sessions: int = Query(1, ge=1, le=10, description="Number of recent market sessions to scan (1 = latest session)"),
    min_spike: float = Query(1.6, ge=1.0, description="Minimum delivery volume multiplier (e.g. 1.6x 10-day SMA)"),
    min_deliv_per: float = Query(55.0, ge=30.0, le=100.0, description="Minimum delivery percentage (e.g. 55%)"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    tier: Optional[str] = Query("ALL", description="ALL, APEX_SNIPER, ACTIVE_SWING, BASE_ACCUMULATION"),
    setup_type: Optional[str] = Query("ALL", description="ALL, 50D_BREAKOUT, EMA20_PULLBACK, NEAR_PIVOT_BASE"),
    min_conviction: Optional[float] = Query(None, description="Minimum conviction score (0 - 100)"),
    sort_by: str = Query("conviction_score", description="conviction_score, delivery_per, delivery_spike_x, current_price, day_change_pct, turnover_cr, deliv_flow_20d"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    raw_data = DeliveryScreenerService.scan_opportunities(force_refresh=False)
    items = list(raw_data.get("opportunities", []))
    metadata = dict(raw_data.get("metadata", {}))

    # 0. Session Lookback filter (select recent lookback_sessions trading days)
    all_dates = sorted({x["signal_date"] for x in items if x.get("signal_date")})
    if all_dates and lookback_sessions < len(all_dates):
        allowed_dates = set(all_dates[-lookback_sessions:])
        items = [x for x in items if x.get("signal_date") in allowed_dates]

    # 0.1 Parameter filters (Spike & Delivery %)
    if min_spike:
        items = [x for x in items if (x.get("delivery_spike_x") or 0.0) >= min_spike]
    if min_deliv_per:
        items = [x for x in items if (x.get("delivery_per") or 0.0) >= min_deliv_per]

    # Synchronize metadata counts to current lookback & threshold pool (prior to search/tier/setup filters)
    session_pool = items
    metadata["qualifying_setups_count"] = len(session_pool)
    metadata["apex_sniper_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "APEX_SNIPER")
    metadata["active_swing_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "ACTIVE_SWING")
    metadata["base_accumulation_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "BASE_ACCUMULATION")
    metadata["confirmed_breakouts_count"] = sum(1 for o in session_pool if o.get("is_50d_breakout"))
    metadata["ema_pullback_count"] = sum(1 for o in session_pool if o.get("setup_type") == "EMA20_PULLBACK")
    metadata["near_pivot_count"] = sum(1 for o in session_pool if o.get("setup_type") == "NEAR_PIVOT_BASE")

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

    # 3. Tier filter
    if tier and tier.upper() != "ALL":
        items = [x for x in items if x.get("conviction_tier", "").upper() == tier.upper()]

    # 4. Setup type filter
    if setup_type and setup_type.upper() != "ALL":
        items = [x for x in items if x.get("setup_type", "").upper() == setup_type.upper()]

    # 5. Conviction filter
    if min_conviction is not None:
        items = [x for x in items if x["conviction_score"] >= min_conviction]

    # 6. Sorting
    reverse_sort = (sort_order.lower() == "desc")
    allowed_sort_fields = [
        "conviction_score", "delivery_per", "delivery_spike_x", "current_price", 
        "day_change_pct", "turnover_cr", "deliv_flow_20d", "market_cap_cr", 
        "ticket_spike_x", "range_contraction_ratio"
    ]
    if sort_by in allowed_sort_fields:
        items.sort(key=lambda x: x.get(sort_by) or 0, reverse=reverse_sort)

    total_count = len(items)
    total_pages = max(1, (total_count + limit - 1) // limit)
    offset = (page - 1) * limit
    paginated_items = items[offset:offset + limit]

    from app.services.stock_trend_enricher import StockTrendEnricher
    StockTrendEnricher.enrich(db, paginated_items, symbol_key="symbol", cmp_key="current_price")

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
    min_spike: float = Query(1.6, ge=1.0),
    min_deliv_per: float = Query(55.0, ge=30.0),
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
