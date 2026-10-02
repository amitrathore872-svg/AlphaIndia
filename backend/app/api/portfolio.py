"""
Alpha India - Portfolio Intelligence API
REST endpoints for multi-portfolio management, manual stock entry,
CSV broker imports, and 360° AI institutional diagnostics.
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.portfolio import Portfolio
from app.services.portfolio_intelligence_service import PortfolioIntelligenceService

router = APIRouter(prefix="/portfolio", tags=["Portfolio Intelligence"])


# -------------------------------------------------------------
# PYDANTIC SCHEMAS
# -------------------------------------------------------------

class PortfolioCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "emerald"
    benchmark: Optional[str] = "NIFTY 50"
    cash_balance: Optional[float] = 0.0
    is_default: Optional[bool] = False


class PortfolioUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    benchmark: Optional[str] = None
    cash_balance: Optional[float] = None
    is_default: Optional[bool] = None


class HoldingCreateRequest(BaseModel):
    symbol: str
    quantity: float
    avg_buy_price: float
    buy_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None


class HoldingUpdateRequest(BaseModel):
    quantity: Optional[float] = None
    avg_buy_price: Optional[float] = None
    notes: Optional[str] = None


from app.api.deps import get_optional_current_user
from app.models.user import User

# -------------------------------------------------------------
# PORTFOLIO MANAGEMENT ENDPOINTS
# -------------------------------------------------------------

@router.get("/list")
def list_portfolios(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """List all portfolios under the account with summary metrics, scoped to user if authenticated."""
    user_id = current_user.id if current_user else None
    return PortfolioIntelligenceService.get_all_portfolios(db, user_id=user_id)


@router.post("/create")
def create_portfolio(
    req: PortfolioCreateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Create a new named portfolio, automatically scoped to current user."""
    user_id = current_user.id if current_user else None
    portfolio = PortfolioIntelligenceService.create_portfolio(
        db=db,
        name=req.name,
        description=req.description,
        color=req.color or "emerald",
        benchmark=req.benchmark or "NIFTY 50",
        cash_balance=req.cash_balance or 0.0,
        is_default=req.is_default or False,
        user_id=user_id,
    )
    return {"success": True, "portfolio": portfolio}


@router.get("/{portfolio_id}/summary")
def get_portfolio_summary(
    portfolio_id: int,
    refresh: bool = Query(False, description="Force fresh live price resolution"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Returns top-level metrics, health score, factor radar, and concentration warnings."""
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if portfolio and portfolio.user_id is not None and portfolio.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    return PortfolioIntelligenceService.calculate_portfolio_summary(db, portfolio_id, force_refresh=refresh)


@router.post("/{portfolio_id}/refresh-prices")
def refresh_portfolio_prices(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Forces an institutional live quote refresh for all holdings in this portfolio.
    Updates CMP, recalculates real-time PnL & health score, and invalidates stale caches.
    """
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if portfolio and portfolio.user_id is not None and portfolio.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    return PortfolioIntelligenceService.refresh_portfolio_prices(db, portfolio_id)


@router.put("/{portfolio_id}")
def update_portfolio(
    portfolio_id: int,
    req: PortfolioUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Update portfolio metadata."""
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if portfolio and portfolio.user_id is not None and portfolio.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    updated = PortfolioIntelligenceService.update_portfolio(
        db=db,
        portfolio_id=portfolio_id,
        name=req.name,
        description=req.description,
        color=req.color,
        benchmark=req.benchmark,
        cash_balance=req.cash_balance,
        is_default=req.is_default,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"success": True, "portfolio": updated}


@router.delete("/{portfolio_id}")
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Delete a portfolio."""
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if portfolio and portfolio.user_id is not None and portfolio.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    success = PortfolioIntelligenceService.delete_portfolio(db, portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"success": True}


# -------------------------------------------------------------
# HOLDINGS CRUD & CSV IMPORT ENDPOINTS
# -------------------------------------------------------------

@router.get("/{portfolio_id}/holdings")
def get_portfolio_holdings(
    portfolio_id: int,
    refresh: bool = Query(False, description="Force fresh live price resolution"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Returns all holdings enriched with live CMP, PnL, and 360° AI diagnostics."""
    if current_user:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if portfolio and portfolio.user_id is not None and portfolio.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Portfolio not found")
    return PortfolioIntelligenceService.get_enriched_holdings(db, portfolio_id, force_refresh=refresh)


@router.post("/{portfolio_id}/holdings")
def add_manual_holding(portfolio_id: int, req: HoldingCreateRequest, db: Session = Depends(get_db)):
    """Add a stock manually to the portfolio with buy price and quantity."""
    buy_dt = None
    if req.buy_date:
        try:
            buy_dt = datetime.strptime(req.buy_date, "%Y-%m-%d")
        except ValueError:
            buy_dt = datetime.utcnow()

    holding = PortfolioIntelligenceService.add_manual_holding(
        db=db,
        portfolio_id=portfolio_id,
        symbol=req.symbol,
        quantity=req.quantity,
        avg_buy_price=req.avg_buy_price,
        buy_date=buy_dt,
        notes=req.notes,
    )
    return {"success": True, "holding_id": holding.id, "symbol": holding.symbol}


@router.put("/{portfolio_id}/holdings/{holding_id}")
def update_holding(
    portfolio_id: int,
    holding_id: int,
    req: HoldingUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update holding details (quantity, price, notes)."""
    holding = PortfolioIntelligenceService.update_holding(
        db=db,
        holding_id=holding_id,
        quantity=req.quantity,
        avg_buy_price=req.avg_buy_price,
        notes=req.notes,
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"success": True, "holding_id": holding.id}


@router.delete("/{portfolio_id}/holdings/{holding_id}")
def delete_holding(portfolio_id: int, holding_id: int, db: Session = Depends(get_db)):
    """Delete a holding from the portfolio."""
    success = PortfolioIntelligenceService.delete_holding(db, holding_id)
    if not success:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"success": True}


class CsvTextImportRequest(BaseModel):
    csv_content: str


@router.post("/{portfolio_id}/import-csv")
async def import_holdings_csv(
    portfolio_id: int,
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Import holdings from CSV or Excel file (.xlsx, .xls) or form text.
    Supports Zerodha Kite, Zerodha Equity & Mutual Funds P&L, Groww, Angel One, and standard formats.
    """
    if file:
        content = await file.read()
        filename = file.filename or "statement.csv"
        return PortfolioIntelligenceService.import_holdings_file(
            db=db,
            portfolio_id=portfolio_id,
            file_bytes=content,
            filename=filename,
        )
    elif csv_text:
        return PortfolioIntelligenceService.import_holdings_csv(db, portfolio_id, csv_text)
    else:
        raise HTTPException(status_code=400, detail="No CSV or Excel file provided")


@router.post("/{portfolio_id}/import-csv-text")
def import_holdings_csv_text(
    portfolio_id: int,
    req: CsvTextImportRequest,
    db: Session = Depends(get_db),
):
    """Import holdings by directly pasting CSV text."""
    if not req.csv_content or not req.csv_content.strip():
        raise HTTPException(status_code=400, detail="CSV content cannot be empty")
    result = PortfolioIntelligenceService.import_holdings_csv(db, portfolio_id, req.csv_content)
    return result


# -------------------------------------------------------------
# 360° REPORT, REBALANCING & OPPORTUNITY SCANNER
# -------------------------------------------------------------

@router.get("/{portfolio_id}/analysis/{symbol}")
def get_stock_360_analysis(portfolio_id: int, symbol: str, db: Session = Depends(get_db)):
    """Returns the comprehensive 360° deep-dive report for a specific stock."""
    price_info = PortfolioIntelligenceService.get_live_price_data(db, symbol)
    analysis = PortfolioIntelligenceService.analyze_stock_360(db, symbol, price_info["cmp"])
    return {
        "symbol": symbol.upper(),
        "live_price": price_info,
        "analysis": analysis,
    }


@router.get("/{portfolio_id}/rebalance")
def get_rebalance_recommendations(portfolio_id: int, db: Session = Depends(get_db)):
    """Engine 13: Sector concentration alerts and allocation rebalancing recommendations."""
    return PortfolioIntelligenceService.get_rebalancing_recommendations(db, portfolio_id)


@router.get("/{portfolio_id}/opportunities")
def get_fresh_opportunity_allocations(
    portfolio_id: int,
    amount: float = Query(100000.0, description="Amount in INR to allocate (Default 1 Lakh)"),
    db: Session = Depends(get_db),
):
    """
    Engine 14: 'Where to invest ₹X (Default ₹1,00,000) today?'
    Calculates the best risk-reward allocation across core dips and high-growth discoveries.
    """
    return PortfolioIntelligenceService.get_fresh_opportunity_allocator(db, portfolio_id, amount)


# -------------------------------------------------------------
# DEDICATED TELEGRAM RADAR & BUY/SELL ALERTS ENDPOINTS
# -------------------------------------------------------------
from app.services.portfolio_alert_service import PortfolioAlertService


class UpdatePortfolioTelegramRequest(BaseModel):
    chat_id: str
    channel_name: Optional[str] = None
    bot_token: Optional[str] = None
    telegram_username: Optional[str] = None
    is_enabled: Optional[bool] = True
    notify_portfolio_buy: Optional[bool] = True
    notify_portfolio_sell: Optional[bool] = True
    notify_portfolio_rebalance: Optional[bool] = True
    notify_watchlist_buy: Optional[bool] = True
    notify_watchlist_sell: Optional[bool] = True
    min_conviction_score: Optional[int] = 75
    notify_price_cross: Optional[bool] = True
    notify_dma_reclaim: Optional[bool] = True
    notify_vcp_breakout: Optional[bool] = True
    notify_volume_surge: Optional[bool] = True
    notify_target_stop: Optional[bool] = True


class TestPortfolioTelegramRequest(BaseModel):
    chat_id: Optional[str] = None
    bot_token: Optional[str] = None


@router.get("/telegram/config")
def get_portfolio_telegram_config(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetches the dedicated Telegram configuration for Portfolio & Watchlist BUY/SELL alerts.
    This group is separate from public screener engine alerts.
    """
    user_id = current_user.id if current_user else None
    cfg = PortfolioAlertService.get_or_create_config(db, user_id=user_id)
    return {
        "success": True,
        "config": cfg.to_dict(mask_secret=True),
    }


@router.post("/telegram/config")
def update_portfolio_telegram_config(
    req: UpdatePortfolioTelegramRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the dedicated Telegram channel/group settings and BUY/SELL notification flags.
    """
    user_id = current_user.id if current_user else None
    cfg = PortfolioAlertService.update_config(
        db=db,
        user_id=user_id,
        chat_id=req.chat_id,
        channel_name=req.channel_name,
        bot_token=req.bot_token,
        telegram_username=req.telegram_username,
        is_enabled=req.is_enabled,
        notify_portfolio_buy=req.notify_portfolio_buy,
        notify_portfolio_sell=req.notify_portfolio_sell,
        notify_portfolio_rebalance=req.notify_portfolio_rebalance,
        notify_watchlist_buy=req.notify_watchlist_buy,
        notify_watchlist_sell=req.notify_watchlist_sell,
        min_conviction_score=req.min_conviction_score,
        notify_price_cross=req.notify_price_cross,
        notify_dma_reclaim=req.notify_dma_reclaim,
        notify_vcp_breakout=req.notify_vcp_breakout,
        notify_volume_surge=req.notify_volume_surge,
        notify_target_stop=req.notify_target_stop,
    )
    return {
        "success": True,
        "message": "Dedicated Portfolio & Watchlist Telegram settings updated.",
        "config": cfg.to_dict(mask_secret=True),
    }


@router.post("/telegram/test-ping")
def test_portfolio_telegram_ping(
    req: Optional[TestPortfolioTelegramRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Sends a test verification ping to the separate Portfolio & Watchlist Telegram chat group.
    """
    user_id = current_user.id if current_user else None
    chat_id = req.chat_id if req else None
    bot_token = req.bot_token if req else None
    res = PortfolioAlertService.send_test_ping(
        db=db,
        user_id=user_id,
        custom_chat_id=chat_id,
        custom_bot_token=bot_token,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=400,
            detail=f"Telegram test ping failed: {res.get('error', 'Unknown error')}",
        )
    return {
        "success": True,
        "message": "Test ping successfully delivered to dedicated Telegram channel.",
        "details": res,
    }


@router.get("/{portfolio_id}/alerts/signals")
def get_portfolio_signals(
    portfolio_id: int,
    refresh: bool = Query(False, description="Force fresh live quote and diagnostics refresh"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans and returns all active BUY & SELL signals for this portfolio.
    BUY: Best Buy Zone, Accumulate Dip, Strong Buy Upgrade, Rebalance Add
    SELL: Profit Booking Target Reached, Stop Loss Breached, Rating Downgraded, Rebalance Trim
    """
    user_id = current_user.id if current_user else None
    signals = PortfolioAlertService.evaluate_portfolio_signals(
        db=db, portfolio_id=portfolio_id, user_id=user_id, force_refresh=refresh
    )
    buy_signals = [s for s in signals if s["signal_type"] == "BUY"]
    sell_signals = [s for s in signals if s["signal_type"] == "SELL"]

    return {
        "success": True,
        "portfolio_id": portfolio_id,
        "total_signals": len(signals),
        "buy_signals_count": len(buy_signals),
        "sell_signals_count": len(sell_signals),
        "buy_signals": buy_signals,
        "sell_signals": sell_signals,
        "all_signals": signals,
    }


@router.post("/{portfolio_id}/alerts/dispatch")
def dispatch_portfolio_alerts(
    portfolio_id: int,
    force_broadcast: bool = Query(False, description="Force broadcast even if in cooldown window"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans current portfolio holdings, discovers active BUY & SELL signals,
    and dispatches notifications directly to the dedicated Telegram chat group/channel.
    """
    user_id = current_user.id if current_user else None
    res = PortfolioAlertService.scan_and_dispatch_portfolio_alerts(
        db=db, portfolio_id=portfolio_id, user_id=user_id, force_broadcast=force_broadcast
    )
    return res


@router.get("/{portfolio_id}/alerts/history")
def get_portfolio_alerts_history(
    portfolio_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns audit trail of dispatched BUY & SELL signals for this portfolio.
    """
    history = PortfolioAlertService.get_recent_portfolio_signals(
        db=db, portfolio_id=portfolio_id, limit=limit
    )
    return {
        "success": True,
        "portfolio_id": portfolio_id,
        "count": len(history),
        "history": history,
    }

