"""
Alpha India - Candlestick Pattern Screener API
==============================================
Institutional endpoints for querying Single, Double, and Triple Candlestick patterns:
- Strike.money 20 Triple Candlestick catalog (Morning Star, Soldiers, Abandoned Baby, etc.)
- TradingSim confluence triggers (Volume surge, 20 EMA / 50 DMA bounce, Risk-to-Reward)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.pattern_engine.candlestick_scanner_service import CandlestickScannerService

logger = logging.getLogger("alpha_india.api.candlestick_screener")

router = APIRouter(prefix="/candlesticks", tags=["Candlestick Pattern Radar"])


@router.get("", summary="Get detected institutional candlestick patterns")
def list_candlesticks(
    direction: Optional[str] = Query(None, description="BULLISH, BEARISH, or ALL"),
    category: Optional[str] = Query(None, description="TRIPLE, DOUBLE, SINGLE, or ALL"),
    pattern_key: Optional[str] = Query(None, description="Specific pattern key, e.g. MORNING_STAR"),
    min_score: int = Query(50, ge=0, le=100, description="Minimum AI Conviction Score (0-100)"),
    search: Optional[str] = Query(None, description="Symbol or Company name substring"),
    sort_by: str = Query("ai_conviction_score", description="Sort by: ai_conviction_score, volume_surge_ratio, risk_reward, cmp"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    force_refresh: bool = Query(False, description="Trigger synchronous rescan"),
    db: Session = Depends(get_db),
):
    """
    Returns filtered and paginated candlestick pattern signals.
    """
    res = CandlestickScannerService.get_candlestick_opportunities(db=db, force_refresh=force_refresh)
    signals: List[Dict[str, Any]] = res.get("signals", [])
    metadata: Dict[str, Any] = res.get("metadata", {})

    filtered = signals

    # 1. Filter by Direction
    if direction and direction.upper() != "ALL":
        d_clean = direction.strip().upper()
        filtered = [s for s in filtered if s.get("direction", "").upper() == d_clean]

    # 2. Filter by Category
    if category and category.upper() != "ALL":
        c_clean = category.strip().upper()
        filtered = [s for s in filtered if s.get("category", "").upper() == c_clean]

    # 3. Filter by pattern_key
    if pattern_key:
        pk_clean = pattern_key.strip().upper()
        filtered = [s for s in filtered if s.get("pattern_key", "").upper() == pk_clean]

    # 4. Filter by min_score
    if min_score > 0:
        filtered = [s for s in filtered if s.get("ai_conviction_score", 0) >= min_score]

    # 5. Filter by search
    if search:
        q = search.strip().upper()
        filtered = [
            s for s in filtered
            if q in s.get("symbol", "").upper() or q in s.get("pattern_name", "").upper()
        ]

    # 6. Sorting
    reverse = sort_order == "desc"

    def get_sort_val(item: Dict[str, Any]):
        v = item.get(sort_by)
        if v is None:
            return -999999.0 if reverse else 999999.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return str(v).lower()

    filtered.sort(key=get_sort_val, reverse=reverse)

    # 7. Pagination
    total_count = len(filtered)
    start_idx = (page - 1) * limit
    paged = filtered[start_idx : start_idx + limit]

    return {
        "metadata": metadata,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
        "signals": paged,
    }


@router.get("/summary", summary="Summary statistics of active candlestick patterns")
def get_candlestick_summary(db: Session = Depends(get_db)):
    """
    Returns breakdown by pattern category, top patterns, and directional bias.
    """
    res = CandlestickScannerService.get_candlestick_opportunities(db=db, force_refresh=False)
    signals: List[Dict[str, Any]] = res.get("signals", [])
    metadata: Dict[str, Any] = res.get("metadata", {})

    pattern_counts: Dict[str, int] = {}
    for s in signals:
        pname = s.get("pattern_name", "Unknown")
        pattern_counts[pname] = pattern_counts.get(pname, 0) + 1

    top_patterns = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:6]

    return {
        "metadata": metadata,
        "top_patterns": [{"pattern": k, "count": v} for k, v in top_patterns],
        "category_breakdown": {
            "triple": metadata.get("triple_patterns", 0),
            "double": metadata.get("double_patterns", 0),
            "single": metadata.get("single_patterns", 0),
        },
        "direction_breakdown": {
            "bullish": metadata.get("bullish_signals", 0),
            "bearish": metadata.get("bearish_signals", 0),
        }
    }


@router.get("/symbol/{symbol}", summary="Get detected candlestick signals for a specific symbol")
def get_symbol_candlesticks(symbol: str):
    """
    Returns historical candlestick pattern annotations for TradingView chart overlays.
    """
    signals = CandlestickScannerService.get_candlesticks_for_symbol(symbol=symbol)
    return {
        "symbol": symbol.upper(),
        "total_signals": len(signals),
        "signals": signals,
    }
