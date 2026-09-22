"""
Alpha India - Alpha Swing Overlay Engine (AIOSE v3.0) API Router
Sprint S9: Institutional Tactical Swing Overlay & Watchlist Opportunity Endpoints
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.swing_quant_service import SwingQuantService
from app.services.swing_backtest_service import SwingBacktestService
from app.models.swing_overlay import SwingPosition, SwingTradeLog

router = APIRouter(prefix="/swing-overlay", tags=["Alpha Swing Overlay Engine"])


@router.get("/dashboard")
def get_swing_overlay_dashboard(
    source: str = Query("holdings", description="Source: holdings, watchlist, or universal"),
    portfolio_id: Optional[int] = Query(None, description="Portfolio ID if source=holdings"),
    watchlist_id: Optional[int] = Query(None, description="Watchlist ID if source=watchlist"),
    db: Session = Depends(get_db),
):
    """
    Returns full terminal dashboard payload:
    - Executive KPIs (Active Alpha Cash, Win Rate, Profit Factor)
    - Fast Action Queue (Buy Ready, Exhaustion Sell, Pullback Watch)
    - Exact Rupee Levels (Buy Zone, Stop Loss, Target 1, Target 2)
    - Adaptive Indicator DNA per stock
    """
    try:
        return SwingQuantService.get_dashboard_payload(
            source=source,
            portfolio_id=portfolio_id,
            watchlist_id=watchlist_id,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch swing dashboard: {str(e)}")


@router.get("/diagnostic/{symbol}")
def get_stock_diagnostic(symbol: str):
    """
    Returns instant deep-dive quantitative diagnostic for ANY stock on NSE/BSE:
    - Current State Machine Status
    - Fractal Swing High and Swing Low Structure
    - Fibonacci Golden Pocket Buy Zone
    - 3-Pillar Top Exhaustion Probability
    - Stock-Specific Adaptive Indicator DNA
    """
    diagnostic = SwingQuantService.get_stock_diagnostic(symbol)
    if not diagnostic:
        raise HTTPException(status_code=404, detail=f"Stock data not found or insufficient bars for {symbol}")
    return diagnostic


@router.get("/backtest/{symbol}")
def get_stock_backtest(
    symbol: str,
    period: str = Query("90d", description="Backtest period: 60d, 90d, 180d, 1y")
):
    """
    Returns historical backtest audit for the given stock:
    - Total Trades, Win Rate %, Profit Factor, Reward:Risk
    - Net Cumulative Alpha Return %
    - Equity Curve Progression
    - Recent Trade Ledger
    """
    result = SwingBacktestService.run_stock_backtest(symbol, period=period)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/watchlist-opportunities")
def get_watchlist_opportunities(
    watchlist_id: Optional[int] = Query(None, description="Specific Watchlist ID"),
    db: Session = Depends(get_db)
):
    """
    Convenience endpoint specifically returning watchlist stocks filtered and ranked for fresh buy setups.
    """
    try:
        payload = SwingQuantService.get_dashboard_payload(
            source="watchlist",
            watchlist_id=watchlist_id,
            db=db
        )
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trade/record")
def record_swing_trade(
    symbol: str,
    entry_price: float,
    exit_price: float,
    shares_traded: float,
    exit_reason: str,
    holding_hours: float = 24.0,
    setup_dna: str = "EMA_Pullback",
    portfolio_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Logs an executed swing trade into the institutional journal ledger.
    """
    gain_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
    pnl = round((exit_price - entry_price) * shares_traded, 2)
    
    log_entry = SwingTradeLog(
        symbol=symbol.upper(),
        portfolio_id=portfolio_id,
        entry_time=datetime.utcnow(),
        exit_time=datetime.utcnow(),
        entry_price=entry_price,
        exit_price=exit_price,
        shares_traded=shares_traded,
        gain_pct=gain_pct,
        realized_pnl=pnl,
        exit_reason=exit_reason,
        holding_hours=holding_hours,
        setup_dna=setup_dna,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return {"status": "success", "id": log_entry.id, "realized_pnl": pnl, "gain_pct": gain_pct}
