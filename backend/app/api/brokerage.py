"""
Alpha India — Institutional Brokerage Intelligence API Router
Exposes endpoints for:
- Paginated master research feed & filterable recommendations
- Top conviction Hot Picks
- Single-stock consensus corridor & chronological research history (for One Stock Page)
- 60+ Brokerage League Table & Scorecards
- Header summary metrics ribbon
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.brokerage_service import BrokerageService

logger = logging.getLogger("alpha_india.api.brokerage")

router = APIRouter(prefix="", tags=["Brokerage Intelligence"])


@router.get("/brokerage/feed")
@router.get("/api/v1/brokerage/feed")
def get_brokerage_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    symbol: Optional[str] = Query(None),
    brokerage_house: Optional[str] = Query(None),
    broker_tier: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    market_cap_category: Optional[str] = Query(None, description="LARGE_CAP, MID_CAP, SMALL_CAP, or ALL"),
    target_horizon: Optional[str] = Query(None, description="Filter by horizon: 1_MONTH, 3_MONTHS, 6_MONTHS, 12_MONTHS, SHORT, MEDIUM, LONG"),
    min_conviction: Optional[float] = Query(None),
    is_hot_pick: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("report_date"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns filterable, paginated institutional brokerage research reports.
    """
    try:
        return BrokerageService.get_brokerage_feed(
            db=db,
            page=page,
            limit=limit,
            symbol=symbol,
            brokerage_house=brokerage_house,
            broker_tier=broker_tier,
            action=action,
            market_cap_category=market_cap_category,
            target_horizon=target_horizon,
            min_conviction=min_conviction,
            is_hot_pick=is_hot_pick,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching feed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/hot-picks")
@router.get("/api/v1/brokerage/hot-picks")
def get_hot_picks(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns top-conviction cluster picks (Conviction Score >= 85 or multiple broker upgrades).
    """
    try:
        picks = BrokerageService.get_hot_picks(db=db, limit=limit)
        return {
            "status": "success",
            "count": len(picks),
            "data": picks,
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching hot picks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/stock/{symbol}")
@router.get("/api/v1/brokerage/stock/{symbol}")
def get_stock_brokerage_consensus(
    symbol: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns the consensus target price corridor (Low/Median/High), institutional stance,
    synthesized bull/bear thesis, and complete chronological report history for a single stock.
    Used by the One Stock Page (/stocks/[symbol]).
    """
    try:
        consensus = BrokerageService.get_stock_brokerage_consensus(db=db, symbol=symbol)
        return {
            "status": "success",
            "data": consensus,
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching stock consensus for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/stocks-consensus")
@router.get("/api/v1/brokerage/stocks-consensus")
def get_all_stocks_consensus(
    market_cap_category: Optional[str] = Query(None, description="LARGE_CAP, MID_CAP, SMALL_CAP, or ALL"),
    min_brokers: int = Query(1, ge=1, le=20, description="Minimum distinct brokerage houses covering stock"),
    search: Optional[str] = Query(None),
    sort_by: str = Query("broker_count", description="broker_count, consensus_upside_pct, avg_conviction_score, total_reports, symbol"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns multi-broker consensus corridors, distinct brokerage rosters, and complete
    recommendation histories grouped by stock, enabling unified multi-broker analysis.
    """
    try:
        data = BrokerageService.get_all_stocks_consensus(
            db=db,
            market_cap_category=market_cap_category,
            search=search,
            min_brokers=min_brokers,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return {
            "status": "success",
            "count": len(data),
            "data": data,
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching stocks consensus: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/scorecards")
@router.get("/api/v1/brokerage/scorecards")
def get_broker_scorecards(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns the empirical league table of all 60+ tracked brokerage houses ranked by hit rate.
    """
    try:
        scorecards = BrokerageService.get_scorecards(db=db)
        return {
            "status": "success",
            "count": len(scorecards),
            "data": scorecards,
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching scorecards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/metrics")
@router.get("/api/v1/brokerage/metrics")
def get_brokerage_metrics(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns summary stats ribbon for the Brokerage Radar dashboard.
    """
    try:
        metrics = BrokerageService.get_metrics_ribbon(db=db)
        return {
            "status": "success",
            "data": metrics,
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching metrics ribbon: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/brokerage/ingest")
@router.post("/api/v1/brokerage/ingest")
def trigger_brokerage_ingestion(
    days_back: int = Query(7, ge=1, le=30, description="Number of days to scan for fresh calls"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Triggers automated ingestion across institutional brokerage research feeds and media registries.
    Extracts new calls, normalizes targets, computes conviction scores, and updates the database.
    """
    from app.services.brokerage_ingestion_service import BrokerageIngestionService
    try:
        result = BrokerageIngestionService.ingest_live_brokerage_reports(db=db, days_back=days_back)
        return result
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error running brokerage ingestion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brokerage/ingestion/status")
@router.get("/api/v1/brokerage/ingestion/status")
def get_brokerage_ingestion_status(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns telemetry status on the Brokerage Radar ingestion engine.
    """
    from app.services.brokerage_ingestion_service import BrokerageIngestionService
    try:
        return {
            "status": "success",
            "data": BrokerageIngestionService.get_ingestion_status(db=db),
        }
    except Exception as e:
        logger.error(f"[BrokerageAPI] Error fetching ingestion status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

