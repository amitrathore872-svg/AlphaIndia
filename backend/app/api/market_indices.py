"""
Market Indices Router
Sprint 42 - Institutional Indian Market Indices & Monthly Performance Radar
Provides endpoints for Indian stock market indices, rolling 12-month returns, green/red breakdown, and KPIs.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Query, BackgroundTasks
from app.services.market_indices_service import MarketIndicesService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/indices", tags=["Market Indices Radar"])


@router.get("", summary="Get Indian Market Indices with 12-Month Performance Heatmap")
def get_market_indices(
    category: Optional[str] = Query("ALL", description="Filter by category: ALL, BROAD, SECTORAL, THEMATIC"),
    search: Optional[str] = Query(None, description="Search by index name or symbol"),
    sort_by: Optional[str] = Query("win_rate_pct", description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc, desc"),
    force_refresh: bool = Query(False, description="Bypass cache and force immediate refresh")
):
    """
    Returns full universe of Indian stock market indices with their 12-month performance breakdown (Green/Red),
    win rates, cumulative returns (1M, 3M, 6M, 12M, YTD), and 52-week statistics.
    """
    data = MarketIndicesService.scan_all_indices(force_refresh=force_refresh)
    indices = data.get("indices", [])

    # Filter by category
    if category and category.upper() != "ALL":
        indices = [idx for idx in indices if idx.get("category", "").upper() == category.upper()]

    # Filter by search
    if search:
        q = search.strip().lower()
        indices = [
            idx for idx in indices
            if q in idx.get("name", "").lower() or q in idx.get("symbol", "").lower()
        ]

    # Sorting
    reverse = sort_order.lower() == "desc"
    
    def get_sort_key(item):
        val = item.get(sort_by, 0)
        if val is None:
            return -999999 if reverse else 999999
        return val

    try:
        indices = sorted(indices, key=get_sort_key, reverse=reverse)
    except Exception as e:
        logger.warning(f"[IndicesAPI] Sorting error: {e}")

    return {
        "status": "success",
        "timestamp": data.get("timestamp"),
        "timestamp_epoch": data.get("timestamp_epoch"),
        "duration_seconds": data.get("duration_seconds"),
        "summary": data.get("summary"),
        "month_headers": data.get("month_headers", []),
        "total_count": len(indices),
        "indices": indices
    }


@router.get("/summary", summary="Get Indices Summary KPIs")
def get_indices_summary():
    """Returns high-level macro KPIs across broad, sectoral, and thematic indices."""
    data = MarketIndicesService.scan_all_indices(force_refresh=False)
    return {
        "status": "success",
        "timestamp": data.get("timestamp"),
        "summary": data.get("summary")
    }


@router.post("/refresh", summary="Trigger Immediate Cache Refresh")
def refresh_indices(background_tasks: BackgroundTasks):
    """Refreshes the index cache in the background."""
    background_tasks.add_task(MarketIndicesService.scan_all_indices, force_refresh=True)
    return {
        "status": "initiated",
        "message": "Market indices data refresh launched in background."
    }


@router.get("/{symbol}/chart", summary="Get Interactive OHLC & DMA Chart Series for an Index")
def get_index_chart(
    symbol: str,
    period: str = Query("1Y", description="Timeframe: 1M, 3M, 6M, 1Y")
):
    """
    Returns daily candlestick OHLC series, line series, and 50/200 DMA moving averages
    for lightweight-charts rendering.
    """
    data = MarketIndicesService.get_index_chart_series(symbol=symbol, period=period)
    if "error" in data:
        return {"status": "error", "message": data["error"]}
    return {
        "status": "success",
        **data
    }

