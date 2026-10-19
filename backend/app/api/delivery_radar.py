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
    lookback_sessions: int = Query(1, ge=1, le=30, description="Number of recent market sessions to scan (1 = latest session, up to 30 for 1 month)"),
    min_spike: float = Query(1.6, ge=1.0, description="Minimum delivery volume multiplier (e.g. 1.6x 10-day SMA)"),
    min_deliv_per: float = Query(55.0, ge=30.0, le=100.0, description="Minimum delivery percentage (e.g. 55%)"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    sector: Optional[str] = Query(None, description="Filter by sector name"),
    tier: Optional[str] = Query("ALL", description="ALL, APEX_SNIPER, ACTIVE_SWING, BASE_ACCUMULATION"),
    setup_type: Optional[str] = Query("ALL", description="ALL, 50D_BREAKOUT, EMA20_PULLBACK, NEAR_PIVOT_BASE, CIRCUIT_LOCKED, PRE_CIRCUIT_SURGE"),
    archetype: Optional[str] = Query("ALL", description="ALL, CIRCUIT_RADAR, CIRCUIT_LOCK, PRE_CIRCUIT, STEALTH_FLOAT_LOCK, HIGH_BUYER_DOMINANCE, SUPPORT_DEFENDER, MOMENTUM_BREAKOUT"),
    min_buyer_ratio: Optional[float] = Query(None, description="Minimum buyer demand ratio (0 - 100)"),
    min_conviction: Optional[float] = Query(None, description="Minimum conviction score (0 - 100)"),
    sort_by: str = Query("conviction_score", description="conviction_score, buyer_demand_ratio, net_deliv_cr_10d, net_deliv_cr_30d, deliv_persist_10d, delivery_per, delivery_spike_x, current_price, day_change_pct, turnover_cr, deliv_flow_20d"),
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

    # 0.1 Parameter filters (Spike & Delivery %) - bypass if already circuit locked
    if min_spike:
        items = [x for x in items if (x.get("delivery_spike_x") or 0.0) >= min_spike or x.get("is_circuit_locked")]
    if min_deliv_per:
        items = [x for x in items if (x.get("delivery_per") or 0.0) >= min_deliv_per or x.get("is_circuit_locked")]

    # Synchronize metadata counts to current lookback & threshold pool (prior to search/tier/setup filters)
    session_pool = items
    metadata["qualifying_setups_count"] = len(session_pool)
    metadata["apex_sniper_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "APEX_SNIPER")
    metadata["active_swing_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "ACTIVE_SWING")
    metadata["base_accumulation_count"] = sum(1 for o in session_pool if o.get("conviction_tier") == "BASE_ACCUMULATION")
    metadata["confirmed_breakouts_count"] = sum(1 for o in session_pool if o.get("is_50d_breakout"))
    metadata["ema_pullback_count"] = sum(1 for o in session_pool if o.get("setup_type") == "EMA20_PULLBACK")
    metadata["near_pivot_count"] = sum(1 for o in session_pool if o.get("setup_type") == "NEAR_PIVOT_BASE")
    metadata["circuit_locked_count"] = sum(1 for o in session_pool if o.get("is_circuit_locked"))
    metadata["pre_circuit_count"] = sum(1 for o in session_pool if o.get("is_pre_circuit"))
    metadata["high_buyer_count"] = sum(1 for o in session_pool if (o.get("buyer_demand_ratio") or 0) >= 78.0)
    metadata["stealth_lock_count"] = sum(1 for o in session_pool if o.get("decision_archetype") == "STEALTH_FLOAT_LOCK")

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

    # 4.1 Archetype filter
    if archetype and archetype.upper() != "ALL":
        arch_clean = archetype.upper().strip()
        if arch_clean == "CIRCUIT_RADAR":
            items = [x for x in items if x.get("is_circuit_locked") or x.get("is_pre_circuit") or x.get("decision_archetype") in ("CIRCUIT_LOCK", "PRE_CIRCUIT")]
        elif arch_clean in ("HIGH_BUYER", "HIGH_BUYER_DOMINANCE"):
            items = [x for x in items if (x.get("buyer_demand_ratio") or 0) >= 75.0 or x.get("decision_archetype") == "HIGH_BUYER_DOMINANCE"]
        elif arch_clean in ("MOMENTUM_BREAKOUT", "BREAKOUT", "50D_BREAKOUT"):
            items = [x for x in items if x.get("is_50d_breakout") or x.get("setup_type") == "50D_BREAKOUT" or str(x.get("decision_archetype", "")).upper() == "MOMENTUM_BREAKOUT"]
        elif arch_clean in ("SUPPORT_DEFENDER", "EMA20_PULLBACK"):
            items = [x for x in items if x.get("setup_type") == "EMA20_PULLBACK" or str(x.get("decision_archetype", "")).upper() == "SUPPORT_DEFENDER"]
        elif arch_clean == "STEALTH_FLOAT_LOCK":
            items = [x for x in items if str(x.get("decision_archetype", "")).upper() == "STEALTH_FLOAT_LOCK" or (x.get("range_contraction_ratio", 1.0) <= 0.88 and x.get("deliv_flow_20d", 0) >= 1.35)]
        else:
            items = [x for x in items if str(x.get("decision_archetype", "")).upper() == arch_clean]

    # 4.2 Minimum Buyer Demand Ratio filter
    if min_buyer_ratio is not None:
        items = [x for x in items if (x.get("buyer_demand_ratio") or 0.0) >= min_buyer_ratio]

    # 5. Conviction filter
    if min_conviction is not None:
        items = [x for x in items if x["conviction_score"] >= min_conviction]

    # 6. Sorting
    reverse_sort = (sort_order.lower() == "desc")
    allowed_sort_fields = [
        "conviction_score", "buyer_demand_ratio", "net_deliv_cr_10d", "net_deliv_cr_30d", 
        "deliv_persist_10d", "delivery_per", "delivery_spike_x", "current_price", 
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


@router.get("/live-buyer-ratio/{symbol}", summary="Get Live Order Book Buyer-to-Seller Ratio & Depth")
def get_live_buyer_ratio(symbol: str) -> Dict[str, Any]:
    """
    Queries real-time market depth to compute the exact Live Buyer-to-Seller Ratio:
    Buyer Ratio % = Total Buy Qty / (Total Buy Qty + Total Sell Qty) * 100
    Detects upper circuit freeze (100% Buyers, 0 Sellers).
    """
    clean_sym = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
    try:
        from app.clients.fivepaisa_client import FivePaisaClient
        client = FivePaisaClient.get_instance()
        quotes = client.get_live_quotes([clean_sym])
        quote = quotes.get(clean_sym, {})
        
        # Also check NSE official quote depth if available
        buy_qty = quote.get("buy_qty") or quote.get("TotalBuyQty", 0)
        sell_qty = quote.get("sell_qty") or quote.get("TotalSellQty", 0)
        cmp = quote.get("cmp") or quote.get("LastRate", 0.0)
        day_chg_pct = quote.get("day_change_pct", 0.0)

        tot = buy_qty + sell_qty
        if tot > 0:
            ratio = round((buy_qty / tot) * 100.0, 1)
            is_circuit = (sell_qty == 0 and buy_qty > 0) or (day_chg_pct >= 4.9 and ratio >= 95.0)
            status = "CIRCUIT_LOCKED_100_BUYERS" if is_circuit else ("HIGH_BUYER_DEMAND" if ratio >= 75.0 else "BALANCED")
            seller_ratio = round(100.0 - ratio, 1)
        else:
            ratio = 0.0
            seller_ratio = 0.0
            is_circuit = False
            status = "AFTER_HOURS_OFFLINE"

        return {
            "symbol": clean_sym,
            "cmp": cmp,
            "day_change_pct": day_chg_pct,
            "total_buy_quantity": buy_qty,
            "total_sell_quantity": sell_qty,
            "buyer_ratio": ratio,
            "seller_ratio": seller_ratio,
            "is_upper_circuit_locked": is_circuit,
            "source": quote.get("source", "MARKET_DEPTH"),
            "status": status
        }
    except Exception as e:
        return {
            "symbol": clean_sym,
            "buyer_ratio": 50.0,
            "is_upper_circuit_locked": False,
            "error": str(e),
            "status": "FALLBACK"
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


@router.get("/tree-breakdown", summary="Get 30-Day Month -> Week -> Day Delivery & Drawdown Tree")
def get_symbol_tree_breakdown(
    symbol: str = Query(..., description="Equity symbol e.g. SANATHAN, TRENT, BEL"),
    lookback_sessions: int = Query(30, ge=10, le=60, description="Number of trading sessions to breakdown (default 30 sessions = 1 month)"),
) -> Dict[str, Any]:
    """
    Returns hierarchical Month -> Week -> Day breakdown of delivery accumulation,
    peak-to-trough drawdown, and blast readiness signatures for visual drilldown.
    """
    from app.services.delivery_tree_service import DeliveryTreeService
    res = DeliveryTreeService.get_symbol_tree_breakdown(symbol=symbol, lookback_sessions=lookback_sessions)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res

