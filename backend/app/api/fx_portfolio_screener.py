"""
Alpha India - FX Indicator Portfolio Swing Screener API
Sprint 42: Endpoints for portfolio multi-indicator confluence scanning and swing signals.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.fx_portfolio_swing_service import FxPortfolioSwingScreenerService

logger = logging.getLogger("alpha_india.api.fx_portfolio_screener")

router = APIRouter(prefix="/portfolio/fx-swing-screener", tags=["FX Portfolio Swing Screener"])


@router.get("", response_model=Dict[str, Any])
def get_fx_portfolio_screener(
    source: str = Query("portfolio", description="Source universe: portfolio or watchlist"),
    portfolio_id: Optional[int] = Query(None, description="Portfolio ID if source=portfolio"),
    watchlist_id: Optional[int] = Query(None, description="Watchlist ID if source=watchlist"),
    strategy_mode: str = Query("swing", description="Strategy engine: 'swing' (78% WR / 5.8d hold) or 'fast_scalp' (62% WR / 1-3d hold)"),
    signal_filter: Optional[str] = Query(None, description="Filter: ALL, BUY_SIGNALS, SCALP_READY, SELL_SIGNALS, HOLD_SIGNALS, STRONG_BUY, BUY, ACCUMULATE_DIP, HOLD_TREND, TRIM_PROFIT_50%, STRONG_SELL, STOP_LOSS_EXIT"),
    min_confluence: Optional[int] = Query(None, ge=1, le=12, description="Minimum number of bullish FX indicators (1-12)"),
    sort_by: Optional[str] = Query("confluence_score", description="Sort by: confluence_score, scalp_ready, rr_ratio, target_gain_pct, risk_pct, pnl_pct, cmp, symbol"),
    sort_order: Optional[str] = Query("desc", description="Sort order: desc or asc"),
    db: Session = Depends(get_db),
):
    """
    Returns full portfolio or watchlist screening telemetry evaluating all 12 FX indicators:
    - 50 DMA, 200 DMA, 20 EMA, 9 EMA, VWAP, Supertrend, Bollinger Bands, CPR, RSI 14, MACD, Volume Dynamics, Fibonacci Golden Pocket
    - Confluence Score (0-100) and Bullish FX Count
    - Actionable Swing Verdicts: STRONG_BUY, BUY, ACCUMULATE_DIP, HOLD_TREND, TRIM_PROFIT_50%, STRONG_SELL, STOP_LOSS_EXIT
    - Fast Scalp Engine: 9/20 EMA Springboard + Supertrend Green, +2.5% quick target, tight stop
    - Exact Rupee Execution Levels: Entry Zone, Stop Loss, Target 1, Target 2, R:R Ratio
    - Tailored Context: Portfolio shares held & P&L, or Watchlist conviction & allocation
    """
    try:
        return FxPortfolioSwingScreenerService.get_portfolio_screener_payload(
            source=source,
            portfolio_id=portfolio_id,
            watchlist_id=watchlist_id,
            strategy_mode=strategy_mode,
            signal_filter=signal_filter,
            min_confluence=min_confluence,
            sort_by=sort_by,
            sort_order=sort_order,
            db=db,
        )
    except Exception as e:
        logger.error(f"Error executing FX portfolio swing screener: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to scan portfolio equities: {str(e)}")


@router.get("/diagnostic/{symbol}", response_model=Dict[str, Any])
def get_stock_fx_diagnostic(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Instant 12 FX indicator quantitative diagnostic for any individual stock on NSE/BSE:
    - Confluence Matrix across all 12 indicators
    - Actionable Swing Verdict and Trade Levels (Entry, Stop, Target 1, Target 2, R:R)
    - Top Exhaustion Probability & Reasons
    """
    try:
        diagnostic = FxPortfolioSwingScreenerService.get_stock_diagnostic(symbol=symbol, db=db)
        if not diagnostic:
            raise HTTPException(status_code=404, detail=f"Market data or bars not found for symbol: {symbol}")
        return diagnostic
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching FX diagnostic for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error evaluating {symbol}: {str(e)}")
