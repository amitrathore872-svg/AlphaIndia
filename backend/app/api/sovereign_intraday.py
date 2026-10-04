"""
Alpha India - Sovereign Intraday Cockpit REST API
Sprint 42.5 Flagship Real-Time Day Trading Endpoints

Exposes:
- GET /api/v1/sovereign-intraday/radar (Active signals strictly in execution windows)
- GET /api/v1/sovereign-intraday/log (Execution audit ledger & ₹1,00,000 PnL history)
- POST /api/v1/sovereign-intraday/refresh (Instant 5Paisa multi-quote refresh)
- POST /api/v1/sovereign-intraday/broadcast/{id} (Telegram alert dispatch)
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.sovereign_intraday_service import SovereignIntradayService

router = APIRouter(prefix="/sovereign-intraday", tags=["Sovereign Intraday Cockpit"])


@router.get("/radar")
def get_radar(
    force_refresh: bool = Query(False, description="Force 5Paisa quote refresh"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns live active candidates strictly within their temporal execution window.
    Features 5Paisa 0-delay real-time feed, countdown timers, and Breakeven Lock indicators.
    """
    try:
        return SovereignIntradayService.get_live_radar(db=db, force_refresh=force_refresh)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/log")
def get_log(
    limit: int = Query(100, ge=1, le=500, description="Max historical audit records to return"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns the persistent Execution Audit Ledger of closed trades, velocity stalls,
    and auto-expired setups with equity progression on ₹1,00,000 capital.
    """
    try:
        return SovereignIntradayService.get_execution_log(db=db, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/refresh")
def refresh_feed(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Forces an immediate multi-quote fetch from 5Paisa's live exchange gateway.
    """
    try:
        data = SovereignIntradayService.get_live_radar(db=db, force_refresh=True)
        return {
            "ok": True,
            "feed_status": data.get("feed_status"),
            "active_candidates_count": data.get("summary_stats", {}).get("total_active_candidates"),
            "timestamp": data.get("timestamp"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/broadcast/{signal_id}")
def broadcast_alert(signal_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Dispatches a real-time signal alert to Telegram and In-App notification center.
    """
    try:
        res = SovereignIntradayService.broadcast_telegram_signal(db=db, signal_id=signal_id)
        if not res.get("ok"):
            raise HTTPException(status_code=404, detail=res.get("error", "Failed to broadcast signal"))
        return res
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
