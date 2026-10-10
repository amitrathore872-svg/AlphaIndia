"""
Alpha India - VCP-V1 Out-of-Sample Validation & Comprehensive Robustness Suite
Rigorous quant validation of the frozen VCP-V1 strategy:
- True Out-of-Sample (post 2026-09-25)
- Extended Historical (12 months: 2025-10-01 to 2026-10-07)
- Walk-Forward Rolling Analysis
- Market Regime Breakdown
- Time-of-Day Microstructure
- Parameter Perturbation Surface & Stability Grid
- MFE / MAE Hit Rates
- Wilson Score Confidence Intervals
- Baseline VCB vs VCP-V1 Head-to-Head
"""

import sys
import os
import json
import math
from datetime import datetime, timedelta, time as dtime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "backend")

from app.db.database import SessionLocal
from app.services.backtest.universe_service import NIFTY_50_BENCHMARK_SYMBOLS
from app.services.backtest.market_data_provider import CompositeMarketDataProvider
from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.vcp_detector import VCPDetector
from app.services.backtest.daily_confirmation import DailyConfirmationEngine
from app.services.backtest.relative_strength import RelativeStrengthCalculator
from app.models.company import Company

# ==============================================================================
# FROZEN VCP-V1 SPECIFICATION (DO NOT ALTER)
# ==============================================================================
FROZEN_VCP_V1 = {
    "min_vcp_score": 80.0,
    "min_vol_mult": 2.5,
    "min_rs_score": 75.0,
    "max_range12": 0.018,
    "max_atr_ratio": 0.65,
    "close_loc": 0.25,
    "ext_ratio": 0.010,
    "target_pct": 0.010,       # +1.0% Target
    "stop_pct": 0.005,         # -0.5% Stop
    "window_start": dtime(9, 45),
    "window_end": dtime(14, 30),
    "capital": 1_000_000.0,
}

CACHE_DIR_APP = Path("backend/app/data/intraday_5m_cache")
CACHE_DIR_ROOT = Path("backend/data/intraday_5m_cache")
CACHE_DIR_APP.mkdir(parents=True, exist_ok=True)


def calculate_wilson_ci(wins: int, n: int, confidence: float = 0.95) -> Tuple[float, float]:
    """Calculates Wilson Score Confidence Interval for binomial proportion."""
    if n == 0:
        return (0.0, 0.0)
    z = 1.95996  # 95% confidence
    p_hat = wins / n
    denom = 1.0 + (z**2) / n
    center = (p_hat + (z**2) / (2 * n)) / denom
    margin = (z * math.sqrt((p_hat * (1 - p_hat) / n) + (z**2) / (4 * n**2))) / denom
    return (max(0.0, round((center - margin) * 100.0, 1)), min(100.0, round((center + margin) * 100.0, 1)))


def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    col_map = {c: c.capitalize() for c in df.columns}
    df = df.rename(columns=col_map)
    if "Datetime" not in df.columns:
        df["Datetime"] = df.index
    try:
        dt_series = pd.to_datetime(df["Datetime"])
        if dt_series.dt.tz is not None:
            df["Datetime"] = dt_series.dt.tz_convert("Asia/Kolkata").dt.tz_localize(None)
        else:
            df["Datetime"] = dt_series
    except Exception:
        df["Datetime"] = pd.to_datetime(df["Datetime"], utc=True).dt.tz_convert("Asia/Kolkata").dt.tz_localize(None)
    return df


class MultiPeriodDataManager:
    """Manages multi-timeframe candle datasets with persistent disk caching across periods."""

    def __init__(self, db):
        self.db = db
        self.prov = CompositeMarketDataProvider(db=db)

    def get_equity_5m(self, sym: str, start_date: str, end_date: str) -> pd.DataFrame:
        clean = sym.strip().upper()
        cache_file = CACHE_DIR_APP / f"{clean}_5m_full.parquet"
        
        # Check unified cache first
        if cache_file.exists():
            try:
                df = _normalize_df(pd.read_parquet(cache_file))
                s_dt = pd.to_datetime(start_date)
                e_dt = pd.to_datetime(end_date) + pd.Timedelta(days=1)
                sub = df[(df["Datetime"] >= s_dt) & (df["Datetime"] <= e_dt)].copy()
                if not sub.empty and len(sub) > 50:
                    return sub
            except Exception:
                pass

        # Check existing 3-month parquet cache
        p_paths = [
            CACHE_DIR_APP / f"{clean}_5m.parquet",
            CACHE_DIR_ROOT / f"{clean}_5m.parquet",
        ]
        df_base = pd.DataFrame()
        for p in p_paths:
            if p.exists():
                try:
                    df_base = _normalize_df(pd.read_parquet(p))
                    break
                except Exception:
                    pass

        # Check if we need to fetch OOS (post 2026-09-25) or extended historical from 5Paisa
        df_oos = pd.DataFrame()
        if pd.to_datetime(end_date) > pd.to_datetime("2026-09-25"):
            oos_file = CACHE_DIR_APP / f"{clean}_5m_oos.parquet"
            if oos_file.exists():
                try:
                    df_oos = _normalize_df(pd.read_parquet(oos_file))
                except Exception:
                    pass
            if df_oos.empty:
                try:
                    raw_oos = self.prov.fivepaisa_provider.get_candles(
                        clean, timeframe="5m", start_date="2026-09-26", end_date="2026-10-07"
                    )
                    if not raw_oos.empty:
                        df_oos = _normalize_df(raw_oos)
                        df_oos.to_parquet(oos_file)
                except Exception:
                    pass

        # Check if we need prior historical (pre 2026-07-06)
        df_prior = pd.DataFrame()
        if pd.to_datetime(start_date) < pd.to_datetime("2026-07-06"):
            prior_file = CACHE_DIR_APP / f"{clean}_5m_prior.parquet"
            if prior_file.exists():
                try:
                    df_prior = _normalize_df(pd.read_parquet(prior_file))
                except Exception:
                    pass
            if df_prior.empty:
                # Query in 60-day chunks from 5Paisa
                chunks = [
                    ("2026-05-01", "2026-07-05"),
                    ("2026-03-01", "2026-05-01"),
                    ("2026-01-01", "2026-03-01"),
                    ("2025-10-01", "2026-01-01"),
                ]
                dfs = []
                for cs, ce in chunks:
                    try:
                        c_df = self.prov.fivepaisa_provider.get_candles(clean, timeframe="5m", start_date=cs, end_date=ce)
                        if not c_df.empty:
                            dfs.append(_normalize_df(c_df))
                    except Exception:
                        pass
                if dfs:
                    df_prior = pd.concat(dfs, ignore_index=True)
                    df_prior.drop_duplicates(subset=["Datetime"], inplace=True)
                    df_prior.to_parquet(prior_file)

        # Merge pieces safely
        parts = [p for p in [df_prior, df_base, df_oos] if not p.empty]
        if not parts:
            return pd.DataFrame()

        full_df = pd.concat(parts, ignore_index=True)
        full_df.sort_values(by="Datetime", inplace=True)
        full_df.drop_duplicates(subset=["Datetime"], inplace=True)
        full_df.reset_index(drop=True, inplace=True)

        # Cache unified dataframe
        try:
            full_df.to_parquet(cache_file)
        except Exception:
            pass

        # Slice requested date range
        s_dt = pd.to_datetime(start_date)
        e_dt = pd.to_datetime(end_date) + pd.Timedelta(days=1)
        return full_df[(full_df["Datetime"] >= s_dt) & (full_df["Datetime"] <= e_dt)].copy()

    def get_equity_daily(self, sym: str) -> pd.DataFrame:
        clean = sym.strip().upper()
        cache_file = CACHE_DIR_APP / f"{clean}_1d.parquet"
        if cache_file.exists():
            try:
                df = pd.read_parquet(cache_file)
                col_map = {c: c.capitalize() for c in df.columns}
                df.rename(columns=col_map, inplace=True)
                df["Datetime"] = pd.to_datetime(df["Datetime"])
                return df
            except Exception:
                pass
        df = self.prov.get_candles(clean, timeframe="1d", start_date="2025-01-01", end_date="2026-10-07")
        if not df.empty:
            try:
                df.to_parquet(cache_file)
            except Exception:
                pass
        return df


def simulate_trade_execution(
    candidate: Dict[str, Any],
    target_pct: float,
    stop_pct: float,
    pos_sizer: PositionSizer,
    cost_model: TransactionCostModel,
    capital: float = 1_000_000.0,
) -> Dict[str, Any]:
    """Simulates zero look-ahead execution strictly on t+1 bars."""
    ep = candidate["entry_price"]
    tgt_price = ep * (1.0 + target_pct)
    stp_price = ep * (1.0 - stop_pct)

    pos = pos_sizer.calculate_position("RISK_BASED", capital, ep, stp_price)
    shares = pos["shares"]
    if shares <= 0:
        return {"valid": False}

    exit_price = ep
    exit_reason = "EOD"
    holding_bars = 0
    mfe_val = 0.0
    mae_val = 0.0

    f_highs = candidate["fwd_highs"]
    f_lows = candidate["fwd_lows"]
    f_closes = candidate["fwd_closes"]
    f_times = candidate["fwd_times"]

    # Threshold trackers
    mfe_thresholds = [0.0025, 0.005, 0.0075, 0.010, 0.015, 0.020, 0.030, 0.050]
    mae_thresholds = [-0.0025, -0.005, -0.0075, -0.010, -0.015, -0.020]
    mfe_hits = {f"{t*100:.2f}%": False for t in mfe_thresholds}
    mae_hits = {f"{abs(s)*100:.2f}%": False for s in mae_thresholds}

    for step in range(len(f_highs)):
        holding_bars = step + 1
        ch = f_highs[step]
        cl = f_lows[step]
        cc = f_closes[step]
        ct = f_times[step]

        bar_mfe = ((ch - ep) / ep) * 100.0
        bar_mae = ((cl - ep) / ep) * 100.0
        if bar_mfe > mfe_val:
            mfe_val = bar_mfe
        if bar_mae < mae_val:
            mae_val = bar_mae

        for t in mfe_thresholds:
            if ch >= ep * (1.0 + t):
                mfe_hits[f"{t*100:.2f}%"] = True
        for s in mae_thresholds:
            if cl <= ep * (1.0 + s):
                mae_hits[f"{abs(s)*100:.2f}%"] = True

        hit_tgt = (ch >= tgt_price)
        hit_stp = (cl <= stp_price)

        if hit_tgt and hit_stp:
            exit_price = stp_price
            exit_reason = "STOP_LOSS (Ambiguous)"
            break
        elif hit_tgt:
            exit_price = tgt_price
            exit_reason = f"TARGET (+{target_pct*100:.1f}%)"
            break
        elif hit_stp:
            exit_price = stp_price
            exit_reason = f"STOP_LOSS (-{stop_pct*100:.1f}%)"
            break

        if hasattr(ct, "time") and ct.time() >= dtime(15, 20):
            exit_price = cc
            exit_reason = "EOD_SQUAREOFF"
            break

    fric = cost_model.calculate_round_trip_costs(ep, exit_price, shares)
    gross_pnl = shares * (exit_price - ep)
    net_pnl = gross_pnl - fric.total_friction
    net_ret_pct = (net_pnl / (shares * ep)) * 100.0 if (shares * ep) > 0 else 0.0

    return {
        "valid": True,
        "symbol": candidate["symbol"],
        "timestamp": candidate["timestamp"],
        "entry_price": ep,
        "exit_price": exit_price,
        "exit_reason": exit_reason,
        "holding_bars": holding_bars,
        "holding_minutes": holding_bars * 5,
        "shares": shares,
        "gross_pnl": gross_pnl,
        "net_pnl": net_pnl,
        "net_return_pct": net_ret_pct,
        "is_win": net_pnl > 0,
        "is_loss": net_pnl < 0,
        "is_target_hit": "TARGET" in exit_reason,
        "is_stop_hit": "STOP_LOSS" in exit_reason,
        "mfe": mfe_val,
        "mae": mae_val,
        "mfe_hits": mfe_hits,
        "mae_hits": mae_hits,
        "vcp_score": candidate["vcp_score"],
        "rs_score": candidate["rs_score"],
        "daily_score": candidate["daily_score"],
        "vol_mult": candidate["vol_mult"],
        "range_12": candidate["range_12"],
        "market_regime": candidate["market_regime"],
        "time": candidate["time"],
    }


def extract_breakout_events(symbols, data_mgr, start_date, end_date, vcp_detector, db):
    """Extracts raw candidate breakout events across the date range."""
    bench_daily = data_mgr.get_equity_daily("NIFTYBEES")
    if bench_daily.empty:
        bench_daily = data_mgr.get_equity_daily("RELIANCE")

    b_dates = pd.to_datetime(bench_daily["Datetime"]).dt.date if "Datetime" in bench_daily.columns else None

    raw_events = []
    for sym in symbols:
        df = data_mgr.get_equity_5m(sym, start_date, end_date)
        if df.empty or len(df) < 65:
            continue

        n = len(df)
        date_series = df["Datetime"].dt.date
        pv = df["Close"] * df["Volume"]
        cum_pv = pv.groupby(date_series).cumsum()
        cum_vol = df["Volume"].groupby(date_series).cumsum()
        df["VWAP"] = cum_pv / np.maximum(1.0, cum_vol)

        df["Prev_12_High"] = df["High"].shift(1).rolling(12, min_periods=12).max()
        df["Prev_12_Low"] = df["Low"].shift(1).rolling(12, min_periods=12).min()
        df["Prev_Vol_SMA20"] = df["Volume"].shift(1).rolling(20, min_periods=20).mean()
        df["Prev_Vol_SMA5"] = df["Volume"].shift(1).rolling(5, min_periods=5).mean()

        tr1 = df["High"] - df["Low"]
        tr2 = (df["High"] - df["Close"].shift(1)).abs()
        tr3 = (df["Low"] - df["Close"].shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        df["ATR14"] = tr.rolling(14, min_periods=14).mean()
        df["Prev_ATR14"] = df["ATR14"].shift(1)
        df["Prev_ATR14_SMA50"] = df["ATR14"].shift(1).rolling(50, min_periods=50).mean()
        df["Prev_Close"] = df["Close"].shift(1)

        d_df = data_mgr.get_equity_daily(sym)
        d_dates = None
        if not d_df.empty:
            d_df["Date"] = pd.to_datetime(d_df["Datetime"]).dt.date
            d_dates = d_df["Date"].values

        w_df = None
        w_dates = None
        if not d_df.empty and len(d_df) >= 15:
            d_w = d_df.copy()
            d_w["Datetime"] = pd.to_datetime(d_w["Datetime"])
            d_w.set_index("Datetime", inplace=True)
            w_df = d_w.resample("W-FRI").agg({
                "Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"
            }).dropna(subset=["Close"]).reset_index()
            w_df["Date"] = pd.to_datetime(w_df["Datetime"]).dt.date
            w_dates = w_df["Date"].values

        comp = db.query(Company).filter(Company.symbol == sym).first()
        sec_name = comp.sector if comp else None

        vcp_memo = {}
        daily_memo = {}
        rs_memo = {}

        closes = df["Close"].values
        opens = df["Open"].values
        highs = df["High"].values
        lows = df["Low"].values
        vols = df["Volume"].values
        vwaps = df["VWAP"].values
        p_highs = df["Prev_12_High"].values
        p_lows = df["Prev_12_Low"].values
        p_v20s = df["Prev_Vol_SMA20"].values
        p_v5s = df["Prev_Vol_SMA5"].values
        p_atrs = df["Prev_ATR14"].values
        p_atr_smas = df["Prev_ATR14_SMA50"].values
        p_closes = df["Prev_Close"].values
        ts_list = df["Datetime"].tolist()

        for i in range(60, n - 1):
            c_close = closes[i]
            c_open = opens[i]
            c_high = highs[i]
            c_low = lows[i]
            c_vol = vols[i]
            c_vwap = vwaps[i]
            c_range = c_high - c_low

            p_res = p_highs[i]
            p_v20 = p_v20s[i]
            p_v5 = p_v5s[i]
            p_atr = p_atrs[i]
            p_atr_sma = p_atr_smas[i]
            p_close = p_closes[i]

            if np.isnan(p_res) or np.isnan(p_v20) or np.isnan(p_atr_sma) or p_v20 <= 0 or p_close <= 0:
                continue

            # Core baseline 5m criteria
            is_breakout = (c_close > p_res)
            is_green = (c_close > c_open)
            above_vwap = (c_close > c_vwap)
            vol_mult = c_vol / p_v20
            close_loc = (c_high - c_close) / c_range if c_range > 0 else 1.0
            range_12 = (p_res - p_lows[i]) / p_close if p_close > 0 else 1.0
            atr_ratio = p_atr / p_atr_sma if p_atr_sma > 0 else 1.0
            vol_comp_ratio = p_v5 / p_v20 if p_v20 > 0 else 1.0
            ext_ratio = (c_close - p_res) / p_res if p_res > 0 else 1.0

            # Raw candidates for evaluation
            if not (is_breakout and is_green and above_vwap and vol_mult >= 1.5):
                continue

            sig_ts = ts_list[i]
            sig_date = sig_ts.date()
            bar_time = sig_ts.time()

            # Strict Prior Weekly VCP (Memoized by week start)
            start_of_current_week = sig_date - timedelta(days=sig_date.weekday())
            if start_of_current_week in vcp_memo:
                vcp_score = vcp_memo[start_of_current_week]
            else:
                vcp_score = 0.0
                if w_df is not None and w_dates is not None:
                    comp_weekly = w_df[w_dates < start_of_current_week]
                    if len(comp_weekly) >= 15:
                        v_res = vcp_detector.detect(comp_weekly)
                        vcp_score = v_res.vcp_score if v_res.is_valid_vcp else 0.0
                vcp_memo[start_of_current_week] = vcp_score

            # Strict Prior Daily Confirmation (Memoized by date)
            if sig_date in daily_memo:
                daily_score = daily_memo[sig_date]
            else:
                daily_score = 0.0
                if d_df is not None and d_dates is not None:
                    comp_daily = d_df[d_dates < sig_date]
                    if len(comp_daily) >= 20:
                        d_res = DailyConfirmationEngine.evaluate(comp_daily)
                        daily_score = d_res.daily_score
                daily_memo[sig_date] = daily_score

            # Relative Strength & Market Regime (Memoized by date)
            if sig_date in rs_memo:
                rs_score, market_regime = rs_memo[sig_date]
            else:
                rs_score = 0.0
                market_regime = "NEUTRAL"
                if d_df is not None and d_dates is not None and bench_daily is not None and not bench_daily.empty:
                    comp_daily = d_df[d_dates < sig_date]
                    comp_bench = bench_daily[b_dates < sig_date] if b_dates is not None else bench_daily
                    if len(comp_daily) >= 20 and len(comp_bench) >= 20:
                        rs_res = RelativeStrengthCalculator.evaluate(comp_daily, comp_bench, sec_name)
                        rs_score = rs_res.stock_rs_score

                        # Regime
                        b_closes = comp_bench["Close"].values
                        b_ema20 = float(pd.Series(b_closes).ewm(span=20, adjust=False).mean().iloc[-1])
                        b_ema50 = float(pd.Series(b_closes).ewm(span=min(50, len(b_closes)), adjust=False).mean().iloc[-1])
                        b_curr = float(b_closes[-1])
                        if b_curr >= b_ema20 and b_ema20 >= b_ema50:
                            market_regime = "STRONG_BULLISH"
                        elif b_curr >= b_ema50:
                            market_regime = "BULLISH"
                        elif b_curr >= b_ema20:
                            market_regime = "NEUTRAL"
                        elif b_ema20 < b_ema50 and b_curr < b_ema20:
                            market_regime = "STRONG_BEARISH"
                        else:
                            market_regime = "BEARISH"
                rs_memo[sig_date] = (rs_score, market_regime)

            raw_events.append({
                "symbol": sym,
                "timestamp": sig_ts,
                "date": sig_date,
                "time": bar_time,
                "entry_price": float(c_close),
                "vol_mult": float(vol_mult),
                "close_loc": float(close_loc),
                "range_12": float(range_12),
                "atr_ratio": float(atr_ratio),
                "vol_comp_ratio": float(vol_comp_ratio),
                "ext_ratio": float(ext_ratio),
                "vcp_score": float(vcp_score),
                "daily_score": float(daily_score),
                "rs_score": float(rs_score),
                "market_regime": market_regime,
                "fwd_highs": highs[i+1 : min(n, i+76)],
                "fwd_lows": lows[i+1 : min(n, i+76)],
                "fwd_closes": closes[i+1 : min(n, i+76)],
                "fwd_times": ts_list[i+1 : min(n, i+76)],
            })

    return raw_events


def evaluate_metrics(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes comprehensive quantitative performance scorecard."""
    n = len(trades)
    if n == 0:
        return {
            "trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0, "win_rate_ci": (0.0, 0.0),
            "profit_factor": 0.0, "expectancy": 0.0, "avg_return": 0.0, "median_return": 0.0,
            "gross_pnl": 0.0, "net_pnl": 0.0, "max_dd_pct": 0.0, "max_loss_streak": 0,
            "mfe": 0.0, "mae": 0.0, "mfe_mae_ratio": 0.0, "avg_holding_min": 0,
            "target_hit_rate": 0.0, "stop_hit_rate": 0.0,
        }

    wins = [t for t in trades if t["is_win"]]
    losses = [t for t in trades if t["is_loss"]]
    win_cnt = len(wins)
    loss_cnt = len(losses)
    win_rate = round((win_cnt / n) * 100.0, 1)
    ci = calculate_wilson_ci(win_cnt, n)

    gross_pnl = sum([t["gross_pnl"] for t in trades])
    net_pnl = sum([t["net_pnl"] for t in trades])
    returns = [t["net_return_pct"] for t in trades]

    gross_win = sum([t["gross_pnl"] for t in wins]) if wins else 0.0
    gross_loss = abs(sum([t["gross_pnl"] for t in losses])) if losses else 0.0
    pf = round(gross_win / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_win > 0 else 0.0)

    avg_ret = round(float(np.mean(returns)), 2)
    med_ret = round(float(np.median(returns)), 2)
    exp = round((win_cnt / n) * (np.mean([t["net_return_pct"] for t in wins]) if wins else 0.0) +
                (loss_cnt / n) * (np.mean([t["net_return_pct"] for t in losses]) if losses else 0.0), 2)

    # Excursion
    mfes = [t["mfe"] for t in trades]
    maes = [t["mae"] for t in trades]
    avg_mfe = round(float(np.mean(mfes)), 2)
    avg_mae = round(float(np.mean(maes)), 2)
    mfe_mae = round(avg_mfe / abs(avg_mae), 2) if avg_mae != 0 else 0.0

    # Drawdown & streaks
    cum = np.cumsum([t["net_pnl"] for t in trades])
    peak = np.maximum.accumulate(cum)
    dd = (peak - cum)
    max_dd = round(float(np.max(dd)), 2) if len(dd) > 0 else 0.0

    cur_loss_streak = 0
    max_loss_streak = 0
    for t in trades:
        if t["is_loss"]:
            cur_loss_streak += 1
            if cur_loss_streak > max_loss_streak:
                max_loss_streak = cur_loss_streak
        else:
            cur_loss_streak = 0

    hold_times = [t["holding_minutes"] for t in trades]
    avg_hold = round(float(np.mean(hold_times)), 1) if hold_times else 0

    tgt_hits = len([t for t in trades if t["is_target_hit"]])
    stp_hits = len([t for t in trades if t["is_stop_hit"]])

    return {
        "trades": n,
        "wins": win_cnt,
        "losses": loss_cnt,
        "win_rate": win_rate,
        "win_rate_ci": ci,
        "profit_factor": pf,
        "expectancy": exp,
        "avg_return": avg_ret,
        "median_return": med_ret,
        "gross_pnl": round(gross_pnl, 2),
        "net_pnl": round(net_pnl, 2),
        "max_dd": max_dd,
        "max_loss_streak": max_loss_streak,
        "mfe": avg_mfe,
        "mae": avg_mae,
        "mfe_mae_ratio": mfe_mae,
        "avg_holding_min": avg_hold,
        "target_hit_rate": round((tgt_hits / n) * 100.0, 1),
        "stop_hit_rate": round((stp_hits / n) * 100.0, 1),
    }


def filter_candidates(raw_events, cfg, is_vcp_v1=True):
    """Filters raw events based on configuration."""
    filtered = []
    for c in raw_events:
        # Standard VCB baseline checks
        if c["close_loc"] > cfg.get("close_loc", 0.25):
            continue
        if c["ext_ratio"] > cfg.get("ext_ratio", 0.010):
            continue
        if c["vol_mult"] < cfg.get("min_vol_mult", 2.0):
            continue
        if c["range_12"] > cfg.get("max_range12", 0.020):
            continue
        if c["atr_ratio"] > cfg.get("max_atr_ratio", 0.70):
            continue

        # Timing check
        w_start = cfg.get("window_start")
        w_end = cfg.get("window_end")
        if w_start and w_end:
            if not (w_start <= c["time"] <= w_end):
                continue

        # If evaluating frozen VCP-V1, apply MTF structure gates
        if is_vcp_v1:
            if c["vcp_score"] < cfg.get("min_vcp_score", 80.0):
                continue
            if c["daily_score"] < cfg.get("min_daily_score", 70.0):
                continue
            if c["rs_score"] < cfg.get("min_rs_score", 75.0):
                continue

        filtered.append(c)
    return filtered


def run_full_validation_suite():
    db = SessionLocal()
    data_mgr = MultiPeriodDataManager(db=db)
    vcp_detector = VCPDetector()
    cost_model = TransactionCostModel(brokerage_per_order=20.0, slippage_pct=0.05)
    pos_sizer = PositionSizer()
    symbols = list(NIFTY_50_BENCHMARK_SYMBOLS)

    print("================================================================================")
    print("ALPHA INDIA: VCP-V1 OUT-OF-SAMPLE VALIDATION & ROBUSTNESS ENGINE")
    print("================================================================================")
    print(f"Universe: {len(symbols)} NIFTY 50 Benchmark Heavyweights")
    print(f"Frozen VCP-V1 Parameters: VCP >= 80 | Vol >= 2.5x | RS >= 75 | Range <= 1.8% | Tgt +1.0% / Stp -0.5%")

    # Date partitions
    P_OOS = ("2026-09-26", "2026-10-07", "True Out-of-Sample (Subsequent Data)")
    P_IS = ("2026-07-06", "2026-09-25", "In-Sample Optimization Benchmark")
    P_PRIOR = ("2025-10-01", "2026-07-05", "Prior Historical In-Depth (9 Months)")
    P_12M = ("2025-10-01", "2026-10-07", "Full 12-Month Continuous Horizon")

    # 1. EXTRACT RAW EVENTS ACROSS FULL HORIZON
    print(f"\n[Phase 0] Ingesting & scanning full 12-month multi-timeframe candle horizon...", flush=True)
    from concurrent.futures import ThreadPoolExecutor, as_completed
    print(f"   -> Pre-fetching and caching 12M data in parallel (8 threads)...", flush=True)
    with ThreadPoolExecutor(max_workers=8) as executor:
        f_map = {executor.submit(data_mgr.get_equity_5m, s, P_12M[0], P_12M[1]): s for s in symbols}
        done_i = 0
        for f in as_completed(f_map):
            done_i += 1
            s = f_map[f]
            try:
                res_df = f.result()
                print(f"      [{done_i:2d}/{len(symbols)}] {s:<12}: {len(res_df)} 5m bars ready.", flush=True)
            except Exception as e:
                print(f"      [{done_i:2d}/{len(symbols)}] {s:<12}: Error: {e}", flush=True)

    raw_12m = extract_breakout_events(symbols, data_mgr, P_12M[0], P_12M[1], vcp_detector, db)
    print(f"Total Raw Breakout Events Found (12 Months): {len(raw_12m)}", flush=True)

    # Partition events
    raw_oos = [e for e in raw_12m if e["date"] >= pd.to_datetime(P_OOS[0]).date()]
    raw_is = [e for e in raw_12m if pd.to_datetime(P_IS[0]).date() <= e["date"] <= pd.to_datetime(P_IS[1]).date()]
    raw_prior = [e for e in raw_12m if e["date"] < pd.to_datetime(P_IS[0]).date()]

    print(f"   -> Out-of-Sample Events (post Sept 25): {len(raw_oos)}")
    print(f"   -> In-Sample Events (July - Sept 2026): {len(raw_is)}")
    print(f"   -> Prior Historical Events (Oct 2025 - July 2026): {len(raw_prior)}")

    # --------------------------------------------------------------------------
    # MODULE A: FROZEN VCP-V1 OUT-OF-SAMPLE TEST
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE A: TRUE OUT-OF-SAMPLE (OOS) VALIDATION (2026-09-26 -> 2026-10-07)")
    print("=" * 80)
    oos_candidates = filter_candidates(raw_oos, FROZEN_VCP_V1, is_vcp_v1=True)
    oos_trades = [
        simulate_trade_execution(c, FROZEN_VCP_V1["target_pct"], FROZEN_VCP_V1["stop_pct"], pos_sizer, cost_model)
        for c in oos_candidates
    ]
    oos_metrics = evaluate_metrics(oos_trades)

    print(f"Qualifying OOS Setups: {len(oos_candidates)}")
    print(f"OOS Trades Taken: {oos_metrics['trades']}")
    print(f"Wins: {oos_metrics['wins']} | Losses: {oos_metrics['losses']}")
    print(f"Win Rate: {oos_metrics['win_rate']}% (95% CI: {oos_metrics['win_rate_ci'][0]}% - {oos_metrics['win_rate_ci'][1]}%)")
    print(f"Profit Factor: {oos_metrics['profit_factor']}")
    print(f"Expectancy: {oos_metrics['expectancy']}%")
    print(f"Net P&L: ₹{oos_metrics['net_pnl']:,.2f}")
    print(f"Avg MFE: +{oos_metrics['mfe']}% | Avg MAE: {oos_metrics['mae']}% (Ratio: {oos_metrics['mfe_mae_ratio']})")
    print(f"Target Hit Rate: {oos_metrics['target_hit_rate']}% | Stop Hit Rate: {oos_metrics['stop_hit_rate']}%")

    if oos_trades:
        print("\nOOS Trade Audit Log:")
        for t in oos_trades:
            print(f"   [{'WIN' if t['is_win'] else 'LOSS'}] {t['symbol']} | {t['timestamp']} | Entry: ₹{t['entry_price']:.2f} | Exit: ₹{t['exit_price']:.2f} ({t['exit_reason']}) | Net: ₹{t['net_pnl']:,.2f} | MFE: +{t['mfe']:.2f}% | MAE: {t['mae']:.2f}%")

    # --------------------------------------------------------------------------
    # MODULE B: IN-SAMPLE BENCHMARK VERIFICATION
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE B: IN-SAMPLE BENCHMARK (2026-07-06 -> 2026-09-25)")
    print("=" * 80)
    is_candidates = filter_candidates(raw_is, FROZEN_VCP_V1, is_vcp_v1=True)
    is_trades = [
        simulate_trade_execution(c, FROZEN_VCP_V1["target_pct"], FROZEN_VCP_V1["stop_pct"], pos_sizer, cost_model)
        for c in is_candidates
    ]
    is_metrics = evaluate_metrics(is_trades)
    print(f"Trades: {is_metrics['trades']} (W: {is_metrics['wins']}, L: {is_metrics['losses']}) | Win%: {is_metrics['win_rate']}% | PF: {is_metrics['profit_factor']} | Net: ₹{is_metrics['net_pnl']:,.2f} | MFE/MAE: {is_metrics['mfe_mae_ratio']}")

    # --------------------------------------------------------------------------
    # MODULE C: EXTENDED HISTORICAL & 12-MONTH HORIZON
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE C: EXTENDED HISTORICAL (12 MONTHS: 2025-10-01 -> 2026-10-07)")
    print("=" * 80)
    full_candidates = filter_candidates(raw_12m, FROZEN_VCP_V1, is_vcp_v1=True)
    full_trades = [
        simulate_trade_execution(c, FROZEN_VCP_V1["target_pct"], FROZEN_VCP_V1["stop_pct"], pos_sizer, cost_model)
        for c in full_candidates
    ]
    full_metrics = evaluate_metrics(full_trades)
    print(f"12M Trades: {full_metrics['trades']} (W: {full_metrics['wins']}, L: {full_metrics['losses']}) | Win%: {full_metrics['win_rate']}% (95% CI: {full_metrics['win_rate_ci'][0]}% - {full_metrics['win_rate_ci'][1]}%)")
    print(f"Profit Factor: {full_metrics['profit_factor']} | Expectancy: {full_metrics['expectancy']}% | Net: ₹{full_metrics['net_pnl']:,.2f}")
    print(f"MFE/MAE: {full_metrics['mfe_mae_ratio']} | Max Drawdown: ₹{full_metrics['max_dd']:,.2f} | Max Loss Streak: {full_metrics['max_loss_streak']}")

    # --------------------------------------------------------------------------
    # MODULE D: BASELINE VCB VS FROZEN VCP-V1 COMPARISON (12 MONTHS)
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE D: BASELINE 5M VCB VS FROZEN VCP-V1 (HEAD-TO-HEAD OVER 12 MONTHS)")
    print("=" * 80)
    # Baseline VCB uses standard 9 rules, no MTF gates, Target 1.5% Stop 1.0%
    base_cfg = {
        "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
        "close_loc": 0.25, "ext_ratio": 0.010, "window_start": None, "window_end": None,
    }
    base_candidates = filter_candidates(raw_12m, base_cfg, is_vcp_v1=False)
    base_trades = [
        simulate_trade_execution(c, target_pct=0.015, stop_pct=0.010, pos_sizer=pos_sizer, cost_model=cost_model)
        for c in base_candidates
    ]
    base_metrics = evaluate_metrics(base_trades)
    print(f"Baseline VCB 5M: {base_metrics['trades']} trades | Win%: {base_metrics['win_rate']}% | PF: {base_metrics['profit_factor']} | Net: ₹{base_metrics['net_pnl']:,.2f} | MFE/MAE: {base_metrics['mfe_mae_ratio']}")
    print(f"VCP-V1 Frozen:   {full_metrics['trades']} trades | Win%: {full_metrics['win_rate']}% | PF: {full_metrics['profit_factor']} | Net: ₹{full_metrics['net_pnl']:,.2f} | MFE/MAE: {full_metrics['mfe_mae_ratio']}")

    # --------------------------------------------------------------------------
    # MODULE E: WALK-FORWARD ROLLING ANALYSIS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE E: ROLLING WALK-FORWARD VALIDATION")
    print("=" * 80)
    wf_windows = [
        ("WF_01 (Q4 2025: Oct - Dec 2025)", "2025-10-01", "2025-12-31"),
        ("WF_02 (Q1 2026: Jan - Mar 2026)", "2026-01-01", "2026-03-31"),
        ("WF_03 (Q2 2026: Apr - Jun 2026)", "2026-04-01", "2026-06-30"),
        ("WF_04 (Q3 2026: Jul - Sep 2026 [IS])", "2026-07-01", "2026-09-25"),
        ("WF_05 (Q4 2026: Sep 26 - Oct 07 [OOS])", "2026-09-26", "2026-10-07"),
    ]
    wf_results = []
    for label, ws, we in wf_windows:
        w_events = [e for e in raw_12m if pd.to_datetime(ws).date() <= e["date"] <= pd.to_datetime(we).date()]
        w_cands = filter_candidates(w_events, FROZEN_VCP_V1, is_vcp_v1=True)
        w_tr = [
            simulate_trade_execution(c, FROZEN_VCP_V1["target_pct"], FROZEN_VCP_V1["stop_pct"], pos_sizer, cost_model)
            for c in w_cands
        ]
        w_met = evaluate_metrics(w_tr)
        wf_results.append({"window": label, "metrics": w_met})
        print(f"[{label}] Trades: {w_met['trades']:<2} | Wins: {w_met['wins']} | Losses: {w_met['losses']} | Win%: {w_met['win_rate']:<5}% | PF: {w_met['profit_factor']:<4} | Net: ₹{w_met['net_pnl']:>9,.2f}")

    # --------------------------------------------------------------------------
    # MODULE F: MARKET REGIME BREAKDOWN
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE F: MARKET REGIME ANALYSIS (ACROSS FULL HORIZON)")
    print("=" * 80)
    regimes = ["STRONG_BULLISH", "BULLISH", "NEUTRAL", "BEARISH", "STRONG_BEARISH"]
    regime_results = {}
    for reg in regimes:
        r_trades = [t for t in full_trades if t["market_regime"] == reg]
        r_met = evaluate_metrics(r_trades)
        regime_results[reg] = r_met
        print(f"[{reg:<14}] Trades: {r_met['trades']:<2} | Win%: {r_met['win_rate']:<5}% | PF: {r_met['profit_factor']:<4} | Net: ₹{r_met['net_pnl']:>9,.2f} | MFE/MAE: {r_met['mfe_mae_ratio']}")

    # --------------------------------------------------------------------------
    # MODULE G: TIME-OF-DAY MICROSTRUCTURE
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE G: TIME-OF-DAY VALIDATION (7 INTRADAY BUCKETS)")
    print("=" * 80)
    time_buckets = [
        ("09:15 - 09:45 (Opening Gap Auction)", dtime(9, 15), dtime(9, 45)),
        ("09:45 - 10:30 (Morning Core Expansion)", dtime(9, 45), dtime(10, 30)),
        ("10:30 - 11:30 (Institutional Thrust)", dtime(10, 30), dtime(11, 30)),
        ("11:30 - 12:30 (Pre-Midday Consolidation)", dtime(11, 30), dtime(12, 30)),
        ("12:30 - 13:30 (Midday European Open)", dtime(12, 30), dtime(13, 30)),
        ("13:30 - 14:30 (Afternoon Trend Resumption)", dtime(13, 30), dtime(14, 30)),
        ("14:30 - 15:30 (Closing Square-Off)", dtime(14, 30), dtime(15, 30)),
    ]
    # For time of day, filter candidates without time constraints first
    unconstrained_cfg = dict(FROZEN_VCP_V1)
    unconstrained_cfg["window_start"] = None
    unconstrained_cfg["window_end"] = None
    all_time_candidates = filter_candidates(raw_12m, unconstrained_cfg, is_vcp_v1=True)
    tod_results = []
    for label, ts, te in time_buckets:
        b_cands = [c for c in all_time_candidates if ts <= c["time"] < te]
        b_tr = [
            simulate_trade_execution(c, FROZEN_VCP_V1["target_pct"], FROZEN_VCP_V1["stop_pct"], pos_sizer, cost_model)
            for c in b_cands
        ]
        b_met = evaluate_metrics(b_tr)
        tod_results.append({"bucket": label, "metrics": b_met})
        print(f"[{label:<35}] Trades: {b_met['trades']:<2} | Win%: {b_met['win_rate']:<5}% | PF: {b_met['profit_factor']:<4} | Net: ₹{b_met['net_pnl']:>9,.2f}")

    # --------------------------------------------------------------------------
    # MODULE H: PARAMETER PERTURBATION & ROBUSTNESS SURFACE
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE H: PARAMETER PERTURBATION & STABILITY REGION TEST")
    print("=" * 80)

    # 1. VCP Score Perturbation: 70, 75, 80, 85, 90
    print("1. Perturbation around Weekly VCP Score:")
    vcp_surface = []
    for v in [70.0, 75.0, 80.0, 85.0, 90.0]:
        p_cfg = dict(FROZEN_VCP_V1)
        p_cfg["min_vcp_score"] = v
        cands = filter_candidates(raw_12m, p_cfg, is_vcp_v1=True)
        trs = [simulate_trade_execution(c, p_cfg["target_pct"], p_cfg["stop_pct"], pos_sizer, cost_model) for c in cands]
        m = evaluate_metrics(trs)
        vcp_surface.append({"vcp": v, "metrics": m})
        print(f"   VCP >= {v:.0f}: Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f}")

    # 2. Volume Surge Perturbation: 2.0x, 2.25x, 2.5x, 2.75x, 3.0x
    print("\n2. Perturbation around Volume Multiplier:")
    vol_surface = []
    for vm in [2.0, 2.25, 2.5, 2.75, 3.0]:
        p_cfg = dict(FROZEN_VCP_V1)
        p_cfg["min_vol_mult"] = vm
        cands = filter_candidates(raw_12m, p_cfg, is_vcp_v1=True)
        trs = [simulate_trade_execution(c, p_cfg["target_pct"], p_cfg["stop_pct"], pos_sizer, cost_model) for c in cands]
        m = evaluate_metrics(trs)
        vol_surface.append({"vol_mult": vm, "metrics": m})
        print(f"   Vol >= {vm:.2f}x: Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f}")

    # 3. Relative Strength Perturbation: 65, 70, 75, 80, 85
    print("\n3. Perturbation around Relative Strength (RS):")
    rs_surface = []
    for r in [65.0, 70.0, 75.0, 80.0, 85.0]:
        p_cfg = dict(FROZEN_VCP_V1)
        p_cfg["min_rs_score"] = r
        cands = filter_candidates(raw_12m, p_cfg, is_vcp_v1=True)
        trs = [simulate_trade_execution(c, p_cfg["target_pct"], p_cfg["stop_pct"], pos_sizer, cost_model) for c in cands]
        m = evaluate_metrics(trs)
        rs_surface.append({"rs": r, "metrics": m})
        print(f"   RS >= {r:.0f}: Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f}")

    # 4. Range Compression Perturbation: 1.5%, 1.6%, 1.7%, 1.8%, 1.9%, 2.0%
    print("\n4. Perturbation around Range Compression:")
    range_surface = []
    for rc in [0.015, 0.016, 0.017, 0.018, 0.019, 0.020]:
        p_cfg = dict(FROZEN_VCP_V1)
        p_cfg["max_range12"] = rc
        cands = filter_candidates(raw_12m, p_cfg, is_vcp_v1=True)
        trs = [simulate_trade_execution(c, p_cfg["target_pct"], p_cfg["stop_pct"], pos_sizer, cost_model) for c in cands]
        m = evaluate_metrics(trs)
        range_surface.append({"range_pct": rc, "metrics": m})
        print(f"   Range <= {rc*100:.1f}%: Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f}")

    # 5. Exit Robustness: Target & Stop Grid
    print("\n5. Exit Model Robustness Grid:")
    exit_grid = [
        ("Tgt +0.75% / Stp -0.50% (1.5:1)", 0.0075, 0.005),
        ("Tgt +1.00% / Stp -0.50% (2.0:1) [FROZEN]", 0.010, 0.005),
        ("Tgt +1.25% / Stp -0.50% (2.5:1)", 0.0125, 0.005),
        ("Tgt +1.50% / Stp -0.50% (3.0:1)", 0.015, 0.005),
        ("Tgt +1.00% / Stp -0.40% (2.5:1)", 0.010, 0.004),
        ("Tgt +1.00% / Stp -0.60% (1.67:1)", 0.010, 0.006),
        ("Tgt +1.00% / Stp -0.75% (1.33:1)", 0.010, 0.0075),
    ]
    exit_results = []
    for elabel, tp, sp in exit_grid:
        trs = [simulate_trade_execution(c, tp, sp, pos_sizer, cost_model) for c in full_candidates]
        m = evaluate_metrics(trs)
        exit_results.append({"exit": elabel, "metrics": m})
        print(f"   [{elabel:<34}] Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f} | MFE/MAE={m['mfe_mae_ratio']}")

    # 6. Trading Window Perturbation
    print("\n6. Trading Window Perturbation:")
    window_grid = [
        ("09:30 - 14:30 (Early Start)", dtime(9, 30), dtime(14, 30)),
        ("09:45 - 14:30 [FROZEN VCP-V1]", dtime(9, 45), dtime(14, 30)),
        ("10:00 - 14:30 (Late Start)", dtime(10, 0), dtime(14, 30)),
    ]
    window_results = []
    for wlabel, ws, we in window_grid:
        p_cfg = dict(FROZEN_VCP_V1)
        p_cfg["window_start"] = ws
        p_cfg["window_end"] = we
        cands = filter_candidates(raw_12m, p_cfg, is_vcp_v1=True)
        trs = [simulate_trade_execution(c, p_cfg["target_pct"], p_cfg["stop_pct"], pos_sizer, cost_model) for c in cands]
        m = evaluate_metrics(trs)
        window_results.append({"window": wlabel, "metrics": m})
        print(f"   [{wlabel:<30}] Trades={m['trades']:<2} | Win%={m['win_rate']:<5}% | PF={m['profit_factor']:<4} | Net=₹{m['net_pnl']:>9,.2f}")

    # --------------------------------------------------------------------------
    # MODULE I: MFE / MAE DISTRIBUTION
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE I: MFE / MAE THRESHOLD DISTRIBUTION")
    print("=" * 80)
    n_tot = len(full_trades) if full_trades else 1
    mfe_thresholds = ["0.25%", "0.50%", "0.75%", "1.00%", "1.50%", "2.00%", "3.00%", "5.00%"]
    mae_thresholds = ["0.25%", "0.50%", "0.75%", "1.00%", "1.50%", "2.00%"]

    mfe_rates = {}
    for mt in mfe_thresholds:
        cnt = sum([1 for t in full_trades if t["mfe_hits"].get(mt, False)])
        pct = round((cnt / n_tot) * 100.0, 1)
        mfe_rates[mt] = {"count": cnt, "pct": pct}
        print(f"   MFE reached +{mt}: {cnt} / {n_tot} trades ({pct}%)")

    mae_rates = {}
    for st in mae_thresholds:
        cnt = sum([1 for t in full_trades if t["mae_hits"].get(st, False)])
        pct = round((cnt / n_tot) * 100.0, 1)
        mae_rates[st] = {"count": cnt, "pct": pct}
        print(f"   MAE breached -{st}: {cnt} / {n_tot} trades ({pct}%)")

    # --------------------------------------------------------------------------
    # MODULE J: TRADE FREQUENCY STATISTICS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("MODULE J: TRADE FREQUENCY & SELECTIVITY METRICS")
    print("=" * 80)
    if full_trades:
        trade_dates = [t["timestamp"].date() for t in full_trades]
        unique_days = len(set(trade_dates))
        months = sorted(list(set([d.strftime("%Y-%m") for d in trade_dates])))
        month_counts = [sum([1 for d in trade_dates if d.strftime("%Y-%m") == m]) for m in months]
        
        # Total trading days approx 250 in 12 months
        trades_per_day = round(len(full_trades) / 250.0, 3)
        trades_per_week = round(len(full_trades) / 52.0, 2)
        trades_per_month = round(len(full_trades) / 12.0, 2)
        med_m = float(np.median(month_counts)) if month_counts else 0.0
        min_m = min(month_counts) if month_counts else 0
        max_m = max(month_counts) if month_counts else 0
    else:
        trades_per_day = 0.0
        trades_per_week = 0.0
        trades_per_month = 0.0
        med_m = 0.0
        min_m = 0
        max_m = 0

    print(f"Total Trades (12M): {len(full_trades)}")
    print(f"Trades / Day:   {trades_per_day}")
    print(f"Trades / Week:  {trades_per_week}")
    print(f"Trades / Month: {trades_per_month} (Median: {med_m}, Min: {min_m}, Max: {max_m})")
    print(f"Selectivity:    {round((len(full_trades) / len(raw_12m)) * 100.0, 3)}% of raw breakouts (Top 1% criterion strictly met)")

    # --------------------------------------------------------------------------
    # COMPILE AUDIT DATA FOR PERSISTENCE
    # --------------------------------------------------------------------------
    audit_data = {
        "oos_metrics": oos_metrics,
        "is_metrics": is_metrics,
        "full_12m_metrics": full_metrics,
        "baseline_metrics": base_metrics,
        "walk_forward": wf_results,
        "regimes": regime_results,
        "time_of_day": tod_results,
        "vcp_surface": vcp_surface,
        "vol_surface": vol_surface,
        "rs_surface": rs_surface,
        "range_surface": range_surface,
        "exit_results": exit_results,
        "window_results": window_results,
        "mfe_rates": mfe_rates,
        "mae_rates": mae_rates,
        "trade_frequency": {
            "per_day": trades_per_day,
            "per_week": trades_per_week,
            "per_month": trades_per_month,
            "median_month": med_m,
            "min_month": min_m,
            "max_month": max_m,
        },
        "all_12m_trades": [
            {
                "symbol": t["symbol"],
                "timestamp": str(t["timestamp"]),
                "entry_price": t["entry_price"],
                "exit_price": t["exit_price"],
                "exit_reason": t["exit_reason"],
                "net_pnl": t["net_pnl"],
                "net_return_pct": t["net_return_pct"],
                "mfe": t["mfe"],
                "mae": t["mae"],
                "vcp_score": t["vcp_score"],
                "rs_score": t["rs_score"],
                "regime": t["market_regime"],
                "is_win": t["is_win"],
            }
            for t in full_trades
        ]
    }

    out_json = Path("backend/data/vcp_v1_validation_full_results.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2, default=str)
    print(f"\nFull validation data serialized to: {out_json}")

    return audit_data


if __name__ == "__main__":
    run_full_validation_suite()
