"""
Alpha India - Sovereign Alpha & Velocity Cockpit API Router
Sprint 42.0 Institutional Quant & Autonomous AI Trading Radar
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.services.sovereign_cockpit_service import SovereignCockpitService

logger = logging.getLogger("alpha_india.api.sovereign")

router = APIRouter(prefix="/sovereign", tags=["Sovereign Alpha Cockpit"])


class AlertDispatchRequest(BaseModel):
    symbol: str
    alert_type: str = "IGNITION_TRIGGER"  # IGNITION_TRIGGER, PYRAMID_CONFIRMATION, TARGET_1_HIT, TARGET_2_HIT, TIME_STOP_WARNING, INVALIDATION_STOP
    custom_note: Optional[str] = None


@router.get("/cockpit")
def get_sovereign_cockpit(
    chamber: Optional[str] = Query(None, description="Filter by chamber: COMPOUNDER or TURNAROUND"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns live sovereign cockpit intelligence:
    - Dual-Chamber candidates (No artificial quota)
    - Execution buy boxes, 7-day velocity time-stops, 60/40 pilot sizing, profit harvest targets
    - Mathematical composite conviction scores
    """
    try:
        data = SovereignCockpitService.evaluate_universe(db)
        if chamber:
            ch_upper = chamber.upper()
            if "COMP" in ch_upper:
                data["chamber_2_turnarounds"]["candidates"] = []
                data["total_qualified"] = data["chamber_1_compounders"]["count"]
            elif "TURN" in ch_upper:
                data["chamber_1_compounders"]["candidates"] = []
                data["total_qualified"] = data["chamber_2_turnarounds"]["count"]
        return data
    except Exception as e:
        logger.error(f"Error fetching sovereign cockpit data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dossier/{symbol}")
def get_ai_forensic_dossier(
    symbol: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns 360° AI Forensic & Qualitative Investigation for a specific stock:
    - Management Concall & Presentation Takeaways
    - Macro & Sectoral Headwinds / Tailwinds
    - Bull Case & Bear Case
    - Forensic Integrity Flags (Promoter Pledge, Cash conversion)
    - Hard Invalidation Anchor
    """
    try:
        dossier = SovereignCockpitService.get_ai_forensic_dossier(db, symbol.upper())
        if "error" in dossier:
            raise HTTPException(status_code=404, detail=dossier["error"])
        return dossier
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building AI dossier for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dispatch-alert")
def dispatch_sovereign_alert(
    payload: AlertDispatchRequest = Body(...),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Dispatches a real-time sovereign alert across In-App notifications and Telegram channel.
    Alert Types:
    - IGNITION_TRIGGER (Ready inside Buy Box)
    - PYRAMID_CONFIRMATION (+2.5% in profit, scale remaining 40%)
    - TARGET_1_HIT (+14%, harvest 33%, move SL to cost)
    - TARGET_2_HIT (+25%, harvest 33%)
    - TIME_STOP_WARNING (7 sessions stalled, dead money alert)
    - INVALIDATION_STOP (-3% structural break)
    """
    try:
        res = SovereignCockpitService.dispatch_alert(
            db=db,
            alert_type=payload.alert_type,
            symbol=payload.symbol.upper(),
            custom_note=payload.custom_note
        )
        return res
    except Exception as e:
        logger.error(f"Error dispatching sovereign alert for {payload.symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
