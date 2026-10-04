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
    universe: str = Query("NIFTY_500", description="NIFTY_500, NIFTY_50, FNO, or ALL"),
    group_by_stock: bool = Query(True, description="Group multiple patterns into one row per unique stock"),
    conviction_tier: Optional[str] = Query(None, description="ELITE, HIGH, MODERATE, or ALL"),
    direction: Optional[str] = Query(None, description="BULLISH, BEARISH, or ALL"),
    category: Optional[str] = Query(None, description="TRIPLE, DOUBLE, SINGLE, or ALL"),
    pattern_key: Optional[str] = Query(None, description="Specific pattern key, e.g. MORNING_STAR"),
    min_score: int = Query(50, ge=0, le=100, description="Minimum AI Conviction Score (0-100)"),
    min_volume_ratio: Optional[float] = Query(None, ge=0.0, description="Minimum volume surge ratio (e.g. 1.2, 1.5, 2.0)"),
    min_risk_reward: Optional[float] = Query(None, ge=0.0, description="Minimum Risk-to-Reward ratio (e.g. 1.5, 2.0)"),
    stage: Optional[str] = Query(None, description="Filter by Minervini Stage: STAGE_1, STAGE_2, STAGE_3, STAGE_4"),
    search: Optional[str] = Query(None, description="Symbol or Company name substring"),
    sort_by: str = Query("ai_conviction_score", description="Sort by: ai_conviction_score, volume_surge_ratio, risk_reward, cmp, patterns_count"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    force_refresh: bool = Query(False, description="Trigger synchronous rescan"),
    db: Session = Depends(get_db),
):
    """
    Returns filtered and paginated candlestick pattern signals across Nifty 500 or selected universe.
    Supports consolidating multiple patterns into one clean row per stock (group_by_stock=True).
    """
    res = CandlestickScannerService.get_candlestick_opportunities(universe=universe, db=db, force_refresh=force_refresh)
    signals: List[Dict[str, Any]] = res.get("signals", [])
    metadata: Dict[str, Any] = dict(res.get("metadata", {}))

    # 1. Group by stock if requested (Default = True)
    if group_by_stock:
        filtered = CandlestickScannerService.group_signals_by_stock(signals)
        metadata["group_by_stock"] = True
        metadata["total_unique_stocks"] = len(filtered)
    else:
        filtered = list(signals)
        metadata["group_by_stock"] = False

    # 2. Filter by Conviction Tier
    if conviction_tier and conviction_tier.upper() != "ALL":
        ct_clean = conviction_tier.strip().upper()
        filtered = [s for s in filtered if s.get("conviction_tier", "").upper() == ct_clean]

    # 3. Filter by Direction
    if direction and direction.upper() != "ALL":
        d_clean = direction.strip().upper()
        filtered = [s for s in filtered if s.get("direction", "").upper() == d_clean]

    # 4. Filter by Category
    if category and category.upper() != "ALL":
        c_clean = category.strip().upper()
        if group_by_stock:
            filtered = [
                s for s in filtered
                if s.get("category", "").upper() == c_clean
                or any(p.get("category", "").upper() == c_clean for p in s.get("patterns", []))
            ]
        else:
            filtered = [s for s in filtered if s.get("category", "").upper() == c_clean]

    # 5. Filter by pattern_key
    if pattern_key:
        pk_clean = pattern_key.strip().upper()
        if group_by_stock:
            filtered = [
                s for s in filtered
                if s.get("pattern_key", "").upper() == pk_clean
                or any(p.get("pattern_key", "").upper() == pk_clean for p in s.get("patterns", []))
            ]
        else:
            filtered = [s for s in filtered if s.get("pattern_key", "").upper() == pk_clean]

    # 6. Filter by min_score
    if min_score > 0:
        filtered = [s for s in filtered if s.get("ai_conviction_score", 0) >= min_score]

    # 7. Filter by Volume Surge Ratio (High Institutional Weightage)
    if min_volume_ratio is not None and min_volume_ratio > 0:
        filtered = [s for s in filtered if float(s.get("volume_surge_ratio", 0)) >= min_volume_ratio]

    # 8. Filter by min_risk_reward
    if min_risk_reward is not None and min_risk_reward > 0:
        filtered = [s for s in filtered if float(s.get("risk_reward", 0)) >= min_risk_reward]

    # 9. Enrich with 90D Trend Sparkline, Stage & Metadata
    from app.services.stock_trend_enricher import StockTrendEnricher
    StockTrendEnricher.enrich(db, filtered, symbol_key="symbol", cmp_key="cmp")

    # 10. Filter by Stage
    if stage and stage.upper() != "ALL":
        st_clean = stage.strip().upper()
        filtered = [s for s in filtered if s.get("stage_code", "").upper() == st_clean]

    # 11. Filter by search (symbol, pattern_name, company_name, sector, or any child pattern name)
    if search:
        q = search.strip().upper()
        filtered = [
            s for s in filtered
            if q in s.get("symbol", "").upper()
            or q in s.get("pattern_name", "").upper()
            or q in s.get("company_name", "").upper()
            or q in s.get("sector", "").upper()
            or any(q in p_name.upper() for p_name in s.get("all_pattern_names", []))
        ]

    # 12. Sorting
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

    # 13. Pagination
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
def get_candlestick_summary(
    universe: str = Query("NIFTY_500", description="NIFTY_500, NIFTY_50, FNO"),
    db: Session = Depends(get_db)
):
    """
    Returns breakdown by pattern category, top patterns, conviction tiers, volume expansion, and directional bias.
    """
    res = CandlestickScannerService.get_candlestick_opportunities(universe=universe, db=db, force_refresh=False)
    signals: List[Dict[str, Any]] = res.get("signals", [])
    metadata: Dict[str, Any] = res.get("metadata", {})

    from collections import defaultdict
    pattern_counts: Dict[str, int] = {}
    by_symbol: Dict[str, int] = defaultdict(int)
    high_volume_count = 0
    explosive_volume_count = 0

    for s in signals:
        pname = s.get("pattern_name", "Unknown")
        pattern_counts[pname] = pattern_counts.get(pname, 0) + 1
        sym = s.get("symbol")
        if sym:
            by_symbol[sym] += 1
        vol_ratio = float(s.get("volume_surge_ratio", 0))
        if vol_ratio >= 2.0:
            explosive_volume_count += 1
        if vol_ratio >= 1.5:
            high_volume_count += 1

    top_patterns = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    multi_pattern_stocks_count = sum(1 for cnt in by_symbol.values() if cnt > 1)

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
        },
        "conviction_breakdown": {
            "elite": metadata.get("elite_signals", 0),
            "high": metadata.get("high_conviction_signals", 0),
            "moderate": metadata.get("moderate_signals", 0),
            "speculative": metadata.get("speculative_signals", 0),
        },
        "volume_breakdown": {
            "explosive_2x": explosive_volume_count,
            "strong_1_5x": high_volume_count,
        },
        "total_unique_stocks": len(by_symbol),
        "multi_pattern_stocks": multi_pattern_stocks_count,
        "avg_conviction_score": metadata.get("avg_conviction_score", 0.0),
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
