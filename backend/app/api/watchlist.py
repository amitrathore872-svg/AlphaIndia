"""
Alpha India Watchlist API
Supports multiple watchlists, conviction/confidence ranking (1-5),
inline investment comments/notes, and real-time financial data enrichment.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.db.database import get_db
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.watchlist import Watchlist, WatchlistItem
from app.models.watchlist_alert import WatchlistAlert, UserPersonalTelegramConfig
from app.models.user import User
from app.api.deps import get_optional_current_user
from app.services.live_price_service import LivePriceService
from app.services.watchlist_alert_service import WatchlistAlertService

router = APIRouter(
    prefix="/watchlists",
    tags=["Watchlists"],
)


# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------
class CreateWatchlistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = "cyan"


class UpdateWatchlistRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None


class AddWatchlistItemRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=30)
    company_name: Optional[str] = None
    confidence_score: int = Field(default=3, ge=1, le=5)
    comment: Optional[str] = None
    target_price: Optional[float] = None


class UpdateWatchlistItemRequest(BaseModel):
    confidence_score: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    target_price: Optional[float] = None


# ---------------------------------------------------------
# Helper to enrich items with market fundamentals
# ---------------------------------------------------------
def enrich_item(item: WatchlistItem, db: Session) -> Dict[str, Any]:
    clean_sym = item.symbol.strip().upper()

    # Query screener growth record for rich fundamental metrics
    screener_rec = (
        db.query(ScreenerGrowthRecord)
        .filter(ScreenerGrowthRecord.symbol == clean_sym)
        .first()
    )

    # Query master company table
    comp = db.query(Company).filter(Company.symbol == clean_sym).first()

    company_name = (
        item.company_name
        or (screener_rec.company_name if screener_rec else None)
        or (comp.company if comp else clean_sym)
    )

    # Query live market metrics
    metrics = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.symbol == clean_sym).first()

    cmp = (metrics.cmp if metrics and metrics.cmp and metrics.cmp > 0 else None) or (screener_rec.current_price if screener_rec else None)
    sector = (
        (metrics.sector if metrics and metrics.sector else None)
        or (screener_rec.sector if screener_rec and screener_rec.sector else None)
        or (comp.sector if comp else None)
        or "Unknown"
    )
    industry = (
        (screener_rec.industry if screener_rec and screener_rec.industry else None)
        or (comp.industry if comp else None)
        or "Unknown"
    )
    exchange = (
        (screener_rec.exchange if screener_rec and screener_rec.exchange else None)
        or (comp.exchange if comp else None)
        or "NSE"
    )

    market_cap = (
        (metrics.market_cap if metrics and metrics.market_cap else None)
        or (screener_rec.market_cap if screener_rec and screener_rec.market_cap else None)
        or (comp.market_cap if comp else None)
    )
    market_cap_category = (
        screener_rec.market_cap_category
        if screener_rec and screener_rec.market_cap_category
        else (comp.market_cap_category if comp else "MID")
    )

    return {
        "id": item.id,
        "watchlist_id": item.watchlist_id,
        "symbol": clean_sym,
        "company_name": company_name,
        "confidence_score": item.confidence_score,
        "comment": item.comment or "",
        "target_price": item.target_price,
        "added_at": item.added_at.isoformat() if item.added_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        # Fundamentals
        "current_price": cmp,
        "sector": sector,
        "industry": industry,
        "exchange": exchange,
        "market_cap": market_cap,
        "market_cap_category": market_cap_category,
        "stock_pe": screener_rec.stock_pe if screener_rec else None,
        "roce": (
            screener_rec.roce
            if screener_rec and screener_rec.roce is not None
            else (comp.roce if comp else None)
        ),
        "roe": screener_rec.roe if screener_rec else None,
        "sales_growth_3yr": (
            screener_rec.sales_growth_3yr if screener_rec else None
        ),
        "profit_growth_3yr": (
            screener_rec.profit_growth_3yr if screener_rec else None
        ),
        "return_3m": screener_rec.return_3m if screener_rec else None,
        "return_1y": screener_rec.return_1y if screener_rec else None,
        "dma_50": screener_rec.dma_50 if screener_rec else None,
        "dma_200": screener_rec.dma_200 if screener_rec else None,
        "ai_score": comp.ai_score if comp else None,
    }


# ---------------------------------------------------------
# Watchlist Endpoints
# ---------------------------------------------------------
@router.get("")
def list_watchlists(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Returns all user watchlists with item counts, average confidence, and summary stats.
    Automatically creates a default 'Core Growth Ideas' watchlist if none exist.
    """
    query = db.query(Watchlist)
    if current_user:
        query = query.filter(or_(Watchlist.user_id == current_user.id, Watchlist.user_id.is_(None)))
    watchlists = query.order_by(Watchlist.id.asc()).all()

    # Seed initial watchlist if table is empty
    if not watchlists:
        default_wl = Watchlist(
            name="Core Growth Conviction",
            description="High conviction long-term compounding opportunities in Indian markets",
            color="cyan",
            is_default=1,
        )
        db.add(default_wl)
        db.commit()
        db.refresh(default_wl)

        # Add seed stocks from top quality records if available
        seed_symbols = ["TCS", "INFY", "DEEPAKNTR", "RELIANCE", "CPCL"]
        for sym in seed_symbols:
            c = db.query(Company).filter(Company.symbol == sym).first()
            item = WatchlistItem(
                watchlist_id=default_wl.id,
                symbol=sym,
                company_name=c.company if c else sym,
                confidence_score=5 if sym in ("TCS", "INFY") else 4,
                comment="Institutional seed pick: strong balance sheet and solid return on capital.",
            )
            db.add(item)
        db.commit()
        watchlists = [default_wl]

    results = []
    for wl in watchlists:
        items = wl.items
        avg_conf = (
            round(sum(i.confidence_score for i in items) / len(items), 1)
            if items
            else 0.0
        )
        results.append({
            "id": wl.id,
            "name": wl.name,
            "description": wl.description or "",
            "color": wl.color or "cyan",
            "is_default": bool(wl.is_default),
            "items_count": len(items),
            "avg_confidence": avg_conf,
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
            "updated_at": wl.updated_at.isoformat() if wl.updated_at else None,
        })

    return {"success": True, "count": len(results), "watchlists": results}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_watchlist(
    req: CreateWatchlistRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Creates a new named watchlist, automatically scoped to current user.
    """
    wl = Watchlist(
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        color=req.color or "cyan",
        user_id=current_user.id if current_user else None,
    )
    db.add(wl)
    db.commit()
    db.refresh(wl)

    return {
        "success": True,
        "message": f"Watchlist '{wl.name}' created successfully.",
        "watchlist": {
            "id": wl.id,
            "name": wl.name,
            "description": wl.description or "",
            "color": wl.color,
            "items_count": 0,
            "avg_confidence": 0.0,
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
        },
    }


@router.get("/search/stocks")
def search_stocks_for_watchlist(
    q: str = Query(default="", min_length=1),
    limit: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Fast autocomplete endpoint for quickly searching and adding stocks to any watchlist.
    Returns matching symbols, company names, CMP, sector, and ROCE.
    """
    clean_q = q.strip()
    companies = (
        db.query(Company)
        .filter(
            or_(
                Company.symbol.ilike(f"%{clean_q}%"),
                Company.company.ilike(f"%{clean_q}%"),
            )
        )
        .order_by(Company.company.asc())
        .limit(limit)
        .all()
    )

    symbols = [c.symbol for c in companies]
    screener_recs = {
        r.symbol: r
        for r in db.query(ScreenerGrowthRecord)
        .filter(ScreenerGrowthRecord.symbol.in_(symbols))
        .all()
    }

    results = []
    for c in companies:
        rec = screener_recs.get(c.symbol)
        results.append({
            "symbol": c.symbol,
            "company_name": c.company,
            "sector": c.sector or (rec.sector if rec else "Unknown"),
            "exchange": c.exchange or "NSE",
            "current_price": rec.current_price if rec else None,
            "roce": rec.roce if rec and rec.roce is not None else c.roce,
            "stock_pe": rec.stock_pe if rec else None,
            "market_cap": rec.market_cap if rec and rec.market_cap else c.market_cap,
        })

    return {"success": True, "count": len(results), "results": results}


@router.get("/{watchlist_id}")
def get_watchlist(
    watchlist_id: int,
    refresh: bool = Query(False, description="Force fresh live price resolution for all stocks"),
    db: Session = Depends(get_db),
):
    """
    Returns full watchlist details along with all stock items enriched with live metrics.
    """
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    if refresh:
        symbols = [item.symbol.strip().upper() for item in wl.items if item.symbol]
        if symbols:
            LivePriceService.get_batch_live_prices(symbols, force_refresh=True, db=db)

    items = [enrich_item(item, db) for item in wl.items]

    # Calculate summary KPIs for this watchlist
    avg_conf = (
        round(sum(i["confidence_score"] for i in items) / len(items), 1)
        if items
        else 0.0
    )
    valid_roce = [i["roce"] for i in items if i["roce"] is not None]
    avg_roce = (
        round(sum(valid_roce) / len(valid_roce), 1) if valid_roce else None
    )
    high_conviction_count = sum(
        1 for i in items if i["confidence_score"] in (4, 5)
    )

    return {
        "success": True,
        "watchlist": {
            "id": wl.id,
            "name": wl.name,
            "description": wl.description or "",
            "color": wl.color or "cyan",
            "is_default": bool(wl.is_default),
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
            "updated_at": wl.updated_at.isoformat() if wl.updated_at else None,
        },
        "summary": {
            "items_count": len(items),
            "avg_confidence": avg_conf,
            "avg_roce": avg_roce,
            "high_conviction_count": high_conviction_count,
        },
        "items": items,
    }


@router.post("/{watchlist_id}/refresh-prices")
def refresh_watchlist_prices(watchlist_id: int, db: Session = Depends(get_db)):
    """
    Triggers batch live market quote fetching for all stocks in the specified watchlist.
    """
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    symbols = [item.symbol.strip().upper() for item in wl.items if item.symbol]
    quotes = {}
    if symbols:
        quotes = LivePriceService.get_batch_live_prices(symbols, force_refresh=True, db=db)

    items = [enrich_item(item, db) for item in wl.items]

    return {
        "success": True,
        "refreshed_count": len(symbols),
        "items": items,
    }


@router.put("/{watchlist_id}")
def update_watchlist(
    watchlist_id: int,
    req: UpdateWatchlistRequest,
    db: Session = Depends(get_db),
):
    """
    Updates watchlist metadata (name, description, color).
    """
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    if req.name is not None:
        wl.name = req.name.strip()
    if req.description is not None:
        wl.description = req.description.strip()
    if req.color is not None:
        wl.color = req.color

    wl.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wl)

    return {
        "success": True,
        "message": "Watchlist updated successfully.",
        "watchlist": {
            "id": wl.id,
            "name": wl.name,
            "description": wl.description or "",
            "color": wl.color,
        },
    }


@router.delete("/{watchlist_id}")
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    """
    Deletes a watchlist and all child items.
    """
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    name = wl.name
    db.delete(wl)
    db.commit()

    return {
        "success": True,
        "message": f"Watchlist '{name}' deleted successfully.",
    }


# ---------------------------------------------------------
# Watchlist Item Endpoints (Add, Edit, Delete Stock)
# ---------------------------------------------------------
@router.post("/{watchlist_id}/items", status_code=status.HTTP_201_CREATED)
def add_stock_to_watchlist(
    watchlist_id: int,
    req: AddWatchlistItemRequest,
    db: Session = Depends(get_db),
):
    """
    Adds a stock to the specified watchlist with an initial confidence rank (1-5) and comment.
    """
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    clean_sym = req.symbol.strip().upper()

    # Check for duplicate
    existing = (
        db.query(WatchlistItem)
        .filter(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.symbol == clean_sym,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"{clean_sym} is already in this watchlist. You can edit its confidence or comment directly.",
        )

    # Resolve company name
    comp = db.query(Company).filter(Company.symbol == clean_sym).first()
    c_name = req.company_name or (comp.company if comp else clean_sym)

    item = WatchlistItem(
        watchlist_id=watchlist_id,
        symbol=clean_sym,
        company_name=c_name,
        confidence_score=req.confidence_score,
        comment=req.comment.strip() if req.comment else None,
        target_price=req.target_price,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    enriched = enrich_item(item, db)
    return {
        "success": True,
        "message": f"Added {clean_sym} to '{wl.name}'.",
        "item": enriched,
    }


@router.put("/{watchlist_id}/items/{item_id}")
def update_watchlist_item(
    watchlist_id: int,
    item_id: int,
    req: UpdateWatchlistItemRequest,
    db: Session = Depends(get_db),
):
    """
    Updates stock confidence rating (1-5) and investment thesis comment.
    Called directly by the table inline editor for instant updates.
    """
    item = (
        db.query(WatchlistItem)
        .filter(
            WatchlistItem.id == item_id,
            WatchlistItem.watchlist_id == watchlist_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=404, detail="Stock item not found in this watchlist."
        )

    if req.confidence_score is not None:
        item.confidence_score = req.confidence_score
    if req.comment is not None:
        item.comment = req.comment.strip()
    if req.target_price is not None:
        item.target_price = req.target_price

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    enriched = enrich_item(item, db)
    return {
        "success": True,
        "message": f"Updated {item.symbol}.",
        "item": enriched,
    }


@router.delete("/{watchlist_id}/items/{item_id}")
def remove_stock_from_watchlist(
    watchlist_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    """
    Removes a stock from the watchlist.
    """
    item = (
        db.query(WatchlistItem)
        .filter(
            WatchlistItem.id == item_id,
            WatchlistItem.watchlist_id == watchlist_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=404, detail="Stock item not found in this watchlist."
        )

    sym = item.symbol
    db.delete(item)
    db.commit()

    return {
        "success": True,
        "message": f"Removed {sym} from watchlist.",
        "removed_symbol": sym,
    }


# =========================================================
# Rule-Based Alerts & Personal Telegram Endpoints
# =========================================================

class CreateWatchlistAlertRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=30)
    rule_type: str = Field(..., min_length=2, max_length=50)
    threshold_value: Optional[float] = None
    timeframe: Optional[str] = "1D"
    notes: Optional[str] = None
    notify_in_app: Optional[bool] = True
    notify_telegram: Optional[bool] = True


class UpdateAlertStatusRequest(BaseModel):
    status: str = Field(..., min_length=4, max_length=20)


class UpdatePersonalTelegramRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, max_length=100)
    channel_name: Optional[str] = "Personal Watchlist Radar"
    bot_token: Optional[str] = None
    telegram_username: Optional[str] = None
    is_enabled: Optional[bool] = True
    notify_price_cross: Optional[bool] = True
    notify_dma_reclaim: Optional[bool] = True
    notify_vcp_breakout: Optional[bool] = True
    notify_volume_surge: Optional[bool] = True
    notify_target_stop: Optional[bool] = True
    notify_portfolio_buy: Optional[bool] = True
    notify_portfolio_sell: Optional[bool] = True
    notify_portfolio_rebalance: Optional[bool] = True
    notify_watchlist_buy: Optional[bool] = True
    notify_watchlist_sell: Optional[bool] = True
    min_conviction_score: Optional[int] = 75


class TestTelegramPingRequest(BaseModel):
    chat_id: Optional[str] = None
    bot_token: Optional[str] = None


@router.get("/personal-telegram/config")
def get_personal_telegram_config(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetches the personalized Telegram configuration for the current user.
    """
    user_id = current_user.id if current_user else None
    cfg = WatchlistAlertService.get_or_create_user_telegram_config(db, user_id=user_id)
    return {
        "success": True,
        "config": cfg.to_dict(mask_secret=True),
    }


@router.post("/personal-telegram/config")
def update_personal_telegram_config(
    req: UpdatePersonalTelegramRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates personalized Telegram channel settings (chat_id, bot_token, notification flags).
    """
    user_id = current_user.id if current_user else None
    cfg = WatchlistAlertService.update_user_telegram_config(
        db=db,
        user_id=user_id,
        chat_id=req.chat_id,
        channel_name=req.channel_name,
        bot_token=req.bot_token,
        telegram_username=req.telegram_username,
        is_enabled=req.is_enabled,
        notify_price_cross=req.notify_price_cross,
        notify_dma_reclaim=req.notify_dma_reclaim,
        notify_vcp_breakout=req.notify_vcp_breakout,
        notify_volume_surge=req.notify_volume_surge,
        notify_target_stop=req.notify_target_stop,
        notify_portfolio_buy=req.notify_portfolio_buy,
        notify_portfolio_sell=req.notify_portfolio_sell,
        notify_portfolio_rebalance=req.notify_portfolio_rebalance,
        notify_watchlist_buy=req.notify_watchlist_buy,
        notify_watchlist_sell=req.notify_watchlist_sell,
        min_conviction_score=req.min_conviction_score,
    )
    return {
        "success": True,
        "message": "Personal Telegram alert configuration saved.",
        "config": cfg.to_dict(mask_secret=True),
    }


@router.post("/personal-telegram/test-ping")
def test_personal_telegram_ping(
    req: Optional[TestTelegramPingRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Sends an instant verification message to the user's personal Telegram chat / channel.
    """
    user_id = current_user.id if current_user else None
    chat_id = req.chat_id if req else None
    bot_token = req.bot_token if req else None
    res = WatchlistAlertService.send_test_ping(
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
        "message": "Test ping delivered successfully to personal Telegram channel.",
        "details": res,
    }


@router.get("/alerts/by-symbol/{symbol}")
def get_alerts_by_symbol(
    symbol: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetches all configured rule alerts for a specific stock symbol.
    """
    user_id = current_user.id if current_user else None
    alerts = WatchlistAlertService.get_alerts_for_symbol(db, symbol=symbol, user_id=user_id)
    return {
        "success": True,
        "symbol": symbol.upper(),
        "alerts": [a.to_dict() for a in alerts],
    }


@router.get("/{watchlist_id}/alerts")
def get_alerts_for_watchlist(
    watchlist_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetches all alerts configured within a given watchlist.
    """
    user_id = current_user.id if current_user else None
    alerts = WatchlistAlertService.get_alerts_for_watchlist(
        db, watchlist_id=watchlist_id, user_id=user_id
    )
    return {
        "success": True,
        "watchlist_id": watchlist_id,
        "alerts": [a.to_dict() for a in alerts],
    }


@router.post("/{watchlist_id}/alerts")
def create_watchlist_alert(
    watchlist_id: int,
    req: CreateWatchlistAlertRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new rule-based alert for a stock in this watchlist.
    """
    # Verify watchlist exists
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found.")

    user_id = current_user.id if current_user else None
    alert = WatchlistAlertService.create_alert(
        db=db,
        watchlist_id=watchlist_id,
        symbol=req.symbol,
        rule_type=req.rule_type,
        threshold_value=req.threshold_value,
        user_id=user_id,
        timeframe=req.timeframe or "1D",
        notes=req.notes,
        notify_in_app=req.notify_in_app if req.notify_in_app is not None else True,
        notify_telegram=req.notify_telegram if req.notify_telegram is not None else True,
    )

    return {
        "success": True,
        "message": f"Alert created for {alert.symbol} ({alert.rule_type}).",
        "alert": alert.to_dict(),
    }


@router.patch("/alerts/{alert_id}/status")
def update_watchlist_alert_status(
    alert_id: int,
    req: UpdateAlertStatusRequest,
    db: Session = Depends(get_db),
):
    """
    Updates alert status (ACTIVE, SNOOZED, MUTED, etc.).
    """
    alert = WatchlistAlertService.update_alert_status(db, alert_id=alert_id, status=req.status.upper())
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return {
        "success": True,
        "message": f"Alert {alert_id} status updated to {alert.status}.",
        "alert": alert.to_dict(),
    }


@router.delete("/alerts/{alert_id}")
def delete_watchlist_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    """
    Deletes a watchlist alert.
    """
    ok = WatchlistAlertService.delete_alert(db, alert_id=alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return {
        "success": True,
        "message": f"Alert {alert_id} deleted.",
    }


class EvaluateAlertsRequest(BaseModel):
    cmp: float
    day_change_pct: Optional[float] = 0.0
    volume: Optional[float] = None
    avg_volume_20d: Optional[float] = None
    dma_50: Optional[float] = None
    dma_200: Optional[float] = None
    vcp_score: Optional[int] = None
    momentum_matches: Optional[int] = None


@router.post("/alerts/evaluate/{symbol}")
def evaluate_symbol_alerts(
    symbol: str,
    req: EvaluateAlertsRequest,
    db: Session = Depends(get_db),
):
    """
    Evaluates all active rules for the given symbol against real-time parameters.
    Dispatches to personal Telegram if triggered.
    """
    results = WatchlistAlertService.evaluate_and_dispatch(
        db=db,
        symbol=symbol,
        cmp=req.cmp,
        day_change_pct=req.day_change_pct or 0.0,
        volume=req.volume,
        avg_volume_20d=req.avg_volume_20d,
        dma_50=req.dma_50,
        dma_200=req.dma_200,
        vcp_score=req.vcp_score,
        momentum_matches=req.momentum_matches,
    )
    return {
        "success": True,
        "symbol": symbol.upper(),
        "triggered_count": len(results),
        "triggered": results,
    }

