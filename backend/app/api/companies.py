"""
Alpha India Companies API
Sprint v0.9.5 Recovery (Stable)
"""

from fastapi import APIRouter, Depends, Query, HTTPException, Body, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.database import get_db
from app.models.company import Company

router = APIRouter(tags=["Companies"])


# ==========================================================
# Dashboard Summary API (Consolidated Single DB Query)
# ==========================================================
@router.get("/companies/dashboard-summary")
def dashboard_summary(db: Session = Depends(get_db)):
    stats = db.query(
        func.count(Company.id).label("total_companies"),
        func.count().filter(Company.listing_status == "Active", Company.is_growth_eligible.is_(True)).label("active_companies"),
        func.count().filter(Company.listing_status != "Active").label("unlisted_companies"),
        func.count().filter(Company.security_type == "MUTUAL_FUND").label("mutual_funds"),
        func.count().filter(Company.security_type == "DEBT").label("debt_instruments"),
        func.count().filter(Company.exchange == "NSE").label("nse_companies"),
        func.count().filter(Company.exchange == "BSE").label("bse_companies"),
    ).one()

    return {
        "total_companies": stats.total_companies or 0,
        "active_companies": stats.active_companies or 0,
        "unlisted_companies": stats.unlisted_companies or 0,
        "mutual_funds": stats.mutual_funds or 0,
        "debt_instruments": stats.debt_instruments or 0,
        "nse_companies": stats.nse_companies or 0,
        "bse_companies": stats.bse_companies or 0,
    }

# ==========================================================
# Companies API
# Used by Growth Scanner Dashboard
# ==========================================================
@router.get("/companies")
def get_companies(
    search: str = Query(default=""),
    eligible_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Company)

    if eligible_only:
        query = query.filter(
            Company.listing_status == "Active",
            Company.is_growth_eligible.is_(True),
        )

    if search:
        query = query.filter(
            or_(
                Company.company.ilike(f"%{search}%"),
                Company.symbol.ilike(f"%{search}%"),
            )
        )

    total = query.count()

    companies = (
        query.order_by(Company.company.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "count": len(companies),
        "companies": [
            {
                "id": company.id,
                "company_name": company.company,
                "symbol": company.symbol,
                "isin": company.isin or "N/A",
                "exchange": company.exchange or "NSE",
                "listing_status": company.listing_status or "Active",
                "is_growth_eligible": company.is_growth_eligible if company.is_growth_eligible is not None else True,
                "security_type": getattr(company, "security_type", "EQUITY"),
                "sector": company.sector or "Unknown",
                "industry": company.industry or "Unknown",
                "market_cap": company.market_cap or "N/A",
                "revenue_growth": company.revenue_growth or 0,
                "pat_growth": company.pat_growth or 0,
                "roce": company.roce or 0,
                "ai_score": company.ai_score or 0,
                "updated_at": company.updated_at.isoformat() if getattr(company, "updated_at", None) else None,
            }
            for company in companies
        ],
    }


# ==========================================================
# Company Visibility & Status Toggle Endpoint
# ==========================================================
@router.patch("/companies/{company_id}/visibility")
def toggle_company_visibility(
    company_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Toggle growth eligibility or listing status (Hide/Unhide equity from screener/radar).
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if "is_growth_eligible" in payload:
        company.is_growth_eligible = bool(payload["is_growth_eligible"])

    if "listing_status" in payload:
        company.listing_status = str(payload["listing_status"])

    db.commit()
    db.refresh(company)

    return {
        "status": "success",
        "company_id": company.id,
        "symbol": company.symbol,
        "is_growth_eligible": company.is_growth_eligible,
        "listing_status": company.listing_status,
        "message": f"Company {company.symbol} visibility updated (Eligible: {company.is_growth_eligible}, Status: {company.listing_status})",
    }


# ==========================================================
# DhanHQ Zero-Latency Market Feed Console Endpoints
# ==========================================================
@router.get("/companies/dhan-feed/status")
def get_dhan_feed_status():
    """
    Returns real-time diagnostics and token expiry for DhanHQ Market Feed.
    """
    from app.clients.dhan_client import DhanClient
    dhan = DhanClient.get_instance()
    return dhan.check_connection()


@router.post("/companies/dhan-feed/update-token")
def update_dhan_feed_token(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Updates the Dhan access token for next 24 hours, persists to .env,
    reinitializes the live client, and triggers an immediate active price refresh in background.
    """
    import os
    import threading
    from app.clients.dhan_client import DhanClient
    from app.services.live_price_service import LivePriceService
    from app.core.config import settings

    access_token = str(payload.get("access_token", "")).strip()
    client_id = str(payload.get("client_id", "")).strip() or None

    if not access_token:
        raise HTTPException(status_code=400, detail="access_token is required")

    # 1. Update in-memory settings & environment
    os.environ["DHAN_ACCESS_TOKEN"] = access_token
    settings.DHAN_ACCESS_TOKEN = access_token
    if client_id:
        os.environ["DHAN_CLIENT_ID"] = client_id
        settings.DHAN_CLIENT_ID = client_id

    # 2. Persist to backend/.env file
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    try:
        env_lines = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                env_lines = f.readlines()

        token_updated = False
        client_updated = False
        new_lines = []
        for line in env_lines:
            if line.startswith("DHAN_ACCESS_TOKEN="):
                new_lines.append(f"DHAN_ACCESS_TOKEN={access_token}\n")
                token_updated = True
            elif client_id and line.startswith("DHAN_CLIENT_ID="):
                new_lines.append(f"DHAN_CLIENT_ID={client_id}\n")
                client_updated = True
            else:
                new_lines.append(line)

        if not token_updated:
            new_lines.append(f"DHAN_ACCESS_TOKEN={access_token}\n")
        if client_id and not client_updated:
            new_lines.append(f"DHAN_CLIENT_ID={client_id}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as env_err:
        pass

    # 3. Reconfigure DhanClient instance
    dhan = DhanClient.reconfigure(access_token=access_token, client_id=client_id)
    conn = dhan.check_connection()

    # 4. Trigger immediate active universe live price refresh in background thread
    if conn.get("configured") and not conn.get("is_expired"):
        def _bg_refresh():
            from app.db.database import SessionLocal
            try:
                with SessionLocal() as bg_db:
                    LivePriceService.refresh_active_universe_prices(bg_db, limit=50)
            except Exception:
                pass

        threading.Thread(target=_bg_refresh, daemon=True, name="DhanFeedManualRefresh").start()

    return {
        "status": "success",
        "connection": conn,
        "message": "Dhan token updated successfully. Real-time 0-delay feed active for next 24 hours.",
    }


@router.post("/companies/dhan-feed/refresh-prices")
def refresh_dhan_prices(
    limit: int = Query(default=60, ge=10, le=200),
    db: Session = Depends(get_db),
):
    """
    Manually triggers an immediate batch refresh of all active equity prices
    using DhanHQ zero-delay quotes.
    """
    from app.services.live_price_service import LivePriceService
    res = LivePriceService.refresh_active_universe_prices(db, limit=limit)
    return {
        "status": "success",
        "refreshed_count": res.get("refreshed_count", 0),
        "message": f"Successfully refreshed {res.get('refreshed_count', 0)} active equity quotes.",
    }