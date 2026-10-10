"""
Alpha India - Backtest Engine REST API
Sprint 43.1 Institutional Backtesting Endpoints & Command Deck Telemetry

Endpoints:
- POST /api/v1/backtest/run
- GET  /api/v1/backtest/runs
- GET  /api/v1/backtest/runs/{run_id}
- GET  /api/v1/backtest/runs/{run_id}/metrics
- GET  /api/v1/backtest/runs/{run_id}/trades
- GET  /api/v1/backtest/runs/{run_id}/signals
- GET  /api/v1/backtest/runs/{run_id}/equity
- GET  /api/v1/backtest/strategies
- GET  /api/v1/backtest/universes
- GET  /api/v1/backtest/status
- GET  /api/v1/backtest/data-quality/{symbol}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db, SessionLocal
from app.models.backtest_models import (
    BacktestRun,
    BacktestSignal,
    BacktestTrade,
    BacktestMetric,
    BacktestEquityCurve,
    MarketCandle5m,
)
from app.services.backtest.backtest_engine import BacktestEngine
from app.services.backtest.data_quality_engine import DataQualityEngine
from app.services.backtest.market_data_provider import CompositeMarketDataProvider
from app.services.backtest.universe_service import UniverseService
from app.services.backtest.vcb_strategy import VCBBreakoutStrategy, VCBEarlyStrategy

logger = logging.getLogger("alpha_india.api.backtest")

router = APIRouter(prefix="/backtest", tags=["Backtest Engine"])


# =========================================================================
# Pydantic Schemas
# =========================================================================

class BacktestRunRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="Human-readable run name")
    strategy: str = Field(default="VCB_BREAKOUT", description="Strategy key (VCB_BREAKOUT or VCB_EARLY)")
    universe: str = Field(default="NIFTY_500", description="Universe key (TEST_10, NIFTY_50, NIFTY_500, etc.)")
    timeframe: str = Field(default="5m", description="Candle timeframe (5m)")
    start_date: str = Field(default="2026-07-06", description="Start date (YYYY-MM-DD)")
    end_date: str = Field(default="2026-09-25", description="End date (YYYY-MM-DD)")
    capital: float = Field(default=1000000.0, description="Starting capital in INR")
    target_pct: float = Field(default=0.015, description="Primary profit target (e.g. 0.015 = 1.5%)")
    stop_pct: float = Field(default=0.010, description="Primary stop loss (e.g. 0.010 = 1.0%)")
    slippage_pct: float = Field(default=0.05, description="Slippage assumption percentage")
    brokerage_per_order: float = Field(default=20.0, description="Brokerage in INR per leg")
    sizing_model: str = Field(default="RISK_BASED", description="RISK_BASED, FIXED_CAPITAL, FIXED_QUANTITY")
    strategy_parameters: Optional[Dict[str, Any]] = Field(default=None, description="Custom strategy parameter overrides")
    custom_symbols: Optional[List[str]] = Field(default=None, description="Optional custom stock symbols list")
    run_async: bool = Field(default=True, description="Whether to execute in background")


def _run_backtest_in_background(run_id: str):
    """Background worker function for asynchronous backtest execution."""
    db = SessionLocal()
    try:
        BacktestEngine.execute_backtest(run_id=run_id, db=db)
    except Exception as e:
        logger.error(f"[BacktestWorker] Run {run_id} failed: {e}", exc_info=True)
        run_record = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
        if run_record:
            run_record.status = "FAILED"
            run_record.error_message = str(e)
            db.commit()
    finally:
        db.close()


# =========================================================================
# API Endpoints
# =========================================================================

@router.post("/run", summary="Trigger a new backtest run")
def create_and_run_backtest(
    req: BacktestRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    config_dict = req.model_dump()
    run_id = BacktestEngine.create_run_record(config=config_dict, db=db)

    if req.run_async:
        background_tasks.add_task(_run_backtest_in_background, run_id)
        return {
            "status": "QUEUED",
            "run_id": run_id,
            "message": f"Backtest {run_id} initiated in background. Poll /api/v1/backtest/runs/{run_id} for progress.",
        }
    else:
        res = BacktestEngine.execute_backtest(run_id=run_id, db=db)
        return res


@router.get("/runs", summary="List historical backtest runs")
def list_backtest_runs(
    limit: int = Query(default=25, ge=1, le=100),
    strategy: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(BacktestRun)
    if strategy:
        q = q.filter(BacktestRun.strategy == strategy.upper())
    records = q.order_by(desc(BacktestRun.created_at)).limit(limit).all()

    runs_data = []
    for r in records:
        metric = db.query(BacktestMetric).filter(BacktestMetric.run_id == r.run_id).first()
        runs_data.append({
            "run_id": r.run_id,
            "name": r.name,
            "strategy": r.strategy,
            "universe": r.universe,
            "timeframe": r.timeframe,
            "start_date": str(r.start_date),
            "end_date": str(r.end_date),
            "capital": r.capital,
            "status": r.status,
            "progress_pct": r.progress_pct,
            "current_symbol": r.current_symbol,
            "symbols_processed": r.symbols_processed,
            "total_symbols": r.total_symbols,
            "candles_processed": r.candles_processed,
            "signals_count": r.signals_count,
            "trades_count": r.trades_count,
            "win_rate_pct": metric.win_rate_pct if metric else 0.0,
            "net_pnl": metric.net_pnl if metric else 0.0,
            "profit_factor": metric.profit_factor if metric else 0.0,
            "max_drawdown_pct": metric.max_drawdown_pct if metric else 0.0,
            "execution_time_sec": r.execution_time_sec,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
    return {"total": len(runs_data), "runs": runs_data}


@router.get("/runs/{run_id}", summary="Get backtest run status and configuration")
def get_backtest_run_details(run_id: str, db: Session = Depends(get_db)):
    run_record = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Run not found")

    metric = db.query(BacktestMetric).filter(BacktestMetric.run_id == run_id).first()

    return {
        "run_id": run_record.run_id,
        "name": run_record.name,
        "strategy": run_record.strategy,
        "universe": run_record.universe,
        "timeframe": run_record.timeframe,
        "start_date": str(run_record.start_date),
        "end_date": str(run_record.end_date),
        "capital": run_record.capital,
        "status": run_record.status,
        "progress_pct": run_record.progress_pct,
        "current_symbol": run_record.current_symbol,
        "symbols_processed": run_record.symbols_processed,
        "total_symbols": run_record.total_symbols,
        "candles_processed": run_record.candles_processed,
        "signals_count": run_record.signals_count,
        "trades_count": run_record.trades_count,
        "execution_time_sec": run_record.execution_time_sec,
        "configuration": run_record.configuration,
        "error_message": run_record.error_message,
        "created_at": run_record.created_at.isoformat() if run_record.created_at else None,
        "completed_at": run_record.completed_at.isoformat() if run_record.completed_at else None,
        "has_metrics": metric is not None,
    }


@router.get("/runs/{run_id}/metrics", summary="Get comprehensive metrics for a run")
def get_backtest_metrics(run_id: str, db: Session = Depends(get_db)):
    metric = db.query(BacktestMetric).filter(BacktestMetric.run_id == run_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metrics not found for run")

    return {
        "run_id": metric.run_id,
        "total_signals": metric.total_signals,
        "total_trades": metric.total_trades,
        "winning_trades": metric.winning_trades,
        "losing_trades": metric.losing_trades,
        "win_rate_pct": metric.win_rate_pct,
        "loss_rate_pct": metric.loss_rate_pct,
        "average_return_pct": metric.average_return_pct,
        "median_return_pct": metric.median_return_pct,
        "avg_winning_return_pct": metric.avg_winning_return_pct,
        "avg_losing_return_pct": metric.avg_losing_return_pct,
        "gross_pnl": metric.gross_pnl,
        "net_pnl": metric.net_pnl,
        "profit_factor": metric.profit_factor,
        "expectancy_pct": metric.expectancy_pct,
        "avg_mfe_pct": metric.avg_mfe_pct,
        "median_mfe_pct": metric.median_mfe_pct,
        "avg_mae_pct": metric.avg_mae_pct,
        "median_mae_pct": metric.median_mae_pct,
        "max_drawdown_pct": metric.max_drawdown_pct,
        "max_consecutive_wins": metric.max_consecutive_wins,
        "max_consecutive_losses": metric.max_consecutive_losses,
        "avg_holding_minutes": metric.avg_holding_minutes,
        "trades_per_day_avg": metric.trades_per_day_avg,
        "target_hit_rates": metric.target_hit_rates,
        "stop_hit_rates": metric.stop_hit_rates,
        "time_of_day_breakdown": metric.time_of_day_breakdown,
        "rule_contribution_analysis": metric.rule_contribution_analysis,
        "daily_pnl": metric.daily_pnl,
        "weekly_pnl": metric.weekly_pnl,
        "monthly_pnl": metric.monthly_pnl,
    }


@router.get("/runs/{run_id}/trades", summary="Get paginated simulated trades")
def get_backtest_trades(
    run_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    total = db.query(BacktestTrade).filter(BacktestTrade.run_id == run_id).count()
    records = (
        db.query(BacktestTrade)
        .filter(BacktestTrade.run_id == run_id)
        .order_by(BacktestTrade.entry_time.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    trades = [
        {
            "id": r.id,
            "symbol": r.symbol,
            "entry_time": r.entry_time.isoformat() if r.entry_time else None,
            "entry_price": r.entry_price,
            "exit_time": r.exit_time.isoformat() if r.exit_time else None,
            "exit_price": r.exit_price,
            "exit_reason": r.exit_reason,
            "holding_bars": r.holding_bars,
            "holding_minutes": r.holding_minutes,
            "shares": r.shares,
            "position_value": r.position_value,
            "gross_return_pct": r.gross_return_pct,
            "gross_pnl": r.gross_pnl,
            "friction_costs": r.friction_costs,
            "net_return_pct": r.net_return_pct,
            "net_pnl": r.net_pnl,
            "mfe_pct": r.mfe_pct,
            "mae_pct": r.mae_pct,
            "time_to_target_min": r.time_to_target_min,
            "time_to_stop_min": r.time_to_stop_min,
            "ambiguous_exit": r.ambiguous_exit,
            "target_matrix": r.target_matrix,
            "stop_matrix": r.stop_matrix,
        }
        for r in records
    ]
    return {"total": total, "page": page, "limit": limit, "trades": trades}


@router.get("/runs/{run_id}/signals", summary="Get strategy signals and rule diagnostics")
def get_backtest_signals(
    run_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit
    total = db.query(BacktestSignal).filter(BacktestSignal.run_id == run_id).count()
    records = (
        db.query(BacktestSignal)
        .filter(BacktestSignal.run_id == run_id)
        .order_by(BacktestSignal.timestamp.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    signals = [
        {
            "id": r.id,
            "symbol": r.symbol,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "strategy": r.strategy,
            "timeframe": r.timeframe,
            "signal_type": r.signal_type,
            "entry_price": r.entry_price,
            "resistance": r.resistance,
            "atr": r.atr,
            "volume_ratio": r.volume_ratio,
            "compression_pct": r.compression_pct,
            "close_location_pct": r.close_location_pct,
            "extension_pct": r.extension_pct,
            "rule_diagnostics": r.rule_diagnostics,
        }
        for r in records
    ]
    return {"total": total, "page": page, "limit": limit, "signals": signals}


@router.get("/runs/{run_id}/equity", summary="Get equity curve progression")
def get_backtest_equity_curve(run_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(BacktestEquityCurve)
        .filter(BacktestEquityCurve.run_id == run_id)
        .order_by(BacktestEquityCurve.timestamp.asc())
        .all()
    )
    curve = [
        {
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "equity": r.equity,
            "cash": r.cash,
            "drawdown_pct": r.drawdown_pct,
            "peak_equity": r.peak_equity,
        }
        for r in records
    ]
    return {"run_id": run_id, "data_points": len(curve), "equity_curve": curve}


@router.get("/strategies", summary="List available backtest strategies")
def list_available_strategies():
    vcb_b = VCBBreakoutStrategy().strategy_metadata()
    vcb_e = VCBEarlyStrategy().strategy_metadata()
    mtf = {
        "name": "MTF_VCP_VCB",
        "timeframe": "5m (Multi-Timeframe Gated)",
        "description": "Multi-Timeframe VCP (Weekly) + Daily Confirmation + 15m + RS + 5m VCB Breakout",
        "layers": [
            "Weekly VCP Structure (Prior Advance, Base, T1..T4 Contractions)",
            "Daily Confirmation (EMA20/50 alignment, slope, controlled volatility)",
            "15-Minute Confirmation (VWAP, 15m trend & compression)",
            "Relative Strength (Stock vs NIFTY 20d/60d excess return)",
            "Sector Strength (Sector leadership score)",
            "Market Regime (NIFTY 20/50 EMA market trend)",
            "5-Minute VCB Breakout (Exact 9 baseline rules)",
        ],
        "default_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": False,
            "enable_relative_strength": False,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 65.0,
            "min_daily_score": 65.0,
            "min_15m_score": 60.0,
            "min_rs_score": 60.0,
            "min_sector_score": 55.0,
            "min_market_score": 50.0,
        },
    }
    return {"strategies": [vcb_b, vcb_e, mtf]}


@router.get("/universes", summary="List available universes and ETF filter status")
def list_available_universes(db: Session = Depends(get_db)):
    u_test10 = UniverseService.get_universe_symbols("TEST_10", db=db)
    u_nifty50 = UniverseService.get_universe_symbols("NIFTY_50", db=db)
    u_nifty100 = UniverseService.get_universe_symbols("NIFTY_100", db=db)
    u_nifty500 = UniverseService.get_universe_symbols("NIFTY_500", db=db)

    return {
        "universes": [
            {
                "id": "TEST_10",
                "label": "Controlled Validation (10 Top Liquid Equities)",
                "symbol_count": u_test10["total_count"],
                "warning": u_test10["survivorship_warning"],
            },
            {
                "id": "NIFTY_50",
                "label": "NIFTY 50 (Blue-Chips)",
                "symbol_count": u_nifty50["total_count"],
                "warning": u_nifty50["survivorship_warning"],
            },
            {
                "id": "NIFTY_100",
                "label": "NIFTY 100 (Large-Cap)",
                "symbol_count": u_nifty100["total_count"],
                "warning": u_nifty100["survivorship_warning"],
            },
            {
                "id": "NIFTY_500",
                "label": "NIFTY 500 (Broad Liquid Universe)",
                "symbol_count": u_nifty500["total_count"],
                "warning": u_nifty500["survivorship_warning"],
            },
        ]
    }


@router.get("/status", summary="Get Command Deck Backtest Engine Telemetry")
def get_backtest_command_deck_status(db: Session = Depends(get_db)):
    """
    Returns KPIs for Mission Control and Command Deck:
    Data Coverage, Last Historical Sync, Available Timeframes,
    Last Backtest, Best Recent Strategy, Current Backtest Status.
    """
    # Check 5paisa connection status
    provider = CompositeMarketDataProvider(db=db)
    is_5p_cfg = provider.fivepaisa_provider.client.is_configured()
    is_5p_active = provider.fivepaisa_provider.client.is_logged_in()

    # Query last backtest run
    last_run = db.query(BacktestRun).order_by(desc(BacktestRun.created_at)).first()
    active_run = db.query(BacktestRun).filter(BacktestRun.status == "RUNNING").first()

    # Best recent strategy by profit factor
    best_metric = (
        db.query(BacktestMetric)
        .order_by(desc(BacktestMetric.profit_factor))
        .first()
    )

    best_strat_info = "VCB Breakout (+1.5% Target)"
    if best_metric:
        r_assoc = db.query(BacktestRun).filter(BacktestRun.run_id == best_metric.run_id).first()
        if r_assoc:
            best_strat_info = f"{r_assoc.strategy} (PF: {best_metric.profit_factor}, WR: {best_metric.win_rate_pct}%)"

    return {
        "engine_name": "Backtest Engine & VCB Simulator",
        "version": "v1.0.0 (Sprint 43.1)",
        "broker_feed": "5paisa Xstream (Automated TOTP)",
        "broker_configured": is_5p_cfg,
        "broker_active": is_5p_active,
        "data_coverage": "28 Equities Parquet Cache (3 Months / 4,342 bars each) + On-Demand 5Paisa API",
        "available_timeframes": ["1m", "5m", "15m", "30m", "60m", "1d"],
        "last_historical_sync": "Continuous 5Paisa Feed & Parquet Cache",
        "last_backtest_id": last_run.run_id if last_run else None,
        "last_backtest_status": last_run.status if last_run else "IDLE",
        "current_status": "RUNNING" if active_run else "IDLE",
        "active_run_id": active_run.run_id if active_run else None,
        "active_progress_pct": active_run.progress_pct if active_run else 0.0,
        "best_recent_strategy": best_strat_info,
    }


@router.get("/data-quality/{symbol}", summary="Forensic data quality check for symbol")
def check_data_quality(
    symbol: str,
    timeframe: str = "5m",
    db: Session = Depends(get_db),
):
    provider = CompositeMarketDataProvider(db=db)
    raw_df = provider.get_candles(symbol=symbol, timeframe=timeframe)
    if raw_df.empty:
        raise HTTPException(status_code=404, detail=f"No candle data found for {symbol}")

    clean_df, dq_report = DataQualityEngine.validate_dataframe(
        df=raw_df,
        symbol=symbol,
        timeframe=timeframe,
    )
    return dq_report.to_dict()
