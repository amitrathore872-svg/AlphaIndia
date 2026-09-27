"""
Alpha India - Live Intraday Screener API
Sprint 38.0
Provides REST endpoints for the 5-Stage Intraday Precision Funnel:
1. /live-intraday/funnel-status (Full pipeline telemetry)
2. /live-intraday/opportunities (Top high-conviction trades)
3. /live-intraday/scan (Force refresh trigger)
4. /live-intraday/broadcast-telegram/{symbol} (Manual alert dispatch)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.intraday_funnel_service import IntradayFunnelService
from app.clients.dhan_client import DhanClient

logger = logging.getLogger("alpha_india.api.live_intraday")

router = APIRouter(prefix="/live-intraday", tags=["Live Intraday Screener"])


@router.get("/funnel-status")
def get_funnel_status(
    force_refresh: bool = Query(False, description="Bypass cache and force recalculation"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns the complete 5-stage funnel state across Nifty 500:
    - Stage counts: 500 -> Narrow CPR -> Sector Aligned -> ORB Breakout -> Elite A+
    - Nifty 50 live benchmark
    - DhanHQ connection status
    - Elite candidates and active trade plans
    """
    try:
        data = IntradayFunnelService.execute_funnel_scan(db=db, force_refresh=force_refresh)
        return data
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error fetching funnel status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/opportunities")
def get_opportunities(
    min_score: int = Query(75, ge=0, le=100, description="Minimum ICE conviction score"),
    sector: Optional[str] = Query(None, description="Filter by sector"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns filtered actionable trade opportunities passing the precision funnel.
    """
    try:
        data = IntradayFunnelService.execute_funnel_scan(db=db, force_refresh=False)
        all_setups = data.get("all_setups", [])
        
        filtered = [s for s in all_setups if s.get("conviction_score", 0) >= min_score]
        if sector and sector.upper() != "ALL":
            filtered = [s for s in filtered if s.get("sector", "").lower() == sector.lower()]

        return {
            "total_matches": len(filtered),
            "data_source": data.get("data_source"),
            "last_scanned_at": data.get("last_scanned_at"),
            "setups": filtered,
        }
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error fetching opportunities: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scan")
def trigger_funnel_scan(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Forces an immediate real-time scan of the Nifty 500 universe.
    """
    try:
        data = IntradayFunnelService.execute_funnel_scan(db=db, force_refresh=True)
        return {
            "status": "success",
            "message": "Intraday funnel scan completed successfully.",
            "funnel_metrics": data.get("funnel_metrics"),
            "elite_picks_count": len(data.get("elite_picks", [])),
        }
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error triggering scan: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/broadcast-telegram/{symbol}")
def broadcast_telegram_alert(symbol: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Manually triggers Telegram alert dispatch for a specific symbol.
    """
    clean_sym = symbol.strip().upper()
    try:
        data = IntradayFunnelService.execute_funnel_scan(db=db, force_refresh=False)
        all_setups = data.get("all_setups", []) + data.get("elite_picks", [])
        target = next((s for s in all_setups if s["symbol"] == clean_sym), None)

        if not target:
            # Analyze on-demand if not in active setups
            target = IntradayFunnelService.analyze_candidate(clean_sym)

        if not target:
            raise HTTPException(status_code=404, detail=f"Symbol {clean_sym} could not be analyzed.")

        IntradayFunnelService._dispatch_telegram_alert_if_eligible({**target, "conviction_score": 90})
        return {
            "status": "success",
            "symbol": clean_sym,
            "message": f"Telegram alert successfully dispatched for {clean_sym}.",
        }
    except Exception as exc:
        logger.error(f"[API:live_intraday] Telegram dispatch failed for {clean_sym}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/dhan-status")
def get_dhan_status() -> Dict[str, Any]:
    """
    Returns live diagnostic telemetry for DhanHQ API connection.
    """
    dhan = DhanClient.get_instance()
    return dhan.check_connection()


@router.get("/sniper-trade-of-the-day")
def get_sniper_trade_of_the_day(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns Option 1 & 2 Apex Sniper Trade of the Day in < 1 second.
    Guarantees 0 trades taken on non-qualifying days to preserve capital.
    """
    try:
        dhan = DhanClient.get_instance()
        dhan_quotes = None
        if dhan.check_data_api_subscription():
            dhan_quotes = dhan.get_live_quotes(IntradayFunnelService.SNIPER_UNIVERSE)

        suite = IntradayFunnelService.evaluate_apex_sniper_suite(dhan_quotes=dhan_quotes)
        return suite.get("trade_of_the_day", {
            "active": False,
            "status": "CAPITAL_PRESERVED",
            "headline": "0 TRADES TODAY — CAPITAL PRESERVED",
            "reason": "No stock meets the strict 80% Win Rate float-lock criteria today. 0 trades taken to prevent brokerage loss.",
        })
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error fetching sniper trade of the day: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/sniper-watchlist")
def get_sniper_watchlist(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the live status of the 7 institutional sniper leaders in < 1 second.
    """
    try:
        dhan = DhanClient.get_instance()
        dhan_quotes = None
        if dhan.check_data_api_subscription():
            dhan_quotes = dhan.get_live_quotes(IntradayFunnelService.SNIPER_UNIVERSE)

        suite = IntradayFunnelService.evaluate_apex_sniper_suite(dhan_quotes=dhan_quotes)
        return {
            "last_scanned_at": datetime.now(timezone.utc).isoformat(),
            "data_source": "DHAN_REALTIME" if dhan_quotes else "YAHOO_LIVE",
            "watchlist": suite.get("watchlist", []),
        }
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error fetching sniper watchlist: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/premarket-imbalance")
def get_premarket_imbalances(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the 9:08 AM Pre-Market Call Auction order book imbalance telemetry in < 1 second.
    """
    try:
        dhan = DhanClient.get_instance()
        dhan_quotes = None
        if dhan.check_data_api_subscription():
            dhan_quotes = dhan.get_live_quotes(IntradayFunnelService.SNIPER_UNIVERSE)

        imbalances = IntradayFunnelService.get_premarket_auction_imbalances(dhan_quotes=dhan_quotes)
        return {
            "last_scanned_at": datetime.now(timezone.utc).isoformat(),
            "imbalances": imbalances,
        }
    except Exception as exc:
        logger.error(f"[API:live_intraday] Error fetching premarket imbalances: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

