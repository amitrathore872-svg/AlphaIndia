"""
Alpha India - Production Backtest Engine Orchestrator
Sprint 43.1 Central Execution Pipeline & Database Persistence

Coordinates:
- Configuration validation & Run lifecycle (QUEUED -> RUNNING -> COMPLETED)
- Multi-tier data retrieval (5Paisa / Parquet / DB)
- Forensic Data Quality verification
- Strategy execution & rule diagnostic extraction (VCB Breakout / VCB Early)
- Next-bar trade simulation with look-ahead protection
- Regulatory transaction friction & position sizing
- Performance metrics, time-of-day, and rule contribution analytics
- Database persistence to PostgreSQL tables
"""

from __future__ import annotations

from datetime import datetime, date, timezone
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, utc_now
from app.models.backtest_models import (
    BacktestRun,
    BacktestSignal,
    BacktestTrade,
    BacktestMetric,
    BacktestEquityCurve,
)
from app.models.company import Company
from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.candle_aggregator import CandleAggregator
from app.services.backtest.data_quality_engine import DataQualityEngine
from app.services.backtest.market_data_provider import CompositeMarketDataProvider
from app.services.backtest.metrics_calculator import MetricsCalculator
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.trade_simulator import TradeSimulator
from app.services.backtest.universe_service import UniverseService
from app.services.backtest.vcb_strategy import VCBBreakoutStrategy, VCBEarlyStrategy
from app.services.backtest.mtf_vcp_vcb_strategy import MTFVCPVCBStrategy

logger = logging.getLogger("alpha_india.backtest.engine")


class BacktestEngine:
    """
    Central quantitative backtesting engine.
    """

    STRATEGY_MAP = {
        "VCB_BREAKOUT": VCBBreakoutStrategy,
        "VCB_EARLY": VCBEarlyStrategy,
        "MTF_VCP_VCB": MTFVCPVCBStrategy,
    }

    @classmethod
    def create_run_record(cls, config: Dict[str, Any], db: Session) -> str:
        """
        Creates an initial BacktestRun record in QUEUED state.
        Returns unique run_id.
        """
        run_id = f"bt_{uuid.uuid4().hex[:12]}_{int(time.time())}"
        name = config.get("name") or f"{config.get('strategy', 'VCB_BREAKOUT')} {config.get('universe', 'NIFTY_500')}"
        start_date = pd.to_datetime(config.get("start_date", "2026-07-06")).date()
        end_date = pd.to_datetime(config.get("end_date", "2026-09-25")).date()

        run_record = BacktestRun(
            run_id=run_id,
            name=name,
            strategy=config.get("strategy", "VCB_BREAKOUT").upper(),
            universe=config.get("universe", "NIFTY_500").upper(),
            timeframe=config.get("timeframe", "5m"),
            start_date=start_date,
            end_date=end_date,
            capital=float(config.get("capital", 1000000.0)),
            status="QUEUED",
            progress_pct=0.0,
            symbols_processed=0,
            total_symbols=0,
            candles_processed=0,
            signals_count=0,
            trades_count=0,
            configuration=config,
            created_at=utc_now(),
        )
        db.add(run_record)
        db.commit()
        return run_id

    @classmethod
    def execute_backtest(cls, run_id: str, db: Session) -> Dict[str, Any]:
        """
        Executes the backtest for the given run_id.
        Updates state and persists signals, trades, metrics, and equity curve.
        """
        run_record = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
        if not run_record:
            raise ValueError(f"Backtest run not found: {run_id}")

        start_time = time.time()
        run_record.status = "RUNNING"
        run_record.progress_pct = 5.0
        db.commit()

        config = run_record.configuration
        strategy_name = run_record.strategy
        universe_name = run_record.universe
        timeframe = run_record.timeframe
        start_date_str = str(run_record.start_date)
        end_date_str = str(run_record.end_date)
        capital = float(run_record.capital)

        # Universe resolution
        univ_info = UniverseService.get_universe_symbols(
            universe_name=universe_name,
            db=db,
            custom_symbols=config.get("custom_symbols"),
        )
        symbols = univ_info["symbols"]
        run_record.total_symbols = len(symbols)
        db.commit()

        if not symbols:
            run_record.status = "FAILED"
            run_record.error_message = "No symbols found for specified universe."
            db.commit()
            return {"run_id": run_id, "status": "FAILED", "error": "No symbols"}

        # Instantiate strategy
        strat_cls = cls.STRATEGY_MAP.get(strategy_name, VCBBreakoutStrategy)
        strategy_instance = strat_cls(parameters=config.get("strategy_parameters"))

        # Setup simulator & costs
        cost_model = TransactionCostModel(
            brokerage_per_order=float(config.get("brokerage_per_order", 20.0)),
            slippage_pct=float(config.get("slippage_pct", 0.05)),
        )
        pos_sizer = PositionSizer()
        trade_sim = TradeSimulator(
            cost_model=cost_model,
            position_sizer=pos_sizer,
            active_target_pct=float(config.get("target_pct", 0.015)),
            active_stop_pct=float(config.get("stop_pct", 0.010)),
        )

        data_provider = CompositeMarketDataProvider(db=db)

        # Setup multi-timeframe benchmark if needed
        benchmark_daily_df = None
        if strategy_name == "MTF_VCP_VCB":
            try:
                benchmark_daily_df = data_provider.get_candles(
                    symbol="NIFTYBEES",
                    timeframe="1d",
                    start_date="2025-01-01",
                    end_date=end_date_str,
                )
            except Exception as e:
                logger.warning(f"[BacktestEngine] Could not load NIFTYBEES benchmark: {e}")

        all_signals = []
        all_trades = []
        total_candles = 0

        # Process equities sequentially
        for idx, sym in enumerate(symbols):
            run_record.current_symbol = sym
            run_record.progress_pct = round(10.0 + (idx / len(symbols)) * 75.0, 1)
            run_record.symbols_processed = idx + 1
            if idx % 5 == 0:
                db.commit()

            try:
                raw_df = data_provider.get_candles(
                    symbol=sym,
                    timeframe=timeframe,
                    start_date=start_date_str,
                    end_date=end_date_str,
                )

                if raw_df.empty or len(raw_df) < 65:
                    continue

                # Data Quality Validation
                clean_df, dq_report = DataQualityEngine.validate_dataframe(
                    df=raw_df,
                    symbol=sym,
                    timeframe=timeframe,
                )

                if clean_df.empty or len(clean_df) < 65:
                    continue

                total_candles += len(clean_df)

                # Inject higher-timeframe data for MTF strategy
                if strategy_name == "MTF_VCP_VCB" and isinstance(strategy_instance, MTFVCPVCBStrategy):
                    daily_df = data_provider.get_candles(
                        symbol=sym,
                        timeframe="1d",
                        start_date="2025-01-01",
                        end_date=end_date_str,
                    )
                    weekly_df = None
                    if not daily_df.empty and len(daily_df) >= 15:
                        d_w = daily_df.copy()
                        if "Datetime" in d_w.columns:
                            d_w["Datetime"] = pd.to_datetime(d_w["Datetime"])
                            d_w.set_index("Datetime", inplace=True)
                        weekly_df = d_w.resample("W-FRI").agg({
                            "Open": "first",
                            "High": "max",
                            "Low": "min",
                            "Close": "last",
                            "Volume": "sum",
                        }).dropna(subset=["Close"]).reset_index()

                    candles_15m = CandleAggregator.aggregate_candles(clean_df, target_timeframe="15m")
                    comp = db.query(Company).filter(Company.symbol == sym).first()
                    sec_name = comp.sector if comp else None

                    strategy_instance.set_higher_timeframe_data(
                        daily_df=daily_df,
                        weekly_df=weekly_df,
                        candles_15m=candles_15m,
                        benchmark_daily_df=benchmark_daily_df,
                        sector_name=sec_name,
                    )

                # Generate signals
                sym_signals = strategy_instance.generate_signals(clean_df, symbol=sym)
                all_signals.extend(sym_signals)

                # Simulate trades on each signal
                for sig in sym_signals:
                    tr = trade_sim.simulate_trade(
                        signal=sig,
                        candles_df=clean_df,
                        capital=capital,
                        sizing_model=config.get("sizing_model", "RISK_BASED"),
                    )
                    if tr:
                        all_trades.append(tr)

            except Exception as e:
                logger.error(f"[BacktestEngine] Error processing symbol {sym}: {e}", exc_info=True)

        run_record.candles_processed = total_candles
        run_record.signals_count = len(all_signals)
        run_record.trades_count = len(all_trades)
        run_record.progress_pct = 90.0
        db.commit()

        # Sort trades chronologically by entry_time
        all_trades.sort(key=lambda t: t.entry_time)

        # Calculate performance metrics
        metrics_dict = MetricsCalculator.calculate_metrics(
            trades=all_trades,
            signals=all_signals,
            initial_capital=capital,
        )

        # Persist Metrics Record
        metric_row = BacktestMetric(
            run_id=run_id,
            total_signals=metrics_dict["total_signals"],
            total_trades=metrics_dict["total_trades"],
            winning_trades=metrics_dict["winning_trades"],
            losing_trades=metrics_dict["losing_trades"],
            win_rate_pct=metrics_dict["win_rate_pct"],
            loss_rate_pct=metrics_dict["loss_rate_pct"],
            average_return_pct=metrics_dict["average_return_pct"],
            median_return_pct=metrics_dict["median_return_pct"],
            avg_winning_return_pct=metrics_dict["avg_winning_return_pct"],
            avg_losing_return_pct=metrics_dict["avg_losing_return_pct"],
            gross_pnl=metrics_dict["gross_pnl"],
            net_pnl=metrics_dict["net_pnl"],
            profit_factor=metrics_dict["profit_factor"],
            expectancy_pct=metrics_dict["expectancy_pct"],
            avg_mfe_pct=metrics_dict["avg_mfe_pct"],
            median_mfe_pct=metrics_dict["median_mfe_pct"],
            avg_mae_pct=metrics_dict["avg_mae_pct"],
            median_mae_pct=metrics_dict["median_mae_pct"],
            max_drawdown_pct=metrics_dict["max_drawdown_pct"],
            max_consecutive_wins=metrics_dict["max_consecutive_wins"],
            max_consecutive_losses=metrics_dict["max_consecutive_losses"],
            avg_holding_minutes=metrics_dict["avg_holding_minutes"],
            target_hit_rates=metrics_dict["target_hit_rates"],
            stop_hit_rates=metrics_dict["stop_hit_rates"],
            time_of_day_breakdown=metrics_dict["time_of_day_breakdown"],
            rule_contribution_analysis=metrics_dict["rule_contribution_analysis"],
            daily_pnl=metrics_dict["daily_pnl"],
            weekly_pnl=metrics_dict["weekly_pnl"],
            monthly_pnl=metrics_dict["monthly_pnl"],
            trades_per_day_avg=metrics_dict["trades_per_day_avg"],
            created_at=utc_now(),
        )
        db.add(metric_row)

        # Persist Signals
        for s in all_signals:
            sig_row = BacktestSignal(
                run_id=run_id,
                symbol=str(s.symbol),
                timestamp=pd.to_datetime(s.timestamp).to_pydatetime(),
                strategy=str(s.strategy),
                timeframe=str(s.timeframe),
                signal_type=str(s.signal_type),
                entry_price=float(s.entry_price),
                resistance=float(s.resistance) if s.resistance is not None else None,
                atr=float(s.atr) if s.atr is not None else None,
                volume_ratio=float(s.volume_ratio) if s.volume_ratio is not None else None,
                compression_pct=float(s.compression_pct) if s.compression_pct is not None else None,
                close_location_pct=float(s.close_location_pct) if s.close_location_pct is not None else None,
                extension_pct=float(s.extension_pct) if s.extension_pct is not None else None,
                rule_diagnostics={k: bool(v) for k, v in (s.rule_diagnostics or {}).items()},
                created_at=utc_now(),
            )
            db.add(sig_row)

        # Persist Trades and Equity Curve
        running_equity = float(capital)
        running_cash = float(capital)
        peak_equity = float(capital)

        for t in all_trades:
            trade_row = BacktestTrade(
                run_id=run_id,
                symbol=str(t.symbol),
                entry_time=pd.to_datetime(t.entry_time).to_pydatetime(),
                entry_price=float(t.entry_price),
                exit_time=pd.to_datetime(t.exit_time).to_pydatetime() if t.exit_time is not None else None,
                exit_price=float(t.exit_price),
                exit_reason=str(t.exit_reason),
                holding_bars=int(t.holding_bars),
                holding_minutes=int(t.holding_minutes),
                shares=int(t.shares),
                position_value=float(t.position_value),
                gross_return_pct=float(t.gross_return_pct),
                gross_pnl=float(t.gross_pnl),
                friction_costs=float(t.friction_costs),
                net_return_pct=float(t.net_return_pct),
                net_pnl=float(t.net_pnl),
                mfe_pct=float(t.mfe_pct),
                mae_pct=float(t.mae_pct),
                time_to_target_min=int(t.time_to_target_min) if t.time_to_target_min is not None else None,
                time_to_stop_min=int(t.time_to_stop_min) if t.time_to_stop_min is not None else None,
                ambiguous_exit=bool(t.ambiguous_exit),
                target_matrix=t.target_matrix,
                stop_matrix=t.stop_matrix,
                created_at=utc_now(),
            )
            db.add(trade_row)

            # Update equity curve
            running_equity += float(t.net_pnl)
            if running_equity > peak_equity:
                peak_equity = running_equity
            cur_dd = float(((peak_equity - running_equity) / peak_equity) * 100.0) if peak_equity > 0 else 0.0

            eq_ts = t.exit_time or t.entry_time
            eq_row = BacktestEquityCurve(
                run_id=run_id,
                timestamp=pd.to_datetime(eq_ts).to_pydatetime(),
                equity=round(float(running_equity), 2),
                cash=round(float(running_cash), 2),
                drawdown_pct=round(float(cur_dd), 2),
                peak_equity=round(float(peak_equity), 2),
            )
            db.add(eq_row)

        # Complete Run
        run_record.status = "COMPLETED"
        run_record.progress_pct = 100.0
        run_record.current_symbol = None
        run_record.execution_time_sec = round(time.time() - start_time, 2)
        run_record.completed_at = utc_now()
        db.commit()

        return {
            "run_id": run_id,
            "status": "COMPLETED",
            "execution_time_sec": run_record.execution_time_sec,
            "symbols_scanned": len(symbols),
            "candles_processed": total_candles,
            "signals_count": len(all_signals),
            "trades_count": len(all_trades),
            "win_rate_pct": metrics_dict["win_rate_pct"],
            "net_pnl": metrics_dict["net_pnl"],
            "profit_factor": metrics_dict["profit_factor"],
            "expectancy_pct": metrics_dict["expectancy_pct"],
            "max_drawdown_pct": metrics_dict["max_drawdown_pct"],
        }
