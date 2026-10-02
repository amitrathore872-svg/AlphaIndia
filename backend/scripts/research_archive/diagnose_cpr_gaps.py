import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.cpr_engine_service import CPREngineService

print("=" * 85)
print("DEEP FORENSIC ANALYSIS: WHY BREAKOUTS FAIL & WHAT FILTERS PLUG THE GAPS")
print("=" * 85)

# Load 90 sessions
dates, history_map = CPREngineService.load_historical_ohlcv(max_sessions=90)

trades = []

for sym, df in history_map.items():
    if len(df) < 35:
        continue

    for i in range(25, len(df) - 5):
        b_prev = df.iloc[i - 1]
        b_curr = df.iloc[i]

        c_p = float(b_prev["close"])
        h_p = float(b_prev["high"])
        l_p = float(b_prev["low"])

        p, bc, tc, cpr_w = CPREngineService.calculate_cpr(h_p, l_p, c_p)
        cpr_top = max(tc, bc)
        cpr_bot = min(tc, bc)

        close = float(b_curr["close"])
        open_p = float(b_curr["open"])
        high = float(b_curr["high"])
        low = float(b_curr["low"])
        vol = float(b_curr["volume"])
        avg_vol = float(df["volume"].iloc[i-20:i].mean())
        vol_ratio = vol / max(1.0, avg_vol)

        spread_pct = (cpr_top - cpr_bot) / max(0.01, close) * 100.0
        dist_to_cpr = min(abs(close - cpr_top), abs(close - cpr_bot), abs(close - p)) / max(0.01, close) * 100.0

        b_prev2 = df.iloc[i - 2]
        p2, bc2, tc2, prev_cpr_w = CPREngineService.calculate_cpr(float(b_prev2["high"]), float(b_prev2["low"]), float(b_prev2["close"]))

        # Base Squeeze Condition
        is_compression = (spread_pct <= 0.15) and (dist_to_cpr <= 0.50) and (prev_cpr_w >= 0.30 or prev_cpr_w >= 2.0 * max(0.01, cpr_w))
        if not is_compression:
            continue

        # Breakout condition
        is_breakout = (close >= cpr_top) and ((close - cpr_top) / max(0.01, cpr_top) <= 0.035)
        if not is_breakout:
            continue

        # Gap 1: Value Migration (Higher Value CPR vs Lower Value CPR)
        is_higher_value = (p >= p2) and (cpr_top >= max(tc2, bc2))

        # Gap 2: Open Gap Trap (Did it gap up or open coiled?)
        open_gap_pct = ((open_p - float(b_prev["close"])) / float(b_prev["close"])) * 100.0
        is_coiled_open = abs(open_gap_pct) <= 0.8  # opened flat/coiled, not exhausted

        # Gap 3: Candle Quality (Solid body, small upper wick)
        c_range = max(0.01, high - low)
        body = abs(close - open_p)
        upper_wick = high - max(close, open_p)
        is_solid_candle = (upper_wick / c_range <= 0.25) and (close >= low + (0.70 * c_range))

        # Gap 4: Trend / DMA 20 & 50
        dma_20 = float(df["close"].iloc[i-20:i].mean())
        dma_50 = float(df["close"].iloc[i-50:i].mean()) if i >= 50 else dma_20
        is_uptrend = (close > dma_20) and (dma_20 >= dma_50)

        # Gap 5: Overhead Resistance Clearance (20-day high)
        prior_20_high = float(df["high"].iloc[i-20:i].max())
        clearance_pct = ((prior_20_high - close) / close) * 100.0
        has_clear_runway = (clearance_pct >= 3.0) or (close >= prior_20_high)  # blue sky or >=3% room

        # Forward Outcome across 5 days
        fwd_bars = df.iloc[i+1 : i+6]
        entry = close
        risk = max(entry * 0.015, abs(cpr_top - cpr_bot) * 1.5)
        stop_loss = cpr_bot - (risk * 0.25)
        target_1 = entry + (1.5 * risk)
        target_2 = entry + (2.5 * risk)

        hit_t1 = False
        hit_t2 = False
        hit_sl = False
        exit_price = fwd_bars.iloc[-1]["close"]

        for _, fwd_bar in fwd_bars.iterrows():
            h_fwd = float(fwd_bar["high"])
            l_fwd = float(fwd_bar["low"])

            if l_fwd <= stop_loss:
                hit_sl = True
                exit_price = stop_loss
                break
            if h_fwd >= target_2:
                hit_t2 = True
                hit_t1 = True
                exit_price = target_2
                break
            elif h_fwd >= target_1:
                hit_t1 = True

        pnl_pct = ((exit_price - entry) / entry) * 100.0
        r_mult = (exit_price - entry) / risk

        trades.append({
            "symbol": sym,
            "pnl_pct": pnl_pct,
            "r_mult": r_mult,
            "hit_t1": hit_t1,
            "hit_t2": hit_t2,
            "hit_sl": hit_sl,
            "vol_ratio": vol_ratio,
            "is_higher_value": is_higher_value,
            "is_coiled_open": is_coiled_open,
            "is_solid_candle": is_solid_candle,
            "is_uptrend": is_uptrend,
            "has_clear_runway": has_clear_runway,
            "spread_pct": spread_pct,
        })

df_diag = pd.DataFrame(trades)
print(f"Total CPR Compression Breakout Setups Analyzed: {len(df_diag)}\n")

def print_metric_row(name, subset):
    if subset.empty:
        print(f"{name:<55} | No trades")
        return
    tot = len(subset)
    w = subset[subset["r_mult"] > 0]
    l = subset[subset["r_mult"] <= 0]
    wr = (len(w) / tot) * 100.0
    t1 = (subset["hit_t1"].sum() / tot) * 100.0
    t2 = (subset["hit_t2"].sum() / tot) * 100.0
    gp = w["pnl_pct"].sum()
    gl = abs(l["pnl_pct"].sum())
    pf = gp / max(0.01, gl)
    exp_r = subset["r_mult"].mean()
    print(f"{name:<55} | N={tot:>4} | WR: {wr:>5.1f}% | T1: {t1:>5.1f}% | T2: {t2:>5.1f}% | PF: {pf:>4.2f} | Exp: {exp_r:>+5.2f}R")

print_metric_row("0. Raw CPR Breakout Baseline", df_diag)
print_metric_row("1. Gap 1 Fixed: Higher-Value CPR (Ascending Value)", df_diag[df_diag["is_higher_value"] == True])
print_metric_row("2. Gap 2 Fixed: Coiled Open (No Gap-Up Exhaustion)", df_diag[df_diag["is_coiled_open"] == True])
print_metric_row("3. Gap 3 Fixed: Solid Candle Body (Upper Wick < 25%)", df_diag[df_diag["is_solid_candle"] == True])
print_metric_row("4. Gap 4 Fixed: Trend Filter (Above 20 DMA > 50 DMA)", df_diag[df_diag["is_uptrend"] == True])
print_metric_row("5. Gap 5 Fixed: Overhead Runway (Clear >= 3% to Wall)", df_diag[df_diag["has_clear_runway"] == True])
print_metric_row("6. Gap 6 Fixed: Institutional Volume (Vol >= 1.5x)", df_diag[df_diag["vol_ratio"] >= 1.5])

# Stacking the solutions
confluence_1 = df_diag[(df_diag["is_higher_value"] == True) & (df_diag["is_uptrend"] == True) & (df_diag["vol_ratio"] >= 1.3)]
print_metric_row("7. [STACK 1] Higher-Value + Uptrend + Vol >= 1.3x", confluence_1)

confluence_2 = df_diag[
    (df_diag["is_higher_value"] == True) &
    (df_diag["is_uptrend"] == True) &
    (df_diag["is_coiled_open"] == True) &
    (df_diag["is_solid_candle"] == True) &
    (df_diag["vol_ratio"] >= 1.3)
]
print_metric_row("8. [STACK 2] Higher-Value + Coiled Open + Solid + Vol", confluence_2)

confluence_elite = df_diag[
    (df_diag["is_higher_value"] == True) &
    (df_diag["is_uptrend"] == True) &
    (df_diag["is_coiled_open"] == True) &
    (df_diag["is_solid_candle"] == True) &
    (df_diag["has_clear_runway"] == True) &
    (df_diag["vol_ratio"] >= 1.5)
]
print_metric_row("9. [ELITE CONFLUENCE] All 6 Gaps Plugged", confluence_elite)
