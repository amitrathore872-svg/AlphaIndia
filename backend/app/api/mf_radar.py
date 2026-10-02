"""
FastAPI Router for Mutual Fund Alpha Radar & Intelligence Suite
Alpha India - Sprint 39
Provides institutional screener endpoints, NAV chart feeds, dip opportunity summaries, and warehouse sync.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.mf_radar.mf_warehouse_service import MFWarehouseService

router = APIRouter(prefix="/v1/mf-radar", tags=["Mutual Fund Alpha Radar"])


@router.get("/schemes", summary="List Top Equity Mutual Fund Schemes")
def get_schemes(
    category: Optional[str] = Query(None, description="Filter by category e.g. 'Flexi Cap', 'Small Cap', 'Mid Cap'"),
    search: Optional[str] = Query(None, description="Search by scheme name, AMC, or manager"),
    sort_by: str = Query("return_6m_pct", description="Column to sort by (return_6m_pct, return_3m_pct, return_1y_pct, day_change_pct, aum_cr, alpha_1y)"),
    sort_order: str = Query("desc", description="Sorting direction ('asc' or 'desc')"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """Returns server-side sorted and paginated Top Pure Equity schemes."""
    return MFWarehouseService.get_schemes_list(
        db=db,
        category=category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


@router.get("/nav/{scheme_code}", summary="Get Scheme Historical NAV Time Series for Charting")
def get_scheme_nav(
    scheme_code: str,
    period: str = Query("6M", description="Chart timeframe: '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'"),
    db: Session = Depends(get_db)
):
    """
    Returns high-resolution daily NAV series, 50 DMA, 200 DMA, and historical dip buy markers
    ready for TradingView lightweight-charts rendering.
    """
    result = MFWarehouseService.get_scheme_nav_series(db=db, scheme_code=scheme_code, period=period)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/summary", summary="Get Dashboard KPIs & Top Dip Opportunities")
def get_summary(db: Session = Depends(get_db)):
    """Returns aggregate summary KPIs, today's dip opportunities, and top momentum leaders."""
    return MFWarehouseService.get_summary_kpis(db=db)


@router.get("/dip-alerts/live-indices", summary="Get Real-Time Category Benchmark Indices")
def get_live_indices():
    """
    Returns real-time intraday quotes for all 6 benchmark indices (Nifty 50, 500, Midcap, Smallcap, IT, Bank)
    with dip status and cut-off window status.
    """
    from app.services.mf_radar.mf_dip_scanner_service import MFDipScannerService
    quotes = MFDipScannerService.scan_live_indices()
    is_window_open = MFDipScannerService.is_lumpsum_window_open()
    ist_time = MFDipScannerService.get_ist_now().strftime("%H:%M:%S IST")
    return {
        "status": "success",
        "ist_time": ist_time,
        "is_lumpsum_window_open": is_window_open,
        "cutoff_target": "14:00 IST",
        "indices": quotes
    }


@router.get("/dip-alerts/active", summary="Get Active Pre-2:00 PM Dip Signals")
def get_active_dip_alerts(db: Session = Depends(get_db)):
    """Returns today's active dip opportunities with recommended flagship funds."""
    from app.services.mf_radar.mf_dip_scanner_service import MFDipScannerService
    alerts = MFDipScannerService.get_active_dip_alerts(db)
    is_window_open = MFDipScannerService.is_lumpsum_window_open()
    return {
        "is_lumpsum_window_open": is_window_open,
        "cutoff_target": "14:00 IST",
        "active_alerts_count": len(alerts),
        "alerts": alerts
    }


@router.get("/dip-alerts/history", summary="Get Historical Dip Signals Ledger")
def get_dip_alert_history(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    """Returns historical dip alerts and their subsequent market outcome."""
    from app.services.mf_radar.mf_dip_scanner_service import MFDipScannerService
    return MFDipScannerService.get_historical_dip_ledger(db, limit=limit)


@router.post("/dip-alerts/scan-now", summary="Trigger Immediate Dip Detection Sweep")
def trigger_dip_scan(force: bool = Query(False), db: Session = Depends(get_db)):
    """Runs a manual intraday dip detection sweep across all benchmark indices."""
    from app.services.mf_radar.mf_dip_scanner_service import MFDipScannerService
    return MFDipScannerService.run_dip_detection_cycle(db, force_scan=force)


@router.post("/sync/daily", summary="Trigger AMFI Daily NAV Sync")
def sync_daily_navs(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Downloads official daily AMFI NAVAll.txt and updates all tracked schemes."""
    result = MFWarehouseService.sync_daily_navs_from_amfi(db)
    return result


@router.post("/sync/bootstrap", summary="Seed Curated Top 100 Universe & Backfill")
def bootstrap_universe(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Seeds the Top Equity master registry into PostgreSQL."""
    res = MFWarehouseService.bootstrap_universe(db)
    return res


@router.post("/backfill/{scheme_code}", summary="Backfill Historical NAV for Scheme")
def backfill_scheme(scheme_code: str, db: Session = Depends(get_db)):
    """Backfills multi-year daily NAV history and recalculates return metrics."""
    return MFWarehouseService.backfill_scheme_history(db=db, scheme_code=scheme_code)


# ==========================================================
# Phase 4: Momentum, Category Rotation & Dilution Alerts
# ==========================================================

@router.get("/momentum/heatmap", summary="Get Category Rotation Heatmap & Macro Signals")
def get_category_heatmap(db: Session = Depends(get_db)):
    """Returns aggregated style performance and institutional capital rotation signals."""
    from app.services.mf_radar.mf_momentum_service import MFMomentumService
    return MFMomentumService.get_category_rotation_heatmap(db)


@router.get("/momentum/rankings", summary="Get 3M/6M Relative Strength Rankings & Momentum Tiers")
def get_momentum_rankings(
    category: Optional[str] = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db)
):
    """
    Ranks schemes within each category based on rolling 3M & 6M Relative Strength (RS),
    assigning momentum tiers and flagging candidates for replacement.
    """
    from app.services.mf_radar.mf_momentum_service import MFMomentumService
    return MFMomentumService.get_scheme_momentum_rankings(db=db, category=category)


@router.get("/momentum/dilution-alerts", summary="Get Closet Indexer & AUM Size Drag Warnings")
def get_dilution_alerts(db: Session = Depends(get_db)):
    """Identifies closet indexers (fee drag) and small/mid-cap funds with excessive AUM."""
    from app.services.mf_radar.mf_momentum_service import MFMomentumService
    return MFMomentumService.get_dilution_and_closet_alerts(db)


# ==========================================================
# Phase 5: Personal Portfolio Tracker & Smart Swap Recommender
# ==========================================================

from pydantic import BaseModel, Field
from datetime import date as d_date

class AddHoldingRequest(BaseModel):
    scheme_code: str = Field(..., description="AMFI Scheme code")
    units: float = Field(..., gt=0, description="Number of units purchased")
    purchase_date: d_date = Field(..., description="Date of purchase (YYYY-MM-DD)")
    purchase_nav: float = Field(..., gt=0, description="Purchase NAV")
    folio_number: Optional[str] = None
    notes: Optional[str] = None


@router.get("/portfolio", summary="Get User Mutual Fund Portfolio Summary & Holdings")
def get_portfolio(db: Session = Depends(get_db)):
    """Returns user's mutual fund holdings with real-time valuations, holding age, and exit load/tax status."""
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService
    return MFPortfolioService.get_portfolio_summary(db)


@router.post("/portfolio/add", summary="Add Mutual Fund Holding")
def add_portfolio_holding(req: AddHoldingRequest, db: Session = Depends(get_db)):
    """Adds a mutual fund holding to portfolio."""
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService
    return MFPortfolioService.add_holding(
        db=db,
        scheme_code=req.scheme_code,
        units=req.units,
        purchase_date=req.purchase_date,
        purchase_nav=req.purchase_nav,
        folio_number=req.folio_number,
        notes=req.notes,
    )


@router.delete("/portfolio/{holding_id}", summary="Delete Mutual Fund Holding")
def delete_portfolio_holding(holding_id: int, db: Session = Depends(get_db)):
    """Deletes a holding by ID."""
    from app.models.mf_radar_models import MFRadarPortfolioHolding
    holding = db.query(MFRadarPortfolioHolding).filter(MFRadarPortfolioHolding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()
    return {"status": "success", "deleted_id": holding_id}


@router.get("/portfolio/swaps", summary="Generate Personalized Smart Swap Recommendation Cards")
def get_smart_swaps(db: Session = Depends(get_db)):
    """
    Analyzes current portfolio holdings for lagging alpha, finds superior category peers,
    deducts Exit Load and STCG/LTCG taxes, and produces actionable 'Sell Fund X -> Buy Fund Y' cards.
    """
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService
    return MFPortfolioService.generate_smart_swap_recommendations(db)


@router.post("/portfolio/seed-sample", summary="Seed Sample Portfolio for Demonstration")
def seed_sample_portfolio(db: Session = Depends(get_db)):
    """Seeds 3 realistic mutual fund holdings."""
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService
    return MFPortfolioService.seed_sample_portfolio(db)


class MFCsvTextImportRequest(BaseModel):
    csv_content: str = Field(..., description="Raw CSV text content")
    replace_existing: bool = Field(False, description="Whether to replace current holdings or merge")


@router.post("/portfolio/import-file", summary="Import Mutual Fund Holdings via Excel (.xlsx) or CSV File")
@router.post("/portfolio/import-csv", summary="Import Mutual Fund Holdings via Excel or CSV File")
async def import_mf_holdings_file(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    replace_existing: bool = Form(False),
    sheet_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Imports mutual fund holdings from:
    - Excel workbooks (.xlsx, .xls) like Zerodha Console, portfolio advisory sheets, CAMS
    - CSV files from Zerodha Coin, Groww, Angel One, CAS
    - Form/Pasted text
    """
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService

    if file:
        content = await file.read()
        filename = file.filename or "statement.xlsx"
        return MFPortfolioService.import_holdings_file(
            db=db,
            file_bytes=content,
            filename=filename,
            replace_existing=replace_existing,
            sheet_name=sheet_name,
        )
    elif csv_text:
        return MFPortfolioService.import_holdings_csv(
            db=db,
            csv_content=csv_text,
            replace_existing=replace_existing,
        )
    else:
        raise HTTPException(status_code=400, detail="No Excel/CSV file or text provided")


@router.post("/portfolio/import-csv-text", summary="Import Mutual Fund Holdings via Pasted CSV Text")
def import_mf_holdings_csv_text(
    req: MFCsvTextImportRequest,
    db: Session = Depends(get_db),
):
    """Imports mutual fund holdings by directly pasting CSV content."""
    if not req.csv_content or not req.csv_content.strip():
        raise HTTPException(status_code=400, detail="CSV content cannot be empty")
    from app.services.mf_radar.mf_portfolio_service import MFPortfolioService
    return MFPortfolioService.import_holdings_csv(db, req.csv_content, replace_existing=req.replace_existing)




