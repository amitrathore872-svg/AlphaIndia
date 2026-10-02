"""
Alpha India - Velocity Burst Elite (VBE) API Router
Sprint 39 Flagship Institutional Breakout Intelligence Namespace
Prefix: /api/v4/velocity
Provides paginated, Redis-cached, OpenAPI-documented access to all 18 sub-engines.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db.database import get_db, SessionLocal
from app.core.redis_cache import cache, cached
from app.models.velocity_models import (
    VelocityMarketRegime,
    VelocitySleepingGiant,
    VelocityCompression,
    VelocityBasePattern,
    VelocityInstitution,
    VelocityRSRank,
    VelocitySectorStrength,
    VelocitySmartMoney,
    VelocityLiquidity,
    VelocityNewsRisk,
    VelocityLiveSignal,
    VelocityEntryQuality,
    VelocityTradeManager,
    VelocityBTST,
    VelocitySignalHistory,
    VelocityAlert,
    VelocityBacktest,
    VelocityLearning,
)
from app.models.system_setting import SystemSetting

# Sub-engine coordinators
from app.services.velocity.velocity_orchestrator import VelocityBurstOrchestrator
from app.services.velocity.market_regime_engine import MarketRegimeEngine
from app.services.velocity.sleeping_giant_engine import SleepingGiantEngine
from app.services.velocity.company_intelligence_engine import CompanyIntelligenceEngine
from app.services.velocity.historical_learning_engine import HistoricalLearningEngine
from app.services.velocity.trade_management_engine import TradeManagementEngine
from app.services.velocity.alert_intelligence_engine import AlertIntelligenceEngine

logger = logging.getLogger("alpha_india.api.velocity")

router = APIRouter(prefix="/api/v4/velocity", tags=["Velocity Burst Elite Engine"])


# =========================================================================
# Schemas
# =========================================================================
class ScanRequest(BaseModel):
    limit: int = Field(default=500, description="Max symbols to scan (e.g. 500)")
    symbols: Optional[List[str]] = Field(default=None, description="Optional targeted symbol list")


class TradeActionRequest(BaseModel):
    action: str = Field(..., description="Action: EXIT, PARTIAL_PROFIT, TRAIL_STOP")
    price: Optional[float] = None
    reason: Optional[str] = None


class BacktestRunRequest(BaseModel):
    name: Optional[str] = "VBE 5-Year Walk-Forward"
    years: int = 5
    universe: str = "NSE500"


class SettingsUpdateRequest(BaseModel):
    key: str
    value: Dict[str, Any]


# =========================================================================
# 1. Status & Mission Control
# =========================================================================
@router.get("/status", summary="Get Flagship Engine Command Deck Telemetry")
async def get_velocity_status(db: Session = Depends(get_db)):
    """
    Returns real-time KPIs for Mission Control Engine Command Deck.
    """
    return VelocityBurstOrchestrator.get_status_overview(db)


@router.post("/scan", summary="Trigger Universe Scan (NSE500)")
async def run_scan(
    request: Optional[ScanRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """
    Triggers asynchronous or immediate universe scan across all 18 sub-engines.
    """
    limit = request.limit if request else 500
    symbols = request.symbols if request else None

    # Run in background task to avoid blocking HTTP worker
    def _bg_scan():
        s = SessionLocal()
        try:
            VelocityBurstOrchestrator.execute_universe_scan(s, limit_symbols=limit, symbols_override=symbols)
        finally:
            s.close()

    background_tasks.add_task(_bg_scan)
    return {
        "status": "QUEUED",
        "message": f"Velocity Burst Elite scan initiated for {limit} equities in background.",
    }


@router.post("/pause", summary="Pause Velocity Burst Elite Engine")
async def pause_engine():
    VelocityBurstOrchestrator.pause_engine()
    return {"status": "PAUSED", "message": "Engine operations successfully paused."}


@router.post("/resume", summary="Resume Velocity Burst Elite Engine")
async def resume_engine():
    VelocityBurstOrchestrator.resume_engine()
    return {"status": "ONLINE", "message": "Engine operations successfully resumed."}


@router.get("/funnel", summary="Stage-by-Stage Screening Funnel & Attrition Waterfall")
@cached("vbe:funnel", ttl=30)
async def get_stage_funnel(db: Session = Depends(get_db)):
    """
    Returns the complete institutional stage attrition waterfall showing candidates entered,
    passed, and filtered out at each screening gate.
    """
    return VelocityBurstOrchestrator.get_stage_funnel_metrics(db=db)


# =========================================================================
# 2. Sub-Engine Endpoints (All Paginated)
# =========================================================================
@router.get("/market-regime", summary="Stage 0: Market Regime Intelligence")
async def get_market_regime(db: Session = Depends(get_db)):
    return MarketRegimeEngine.get_latest_regime(db)


@router.post("/market-regime/recalculate", summary="Recalculate Market Regime")
async def recalculate_market_regime(db: Session = Depends(get_db)):
    return MarketRegimeEngine.evaluate_regime(db)


@router.get("/sleeping-giants", summary="Stage 1: Sleeping Giants (Volatility Contraction)")
async def get_sleeping_giants(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    min_score: float = Query(50.0, ge=0.0, le=100.0),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = (
        db.query(VelocitySleepingGiant)
        .filter(VelocitySleepingGiant.compression_score >= min_score)
        .order_by(desc(VelocitySleepingGiant.compression_score))
    )
    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name,
                "sector": r.sector,
                "market_cap": r.market_cap,
                "current_price": r.current_price,
                "compression_score": r.compression_score,
                "ttm_squeeze_active": r.ttm_squeeze_active,
                "bollinger_width_percentile": r.bollinger_width_percentile,
                "keltner_squeeze_active": r.keltner_squeeze_active,
                "inside_bar_count": r.inside_bar_count,
                "volume_dry_up": r.volume_dry_up,
                "volume_dry_up_ratio": r.volume_dry_up_ratio,
                "squeeze_duration_bars": r.squeeze_duration_bars,
                "is_nr7": r.is_nr7,
                "is_nr10": r.is_nr10,
                "scan_date": str(r.scan_date),
            }
            for r in items
        ],
    }


@router.get("/compression", summary="Stage 2: Compression Intelligence Details")
async def get_compression(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    quality: Optional[str] = Query(None, description="ELITE, HIGH, MEDIUM, LOW"),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityCompression).order_by(desc(VelocityCompression.compression_score))
    if quality:
        query = query.filter(VelocityCompression.compression_quality == quality.upper())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "compression_score": r.compression_score,
                "compression_quality": r.compression_quality,
                "explosive_potential": r.explosive_potential,
                "expected_expansion_window_days": r.expected_expansion_window_days,
                "expected_holding_days": r.expected_holding_days,
                "nr_cluster": r.nr_cluster,
                "bollinger_width_percentile": r.bollinger_width_percentile,
                "ttm_active": r.ttm_active,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in items
        ],
    }


@router.get("/patterns", summary="Stage 3: Base Pattern Recognitions")
async def get_base_patterns(
    pattern_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityBasePattern).order_by(desc(VelocityBasePattern.base_quality_score))
    if pattern_type:
        query = query.filter(VelocityBasePattern.pattern_type.ilike(f"%{pattern_type}%"))
    if status:
        query = query.filter(VelocityBasePattern.pattern_status == status.upper())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "pattern_type": r.pattern_type,
                "base_depth_pct": r.base_depth_pct,
                "base_length_bars": r.base_length_bars,
                "contractions_count": r.contractions_count,
                "pivot_point": r.pivot_point,
                "distance_to_pivot_pct": r.distance_to_pivot_pct,
                "base_quality_score": r.base_quality_score,
                "pattern_status": r.pattern_status,
                "ai_explanation": r.ai_explanation,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in items
        ],
    }


@router.get("/institutions", summary="Stage 4: Institutional Footprint Candidates")
async def get_institutions(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    pocket_pivot_only: bool = False,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityInstitution).order_by(desc(VelocityInstitution.institution_score))
    if pocket_pivot_only:
        query = query.filter(VelocityInstitution.pocket_pivot == True)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "institution_score": r.institution_score,
                "institution_confidence": r.institution_confidence,
                "accumulation_type": r.accumulation_type,
                "delivery_pct": r.delivery_pct,
                "cmf_20": r.cmf_20,
                "mfi_14": r.mfi_14,
                "pocket_pivot": r.pocket_pivot,
                "operator_signature": r.operator_signature,
            }
            for r in items
        ],
    }


@router.get("/rs", summary="Stage 5: Relative Strength Rankings")
async def get_rs_rankings(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    leaders_only: bool = False,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityRSRank).order_by(desc(VelocityRSRank.rs_score))
    if leaders_only:
        query = query.filter(VelocityRSRank.is_leader == True)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "rs_score": r.rs_score,
                "rs_rank": r.rs_rank,
                "is_leader": r.is_leader,
                "rs_new_high": r.rs_new_high,
                "rs_slope": r.rs_slope,
                "rs_vs_nifty_20": r.rs_vs_nifty_20,
                "rs_vs_nifty_50": r.rs_vs_nifty_50,
            }
            for r in items
        ],
    }


@router.get("/sector", summary="Stage 6: Sector Strength & Rotation Quadrants")
async def get_sector_rotation(db: Session = Depends(get_db)):
    rows = db.query(VelocitySectorStrength).order_by(VelocitySectorStrength.leadership_rank).all()
    return [
        {
            "sector": r.sector_name,
            "score": r.sector_score,
            "rank": r.leadership_rank,
            "rotation_signal": r.rotation_signal,
            "rs_vs_nifty": r.sector_rs,
            "momentum": r.sector_momentum,
            "breadth": r.sector_breadth,
            "relative_volume": r.sector_volume_surge,
            "trend": r.sector_trend,
        }
        for r in rows
    ]


@router.get("/smart-money", summary="Stage 7: Smart Money Signals")
async def get_smart_money(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocitySmartMoney).order_by(desc(VelocitySmartMoney.smart_money_score))
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "smart_money_score": r.smart_money_score,
                "pocket_pivot": r.pocket_pivot,
                "anchored_vwap_bounce": r.anchored_vwap_bounce,
                "liquidity_grab": r.liquidity_grab,
                "choch_detected": r.choch_detected,
                "bos_detected": r.bos_detected,
                "fair_value_gap_nearby": r.fair_value_gap_nearby,
                "demand_zone": r.demand_zone_range,
                "supply_zone": r.supply_zone_range,
            }
            for r in items
        ],
    }


@router.get("/liquidity", summary="Stage 8: Liquidity & Execution Scores")
async def get_liquidity(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityLiquidity).order_by(desc(VelocityLiquidity.liquidity_score))
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "liquidity_score": r.liquidity_score,
                "execution_quality": r.execution_quality_score,
                "avg_traded_value_cr": r.avg_traded_value_cr,
                "bid_ask_spread_pct": r.bid_ask_spread_pct,
                "distance_to_52w_high_pct": r.distance_to_52w_high_pct,
            }
            for r in items
        ],
    }


@router.get("/news-risk", summary="Stage 9: News Risk & Catalyst Filters")
async def get_news_risk(
    verdict: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityNewsRisk).order_by(desc(VelocityNewsRisk.opportunity_score))
    if verdict:
        query = query.filter(VelocityNewsRisk.verdict == verdict.upper())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "risk_score": r.risk_score,
                "opportunity_score": r.opportunity_score,
                "verdict": r.verdict,
                "has_results_tomorrow": r.has_results_tomorrow,
                "large_order_win": r.large_order_win,
                "catalyst_headline": r.catalyst_headline,
                "ai_notes": r.ai_risk_notes,
            }
            for r in items
        ],
    }


@router.get("/live-signals", summary="Stage 10: Live Breakout Signals")
async def get_live_signals(
    verdict: Optional[str] = None,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityLiveSignal).order_by(desc(VelocityLiveSignal.signal_timestamp))
    if active_only:
        query = query.filter(VelocityLiveSignal.status == "ACTIVE")
    if verdict:
        query = query.filter(VelocityLiveSignal.ai_verdict == verdict.upper())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "signal_type": r.signal_type,
                "confidence_score": r.confidence_score,
                "ai_verdict": r.ai_verdict,
                "entry_price": r.entry_price,
                "stop_loss": r.stop_loss,
                "target_1": r.target_1,
                "target_2": r.target_2,
                "target_3": r.target_3,
                "risk_reward": r.risk_reward,
                "relative_volume": r.relative_volume_rvol,
                "candle_strength": r.breakout_candle_strength,
                "vwap_confirmed": r.vwap_confirmed,
                "status": r.status,
                "signal_timestamp": r.signal_timestamp.isoformat() if r.signal_timestamp else None,
            }
            for r in items
        ],
    }


@router.get("/entry", summary="Stage 11: Entry Quality Gate Verifications")
async def get_entry_quality(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    passed_only: bool = True,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityEntryQuality).order_by(desc(VelocityEntryQuality.entry_score))
    if passed_only:
        query = query.filter(VelocityEntryQuality.passed_gate == True)

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "entry_score": r.entry_score,
                "passed_gate": r.passed_gate,
                "breakout_retest": r.breakout_retest,
                "vwap_hold": r.vwap_hold,
                "candle_close_strength": r.candle_close_strength,
                "wick_ratio": r.wick_ratio,
                "distance_from_pivot_pct": r.distance_from_pivot_pct,
                "rejection_reasons": r.rejection_reasons or [],
            }
            for r in items
        ],
    }


@router.get("/trade", summary="Stage 12: Active Trade Lifecycle Manager")
async def get_trades(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityTradeManager).order_by(desc(VelocityTradeManager.entry_time))
    if status:
        query = query.filter(VelocityTradeManager.trade_status == status.upper())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "entry_time": r.entry_time.isoformat() if r.entry_time else None,
                "entry_price": r.entry_price,
                "current_price": r.current_price,
                "stop_loss": r.stop_loss,
                "trailing_stop": r.trailing_stop,
                "trail_type": r.trail_type,
                "target_1": r.target_1,
                "target_2": r.target_2,
                "target_3": r.target_3,
                "target_1_hit": r.target_1_hit,
                "unrealized_pnl_pct": r.unrealized_pnl_pct,
                "realized_pnl_pct": r.realized_pnl_pct,
                "trade_status": r.trade_status,
                "exit_time": r.exit_time.isoformat() if r.exit_time else None,
                "exit_price": r.exit_price,
                "exit_reason": r.exit_reason,
            }
            for r in items
        ],
    }


@router.post("/trade/{trade_id}/action", summary="Execute Manual Trade Action")
async def execute_trade_action(
    trade_id: int,
    request: TradeActionRequest,
    db: Session = Depends(get_db),
):
    trade = db.query(VelocityTradeManager).filter(VelocityTradeManager.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    action = request.action.upper()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if action == "EXIT":
        trade.trade_status = "CLOSED_PROFIT" if trade.unrealized_pnl_pct > 0 else "STOPPED_OUT"
        trade.exit_time = now
        trade.exit_price = request.price or trade.current_price
        trade.realized_pnl_pct = trade.unrealized_pnl_pct
        trade.exit_reason = request.reason or "MANUAL_OPERATOR_EXIT"
    elif action == "PARTIAL_PROFIT":
        trade.partial_profit_booked_pct = 50.0
        trade.trailing_stop = max(trade.trailing_stop, trade.entry_price)
    elif action == "TRAIL_STOP" and request.price:
        trade.trailing_stop = request.price

    db.commit()
    db.refresh(trade)
    return {"status": "UPDATED", "trade_id": trade.id, "trade_status": trade.trade_status}


@router.get("/btst", summary="Stage 13: BTST Continuation Candidates")
async def get_btst(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocityBTST).order_by(desc(VelocityBTST.btst_confidence))
    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "scan_date": str(r.scan_date),
                "closing_near_high_pct": r.closing_near_high_pct,
                "delivery_pct": r.delivery_pct,
                "volume_surge_multiple": r.volume_surge_multiple,
                "btst_confidence": r.btst_confidence,
                "continuation_probability": r.continuation_probability,
                "action_recommended": r.action_recommended,
            }
            for r in items
        ],
    }


@router.get("/alerts", summary="Stage 15: Velocity Alerts Feed")
async def get_alerts(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return AlertIntelligenceEngine.get_recent_alerts(db, limit=limit, unread_only=unread_only)


@router.post("/alerts/acknowledge", summary="Mark Alerts as Read")
async def acknowledge_alerts(alert_ids: Optional[List[int]] = None, db: Session = Depends(get_db)):
    query = db.query(VelocityAlert).filter(VelocityAlert.is_read == False)
    if alert_ids:
        query = query.filter(VelocityAlert.id.in_(alert_ids))
    count = query.update({VelocityAlert.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "SUCCESS", "acknowledged_count": count}


@router.get("/history", summary="Stage 14: Historical Signal Ledger")
async def get_signal_history(
    verdict: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    query = db.query(VelocitySignalHistory).order_by(desc(VelocitySignalHistory.signal_date))
    if verdict:
        query = query.filter(VelocitySignalHistory.ai_verdict == verdict.upper())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "symbol": r.symbol,
                "signal_date": str(r.signal_date),
                "entry_price": r.entry_price,
                "stop_loss": r.stop_loss,
                "target_price": r.target_price,
                "confidence_score": r.confidence_score,
                "ai_verdict": r.ai_verdict,
                "outcome": r.outcome,
                "return_pct": r.return_pct,
                "composite_scores": r.composite_scores,
                "ai_explanation": r.ai_explanation,
            }
            for r in items
        ],
    }


@router.get("/company/{symbol}", summary="Stage 16: Company Velocity Intelligence Dossier")
async def get_company_intelligence(symbol: str, db: Session = Depends(get_db)):
    profile = CompanyIntelligenceEngine.get_company_velocity_profile(symbol, db)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found in master database")
    return profile


@router.get("/backtest", summary="Stage 17: Backtest Historical Performance")
async def get_backtests(db: Session = Depends(get_db)):
    rows = db.query(VelocityBacktest).order_by(desc(VelocityBacktest.created_at)).limit(5).all()
    if not rows:
        # Run default 5-year simulation
        sim = HistoricalLearningEngine.run_backtest_simulation(db)
        return [sim]

    return [
        {
            "id": r.id,
            "backtest_name": r.backtest_name,
            "universe": r.universe_type,
            "total_trades": r.total_trades,
            "win_rate_pct": r.win_rate_pct,
            "profit_factor": r.profit_factor,
            "expectancy_r": r.expectancy_r,
            "max_drawdown_pct": r.max_drawdown_pct,
            "average_return_pct": r.average_return_pct,
            "sharpe_ratio": r.sharpe_ratio,
            "sector_performance": r.sector_performance,
            "confidence_bucket_performance": r.confidence_bucket_performance,
            "exit_strategy_comparison": r.exit_strategy_comparison,
        }
        for r in rows
    ]


@router.post("/backtest/run", summary="Trigger New Historical Backtest")
async def run_backtest(
    request: BacktestRunRequest,
    db: Session = Depends(get_db),
):
    return HistoricalLearningEngine.run_backtest_simulation(
        db,
        backtest_name=request.name or "VBE Walk-Forward Simulation",
        years=request.years,
        universe=request.universe,
    )


@router.get("/backtest/latest", summary="Get Latest Backtest Results")
async def get_latest_backtest(db: Session = Depends(get_db)):
    bt = db.query(VelocityBacktest).order_by(desc(VelocityBacktest.created_at)).first()
    if not bt:
        return HistoricalLearningEngine.run_backtest_simulation(db)
    return {
        "id": bt.id,
        "backtest_name": bt.backtest_name,
        "start_date": str(bt.start_date),
        "end_date": str(bt.end_date),
        "universe": bt.universe_type,
        "total_trades": bt.total_trades,
        "winning_trades": bt.winning_trades,
        "losing_trades": bt.losing_trades,
        "win_rate_pct": bt.win_rate_pct,
        "profit_factor": bt.profit_factor,
        "expectancy_r": bt.expectancy_r,
        "max_drawdown_pct": bt.max_drawdown_pct,
        "average_return_pct": bt.average_return_pct,
        "average_hold_days": bt.average_hold_days,
        "sharpe_ratio": bt.sharpe_ratio,
        "sector_performance": bt.sector_performance,
        "regime_performance": bt.regime_performance,
        "confidence_bucket_performance": bt.confidence_bucket_performance,
        "exit_strategy_comparison": bt.exit_strategy_comparison,
        "created_at": bt.created_at.isoformat() if bt.created_at else None,
    }


@router.get("/learning", summary="Stage 17: Monthly Machine Learning Recalibrations")
async def get_learning(db: Session = Depends(get_db)):
    rows = db.query(VelocityLearning).order_by(desc(VelocityLearning.created_at)).limit(5).all()
    if not rows:
        sim = HistoricalLearningEngine.run_monthly_learning_job(db)
        return [sim]

    return [
        {
            "id": r.id,
            "evaluation_period": r.evaluation_period,
            "snapshot_date": str(r.snapshot_date),
            "total_signals_evaluated": r.total_signals_evaluated,
            "overall_win_rate": r.overall_win_rate,
            "optimal_weights": r.optimal_weights,
            "feature_importance": r.feature_importance,
            "recommendations": r.recommended_threshold_adjustments,
        }
        for r in rows
    ]


@router.post("/learning/recalculate", summary="Recalculate Optimal Model Weights")
async def recalculate_learning(db: Session = Depends(get_db)):
    return HistoricalLearningEngine.run_monthly_learning_job(db)


# =========================================================================
# 3. Dynamic Admin Settings & Configurable Thresholds
# =========================================================================
@router.get("/settings", summary="Get Configurable Thresholds & Weights")
async def get_vbe_settings(db: Session = Depends(get_db)):
    settings_rows = db.query(SystemSetting).filter(SystemSetting.setting_key.like("vbe_%")).all()
    res = {}
    for row in settings_rows:
        try:
            import json
            res[row.setting_key] = json.loads(row.setting_value) if row.setting_value else {}
        except Exception:
            res[row.setting_key] = row.setting_value
    return res


@router.put("/settings", summary="Update Configurable Thresholds")
async def update_vbe_settings(request: SettingsUpdateRequest, db: Session = Depends(get_db)):
    import json
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == request.key).first()
    val_str = json.dumps(request.value)
    if not setting:
        setting = SystemSetting(
            setting_key=request.key,
            setting_value=val_str,
            setting_type="json",
            description="Dynamic VBE configuration threshold",
        )
        db.add(setting)
    else:
        setting.setting_value = val_str

    db.commit()
    # Invalidate cached calculations
    await cache.clear_prefix("vbe:")
    return {"status": "UPDATED", "key": request.key}
