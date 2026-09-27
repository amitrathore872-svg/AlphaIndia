"""
Alpha India - Breakout Execution Engine API Router
Endpoints for managing watched candidates, triggering live evaluation,
and monitoring breakout execution status.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.breakout_execution_service import BreakoutExecutionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/breakout-execution", tags=["Breakout Execution Engine"])


class WatchCandidateRequest(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    pattern_tag: Optional[str] = "SUPER_COIL"
    conviction_score: Optional[int] = 75
    setup_tier: Optional[str] = "A+ SUPER COIL"
    cmp: float
    day_change_pct: Optional[float] = 0.0
    trigger_price: Optional[float] = None
    stop_loss: Optional[float] = None
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    notes: Optional[str] = None


class AutoEnrollRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    min_conviction: int = Field(default=70, ge=50, le=100)


import math

def safe_num(val: Any, fallback: float = 0.0) -> float:
    if val is None:
        return fallback
    try:
        f = float(val)
        return fallback if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return fallback


@router.get("/candidates", response_model=Dict[str, Any])
def get_watched_candidates(
    status: Optional[str] = Query(default="ALL", description="ALL, TRIGGERED, READY, COILING, EXTENDED, FAILED"),
    db: Session = Depends(get_db),
):
    """
    Returns all active watched breakout candidates with live execution states.
    """
    candidates = BreakoutExecutionService.get_watched_candidates(db=db, status_filter=status)
    stats = BreakoutExecutionService.get_execution_stats(db=db)

    items = []
    for c in candidates:
        safe_cmp = safe_num(c.current_cmp, fallback=safe_num(c.added_at_cmp, 0.0))
        safe_trigger = safe_num(c.trigger_price, fallback=safe_cmp)
        safe_stop = safe_num(c.stop_loss, fallback=round(safe_cmp * 0.968, 2))
        safe_t1 = safe_num(c.target_1, fallback=round(safe_trigger * 1.09, 2))
        safe_t2 = safe_num(c.target_2, fallback=round(safe_trigger * 1.18, 2))
        safe_buy_max = safe_num(c.buy_zone_max, fallback=round(safe_trigger * 1.015, 2))
        safe_dist = safe_num(c.distance_to_trigger_pct, fallback=0.0)
        safe_day_chg = safe_num(c.day_change_pct, fallback=0.0)
        safe_vol_pace = safe_num(c.volume_pace_ratio, fallback=1.0)
        safe_rr = safe_num(c.risk_reward, fallback=3.0)

        items.append({
            "id": c.id,
            "symbol": c.symbol,
            "company_name": c.company_name or c.symbol,
            "sector": c.sector or "Diversified",
            "pattern_tag": c.pattern_tag,
            "conviction_score": c.conviction_score or 75,
            "setup_tier": c.setup_tier or "A+ SUPER COIL",
            "added_at_cmp": float(c.added_at_cmp or safe_cmp),
            "current_cmp": safe_cmp,
            "day_change_pct": safe_day_chg,
            "trigger_price": safe_trigger,
            "stop_loss": safe_stop,
            "target_1": safe_t1,
            "target_2": safe_t2,
            "buy_zone_max": safe_buy_max,
            "risk_reward": safe_rr,
            "distance_to_trigger_pct": safe_dist,
            "volume_pace_ratio": safe_vol_pace,
            "execution_status": c.execution_status or "COILING",
            "triggered_at": c.triggered_at.isoformat() if c.triggered_at else None,
            "alert_dispatched": bool(c.alert_dispatched),
            "is_active": bool(c.is_active),
            "auto_enrolled": bool(c.auto_enrolled),
            "notes": c.notes,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{c.symbol}/",
            "techno_funda_url": f"/techno-funda/{c.symbol}",
        })

    return {
        "stats": stats,
        "total_count": len(items),
        "items": items,
    }


@router.post("/watch", response_model=Dict[str, Any])
def watch_candidate(
    req: WatchCandidateRequest,
    db: Session = Depends(get_db),
):
    """
    Enrolls a candidate into the breakout watcher queue.
    """
    candidate = BreakoutExecutionService.add_candidate(db=db, data=req.model_dump())
    return {
        "success": True,
        "message": f"{candidate.symbol} added to Breakout Execution Engine.",
        "symbol": candidate.symbol,
        "execution_status": candidate.execution_status,
        "trigger_price": candidate.trigger_price,
    }


@router.delete("/watch/{symbol}", response_model=Dict[str, Any])
def remove_candidate(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Removes a candidate from the breakout watcher queue.
    """
    removed = BreakoutExecutionService.remove_candidate(db=db, symbol=symbol)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Candidate {symbol} not found in execution queue.")
    return {
        "success": True,
        "message": f"{symbol} removed from Breakout Execution Engine.",
        "symbol": symbol,
    }


@router.post("/auto-enroll", response_model=Dict[str, Any])
def auto_enroll_top_candidates(
    req: AutoEnrollRequest = AutoEnrollRequest(),
    db: Session = Depends(get_db),
):
    """
    Auto-enrolls top A+ pre-breakout contraction coils from the screener.
    """
    res = BreakoutExecutionService.auto_enroll_top_coils(
        db=db, limit=req.limit, min_conviction=req.min_conviction
    )
    return res


@router.post("/check-now", response_model=Dict[str, Any])
def check_breakout_status_now(db: Session = Depends(get_db)):
    """
    Triggers an immediate live price/volume check on all watched candidates.
    """
    res = BreakoutExecutionService.evaluate_watched_candidates(db=db)
    stats = BreakoutExecutionService.get_execution_stats(db=db)
    res["stats"] = stats
    return res


@router.post("/reset/{symbol}", response_model=Dict[str, Any])
def reset_candidate_alert(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Re-arms a candidate's alert status so new triggers can be signaled.
    """
    candidate = BreakoutExecutionService.reset_candidate_alert(db=db, symbol=symbol)
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate {symbol} not found.")
    return {
        "success": True,
        "message": f"Alert re-armed for {candidate.symbol}.",
        "symbol": candidate.symbol,
        "execution_status": candidate.execution_status,
    }


@router.get("/stats", response_model=Dict[str, Any])
def get_execution_stats(db: Session = Depends(get_db)):
    """
    Returns summary statistics for the Breakout Execution Engine.
    """
    return BreakoutExecutionService.get_execution_stats(db=db)


@router.post("/test-telegram/{symbol}", response_model=Dict[str, Any])
def test_telegram_alert(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Sends an immediate test breakout execution trigger alert to the configured Telegram channel.
    """
    from app.services.alert_dispatch_service import AlertDispatchService
    from app.models.breakout_execution import BreakoutExecutionCandidate

    clean_sym = symbol.strip().upper()
    candidate = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.symbol == clean_sym).first()
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Candidate {clean_sym} not found in execution queue.")

    res = AlertDispatchService.dispatch_breakout_execution_alert(db=db, candidate=candidate)
    return {
        "success": bool(res.get("telegram", {}).get("success")),
        "message": f"Telegram alert dispatch attempted for {clean_sym}.",
        "details": res,
    }
