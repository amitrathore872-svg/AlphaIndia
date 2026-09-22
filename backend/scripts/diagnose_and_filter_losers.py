"""
Alpha India - VCP False Breakout Diagnostic & Loser Elimination Engine
----------------------------------------------------------------------
Analyzes the 50 losing trades from the 2-Year Empirical Backtest (2024-2026)
and tests 6 institutional filter mechanisms to systematically eliminate losers:

1. Filter A: Ultra-Tight Final Contraction (Final wave <= 5.5% vs 8.5%)
2. Filter B: General Market Regime Filter (Nifty 50 > 50 SMA on breakout day)
3. Filter C: Relative Strength (RS) Leadership (Outperforming Nifty 50 over 65 bars)
4. Filter D: Breakout Candle Quality (Close in top 25% of candle range, upper wick < 20%)
5. Filter E: Stronger Institutional Volume Multiplier (Vol >= 2.0x 20 DMA)
6. Filter F: Sector Rank / Leading Sectors Only
7. Combined Institutional Filter Stack (All combined)
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
logger = logging.getLogger("diagnose_losers")

from run_vcp_2year_backtest import UNIVERSE, SECTOR_MAP


def load_universe_and_benchmark() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
    """Loads 2-year data for the universe plus ^NSEI (Nifty 50 benchmark)."""
    logger.info("Downloading 2-year OHLCV data for universe and ^NSEI benchmark...")
    symbols_to_download = [f"{s}.NS" for s in UNIVERSE] + ["^NSEI"]
    raw = yf.download(
        symbols_to_download,
        period="2y",
        interval="1d",
        group_by="ticker",
        progress=False,
        threads=True,
    )

    # Benchmark (^NSEI)
    nifty_df = raw["^NSEI"].dropna(subset=["Close"]).copy()
    nifty_closes = nifty_df["Close"].to_numpy(dtype=np.float64)
    nifty_sma50 = pd.Series(nifty_closes).rolling(50, min_periods=10).mean().to_numpy()
    nifty_dates = {d.strftime("%Y-%m-%d"): idx for idx, d in enumerate(nifty_df.index)}
    benchmark = {
        "closes": nifty_closes,
        "sma50": nifty_sma50,
        "dates_map": nifty_dates,
    }

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

                data_map[sym] = {
                    "opens": opens,
                    "highs": highs,
                    "lows": lows,
                    "closes": closes,
                    "volumes": volumes,
                    "dates": dates,
                    "len": len(df),
                }
    logger.info(f"Loaded {len(data_map)} equities and ^NSEI benchmark.")
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

    # Rule 1: Contractions successively smaller: C1 >= C2 >= C3
    if not (c1 >= c2 - 1.0 and c2 >= c3 - 1.0):
        return False, [], [], 0.0, 0.0

    # Rule 2: Volume contracts in base
    if not (v3 < v1 * 0.85 or (v1 >= v2 * 0.9 and v2 >= v3 * 0.9)):
        return False, [], [], 0.0, 0.0

    # Higher lows
    if troughs[2][1] < troughs[0][1] * 0.97:
        return False, [], [], 0.0, 0.0

    pivot = max(peaks[1][1], peaks[2][1])
    base_low = min(troughs[1][1], troughs[2][1])
    return True, [round(c1, 1), round(c2, 1), round(c3, 1)], [v1, v2, v3], float(pivot), float(base_low)


def simulate_with_filters(
    data_map: Dict[str, Dict[str, Any]],
    benchmark: Dict[str, Any],
    max_c3: float = 8.5,           # Filter A: Tightness of final wave
    require_market_uptrend: bool = False, # Filter B: Nifty > 50 SMA
    require_rs_leadership: bool = False,  # Filter C: 65-day return > Nifty 50
    min_candle_close_pct: float = 0.60,   # Filter D: Close in top % of candle
    min_vol_20dma_ratio: float = 1.5,    # Filter E: Volume multiplier
    exclude_lagging_sectors: bool = False,# Filter F: Skip structurally weak sectors (e.g. BFSI in 2024-25)
) -> Dict[str, Any]:
    trades = []
    nifty_closes = benchmark["closes"]
    nifty_sma50 = benchmark["sma50"]
    nifty_dates = benchmark["dates_map"]

    for sym, d in data_map.items():
        if exclude_lagging_sectors and SECTOR_MAP.get(sym) == "BFSI & Fintech":
            continue

        opens = d["opens"]
        highs = d["highs"]
        lows = d["lows"]
        closes = d["closes"]
        volumes = d["volumes"]
        dates = d["dates"]
        n = d["len"]

        in_trade = False
        entry_price = 0.0
        entry_date = ""
        entry_bar = 0
        target_price = 0.0
        stop_loss = 0.0
        trailing_activated = False

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

                if l_curr <= stop_loss:
                    exit_reason = "STOP_LOSS"
                    exit_price = stop_loss
                elif h_curr >= target_price:
                    exit_reason = "TARGET_HIT"
                    exit_price = target_price
                elif not trailing_activated and h_curr >= entry_price * 1.08:
                    trailing_activated = True
                    stop_loss = max(stop_loss, entry_price * 1.01)
                elif days_held >= 40:
                    exit_reason = "TIME_EXPIRY"
                    exit_price = c_curr

                if exit_reason:
                    pnl_pct = round(((exit_price - entry_price) / entry_price) * 100.0, 2)
                    trades.append({
                        "symbol": sym,
                        "sector": SECTOR_MAP.get(sym, "Diversified"),
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
                # Candle Range Quality
                day_rng = max(0.01, h_curr - l_curr)
                close_pos = (c_curr - l_curr) / day_rng
                if close_pos < min_candle_close_pct or c_curr <= o_curr:
                    continue

                # Stage 2 Uptrend: CMP > 50 SMA and within 25% of 52W high
                ma50 = np.mean(closes[i - 50 : i])
                if c_curr < ma50:
                    continue
                hi_lookback = np.max(highs[max(0, i - 250) : i + 1])
                if c_curr < hi_lookback * 0.75:
                    continue

                # Filter B: Market Regime Filter (Nifty 50 above 50 SMA)
                cur_dt = dates[i]
                if require_market_uptrend and cur_dt in nifty_dates:
                    n_idx = nifty_dates[cur_dt]
                    if nifty_closes[n_idx] < nifty_sma50[n_idx]:
                        continue  # Skip breakout when general market is below 50 SMA!

                # Filter C: Relative Strength (Outperforming Nifty 50 over 65 bars)
                if require_rs_leadership and cur_dt in nifty_dates and i >= 65:
                    n_idx = nifty_dates[cur_dt]
                    if n_idx >= 65:
                        stock_ret_65 = (c_curr - closes[i - 65]) / closes[i - 65]
                        nifty_ret_65 = (nifty_closes[n_idx] - nifty_closes[n_idx - 65]) / nifty_closes[n_idx - 65]
                        if stock_ret_65 < nifty_ret_65:
                            continue  # Skip breakout if stock is underperforming the benchmark!

                # Rule 3: Volume check
                vols_20 = volumes[i - 20 : i]
                vol_20_max = np.max(vols_20)
                vol_20_mean = np.mean(vols_20)
                is_20d_max_vol = (v_curr >= vol_20_max * 0.95) and (v_curr >= vol_20_mean * min_vol_20dma_ratio)
                if not is_20d_max_vol:
                    continue

                # Rule 1 & Rule 2: 3-5 Contractions
                ok_waves, contractions, wave_vols, pivot, base_low = check_vcp_waves(
                    highs, lows, volumes, max(0, i - 65), i
                )
                if not ok_waves:
                    continue

                # Filter A: Final Contraction Tightness
                if contractions[-1] > max_c3:
                    continue

                # Pivot Breakout
                if c_curr < pivot * 0.985:
                    continue

                # Enter next open
                next_open = opens[i + 1]
                entry_price = next_open
                entry_date = dates[i + 1]
                entry_bar = i + 1
                risk_pct = max(3.5, min(6.0, ((entry_price - base_low) / entry_price) * 100.0))
                stop_loss = round(entry_price * (1.0 - risk_pct / 100.0), 2)
                target_price = round(entry_price * (1.0 + (risk_pct * 2.8) / 100.0), 2)
                trailing_activated = False
                in_trade = True

    if not trades:
        return {"trades": 0, "win_rate": 0.0, "profit_factor": 0.0, "avg_gain": 0.0, "avg_loss": 0.0, "losers": 0}

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

    return {
        "trades": tot,
        "wins": len(wins),
        "losers": len(losses),
        "win_rate": wr,
        "profit_factor": pf,
        "avg_gain": avg_w,
        "avg_loss": avg_l,
        "net_pnl": round(float(df_t["pnl_pct"].sum()), 1),
    }


def main():
    data_map, benchmark = load_universe_and_benchmark()

    experiments = [
        ("0. Baseline (Current Strategy: 8.5% Final Wave)", {}),
        ("1. Filter A: Ultra-Tight Final Wave (Final Wave <= 5.5%)", {"max_c3": 5.5}),
        ("2. Filter B: Market Regime Filter (Nifty 50 > 50 SMA)", {"require_market_uptrend": True}),
        ("3. Filter C: Relative Strength (Outperforming Nifty 50)", {"require_rs_leadership": True}),
        ("4. Filter D: Breakout Candle Quality (Close in top 25%)", {"min_candle_close_pct": 0.75}),
        ("5. Filter E: Volume Surge (>= 2.0x 20 DMA)", {"min_vol_20dma_ratio": 2.0}),
        ("6. Filter F: Exclude Lagging BFSI Sector", {"exclude_lagging_sectors": True}),
        (
            "7. COMBINED INSTITUTIONAL STACK (Tight Wave + Market + RS + Quality)",
            {
                "max_c3": 6.0,
                "require_market_uptrend": True,
                "require_rs_leadership": True,
                "min_candle_close_pct": 0.70,
                "min_vol_20dma_ratio": 1.8,
                "exclude_lagging_sectors": True,
            },
        ),
    ]

    print("\n" + "=" * 85)
    print("VCP LOSER ELIMINATION & QUANT FILTER MATRIX (LAST 2 YEARS: 2024–2026)")
    print("=" * 85)
    print(f"{'Configuration':<52s} | {'Trades':>6s} | {'Wins':>4s} | {'Losers':>6s} | {'Win %':>6s} | {'PF':>5s} | {'Avg Win':>7s} | {'Net %':>7s}")
    print("-" * 85)

    results = []
    for title, params in experiments:
        res = simulate_with_filters(data_map, benchmark, **params)
        results.append((title, res))
        print(
            f"{title:<52s} | {res['trades']:>6d} | {res.get('wins', 0):>4d} | {res.get('losers', 0):>6d} | {res['win_rate']:>5.1f}% | {res['profit_factor']:>4.2f}x | +{res['avg_gain']:>5.1f}% | {res.get('net_pnl', 0.0):>+6.1f}%"
        )
    print("=" * 85 + "\n")


if __name__ == "__main__":
    main()
