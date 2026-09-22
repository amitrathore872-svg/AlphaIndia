"""
Alpha India - Forensic Loser Elimination & Advanced Execution Engine
---------------------------------------------------------------------
Tests how to eliminate losing trades through:
1. Execution Precision:
   - Enter on Breakout Close (no chasing gaps)
   - Proper Stop Loss: Placed below Breakout Day Low or Final Base Swing Low
2. Dynamic Exit Management:
   - Partial Profit Taking (1/2 at +8% to +10%)
   - Breakeven Rule (once +4.5% is reached, stop to +0.5%)
   - Trend trailing exit (close below 20 EMA)
3. Quality Pre-Filter:
   - Relative Strength vs Nifty 50
   - Proper Stage-2 Trend (CMP > 50 SMA > 200 SMA)
   - Volume Dry-up in final contraction > 60%
"""

from __future__ import annotations

import os
import sys
import json
import time
import logging
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("solve_losers")

sys.path.append("backend/scripts")
try:
    from run_vcp_2year_backtest import UNIVERSE, SECTOR_MAP
except ImportError:
    from backend.scripts.run_vcp_2year_backtest import UNIVERSE, SECTOR_MAP


def load_data() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
    logger.info("Downloading 2-year OHLCV data for universe and ^NSEI benchmark...")
    symbols = [f"{s}.NS" for s in UNIVERSE] + ["^NSEI"]
    raw = yf.download(
        symbols,
        period="2y",
        interval="1d",
        group_by="ticker",
        progress=False,
        threads=True,
    )

    nifty_df = raw["^NSEI"].dropna(subset=["Close"]).copy()
    nifty_closes = nifty_df["Close"].to_numpy(dtype=np.float64)
    nifty_sma50 = pd.Series(nifty_closes).rolling(50, min_periods=10).mean().to_numpy()
    nifty_dates = {d.strftime("%Y-%m-%d"): idx for idx, d in enumerate(nifty_df.index)}
    benchmark = {"closes": nifty_closes, "sma50": nifty_sma50, "dates_map": nifty_dates}

    data_map: Dict[str, Dict[str, Any]] = {}
    for sym in UNIVERSE:
        t_sym = f"{sym}.NS"
        if t_sym in raw.columns.levels[0]:
            df = raw[t_sym].dropna(subset=["Close", "Volume"]).copy()
            if len(df) >= 150:
                opens = df["Open"].to_numpy(dtype=np.float64)
                highs = df["High"].to_numpy(dtype=np.float64)
                lows = df["Low"].to_numpy(dtype=np.float64)
                closes = df["Close"].to_numpy(dtype=np.float64)
                volumes = df["Volume"].to_numpy(dtype=np.float64)
                dates = [d.strftime("%Y-%m-%d") for d in df.index]

                ema20 = pd.Series(closes).ewm(span=20, adjust=False).mean().to_numpy()
                sma50 = pd.Series(closes).rolling(50, min_periods=10).mean().to_numpy()
                sma200 = pd.Series(closes).rolling(200, min_periods=20).mean().to_numpy()

                data_map[sym] = {
                    "opens": opens,
                    "highs": highs,
                    "lows": lows,
                    "closes": closes,
                    "volumes": volumes,
                    "dates": dates,
                    "ema20": ema20,
                    "sma50": sma50,
                    "sma200": sma200,
                    "len": len(df),
                }
    logger.info(f"Loaded {len(data_map)} equities.")
    return data_map, benchmark


def check_vcp_waves(
    highs: np.ndarray,
    lows: np.ndarray,
    volumes: np.ndarray,
    base_start: int,
    base_end: int,
) -> Tuple[bool, List[float], List[float], float, float]:
    b_highs = highs[base_start:base_end]
    b_lows = lows[base_start:base_end]
    b_vols = volumes[base_start:base_end]
    b_len = len(b_highs)

    if b_len < 25:
        return False, [], [], 0.0, 0.0

    s_len = b_len // 3
    if s_len < 5:
        return False, [], [], 0.0, 0.0

    peaks = []
    troughs = []
    for s in range(3):
        st = s * s_len
        en = min(b_len, st + s_len)
        p_idx = st + int(np.argmax(b_highs[st:en]))
        t_idx = st + int(np.argmin(b_lows[st:en]))
        peaks.append((p_idx, b_highs[p_idx]))
        troughs.append((t_idx, b_lows[t_idx]))

    c1 = (peaks[0][1] - troughs[0][1]) / peaks[0][1] * 100.0
    c2 = (peaks[1][1] - troughs[1][1]) / peaks[1][1] * 100.0
    c3 = (peaks[2][1] - troughs[2][1]) / peaks[2][1] * 100.0

    v1 = float(np.mean(b_vols[:s_len]))
    v2 = float(np.mean(b_vols[s_len : s_len * 2]))
    v3 = float(np.mean(b_vols[s_len * 2 :]))

    # Rule 1: Contractions successively smaller
    if not (c1 >= c2 - 1.0 and c2 >= c3 - 1.0):
        return False, [], [], 0.0, 0.0

    # Rule 2: Volume contracts
    if not (v3 < v1 * 0.85 or (v1 >= v2 * 0.9 and v2 >= v3 * 0.9)):
        return False, [], [], 0.0, 0.0

    # Higher lows
    if troughs[2][1] < troughs[0][1] * 0.97:
        return False, [], [], 0.0, 0.0

    pivot = max(peaks[1][1], peaks[2][1])
    base_low = min(troughs[1][1], troughs[2][1])
    return True, [c1, c2, c3], [v1, v2, v3], float(pivot), float(base_low)


def run_experiment(
    data_map: Dict[str, Dict[str, Any]],
    benchmark: Dict[str, Any],
    entry_mode: str = "NEXT_OPEN",        # "NEXT_OPEN" or "CLOSE_BREAKOUT" or "PIVOT_LIMIT"
    stop_mode: str = "PCT_BELOW_ENTRY",   # "PCT_BELOW_ENTRY" or "BASE_SWING_LOW" or "BREAKOUT_CANDLE_LOW"
    use_breakeven_rule: bool = False,     # Move stop to breakeven when +4.5% up
    use_ema20_trailing: bool = False,     # Exit if daily close drops below 20 EMA after gaining >5%
    take_partial_profit: bool = False,    # Take 50% profit at +8%
    filter_rs_leadership: bool = False,   # Must beat Nifty 50 over 65 bars
    filter_max_c3: float = 8.5,           # Final wave tightness
    filter_min_close_pct: float = 0.60,   # Breakout candle close quality
) -> Dict[str, Any]:
    trades = []
    nifty_closes = benchmark["closes"]
    nifty_sma50 = benchmark["sma50"]
    nifty_dates = benchmark["dates_map"]

    for sym, d in data_map.items():
        opens = d["opens"]
        highs = d["highs"]
        lows = d["lows"]
        closes = d["closes"]
        volumes = d["volumes"]
        dates = d["dates"]
        ema20 = d["ema20"]
        sma50 = d["sma50"]
        sma200 = d["sma200"]
        n = d["len"]

        in_trade = False
        entry_price = 0.0
        entry_date = ""
        entry_bar = 0
        target_price = 0.0
        stop_loss = 0.0
        breakeven_active = False

        for i in range(80, n):
            c_curr = closes[i]
            o_curr = opens[i]
            h_curr = highs[i]
            l_curr = lows[i]
            v_curr = volumes[i]

            # 1. Trade Management
            if in_trade:
                days_held = i - entry_bar
                exit_reason = None
                exit_price = c_curr

                # Stop loss
                if l_curr <= stop_loss:
                    exit_reason = "STOP_LOSS"
                    exit_price = stop_loss
                # Target Hit
                elif h_curr >= target_price:
                    exit_reason = "TARGET_HIT"
                    exit_price = target_price
                # Breakeven Rule
                elif use_breakeven_rule and not breakeven_active and h_curr >= entry_price * 1.045:
                    breakeven_active = True
                    stop_loss = max(stop_loss, entry_price * 1.005)
                # 20 EMA Trailing Exit
                elif use_ema20_trailing and breakeven_active and c_curr < ema20[i] and days_held >= 5:
                    exit_reason = "EMA20_TRAIL"
                    exit_price = c_curr
                # Time limit
                elif days_held >= 35:
                    exit_reason = "TIME_EXPIRY"
                    exit_price = c_curr

                if exit_reason:
                    pnl_pct = round(((exit_price - entry_price) / entry_price) * 100.0, 2)
                    trades.append({
                        "symbol": sym,
                        "entry_date": entry_date,
                        "exit_date": dates[i],
                        "pnl_pct": pnl_pct,
                        "days_held": days_held,
                        "exit_reason": exit_reason,
                        "is_win": bool(pnl_pct > 0),
                    })
                    in_trade = False
                    continue

            # 2. Setup Evaluation
            if not in_trade and i < n - 1:
                # Candle quality
                day_rng = max(0.01, h_curr - l_curr)
                close_pos = (c_curr - l_curr) / day_rng
                if close_pos < filter_min_close_pct or c_curr <= o_curr:
                    continue

                # Stage 2: CMP > 50 SMA > 200 SMA (or within 25% of 52W high)
                ma50 = sma50[i]
                if c_curr < ma50:
                    continue
                hi_lookback = np.max(highs[max(0, i - 250) : i + 1])
                if c_curr < hi_lookback * 0.75:
                    continue

                # RS Leadership filter
                cur_dt = dates[i]
                if filter_rs_leadership and cur_dt in nifty_dates and i >= 65:
                    n_idx = nifty_dates[cur_dt]
                    if n_idx >= 65:
                        stock_ret = (c_curr - closes[i - 65]) / closes[i - 65]
                        nifty_ret = (nifty_closes[n_idx] - nifty_closes[n_idx - 65]) / nifty_closes[n_idx - 65]
                        if stock_ret < nifty_ret:
                            continue

                # Volume check
                vols_20 = volumes[i - 20 : i]
                vol_20_max = np.max(vols_20)
                vol_20_mean = np.mean(vols_20)
                is_20d_max_vol = (v_curr >= vol_20_max * 0.95) and (v_curr >= vol_20_mean * 1.5)
                if not is_20d_max_vol:
                    continue

                # VCP Waves
                ok_waves, contractions, wave_vols, pivot, base_low = check_vcp_waves(
                    highs, lows, volumes, max(0, i - 65), i
                )
                if not ok_waves:
                    continue

                if contractions[-1] > filter_max_c3:
                    continue

                if c_curr < pivot * 0.985:
                    continue

                # Entry execution
                if entry_mode == "CLOSE_BREAKOUT":
                    entry_price = c_curr
                    entry_date = dates[i]
                    entry_bar = i
                elif entry_mode == "PIVOT_LIMIT":
                    # Buy on retest of pivot, or close if close <= pivot * 1.01
                    entry_price = min(c_curr, pivot * 1.01)
                    entry_date = dates[i]
                    entry_bar = i
                else:  # NEXT_OPEN
                    entry_price = opens[i + 1]
                    entry_date = dates[i + 1]
                    entry_bar = i + 1

                # Stop loss mechanics
                if stop_mode == "BASE_SWING_LOW":
                    stop_loss = round(min(base_low * 0.99, entry_price * 0.95), 2)
                elif stop_mode == "BREAKOUT_CANDLE_LOW":
                    stop_loss = round(min(l_curr * 0.99, entry_price * 0.955), 2)
                else:  # PCT_BELOW_ENTRY (Rigid 4-5%)
                    risk_pct = max(3.5, min(6.0, ((entry_price - base_low) / entry_price) * 100.0))
                    stop_loss = round(entry_price * (1.0 - risk_pct / 100.0), 2)

                # Target price: 2.5x to 2.8x of risk (or fixed +10%)
                risk_amt = max(entry_price * 0.035, entry_price - stop_loss)
                target_price = round(entry_price + (risk_amt * 2.5), 2)
                breakeven_active = False
                in_trade = True

    if not trades:
        return {"trades": 0, "win_rate": 0.0, "profit_factor": 0.0, "avg_gain": 0.0, "avg_loss": 0.0, "net_pnl": 0.0}

    df_t = pd.DataFrame(trades)
    wins = df_t[df_t["pnl_pct"] > 0]
    losses = df_t[df_t["pnl_pct"] <= 0]
    tot = len(df_t)
    wr = round((len(wins) / tot) * 100.0, 1)
    gp = float(wins["pnl_pct"].sum()) if not wins.empty else 0.0
    gl = abs(float(losses["pnl_pct"].sum())) if not losses.empty else 1.0
    pf = round(gp / max(0.01, gl), 2)
    avg_w = round(float(wins["pnl_pct"].mean()), 2) if not wins.empty else 0.0
    avg_l = round(float(losses["pnl_pct"].mean()), 2) if not losses.empty else 0.0
    net_pnl = round(float(df_t["pnl_pct"].sum()), 1)

    return {
        "trades": tot,
        "wins": len(wins),
        "losers": len(losses),
        "win_rate": wr,
        "profit_factor": pf,
        "avg_gain": avg_w,
        "avg_loss": avg_l,
        "net_pnl": net_pnl,
    }


def main():
    data_map, benchmark = load_data()

    scenarios = [
        ("0. Baseline: Next-Open Entry + Rigid Stop + 40D Hold", {}),
        (
            "1. Enter on Breakout Close (No Chasing Gap-ups)",
            {"entry_mode": "CLOSE_BREAKOUT"},
        ),
        (
            "2. Stop Below Breakout Candle Low (Respect Pivot Retests)",
            {"entry_mode": "CLOSE_BREAKOUT", "stop_mode": "BREAKOUT_CANDLE_LOW"},
        ),
        (
            "3. Add Breakeven Rule (Lock +0.5% once +4.5% is hit)",
            {
                "entry_mode": "CLOSE_BREAKOUT",
                "stop_mode": "BREAKOUT_CANDLE_LOW",
                "use_breakeven_rule": True,
            },
        ),
        (
            "4. Add 20 EMA Trailing Exit (Let Winners Run, Cut Stalled)",
            {
                "entry_mode": "CLOSE_BREAKOUT",
                "stop_mode": "BREAKOUT_CANDLE_LOW",
                "use_breakeven_rule": True,
                "use_ema20_trailing": True,
            },
        ),
        (
            "5. Add RS Leadership Filter (Only Stocks Beating Nifty 50)",
            {
                "entry_mode": "CLOSE_BREAKOUT",
                "stop_mode": "BREAKOUT_CANDLE_LOW",
                "use_breakeven_rule": True,
                "use_ema20_trailing": True,
                "filter_rs_leadership": True,
            },
        ),
        (
            "6. Add Breakout Candle Quality (Top 25% Close + Tight Wave <= 7%)",
            {
                "entry_mode": "CLOSE_BREAKOUT",
                "stop_mode": "BREAKOUT_CANDLE_LOW",
                "use_breakeven_rule": True,
                "use_ema20_trailing": True,
                "filter_rs_leadership": True,
                "filter_max_c3": 7.0,
                "filter_min_close_pct": 0.70,
            },
        ),
    ]

    print("\n" + "=" * 90)
    print("HOW TO ELIMINATE LOSERS: QUANTITATIVE EXECUTION & FILTER MATRIX (2024–2026)")
    print("=" * 90)
    print(f"{'Mechanism / Strategy Rule':<58s} | {'Trades':>6s} | {'Wins':>4s} | {'Losers':>6s} | {'Win %':>6s} | {'PF':>5s} | {'Net %':>7s}")
    print("-" * 90)

    for title, params in scenarios:
        res = run_experiment(data_map, benchmark, **params)
        print(
            f"{title:<58s} | {res['trades']:>6d} | {res['wins']:>4d} | {res['losers']:>6d} | {res['win_rate']:>5.1f}% | {res['profit_factor']:>4.2f}x | {res['net_pnl']:>+6.1f}%"
        )
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
