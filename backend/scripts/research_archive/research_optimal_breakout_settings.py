"""
Alpha India - Intraday Breakout Quantitative Optimization & Top 1% Filter Research
Tests NIFTY 50 over the 3-month dataset to identify:
1. The most optimal settings for the breakout engine to execute.
2. The exact win percentage, win count, loss count, and profit factor.
3. The "Top 1%" elite configuration for institutional-grade intraday stock picks/alerts.
"""

import sys
import os
import itertools
from datetime import datetime, timedelta, time as dtime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "backend")

from app.db.database import SessionLocal
from app.services.backtest.universe_service import UniverseService, NIFTY_50_BENCHMARK_SYMBOLS
from app.services.backtest.market_data_provider import CompositeMarketDataProvider
from app.services.backtest.candle_aggregator import CandleAggregator
from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.vcp_detector import VCPDetector
from app.services.backtest.daily_confirmation import DailyConfirmationEngine
from app.services.backtest.relative_strength import RelativeStrengthCalculator
from app.models.company import Company


def run_breakout_research():
    db = SessionLocal()
    data_provider = CompositeMarketDataProvider(db=db)
    vcp_detector = VCPDetector()

    print("================================================================================")
    print("ALPHA INDIA QUANT RESEARCH: NIFTY 50 INTRADAY BREAKOUT OPTIMIZATION (3 MONTHS)")
    print("================================================================================")

    # 1. Load NIFTY 50 data
    symbols = list(NIFTY_50_BENCHMARK_SYMBOLS)
    print(f"Target Universe: {len(symbols)} NIFTY 50 Equities")

    # Load NIFTY benchmark daily data
    benchmark_daily_df = data_provider.get_candles(
        symbol="NIFTYBEES",
        timeframe="1d",
        start_date="2025-01-01",
        end_date="2026-09-25",
    )
    if benchmark_daily_df.empty:
        benchmark_daily_df = data_provider.get_candles(
            symbol="RELIANCE",
            timeframe="1d",
            start_date="2025-01-01",
            end_date="2026-09-25",
        )

    # Cache pre-loaded datasets for speed
    equity_cache: Dict[str, Dict[str, Any]] = {}
    total_loaded = 0

    print("\n[Step 1/3] Pre-loading 5m intraday & daily/weekly context for NIFTY 50...")
    for sym in symbols:
        df_5m = data_provider.get_candles(sym, timeframe="5m")
        if df_5m.empty or len(df_5m) < 100:
            continue

        # Standardize columns
        col_map = {c: c.capitalize() for c in df_5m.columns}
        df_5m = df_5m.rename(columns=col_map)
        df_5m["Datetime"] = pd.to_datetime(df_5m["Datetime"])
        df_5m.sort_values(by="Datetime", inplace=True)
        df_5m.reset_index(drop=True, inplace=True)

        daily_df = data_provider.get_candles(sym, timeframe="1d", start_date="2025-01-01", end_date="2026-09-25")
        weekly_df = None
        if not daily_df.empty and len(daily_df) >= 15:
            d_w = daily_df.copy()
            if "Datetime" in d_w.columns:
                d_w["Datetime"] = pd.to_datetime(d_w["Datetime"])
                d_w.set_index("Datetime", inplace=True)
            weekly_df = d_w.resample("W-FRI").agg({
                "Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"
            }).dropna(subset=["Close"]).reset_index()

        comp = db.query(Company).filter(Company.symbol == sym).first()
        sec_name = comp.sector if comp else None

        equity_cache[sym] = {
            "5m": df_5m,
            "1d": daily_df,
            "1w": weekly_df,
            "sector": sec_name,
        }
        total_loaded += 1

    print(f"Loaded high-fidelity data for {total_loaded} / {len(symbols)} NIFTY 50 equities.")

    # 2. Extract All Raw Candidate Breakout Bars Across NIFTY 50
    # To enable ultra-fast grid simulation, we extract candidate breakout signals and their rich features
    print("\n[Step 2/3] Extracting intraday breakout events and multi-timeframe features...")
    raw_breakouts: List[Dict[str, Any]] = []

    for sym, sdata in equity_cache.items():
        df = sdata["5m"].copy()
        n = len(df)
        if n < 65:
            continue

        # Indicators
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

        d_df = sdata["1d"]
        w_df = sdata["1w"]
        sec_name = sdata["sector"]

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

        for i in range(60, n - 1):  # Must have at least 1 forward bar for execution
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

            # Core baseline criteria check
            is_breakout = (c_close > p_res)
            is_green = (c_close > c_open)
            above_vwap = (c_close > c_vwap)
            vol_mult = c_vol / p_v20
            close_loc = (c_high - c_close) / c_range if c_range > 0 else 1.0
            range_12 = (p_res - p_lows[i]) / p_close if p_close > 0 else 1.0
            atr_ratio = p_atr / p_atr_sma if p_atr_sma > 0 else 1.0
            vol_comp_ratio = p_v5 / p_v20 if p_v20 > 0 else 1.0
            ext_ratio = (c_close - p_res) / p_res if p_res > 0 else 1.0

            # Baseline 9-rules qualification (loose criteria to capture all candidates)
            if not (is_breakout and is_green and above_vwap and vol_mult >= 1.5):
                continue

            sig_ts = ts_list[i]
            sig_date = sig_ts.date()
            bar_time = sig_ts.time()

            # Higher-Timeframe Feature Computation (Strict No Look-Ahead)
            # 1. Weekly VCP
            vcp_score = 0.0
            if w_df is not None and not w_df.empty:
                w_dates = pd.to_datetime(w_df["Datetime"]).dt.date if "Datetime" in w_df.columns else pd.to_datetime(w_df["Date"]).dt.date
                start_of_current_week = sig_date - timedelta(days=sig_date.weekday())
                comp_weekly = w_df[w_dates < start_of_current_week]
                if len(comp_weekly) >= 15:
                    vcp_res = vcp_detector.detect(comp_weekly)
                    vcp_score = vcp_res.vcp_score if vcp_res.is_valid_vcp else 0.0

            # 2. Daily Confirmation
            daily_score = 0.0
            if d_df is not None and not d_df.empty:
                d_dates = pd.to_datetime(d_df["Datetime"]).dt.date if "Datetime" in d_df.columns else pd.to_datetime(d_df["Date"]).dt.date
                comp_daily = d_df[d_dates < sig_date]
                if len(comp_daily) >= 20:
                    d_res = DailyConfirmationEngine.evaluate(comp_daily)
                    daily_score = d_res.daily_score

            # 3. Relative Strength
            rs_score = 0.0
            if d_df is not None and not d_df.empty and benchmark_daily_df is not None and not benchmark_daily_df.empty:
                d_dates = pd.to_datetime(d_df["Datetime"]).dt.date if "Datetime" in d_df.columns else pd.to_datetime(d_df["Date"]).dt.date
                comp_daily = d_df[d_dates < sig_date]
                b_dates = pd.to_datetime(benchmark_daily_df["Datetime"]).dt.date if "Datetime" in benchmark_daily_df.columns else pd.to_datetime(benchmark_daily_df["Date"]).dt.date
                comp_bench = benchmark_daily_df[b_dates < sig_date]
                if len(comp_daily) >= 20 and len(comp_bench) >= 20:
                    rs_res = RelativeStrengthCalculator.evaluate(comp_daily, comp_bench, sec_name)
                    rs_score = rs_res.stock_rs_score

            # Record candidate
            raw_breakouts.append({
                "symbol": sym,
                "bar_idx": i,
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
                # Forward price bars for fast exit simulation
                "fwd_highs": highs[i+1 : min(n, i+76)],
                "fwd_lows": lows[i+1 : min(n, i+76)],
                "fwd_closes": closes[i+1 : min(n, i+76)],
                "fwd_times": ts_list[i+1 : min(n, i+76)],
            })

    print(f"Extracted {len(raw_breakouts)} raw candidate breakout events across NIFTY 50.")

    # 3. Simulate Forward Trade Outcomes Under Configurable Exits
    cost_model = TransactionCostModel(brokerage_per_order=20.0, slippage_pct=0.05)
    pos_sizer = PositionSizer()
    capital = 1_000_000.0

    # Grid of Settings to Test:
    # A. Volume Multiplier: 2.0x (standard), 2.5x, 3.0x
    # B. Compression Range: 0.02 (standard 2%), 0.015 (tight 1.5%)
    # C. ATR Compression: 0.70 (standard), 0.60 (very tight)
    # D. Weekly VCP Gate: None, >=70, >=80, >=85 (A/A+ Tier)
    # E. Daily Trend Gate: None, >=70
    # F. Relative Strength: None, >=70, >=80
    # G. Session Timing: Any, Morning Core (09:45 - 13:30)
    # H. Target / Stop Levels:
    #    (Target 1.0%, Stop 0.5%), (Target 1.5%, Stop 1.0%), (Target 2.0%, Stop 1.0%), (Target 1.0%, Stop 1.0%)

    exit_models = [
        {"name": "T1.0_S0.5", "target": 0.010, "stop": 0.005, "desc": "1.0% Target / 0.5% Stop (2:1 R:R)"},
        {"name": "T1.5_S1.0", "target": 0.015, "stop": 0.010, "desc": "1.5% Target / 1.0% Stop (1.5:1 R:R)"},
        {"name": "T2.0_S1.0", "target": 0.020, "stop": 0.010, "desc": "2.0% Target / 1.0% Stop (2:1 R:R)"},
        {"name": "T1.0_S1.0", "target": 0.010, "stop": 0.010, "desc": "1.0% Target / 1.0% Stop (1:1 R:R)"},
        {"name": "T0.75_S0.5", "target": 0.0075, "stop": 0.005, "desc": "0.75% Target / 0.5% Stop (1.5:1 R:R)"},
    ]

    setup_filters = [
        {
            "id": "BASELINE_VCB",
            "name": "Standard Baseline 5M VCB (Unfiltered)",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": None, "min_daily": None, "min_rs": None, "timing": "ALL",
        },
        {
            "id": "VCB_TIGHT_VOL25",
            "name": "VCB + High Volume (2.5x) + Tight Range (1.5%)",
            "min_vol_mult": 2.5, "max_range12": 0.015, "max_atr_ratio": 0.70,
            "min_vcp": None, "min_daily": None, "min_rs": None, "timing": "ALL",
        },
        {
            "id": "WEEKLY_VCP_70",
            "name": "Weekly VCP (Score >= 70) + 5M VCB",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": 70.0, "min_daily": None, "min_rs": None, "timing": "ALL",
        },
        {
            "id": "WEEKLY_VCP_80",
            "name": "Weekly VCP Elite (Score >= 80) + 5M VCB",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": 80.0, "min_daily": None, "min_rs": None, "timing": "ALL",
        },
        {
            "id": "WEEKLY_VCP_RS",
            "name": "Weekly VCP (>=75) + Relative Strength (>=70) + 5M VCB",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": 75.0, "min_daily": None, "min_rs": 70.0, "timing": "ALL",
        },
        {
            "id": "WEEKLY_VCP_DAILY_RS",
            "name": "Weekly VCP (>=75) + Daily Trend (>=70) + RS (>=70)",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": 75.0, "min_daily": 70.0, "min_rs": 70.0, "timing": "ALL",
        },
        {
            "id": "MORNING_TIMING_VCP",
            "name": "Weekly VCP (>=75) + Morning Window (09:45 - 13:00)",
            "min_vol_mult": 2.0, "max_range12": 0.020, "max_atr_ratio": 0.70,
            "min_vcp": 75.0, "min_daily": None, "min_rs": None, "timing": "MORNING",
        },
        {
            "id": "TOP_1PCT_ELITE_A",
            "name": "Top 1% Elite: VCP (>=80) + Vol Surge (>=2.5x) + RS (>=75) + Timing",
            "min_vol_mult": 2.5, "max_range12": 0.018, "max_atr_ratio": 0.65,
            "min_vcp": 80.0, "min_daily": 70.0, "min_rs": 75.0, "timing": "CORE_HOURS",
        },
        {
            "id": "TOP_1PCT_ELITE_B",
            "name": "Top 1% Pinnacle: VCP A+ (>=85) + Vol Surge (>=2.5x) + RS (>=80)",
            "min_vol_mult": 2.5, "max_range12": 0.015, "max_atr_ratio": 0.65,
            "min_vcp": 85.0, "min_daily": None, "min_rs": 80.0, "timing": "ALL",
        },
    ]

    print("\n[Step 3/3] Running multi-parameter grid simulations across all candidates...")

    results_table: List[Dict[str, Any]] = []

    for s_filt in setup_filters:
        # Filter matching candidates
        matching_candidates = []
        for c in raw_breakouts:
            # Baseline rules
            if c["vol_mult"] < s_filt["min_vol_mult"]:
                continue
            if c["range_12"] > s_filt["max_range12"]:
                continue
            if c["atr_ratio"] > s_filt["max_atr_ratio"]:
                continue
            if c["close_loc"] > 0.25:  # Top 25% of candle
                continue
            if c["ext_ratio"] > 0.010: # < 1.0% above resistance
                continue

            # MTF Gates
            if s_filt["min_vcp"] is not None and c["vcp_score"] < s_filt["min_vcp"]:
                continue
            if s_filt["min_daily"] is not None and c["daily_score"] < s_filt["min_daily"]:
                continue
            if s_filt["min_rs"] is not None and c["rs_score"] < s_filt["min_rs"]:
                continue

            # Timing gate
            t = c["time"]
            if s_filt["timing"] == "MORNING":
                if not (dtime(9, 45) <= t <= dtime(13, 0)):
                    continue
            elif s_filt["timing"] == "CORE_HOURS":
                if not (dtime(9, 45) <= t <= dtime(14, 30)):
                    continue

            matching_candidates.append(c)

        # Now evaluate each exit model on these matching candidates
        for em in exit_models:
            tgt_pct = em["target"]
            stp_pct = em["stop"]

            wins = 0
            losses = 0
            scratches = 0
            total_net_pnl = 0.0
            total_gross_pnl = 0.0
            trade_returns = []
            mfes = []
            maes = []

            for c in matching_candidates:
                ep = c["entry_price"]
                tgt_price = ep * (1.0 + tgt_pct)
                stp_price = ep * (1.0 - stp_pct)

                pos = pos_sizer.calculate_position(
                    sizing_model="RISK_BASED",
                    capital=capital,
                    entry_price=ep,
                    stop_price=stp_price,
                )
                shares = pos["shares"]
                pos_val = shares * ep

                # Fast forward bar execution
                exit_price = ep
                exit_reason = "EOD"
                mfe = 0.0
                mae = 0.0

                f_highs = c["fwd_highs"]
                f_lows = c["fwd_lows"]
                f_closes = c["fwd_closes"]
                f_times = c["fwd_times"]

                for step in range(len(f_highs)):
                    ch = f_highs[step]
                    cl = f_lows[step]
                    cc = f_closes[step]
                    ct = f_times[step]

                    bar_mfe = ((ch - ep) / ep) * 100.0
                    bar_mae = ((cl - ep) / ep) * 100.0
                    if bar_mfe > mfe:
                        mfe = bar_mfe
                    if bar_mae < mae:
                        mae = bar_mae

                    hit_tgt = (ch >= tgt_price)
                    hit_stp = (cl <= stp_price)

                    # Conservative ambiguity resolution (Stop first)
                    if hit_tgt and hit_stp:
                        exit_price = stp_price
                        exit_reason = "STOP_LOSS"
                        break
                    elif hit_tgt:
                        exit_price = tgt_price
                        exit_reason = "TARGET"
                        break
                    elif hit_stp:
                        exit_price = stp_price
                        exit_reason = "STOP_LOSS"
                        break

                    # End of intraday session square-off (15:20)
                    if hasattr(ct, "time") and ct.time() >= dtime(15, 20):
                        exit_price = cc
                        exit_reason = "EOD_SQUAREOFF"
                        break

                # Cost model calculation
                friction = cost_model.calculate_round_trip_costs(entry_price=ep, exit_price=exit_price, shares=shares)
                gross_pnl = shares * (exit_price - ep)
                net_pnl = gross_pnl - friction.total_friction
                net_ret_pct = ((net_pnl) / (shares * ep)) * 100.0 if (shares * ep) > 0 else 0.0

                if net_pnl > 0:
                    wins += 1
                elif net_pnl < 0:
                    losses += 1
                else:
                    scratches += 1

                total_net_pnl += net_pnl
                total_gross_pnl += gross_pnl
                trade_returns.append(net_ret_pct)
                mfes.append(mfe)
                maes.append(mae)

            total_trades = wins + losses + scratches
            win_pct = round((wins / total_trades * 100.0), 1) if total_trades > 0 else 0.0

            # Profit Factor & Expectancy
            gross_win = sum([r for r in trade_returns if r > 0])
            gross_loss = abs(sum([r for r in trade_returns if r < 0]))
            profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_win > 0 else 0.0)
            avg_return = round(np.mean(trade_returns), 2) if trade_returns else 0.0
            avg_mfe = round(np.mean(mfes), 2) if mfes else 0.0
            avg_mae = round(np.mean(maes), 2) if maes else 0.0

            results_table.append({
                "setup_id": s_filt["id"],
                "setup_name": s_filt["name"],
                "exit_name": em["name"],
                "exit_desc": em["desc"],
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "win_pct": win_pct,
                "profit_factor": profit_factor,
                "avg_return_pct": avg_return,
                "total_net_pnl": round(total_net_pnl, 2),
                "avg_mfe": avg_mfe,
                "avg_mae": avg_mae,
                "mfe_mae_ratio": round(avg_mfe / abs(avg_mae), 2) if avg_mae != 0 else 0.0,
            })

    # Convert to DataFrame for presentation and ranking
    res_df = pd.DataFrame(results_table)

    print("\n" + "=" * 100)
    print("COMPLETE GRID RESULTS: ALL STRATEGY & EXIT CONFIGURATIONS")
    print("=" * 100)
    for idx, r in res_df.iterrows():
        print(f"[{r['setup_id']}] {r['exit_name']} ({r['exit_desc']}):")
        print(f"   Trades: {r['total_trades']} | Wins: {r['wins']} | Losses: {r['losses']} | Win%: {r['win_pct']}% | PF: {r['profit_factor']} | Net P&L: ₹{r['total_net_pnl']:,.2f} | MFE/MAE: {r['mfe_mae_ratio']}")

    # Find Top Performers
    print("\n" + "=" * 100)
    print("RANKED BY WIN RATE (MINIMUM 5 TRADES)")
    print("=" * 100)
    min5_df = res_df[res_df["total_trades"] >= 5].sort_values(by=["win_pct", "profit_factor"], ascending=False)
    for idx, r in min5_df.head(10).iterrows():
        print(f"WIN%: {r['win_pct']}% | PF: {r['profit_factor']} | Trades: {r['total_trades']} (W: {r['wins']}, L: {r['losses']}) | Setup: {r['setup_name']} | Exit: {r['exit_desc']}")

    print("\n" + "=" * 100)
    print("RANKED BY PROFIT FACTOR (MINIMUM 5 TRADES)")
    print("=" * 100)
    pf_df = res_df[res_df["total_trades"] >= 5].sort_values(by=["profit_factor", "win_pct"], ascending=False)
    for idx, r in pf_df.head(10).iterrows():
        print(f"PF: {r['profit_factor']} | WIN%: {r['win_pct']}% | Trades: {r['total_trades']} (W: {r['wins']}, L: {r['losses']}) | Net P&L: ₹{r['total_net_pnl']:,.2f} | Setup: {r['setup_name']} | Exit: {r['exit_desc']}")

    # Print Trade-by-Trade Details for TOP_1PCT_ELITE_A
    print("\n" + "=" * 100)
    print("TOP 1% ELITE STRATEGY: TRADE-BY-TRADE AUDIT TRAIL (NIFTY 50 - 3 MONTHS)")
    print("=" * 100)
    for c in raw_breakouts:
        if c["vol_mult"] < 2.5:
            continue
        if c["range_12"] > 0.018:
            continue
        if c["atr_ratio"] > 0.65:
            continue
        if c["close_loc"] > 0.25:
            continue
        if c["ext_ratio"] > 0.010:
            continue
        if c["vcp_score"] < 80.0:
            continue
        if c["daily_score"] < 70.0:
            continue
        if c["rs_score"] < 75.0:
            continue
        t = c["time"]
        if not (dtime(9, 45) <= t <= dtime(14, 30)):
            continue

        ep = c["entry_price"]
        tgt_price = ep * 1.010
        stp_price = ep * 0.995
        pos = pos_sizer.calculate_position("RISK_BASED", capital, ep, stp_price)
        shares = pos["shares"]

        exit_p = ep
        exit_r = "EOD"
        mfe_val = 0.0
        mae_val = 0.0
        for step in range(len(c["fwd_highs"])):
            ch = c["fwd_highs"][step]
            cl = c["fwd_lows"][step]
            cc = c["fwd_closes"][step]
            ct = c["fwd_times"][step]
            b_mfe = ((ch - ep) / ep) * 100.0
            b_mae = ((cl - ep) / ep) * 100.0
            if b_mfe > mfe_val: mfe_val = b_mfe
            if b_mae < mae_val: mae_val = b_mae
            if ch >= tgt_price and cl <= stp_price:
                exit_p = stp_price
                exit_r = "STOP_LOSS (Ambiguous)"
                break
            elif ch >= tgt_price:
                exit_p = tgt_price
                exit_r = "TARGET (+1.0%)"
                break
            elif cl <= stp_price:
                exit_p = stp_price
                exit_r = "STOP_LOSS (-0.5%)"
                break
            if hasattr(ct, "time") and ct.time() >= dtime(15, 20):
                exit_p = cc
                exit_r = "EOD_SQUAREOFF"
                break

        fric = cost_model.calculate_round_trip_costs(ep, exit_p, shares)
        pnl = (shares * (exit_p - ep)) - fric.total_friction
        outcome = "WIN [PROFIT]" if pnl > 0 else "LOSS [STOPPED]"
        print(f"[{outcome}] {c['symbol']:<10} | Time: {c['timestamp']} | Entry: Rs {ep:.2f} | Exit: Rs {exit_p:.2f} ({exit_r}) | Net PnL: Rs {pnl:,.2f} | VCP: {c['vcp_score']:.0f} | RS: {c['rs_score']:.0f} | VolMult: {c['vol_mult']:.1f}x | MFE: +{mfe_val:.2f}% | MAE: {mae_val:.2f}%")

    # Save detailed JSON output for report and frontend
    output_path = Path("backend/data/breakout_optimization_nifty50_results.json")
    res_df.to_json(output_path, orient="records", indent=2)
    print(f"\nOptimization research saved successfully to: {output_path}")

    return res_df


if __name__ == "__main__":
    run_breakout_research()
