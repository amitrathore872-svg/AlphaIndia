"""
Alpha India - Quantitative Performance Metrics Calculator
Sprint 43.1 Statistical Engine & Forensic Return Attribution

Computes:
- Total Trades, Win Rate, Loss Rate
- Gross P&L, Net P&L, Profit Factor, Expectancy
- MFE/MAE Excursion Distributions
- Max Drawdown & Consecutive Streaks
- Target / Stop Matrix Hit Rates
- Time-of-Day Performance Breakdown
- Market Regime Performance Breakdown
- Rule Contribution and Diagnostic Correlation Matrix
- Daily, Weekly, and Monthly Realized P&L
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.services.backtest.market_regime import MarketRegimeEngine
from app.services.backtest.strategy_interface import StrategySignal
from app.services.backtest.trade_simulator import SimulatedTradeResult


class MetricsCalculator:
    """
    Computes institutional performance metrics for backtest executions.
    """

    @classmethod
    def calculate_metrics(
        cls,
        trades: List[SimulatedTradeResult],
        signals: List[StrategySignal],
        initial_capital: float = 1000000.0,
    ) -> Dict[str, Any]:
        total_signals = len(signals)
        total_trades = len(trades)

        if total_trades == 0:
            return cls._empty_metrics(total_signals)

        # Basic Trade Counts
        winners = [t for t in trades if t.net_pnl > 0]
        losers = [t for t in trades if t.net_pnl < 0]
        breakevens = [t for t in trades if t.net_pnl == 0]

        win_count = len(winners)
        loss_count = len(losers)
        win_rate = (win_count / total_trades) * 100.0
        loss_rate = (loss_count / total_trades) * 100.0

        # Returns
        net_returns = [t.net_return_pct for t in trades]
        avg_ret = float(np.mean(net_returns))
        median_ret = float(np.median(net_returns))
        avg_win_ret = float(np.mean([t.net_return_pct for t in winners])) if winners else 0.0
        avg_loss_ret = float(np.mean([t.net_return_pct for t in losers])) if losers else 0.0

        # P&L & Profit Factor
        gross_pnl = float(sum(t.gross_pnl for t in trades))
        net_pnl = float(sum(t.net_pnl for t in trades))
        gross_wins = float(sum(t.net_pnl for t in winners))
        gross_losses = float(abs(sum(t.net_pnl for t in losers)))
        profit_factor = round(gross_wins / max(1.0, gross_losses), 2) if gross_losses > 0 else (99.0 if gross_wins > 0 else 0.0)

        # Expectancy
        # Expectancy = (Win% * AvgWin) - (Loss% * |AvgLoss|)
        expectancy = ((win_rate / 100.0) * avg_win_ret) - ((loss_rate / 100.0) * abs(avg_loss_ret))

        # Excursions
        mfes = [t.mfe_pct for t in trades]
        maes = [t.mae_pct for t in trades]
        avg_mfe = float(np.mean(mfes)) if mfes else 0.0
        median_mfe = float(np.median(mfes)) if mfes else 0.0
        avg_mae = float(np.mean(maes)) if maes else 0.0
        median_mae = float(np.median(maes)) if maes else 0.0

        # Max Drawdown & Streaks
        equity = initial_capital
        peak = initial_capital
        max_dd = 0.0
        cur_win_streak = 0
        max_win_streak = 0
        cur_loss_streak = 0
        max_loss_streak = 0

        daily_pnl_map = defaultdict(float)
        weekly_pnl_map = defaultdict(float)
        monthly_pnl_map = defaultdict(float)

        holding_times = []

        for t in trades:
            holding_times.append(t.holding_minutes)
            equity += t.net_pnl
            if equity > peak:
                peak = equity
            dd = ((peak - equity) / peak) * 100.0 if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd

            # Streaks
            if t.net_pnl > 0:
                cur_win_streak += 1
                cur_loss_streak = 0
                if cur_win_streak > max_win_streak:
                    max_win_streak = cur_win_streak
            elif t.net_pnl < 0:
                cur_loss_streak += 1
                cur_win_streak = 0
                if cur_loss_streak > max_loss_streak:
                    max_loss_streak = cur_loss_streak

            # Date grouping
            d_str = t.entry_time.strftime("%Y-%m-%d") if hasattr(t.entry_time, "strftime") else str(t.entry_time)[:10]
            m_str = d_str[:7]
            dt = pd.to_datetime(d_str)
            w_str = f"{dt.year}-W{dt.isocalendar()[1]:02d}"

            daily_pnl_map[d_str] += t.net_pnl
            weekly_pnl_map[w_str] += t.net_pnl
            monthly_pnl_map[m_str] += t.net_pnl

        avg_hold_min = float(np.mean(holding_times)) if holding_times else 0.0
        unique_days = len(daily_pnl_map)
        trades_per_day = round(total_trades / max(1, unique_days), 2)

        # Target Matrix Aggregate Hit Rates
        target_keys = ["0.5%", "1.0%", "1.5%", "2.0%", "3.0%", "5.0%"]
        target_hits = {k: 0 for k in target_keys}
        for t in trades:
            if t.target_matrix:
                for k in target_keys:
                    if t.target_matrix.get(k, {}).get("hit"):
                        target_hits[k] += 1
        target_hit_rates = {k: round((target_hits[k] / total_trades) * 100.0, 1) for k in target_keys}

        # Stop Matrix Aggregate Hit Rates
        stop_keys = ["0.5%", "1.0%", "1.5%", "2.0%"]
        stop_hits = {k: 0 for k in stop_keys}
        for t in trades:
            if t.stop_matrix:
                for k in stop_keys:
                    if t.stop_matrix.get(k, {}).get("hit"):
                        stop_hits[k] += 1
        stop_hit_rates = {k: round((stop_hits[k] / total_trades) * 100.0, 1) for k in stop_keys}

        # Time-of-Day Performance Breakdown
        tod_map = defaultdict(lambda: {"trades": 0, "wins": 0, "pnl": 0.0, "mfes": [], "maes": []})
        for t in trades:
            b_id = MarketRegimeEngine.get_time_bucket(t.entry_time)
            tod_map[b_id]["trades"] += 1
            if t.net_pnl > 0:
                tod_map[b_id]["wins"] += 1
            tod_map[b_id]["pnl"] += t.net_pnl
            tod_map[b_id]["mfes"].append(t.mfe_pct)
            tod_map[b_id]["maes"].append(t.mae_pct)

        tod_breakdown = []
        for b in MarketRegimeEngine.TIME_BUCKETS:
            bid = b["id"]
            dat = tod_map[bid]
            nt = dat["trades"]
            wr = round((dat["wins"] / max(1, nt)) * 100.0, 1) if nt > 0 else 0.0
            tod_breakdown.append({
                "bucket": bid,
                "label": b["label"],
                "trades": nt,
                "win_rate": wr,
                "pnl": round(dat["pnl"], 2),
                "avg_mfe": round(float(np.mean(dat["mfes"])), 2) if dat["mfes"] else 0.0,
                "avg_mae": round(float(np.mean(dat["maes"])), 2) if dat["maes"] else 0.0,
            })

        # Rule Contribution Analysis
        # Determine for each rule: Pass count, Pass %, Win Rate when active
        rule_stats = defaultdict(lambda: {"total": 0, "wins": 0})
        for sig in signals:
            diag = sig.rule_diagnostics or {}
            # Match with trade if available
            is_win = False
            for t in trades:
                if t.symbol == sig.symbol and str(t.entry_time)[:16] == str(sig.timestamp)[:16]:
                    is_win = t.net_pnl > 0
                    break

            for r_name, r_passed in diag.items():
                if r_passed:
                    rule_stats[r_name]["total"] += 1
                    if is_win:
                        rule_stats[r_name]["wins"] += 1

        rule_analysis = []
        for r_name in sorted(rule_stats.keys()):
            tot = rule_stats[r_name]["total"]
            wn = rule_stats[r_name]["wins"]
            pass_pct = round((tot / max(1, total_signals)) * 100.0, 1)
            wr_when_passed = round((wn / max(1, tot)) * 100.0, 1) if tot > 0 else 0.0
            rule_analysis.append({
                "rule": r_name,
                "pass_count": tot,
                "pass_pct": pass_pct,
                "win_rate": wr_when_passed,
            })

        return {
            "total_signals": total_signals,
            "total_trades": total_trades,
            "winning_trades": win_count,
            "losing_trades": loss_count,
            "win_rate_pct": round(win_rate, 2),
            "loss_rate_pct": round(loss_rate, 2),
            "average_return_pct": round(avg_ret, 2),
            "median_return_pct": round(median_ret, 2),
            "avg_winning_return_pct": round(avg_win_ret, 2),
            "avg_losing_return_pct": round(avg_loss_ret, 2),
            "gross_pnl": round(gross_pnl, 2),
            "net_pnl": round(net_pnl, 2),
            "profit_factor": profit_factor,
            "expectancy_pct": round(expectancy, 2),
            "avg_mfe_pct": round(avg_mfe, 2),
            "median_mfe_pct": round(median_mfe, 2),
            "avg_mae_pct": round(avg_mae, 2),
            "median_mae_pct": round(median_mae, 2),
            "max_drawdown_pct": round(max_dd, 2),
            "max_consecutive_wins": max_win_streak,
            "max_consecutive_losses": max_loss_streak,
            "avg_holding_minutes": round(avg_hold_min, 1),
            "trades_per_day_avg": trades_per_day,
            "target_hit_rates": target_hit_rates,
            "stop_hit_rates": stop_hit_rates,
            "time_of_day_breakdown": tod_breakdown,
            "rule_contribution_analysis": rule_analysis,
            "daily_pnl": dict(sorted(daily_pnl_map.items())),
            "weekly_pnl": dict(sorted(weekly_pnl_map.items())),
            "monthly_pnl": dict(sorted(monthly_pnl_map.items())),
        }

    @classmethod
    def _empty_metrics(cls, total_signals: int) -> Dict[str, Any]:
        return {
            "total_signals": total_signals,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate_pct": 0.0,
            "loss_rate_pct": 0.0,
            "average_return_pct": 0.0,
            "median_return_pct": 0.0,
            "avg_winning_return_pct": 0.0,
            "avg_losing_return_pct": 0.0,
            "gross_pnl": 0.0,
            "net_pnl": 0.0,
            "profit_factor": 0.0,
            "expectancy_pct": 0.0,
            "avg_mfe_pct": 0.0,
            "median_mfe_pct": 0.0,
            "avg_mae_pct": 0.0,
            "median_mae_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "max_consecutive_wins": 0,
            "max_consecutive_losses": 0,
            "avg_holding_minutes": 0.0,
            "trades_per_day_avg": 0.0,
            "target_hit_rates": {},
            "stop_hit_rates": {},
            "time_of_day_breakdown": [],
            "rule_contribution_analysis": [],
            "daily_pnl": {},
            "weekly_pnl": {},
            "monthly_pnl": {},
        }
