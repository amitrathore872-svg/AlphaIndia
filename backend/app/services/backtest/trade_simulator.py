"""
Alpha India - Trade Simulation Engine
Sprint 43.1 Zero-Leakage Execution & Excursion Analytics

Simulates realistic order execution for strategy signals:
- Zero Look-Ahead Bias: Future trajectory strictly evaluated on subsequent bars (t+1 onwards).
- Comprehensive Excursions: MFE (Maximum Favorable Excursion) and MAE (Maximum Adverse Excursion).
- Multi-Target Matrix: +0.5%, +1.0%, +1.5%, +2.0%, +3.0%, +5.0%.
- Multi-Stop Matrix: -0.5%, -1.0%, -1.5%, -2.0%.
- Ambiguous Candle Resolution: Conservative policy (assumes stop hit first if both triggered on same bar).
- End of Day (EOD) Mandatory Square-Off (15:25 IST).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.strategy_interface import StrategySignal

EOD_SQUAREOFF_TIME = dtime(15, 20)


@dataclass
class SimulatedTradeResult:
    symbol: str
    signal_id: Optional[int]
    entry_time: datetime
    entry_price: float
    exit_time: Optional[datetime]
    exit_price: float
    exit_reason: str
    holding_bars: int
    holding_minutes: int
    shares: int
    position_value: float
    gross_return_pct: float
    gross_pnl: float
    friction_costs: float
    net_return_pct: float
    net_pnl: float
    mfe_pct: float
    mae_pct: float
    time_to_target_min: Optional[int]
    time_to_stop_min: Optional[int]
    ambiguous_exit: bool
    target_matrix: Dict[str, Any]
    stop_matrix: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "entry_time": self.entry_time.isoformat() if hasattr(self.entry_time, "isoformat") else str(self.entry_time),
            "entry_price": round(self.entry_price, 2),
            "exit_time": self.exit_time.isoformat() if hasattr(self.exit_time, "isoformat") else str(self.exit_time),
            "exit_price": round(self.exit_price, 2),
            "exit_reason": self.exit_reason,
            "holding_bars": self.holding_bars,
            "holding_minutes": self.holding_minutes,
            "shares": self.shares,
            "position_value": round(self.position_value, 2),
            "gross_return_pct": round(self.gross_return_pct, 2),
            "gross_pnl": round(self.gross_pnl, 2),
            "friction_costs": round(self.friction_costs, 2),
            "net_return_pct": round(self.net_return_pct, 2),
            "net_pnl": round(self.net_pnl, 2),
            "mfe_pct": round(self.mfe_pct, 2),
            "mae_pct": round(self.mae_pct, 2),
            "time_to_target_min": self.time_to_target_min,
            "time_to_stop_min": self.time_to_stop_min,
            "ambiguous_exit": self.ambiguous_exit,
            "target_matrix": self.target_matrix,
            "stop_matrix": self.stop_matrix,
        }


class TradeSimulator:
    """
    Simulates execution and outcomes for strategy signals across subsequent bars.
    """

    TARGET_THRESHOLDS = [0.005, 0.010, 0.015, 0.020, 0.030, 0.050]  # 0.5% to 5.0%
    STOP_THRESHOLDS = [-0.005, -0.010, -0.015, -0.020]               # -0.5% to -2.0%

    def __init__(
        self,
        cost_model: Optional[TransactionCostModel] = None,
        position_sizer: Optional[PositionSizer] = None,
        active_target_pct: float = 0.015,    # Primary target for exit (e.g. +1.5%)
        active_stop_pct: float = 0.010,      # Primary stop for exit (e.g. -1.0%)
        max_holding_bars: int = 75,          # Max 1 session (75 x 5m bars)
        conservative_ambiguity: bool = True, # Assume stop first on collision
    ):
        self.cost_model = cost_model or TransactionCostModel()
        self.position_sizer = position_sizer or PositionSizer()
        self.active_target_pct = active_target_pct
        self.active_stop_pct = active_stop_pct
        self.max_holding_bars = max_holding_bars
        self.conservative_ambiguity = conservative_ambiguity

    def simulate_trade(
        self,
        signal: StrategySignal,
        candles_df: pd.DataFrame,
        capital: float = 1000000.0,
        sizing_model: str = "RISK_BASED",
    ) -> Optional[SimulatedTradeResult]:
        """
        Executes trade at the signal candle close and scans forward candles strictly starting from t+1.
        """
        if candles_df.empty:
            return None

        col_map = {c: c.capitalize() for c in candles_df.columns}
        df = candles_df.rename(columns=col_map)
        df["Datetime"] = pd.to_datetime(df["Datetime"])

        # Locate signal candle index with robust timezone alignment
        sig_ts = pd.to_datetime(signal.timestamp)
        df_tz = df["Datetime"].dt.tz
        if df_tz is not None and sig_ts.tz is None:
            sig_ts = sig_ts.tz_localize(df_tz)
        elif df_tz is not None and sig_ts.tz is not None:
            sig_ts = sig_ts.tz_convert(df_tz)
        elif df_tz is None and sig_ts.tz is not None:
            sig_ts = sig_ts.tz_localize(None)

        matches = df.index[df["Datetime"] == sig_ts].tolist()
        if not matches:
            # Fallback to closest earlier candle
            matches = df.index[df["Datetime"] <= sig_ts].tolist()
            if not matches:
                return None
            sig_idx = matches[-1]
        else:
            sig_idx = matches[0]

        n = len(df)
        if sig_idx >= n - 1:
            # Signal was on the very last candle; no forward trajectory available
            return None

        # Entry Price = Close of breakout candle
        entry_price = float(signal.entry_price)
        if entry_price <= 0:
            return None

        # Calculate position sizing
        stop_price = entry_price * (1.0 - self.active_stop_pct)
        pos_info = self.position_sizer.calculate_position(
            sizing_model=sizing_model,
            capital=capital,
            entry_price=entry_price,
            stop_price=stop_price,
        )
        shares = pos_info["shares"]
        if shares <= 0:
            return None

        # Targets & Stop Levels
        primary_target_price = entry_price * (1.0 + self.active_target_pct)
        primary_stop_price = stop_price

        # Excursion & Multi-threshold tracking
        mfe_val = 0.0
        mae_val = 0.0
        time_to_primary_target = None
        time_to_primary_stop = None
        ambiguous_exit = False

        target_matrix: Dict[str, Any] = {
            f"{int(t*1000)/10}%": {"hit": False, "time_min": None} for t in self.TARGET_THRESHOLDS
        }
        stop_matrix: Dict[str, Any] = {
            f"{int(abs(s)*1000)/10}%": {"hit": False, "time_min": None} for s in self.STOP_THRESHOLDS
        }

        exit_price = entry_price
        exit_time = df.loc[sig_idx + 1, "Datetime"]
        exit_reason = "HOLDING_END"
        bars_held = 0

        sig_date = sig_ts.date()

        # Step forward bar-by-bar strictly from sig_idx + 1 onwards
        for step, cur_idx in enumerate(range(sig_idx + 1, n)):
            bars_held = step + 1
            cur_row = df.loc[cur_idx]
            cur_ts = cur_row["Datetime"]
            cur_open = float(cur_row["Open"])
            cur_high = float(cur_row["High"])
            cur_low = float(cur_row["Low"])
            cur_close = float(cur_row["Close"])

            minutes_elapsed = bars_held * 5

            # Excursion updates
            bar_mfe = ((cur_high - entry_price) / entry_price) * 100.0
            bar_mae = ((cur_low - entry_price) / entry_price) * 100.0
            if bar_mfe > mfe_val:
                mfe_val = bar_mfe
            if bar_mae < mae_val:
                mae_val = bar_mae

            # Multi-Target Matrix updates
            for t in self.TARGET_THRESHOLDS:
                t_key = f"{int(t*1000)/10}%"
                if not target_matrix[t_key]["hit"] and cur_high >= (entry_price * (1.0 + t)):
                    target_matrix[t_key]["hit"] = True
                    target_matrix[t_key]["time_min"] = minutes_elapsed

            # Multi-Stop Matrix updates
            for s in self.STOP_THRESHOLDS:
                s_key = f"{int(abs(s)*1000)/10}%"
                if not stop_matrix[s_key]["hit"] and cur_low <= (entry_price * (1.0 + s)):
                    stop_matrix[s_key]["hit"] = True
                    stop_matrix[s_key]["time_min"] = minutes_elapsed

            # Check if primary target or primary stop touched on this bar
            hit_target = bool(cur_high >= primary_target_price)
            hit_stop = bool(cur_low <= primary_stop_price)

            # AMBIGUOUS CANDLE CHECK
            if hit_target and hit_stop:
                ambiguous_exit = True
                if self.conservative_ambiguity:
                    # Conservative: Assume stopped out first
                    exit_price = primary_stop_price
                    exit_time = cur_ts
                    exit_reason = "AMBIGUOUS_STOP_FIRST"
                    time_to_primary_stop = minutes_elapsed
                    break
                else:
                    exit_price = primary_target_price
                    exit_time = cur_ts
                    exit_reason = "AMBIGUOUS_TARGET_FIRST"
                    time_to_primary_target = minutes_elapsed
                    break

            if hit_target:
                exit_price = primary_target_price
                exit_time = cur_ts
                exit_reason = f"TARGET_{self.active_target_pct*100:.1f}%"
                time_to_primary_target = minutes_elapsed
                break

            if hit_stop:
                exit_price = primary_stop_price
                exit_time = cur_ts
                exit_reason = f"STOP_{self.active_stop_pct*100:.1f}%"
                time_to_primary_stop = minutes_elapsed
                break

            # Check intraday EOD square-off
            if cur_ts.date() != sig_date or cur_ts.time() >= EOD_SQUAREOFF_TIME:
                exit_price = cur_close
                exit_time = cur_ts
                exit_reason = "EOD_SQUAREOFF"
                break

            # Max holding duration
            if bars_held >= self.max_holding_bars:
                exit_price = cur_close
                exit_time = cur_ts
                exit_reason = "TIME_EXPIRY"
                break

        # Calculate P&L and friction
        gross_ret_pct = ((exit_price - entry_price) / entry_price) * 100.0
        pos_val = shares * entry_price
        gross_pnl = (exit_price - entry_price) * shares

        cost_breakdown = self.cost_model.calculate_round_trip_costs(
            entry_price=entry_price,
            exit_price=exit_price,
            shares=shares,
        )
        friction = cost_breakdown.total_friction
        net_pnl = gross_pnl - friction
        net_ret_pct = (net_pnl / pos_val) * 100.0 if pos_val > 0 else 0.0

        return SimulatedTradeResult(
            symbol=signal.symbol,
            signal_id=None,
            entry_time=sig_ts,
            entry_price=entry_price,
            exit_time=exit_time,
            exit_price=exit_price,
            exit_reason=exit_reason,
            holding_bars=bars_held,
            holding_minutes=bars_held * 5,
            shares=shares,
            position_value=pos_val,
            gross_return_pct=gross_ret_pct,
            gross_pnl=gross_pnl,
            friction_costs=friction,
            net_return_pct=net_ret_pct,
            net_pnl=net_pnl,
            mfe_pct=mfe_val,
            mae_pct=mae_val,
            time_to_target_min=time_to_primary_target,
            time_to_stop_min=time_to_primary_stop,
            ambiguous_exit=ambiguous_exit,
            target_matrix=target_matrix,
            stop_matrix=stop_matrix,
        )
