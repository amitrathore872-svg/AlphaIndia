"""
Alpha India - Apex Swing Router
===============================
/api/v1/apex-swing
FastAPI Router exposing:
- GET /api/v1/apex-swing/setups: Full institutional swing cockpit payload
- GET /api/v1/apex-swing/ticket/{symbol}: Single stock execution blueprint ticket
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.apex_swing_engine import ApexSwingEngine

logger = logging.getLogger("alpha_india.api.apex_swing")

router = APIRouter(prefix="/apex-swing", tags=["Apex Swing Sniper Engine"])


@router.get("/setups", summary="Get top institutional asymmetric swing trade setups")
def get_apex_swing_setups(
    archetype: Optional[str] = Query(None, description="ALL, TRIPLE_ALPHA_PEAD, ORDER_WIN_CATALYST, STEALTH_FLOAT_COIL, EMA20_DEFENDER, CONSENSUS_RE_RATING, RUNAWAY_CATALYST, MOMENTUM_DRIFT"),
    sector: Optional[str] = Query(None, description="Filter by equity sector"),
    min_conviction: float = Query(0.0, ge=0.0, le=100.0, description="Minimum conviction score (0-100)"),
    search: Optional[str] = Query(None, description="Search symbol or company name"),
    force_refresh: bool = Query(False, description="Bypass cache and force recalculation"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns verified, high-probability swing trading setups combining:
    - Delivery Radar (order flow, buyer demand)
    - PEAD Drift Screener (Athena quarterly shock, margins)
    - Investor Intelligence (concall guidance, forensic proof)
    - Runaway Guidance & Diamond Catalysts (order books, capex inflection, margin corridor)
    - Brokerage Radar (target upgrades, consensus corridor)
    - Institutional Radar (mutual fund float absorption)
    - Binary Event Risk Shield (board meeting protection)
    - Macro Regime (dynamic sizing multiplier)
    - Real-Time Trading Gap & Chase Metrics
    """
    try:
        return ApexSwingEngine.get_apex_swing_setups(
            db=db,
            archetype_filter=archetype,
            sector_filter=sector,
            min_conviction=min_conviction,
            search=search,
            force_refresh=force_refresh,
        )
    except Exception as e:
        logger.error(f"[ApexSwingAPI] Error generating setups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ticket/{symbol}", summary="Get deep actionable trade ticket for a single stock")
def get_single_ticket(
    symbol: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns single-stock execution ticket with buy corridor, stop loss, and target ladder.
    """
    try:
        ticket = ApexSwingEngine.get_single_ticket(db=db, symbol=symbol)
        if not ticket:
            raise HTTPException(
                status_code=404,
                detail=f"Stock '{symbol.upper()}' does not currently qualify for an Apex Swing setup",
            )
        return {
            "status": "SUCCESS",
            "ticket": ticket,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ApexSwingAPI] Error fetching ticket for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
