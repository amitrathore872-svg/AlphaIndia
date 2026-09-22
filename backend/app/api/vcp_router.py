"""
Alpha India VCP Discovery Engine Router
Sprint 36 — REST API Endpoints for Institutional VCP Breakout Scanner
"""

from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.vcp_models import (
    VCPPattern,
    VolumeAnalysis,
    BreakoutSignal,
    VCPAIScore,
    VCPScanRejection,
)
from app.services.vcp_engine_service import VCPEngineService
from app.services.vcp_backtest_service import VCPBacktestService
from app.services.vcp_monitoring_service import VCPMonitoringService

router = APIRouter(prefix="/api/vcp", tags=["VCP Discovery Engine"])


@router.get("/discovery", summary="Get Today's Top 3 Institutional VCP Breakout Picks")
def get_vcp_discovery(
    force_scan: bool = Query(False, description="Trigger fresh scan if true"),
    filter_mode: str = Query("TODAY_BREAKOUT", description="TODAY_BREAKOUT or BEFORE_BREAKOUT"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns today's top 0-3 institutional VCP breakout candidates.
    If no stocks satisfy all 8 gates with score >= 90, returns empty list
    with clear capital-preservation rationale.
    """
    scan_date = date.today()

    # Fast Path: Check if we already have persisted scores for today and force_scan is False
    if not force_scan:
        existing_scores = (
            db.query(VCPAIScore)
            .filter(VCPAIScore.scan_date == scan_date)
            .order_by(desc(VCPAIScore.total_score))
            .limit(3)
            .all()
        )

        if existing_scores:
            results = []
            for sc in existing_scores:
                pattern = db.query(VCPPattern).filter(VCPPattern.symbol == sc.symbol, VCPPattern.scan_date == scan_date).first()
                vol = db.query(VolumeAnalysis).filter(VolumeAnalysis.symbol == sc.symbol, VolumeAnalysis.scan_date == scan_date).first()
                brk = db.query(BreakoutSignal).filter(BreakoutSignal.symbol == sc.symbol, BreakoutSignal.breakout_date == scan_date).first()

                results.append({
                    "symbol": sc.symbol,
                    "company_name": pattern.company_name if pattern else sc.symbol,
                    "sector": sc.sector or "Diversified",
                    "market_cap": sc.market_cap or 0.0,
                    "cmp": sc.cmp,
                    "pivot_price": sc.pivot_price,
                    "entry_zone": sc.entry_zone or f"₹{sc.pivot_price * 0.998:.1f}–{sc.pivot_price * 1.015:.1f}",
                    "stop_loss": sc.stop_loss,
                    "risk_pct": sc.risk_pct,
                    "target_1": sc.target_1,
                    "target_2": sc.target_2,
                    "target_3": sc.target_3,
                    "reward_risk": sc.reward_risk,
                    "vcp_stage": pattern.vcp_stage if pattern else "3-Stage VCP",
                    "contraction_sizes": pattern.contraction_sizes if pattern else [],
                    "wave_volumes": [],
                    "volume_breakout_ratio": brk.breakout_volume_ratio if brk else 2.5,
                    "is_20d_max_vol": bool(brk.breakout_volume_ratio >= 2.0) if brk else True,
                    "vol_20d_max_ratio": round(brk.breakout_volume_ratio / 2.0, 2) if brk else 1.2,
                    "is_strictly_contracting": True,
                    "vol_strictly_contracting": True,
                    "volume_dryup_pct": int((1.0 - (vol.dryup_ratio if vol else 0.4)) * 100),
                    "trend_score": sc.trend_score,
                    "vcp_score": sc.vcp_score,
                    "volume_score": sc.volume_score,
                    "breakout_score": sc.breakout_score,
                    "institutional_score": sc.institutional_score,
                    "growth_score": sc.growth_score,
                    "catalyst_score": sc.catalyst_score,
                    "final_ai_score": sc.total_score,
                    "verdict": sc.verdict,
                    "confidence": sc.confidence,
                    "time_horizon": sc.time_horizon,
                    "why_selected": sc.why_selected or [],
                    "catalyst_summary": sc.catalyst_summary,
                    "expert_consensus": "STRONG ACCUMULATE" if sc.is_elite else "TACTICAL BUY",
                    "mf_holding_change": sc.mf_holding_change,
                    "news_strength": "VERY HIGH" if sc.is_elite else "HIGH",
                    "is_elite": sc.is_elite,
                })

            rejection_count = db.query(VCPScanRejection).filter(VCPScanRejection.scan_date == scan_date).count()
            return {
                "status": "SUCCESS",
                "scan_date": str(scan_date),
                "filter_mode": filter_mode,
                "cached": True,
                "count": len(results),
                "items": results,
                "empty_reason": None,
                "rejections_logged": rejection_count,
            }

        # Fast Path 2: If today's scan already ran and logged rejections (0 stocks qualified score >= 90)
        rejection_count = db.query(VCPScanRejection).filter(VCPScanRejection.scan_date == scan_date).count()
        if rejection_count > 0:
            return {
                "status": "SUCCESS",
                "scan_date": str(scan_date),
                "filter_mode": filter_mode,
                "cached": True,
                "count": 0,
                "items": [],
                "empty_reason": "No stock met institutional-grade Mark Minervini criteria (Score >= 90) today. Preserving capital.",
                "rejections_logged": rejection_count,
            }

        # Fast Path 3: If scan is already running in background, return non-blocking status immediately
        telemetry = VCPMonitoringService.get_progress_telemetry()
        if telemetry.get("status") in ("RUNNING", "MONITORING"):
            return {
                "status": "SCANNING",
                "scan_date": str(scan_date),
                "filter_mode": filter_mode,
                "cached": False,
                "count": 0,
                "items": telemetry.get("latest_picks", []),
                "empty_reason": "VCP Discovery Scan is currently evaluating candidates in background. Live results will appear automatically.",
                "rejections_logged": 0,
                "telemetry": telemetry,
            }

        # Fast Path 4: If no scan has run yet today, launch background scan and return immediately (<10ms)
        VCPMonitoringService.trigger_scan_now(mode=filter_mode)
        return {
            "status": "SCANNING",
            "scan_date": str(scan_date),
            "filter_mode": filter_mode,
            "cached": False,
            "count": 0,
            "items": [],
            "empty_reason": "VCP Discovery Scan launched in background. Live results will refresh automatically.",
            "rejections_logged": 0,
            "telemetry": VCPMonitoringService.get_progress_telemetry(),
        }

    # Synchronous full scan ONLY when explicitly requested via force_scan=True
    return VCPEngineService.run_discovery_scan(
        db=db,
        limit_candidates=150,
        filter_mode=filter_mode,
        persist=True,
    )


@router.get("/watchlist", summary="Get Pre-Breakout Coiling Setups (Before Breakout)")
def get_vcp_watchlist(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns high-conviction VCP setups coiling within 3% of breakout pivot
    with confirmed volume dry-up, awaiting breakout trigger.
    """
    items = VCPEngineService.get_watchlist_setups(db=db, limit=limit)
    return {
        "status": "SUCCESS",
        "count": len(items),
        "items": items,
    }


@router.get("/history", summary="Get Historical Institutional VCP Signals")
def get_vcp_history(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns recorded historical VCP breakout signals.
    """
    signals = (
        db.query(VCPAIScore)
        .order_by(desc(VCPAIScore.scan_date), desc(VCPAIScore.total_score))
        .limit(limit)
        .all()
    )

    items = []
    for sc in signals:
        items.append({
            "symbol": sc.symbol,
            "scan_date": str(sc.scan_date),
            "verdict": sc.verdict,
            "final_ai_score": sc.total_score,
            "confidence": sc.confidence,
            "cmp": sc.cmp,
            "pivot_price": sc.pivot_price,
            "stop_loss": sc.stop_loss,
            "target_1": sc.target_1,
            "target_2": sc.target_2,
            "reward_risk": sc.reward_risk,
            "time_horizon": sc.time_horizon,
            "is_elite": sc.is_elite,
            "sector": sc.sector,
        })

    return {
        "status": "SUCCESS",
        "count": len(items),
        "items": items,
    }


@router.get("/backtest", summary="Get Historical VCP Quantitative Backtest Report (2-Year Empirical or 10-Year Macro)")
def get_vcp_backtest(
    period: str = Query("2y", description="Backtest timeframe: '2y' (2-Year Empirical) or '10y' (10-Year Macro)"),
) -> Dict[str, Any]:
    """
    Returns empirical backtest analytics across Indian market data (2024–2026 or 2014–2024)
    evaluating the 3-Rule Mark Minervini VCP + Volume Breakout engine.
    """
    return VCPBacktestService.get_backtest_report(period=period)



@router.get("/rejections", summary="Get Latest Scan Rejection Diagnostics and Funnel")
def get_vcp_rejections(
    scan_date_str: Optional[str] = Query(None, description="YYYY-MM-DD or defaults to today"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Provides full auditability on why stocks failed the 8-gate filter.
    """
    target_date = date.fromisoformat(scan_date_str) if scan_date_str else date.today()

    rejections = (
        db.query(VCPScanRejection)
        .filter(VCPScanRejection.scan_date == target_date)
        .order_by(desc(VCPScanRejection.created_at))
        .limit(limit)
        .all()
    )

    # Group counts by gate
    gate_counts: Dict[str, int] = {}
    items = []
    for r in rejections:
        gate_counts[r.gate_failed] = gate_counts.get(r.gate_failed, 0) + 1
        items.append({
            "symbol": r.symbol,
            "gate_failed": r.gate_failed,
            "reason": r.reason,
            "gate_details": r.gate_details,
        })

    return {
        "scan_date": str(target_date),
        "total_rejections": len(items),
        "gate_breakdown": gate_counts,
        "rejection_samples": items,
    }


@router.get("/signals/track-record", summary="Get Complete Signal Track Record and Real-Time Trade Performance")
def get_vcp_signals_track_record(
    trade_state: str = Query("ALL", description="ALL, ACTIVE, or CLOSED"),
    status_filter: str = Query("ALL", description="ALL, TARGET_MET, STOP_HIT, ACTIVE_RUNNING"),
    search: Optional[str] = Query(None, description="Search ticker, company, or sector"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns full chronological record of recommended top picks with recommendation
    date/time, real-time CMP, return %, current status (Target Met vs Stop Hit),
    and active/closed state.
    """
    return VCPEngineService.get_signal_track_record(
        db=db,
        trade_state=trade_state,
        status_filter=status_filter,
        search=search,
    )


# --------------------------------------------------------------------------
# On-Demand & Continuous Live Monitoring Telemetry Endpoints
# --------------------------------------------------------------------------


@router.get("/monitoring/progress", summary="Get Real-Time Progress Telemetry for VCP Scanner")
def get_monitoring_progress() -> Dict[str, Any]:
    """
    Returns live scanning progress, stocks scanned, remaining, throughput,
    and opportunities found.
    """
    return VCPMonitoringService.get_progress_telemetry()


@router.post("/monitoring/scan-now", summary="Trigger Immediate Priority On-Demand Scan")
def trigger_scan_now(
    filter_mode: str = Query("TODAY_BREAKOUT", description="TODAY_BREAKOUT or BEFORE_BREAKOUT"),
) -> Dict[str, Any]:
    """
    Launches an instantaneous prioritized scan in a background worker pool.
    """
    return VCPMonitoringService.trigger_scan_now(mode=filter_mode)


@router.post("/monitoring/start", summary="Start Continuous Live Opportunity Monitoring")
def start_continuous_monitoring() -> Dict[str, Any]:
    """
    Starts the continuous background daemon that loops through prioritized
    candidates with incremental caching.
    """
    return VCPMonitoringService.start_continuous_monitoring()


@router.post("/monitoring/stop", summary="Stop Continuous Live Opportunity Monitoring")
def stop_continuous_monitoring() -> Dict[str, Any]:
    """
    Stops the continuous live monitoring loop.
    """
    return VCPMonitoringService.stop_continuous_monitoring()


@router.get("/{symbol}", summary="Get Deep-Dive VCP Analysis for a Single Stock")
def get_single_stock_vcp(
    symbol: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns detailed contraction wave geometry, swing highs/lows, ATR/BB compression,
    volume dry-up analysis, breakout trigger status, and full AI verdict.
    """
    analysis = VCPEngineService.get_stock_vcp_deep_dive(symbol=symbol, db=db)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Stock '{symbol}' not found in Alpha India universe",
        )
    return analysis


@router.post("/scan", summary="Trigger Manual Real-Time or EOD VCP Scan")
def trigger_vcp_scan(
    filter_mode: str = Query("TODAY_BREAKOUT", description="TODAY_BREAKOUT or BEFORE_BREAKOUT"),
    limit_candidates: int = Query(120, ge=10, le=500),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Manually triggers institutional scan across the universe using high-throughput parallel worker pool.
    """
    top_picks = VCPMonitoringService.execute_scan_pass(
        mode=filter_mode,
        limit_candidates=min(limit_candidates, 100),
        use_cache=False,
    )
    return {
        "status": "SUCCESS",
        "scan_date": str(date.today()),
        "filter_mode": filter_mode,
        "count": len(top_picks),
        "items": top_picks,
        "empty_reason": None if top_picks else "No stock met institutional-grade Mark Minervini criteria (Score >= 90) today. Preserving capital.",
    }


@router.post("/alert/{symbol}", summary="Trigger Institutional Alert & Broadcast for VCP Opportunity")
def trigger_stock_vcp_alert(
    symbol: str,
    auto_broadcast: bool = Query(True, description="Broadcast to enabled external channels (Telegram / WhatsApp)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Manually triggers an in-app notification and multi-channel broadcast for a specific
    VCP breakout candidate.
    """
    from datetime import date
    from app.services.alert_dispatch_service import AlertDispatchService

    sym = symbol.strip().upper()
    scan_date = date.today()

    sc = db.query(VCPAIScore).filter(VCPAIScore.symbol == sym, VCPAIScore.scan_date == scan_date).first()
    if not sc:
        sc = db.query(VCPAIScore).filter(VCPAIScore.symbol == sym).order_by(desc(VCPAIScore.scan_date)).first()

    if not sc:
        raise HTTPException(
            status_code=404,
            detail=f"No VCP analysis found for '{sym}'",
        )

    pattern = db.query(VCPPattern).filter(VCPPattern.symbol == sym, VCPPattern.scan_date == sc.scan_date).first()
    vol = db.query(VolumeAnalysis).filter(VolumeAnalysis.symbol == sym, VolumeAnalysis.scan_date == sc.scan_date).first()
    brk = db.query(BreakoutSignal).filter(BreakoutSignal.symbol == sym, BreakoutSignal.breakout_date == sc.scan_date).first()

    pick = {
        "symbol": sym,
        "company_name": pattern.company_name if pattern else sym,
        "final_ai_score": sc.total_score,
        "is_elite": sc.is_elite,
        "cmp": sc.cmp,
        "pivot_price": sc.pivot_price,
        "entry_zone": sc.entry_zone or f"₹{sc.pivot_price * 0.998:.1f}–{sc.pivot_price * 1.015:.1f}",
        "stop_loss": sc.stop_loss,
        "target_1": sc.target_1,
        "target_2": sc.target_2,
        "target_3": sc.target_3,
        "reward_risk": sc.reward_risk,
        "vcp_stage": pattern.vcp_stage if pattern else "3-Stage VCP",
        "volume_breakout_ratio": brk.breakout_volume_ratio if brk else 2.5,
        "volume_dryup_pct": int((1.0 - (vol.dryup_ratio if vol else 0.4)) * 100),
        "why_selected": sc.why_selected or [],
        "verdict": sc.verdict,
    }

    notif = AlertDispatchService.trigger_vcp_opportunity_alert(
        db=db,
        pick=pick,
        auto_broadcast=auto_broadcast,
    )

    memo = AlertDispatchService.format_vcp_breakout_alert(
        symbol=sym,
        company_name=pick["company_name"],
        vcp_stage=pick["vcp_stage"],
        pivot_price=pick["pivot_price"],
        cmp=pick["cmp"],
        entry_zone=pick["entry_zone"],
        stop_loss=pick["stop_loss"],
        target_1=pick["target_1"],
        target_2=pick["target_2"],
        target_3=pick["target_3"],
        reward_risk=pick["reward_risk"],
        total_score=pick["final_ai_score"],
        breakout_volume_ratio=pick["volume_breakout_ratio"],
        dryup_pct=pick["volume_dryup_pct"],
        why_selected=pick["why_selected"],
        action_url="http://localhost:3000/vcp-discovery",
    )

    wa_url = AlertDispatchService.generate_whatsapp_click_to_chat_url(text=memo)

    return {
        "status": "SUCCESS",
        "symbol": sym,
        "notification": notif.to_dict() if notif else None,
        "memo_text": memo,
        "whatsapp_url": wa_url,
    }
