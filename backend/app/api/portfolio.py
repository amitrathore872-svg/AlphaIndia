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
    Import holdings from CSV file or form text.
    Supports Zerodha Kite, Groww, Angel One, and standard CSV formats.
    """
    text_to_parse = ""
    if file:
        content = await file.read()
        text_to_parse = content.decode("utf-8", errors="ignore")
    elif csv_text:
        text_to_parse = csv_text
    else:
        raise HTTPException(status_code=400, detail="No CSV file or text provided")

    result = PortfolioIntelligenceService.import_holdings_csv(db, portfolio_id, text_to_parse)
    return result


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
