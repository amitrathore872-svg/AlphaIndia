"""
Alpha India - Delivery Radar 2.0 API Router
============================================
Endpoints for:
- Opportunities filtered by Free Float Absorption and Multi-Day Delivery Trends
- Radar 2.0 Market Telemetry Stats Ribbon
- Float Profile & Shareholding Breakdown per Stock
- Force Scan Trigger
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.services.delivery_radar_v2_service import DeliveryRadarV2Service

router = APIRouter(
    prefix="/delivery-radar-v2",
    tags=["Delivery Radar 2.0 (Free Float & Multi-Day Trend)"],
)


@router.get("/opportunities", summary="Get Delivery Radar 2.0 Opportunities")
def get_delivery_v2_opportunities(
    min_float_mcap: float = Query(500.0, description="Minimum Free Float MCap in INR Cr"),
    min_float_absorb_5d: float = Query(1.0, description="Minimum % of Free Float absorbed in past 5 sessions"),
    archetype: Optional[str] = Query(None, description="STEALTH_FLOAT_LOCK, COIL_SUPPLY_EXHAUSTION, BREAKOUT_EXPANSION, CLIMAX_SHOCK_WARNING"),
    trigger_status: Optional[str] = Query(None, description="BUY_TRIGGERED, COILING_WATCHLIST, CLIMAX_AVOID"),
    sweetspot_only: bool = Query(False, description="Filter for 70%-76.5% Buyer Dominance sweet-spot"),
    sort_by: str = Query("conviction_score", description="conviction_score, float_absorb_5d_pct, float_absorb_10d_pct, buyer_demand_ratio, current_price, day_change_pct"),
    sort_order: str = Query("desc", description="desc or asc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    """Surfaces institutional delivery breakout opportunities with free float telemetry."""
    data = DeliveryRadarV2Service.scan_opportunities(
        force_refresh=False,
        min_float_mcap=min_float_mcap,
        min_float_absorb_5d=min_float_absorb_5d,
    )

    items = data.get("opportunities", [])

    if trigger_status:
        items = [x for x in items if x.get("trigger_status") == trigger_status]
    if archetype:
        items = [x for x in items if x.get("archetype") == archetype]
    if sweetspot_only:
        items = [x for x in items if x.get("is_sweetspot_demand")]

    reverse = (sort_order.lower() == "desc")
    items = sorted(items, key=lambda x: x.get(sort_by, 0) or 0, reverse=reverse)

    total_count = len(items)
    start_idx = (page - 1) * limit
    paged_items = items[start_idx : start_idx + limit]

    return {
        "timestamp": data.get("timestamp"),
        "metadata": data.get("metadata", {}),
        "total": total_count,
        "page": page,
        "limit": limit,
        "opportunities": paged_items,
    }


@router.get("/stats", summary="Get Delivery Radar 2.0 Ribbon Stats")
def get_delivery_v2_stats() -> Dict[str, Any]:
    """Returns aggregated high-level statistics across the latest market session."""
    return DeliveryRadarV2Service.get_radar_stats()


@router.get("/float-profile/{symbol}", summary="Get Detailed Free Float & Absorption Profile")
def get_symbol_float_profile(symbol: str) -> Dict[str, Any]:
    """Returns detailed shareholding, free float MCap, and 5-10 day absorption dynamics."""
    clean_sym = symbol.strip().upper()
    data = DeliveryRadarV2Service.scan_opportunities(force_refresh=False)
    items = data.get("opportunities", [])
    match = next((x for x in items if x["symbol"] == clean_sym), None)

    if not match:
        raise HTTPException(status_code=404, detail=f"Symbol {clean_sym} not found in active Radar 2.0 universe.")

    return {
        "symbol": clean_sym,
        "profile": match,
    }


@router.post("/scan", summary="Trigger Fresh Delivery Radar 2.0 Scan")
def trigger_fresh_v2_scan(
    min_float_mcap: float = Query(500.0, ge=100.0),
    min_float_absorb_5d: float = Query(1.0, ge=0.5),
) -> Dict[str, Any]:
    """Forces recalculation of the Radar 2.0 universe."""
    data = DeliveryRadarV2Service.scan_opportunities(
        force_refresh=True,
        min_float_mcap=min_float_mcap,
        min_float_absorb_5d=min_float_absorb_5d,
    )
    return {
        "message": "Fresh Delivery Radar 2.0 scan completed successfully.",
        "metadata": data.get("metadata", {}),
        "total_opportunities": len(data.get("opportunities", [])),
    }
