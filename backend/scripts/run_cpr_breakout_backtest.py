import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import SessionLocal
from app.services.cpr_engine_service import CPREngineService

print("=" * 80)
print("PART 1: ANALYSIS OF ACTIVE INTRADAY DATASET (intraday_backtest_sample_trades.csv)")
print("=" * 80)

csv_path = Path(__file__).resolve().parent.parent / "data" / "intraday_backtest_sample_trades.csv"
if csv_path.exists():
    df_sample = pd.read_csv(csv_path)
    print(f"Total Trades in Sample: {len(df_sample)}")

    def eval_subset(df, name):
        if df.empty:
            print(f"{name:<45}: No trades")
            return
        total = len(df)
        winners = df[df["r_multiple"] > 0]
        losers = df[df["r_multiple"] <= 0]
        wr = (len(winners) / total) * 100.0
        t1_rate = (df["hit_target_1"].sum() / total) * 100.0
        t2_rate = (df["hit_target_2"].sum() / total) * 100.0
        gp = winners["pnl_pct"].sum()
        gl = abs(losers["pnl_pct"].sum())
        pf = gp / max(0.01, gl)
        avg_r = df["r_multiple"].mean()
        avg_win_pct = winners["pnl_pct"].mean() if not winners.empty else 0.0
        avg_loss_pct = losers["pnl_pct"].mean() if not losers.empty else 0.0
        print(f"{name:<45} | N={total:>4} | WinRate: {wr:>5.1f}% | T1 Hit: {t1_rate:>5.1f}% | T2 Hit: {t2_rate:>5.1f}% | PF: {pf:>4.2f} | Exp: {avg_r:>+4.2f}R")

    eval_subset(df_sample, "1. All Unfiltered Intraday Trades")
    eval_subset(df_sample[df_sample["is_narrow_cpr"] == True], "2. Narrow CPR (<=0.28%)")
    eval_subset(df_sample[df_sample["cpr_width_pct"] <= 0.15], "3. Ultra-Narrow CPR (<=0.15%)")
    eval_subset(df_sample[df_sample["cpr_width_pct"] <= 0.10], "4. Hyper-Compressed CPR (<=0.10%)")
    eval_subset(df_sample[(df_sample["cpr_width_pct"] <= 0.15) & (df_sample["vol_ratio"] >= 1.5)], "5. Ultra-Narrow CPR + Vol Expansion (>=1.5x)")
    eval_subset(df_sample[(df_sample["cpr_width_pct"] <= 0.15) & (df_sample["vol_ratio"] >= 1.5) & (df_sample["is_solid_candle"] == True)], "6. Ultra-Narrow CPR + Vol + Solid Candle")

print("\n" + "=" * 80)
print("PART 2: MULTI-DAY SWING & BREAKOUT BACKTEST ON NSE BHAVCOPY (90 SESSIONS)")
print("=" * 80)

dates, history_map = CPREngineService.load_historical_ohlcv(max_sessions=90)
print(f"Loaded {len(dates)} trading sessions across {len(history_map)} equities.")

trades_all = []

for sym, df in history_map.items():
    if len(df) < 30:
        continue

    # Loop through each bar from bar 20 to bar -6 (allowing 5 forward bars for outcome)
    for i in range(20, len(df) - 5):
        b_prev = df.iloc[i - 1]
        b_curr = df.iloc[i]

        c_p = float(b_prev["close"])
        h_p = float(b_prev["high"])
        l_p = float(b_prev["low"])

        p, bc, tc, cpr_w = CPREngineService.calculate_cpr(h_p, l_p, c_p)
        cpr_top = max(tc, bc)
        cpr_bot = min(tc, bc)
        close = float(b_curr["close"])
        vol = float(b_curr["volume"])
        avg_vol = float(df["volume"].iloc[i-20:i].mean())
        vol_ratio = vol / max(1.0, avg_vol)

        # Distance to CPR and CPR spread
        spread_pct = (cpr_top - cpr_bot) / max(0.01, close) * 100.0
        dist_to_cpr = min(abs(close - cpr_top), abs(close - cpr_bot), abs(close - p)) / max(0.01, close) * 100.0

        # Prior CPR width (2 bars prior)
        b_prev2 = df.iloc[i - 2]
        _, _, _, prev_cpr_w = CPREngineService.calculate_cpr(float(b_prev2["high"]), float(b_prev2["low"]), float(b_prev2["close"]))

        # Setup: Broad -> Narrow CPR
        is_compression = (spread_pct <= 0.15) and (dist_to_cpr <= 0.50) and (prev_cpr_w >= 0.30 or prev_cpr_w >= 2.0 * max(0.01, cpr_w))

        if not is_compression:
            continue

        # Breakout Trigger: Close >= cpr_top and within 3%
        is_breakout = (close >= cpr_top) and ((close - cpr_top) / max(0.01, cpr_top) <= 0.035)

        if not is_breakout:
            continue

        # Forward testing: Next 1 to 5 bars
        fwd_bars = df.iloc[i+1 : i+6]
        entry = close
        risk = max(entry * 0.015, abs(cpr_top - cpr_bot) * 1.5)
        stop_loss = cpr_bot - (risk * 0.25)
        target_1 = entry + (1.5 * risk)
        target_2 = entry + (2.5 * risk)

        # Check outcome across next 5 days
        hit_t1 = False
        hit_t2 = False
        hit_sl = False
        exit_price = fwd_bars.iloc[-1]["close"]
        exit_day = len(fwd_bars)

        for day_idx, (_, fwd_bar) in enumerate(fwd_bars.iterrows(), start=1):
            h_fwd = float(fwd_bar["high"])
            l_fwd = float(fwd_bar["low"])

            if l_fwd <= stop_loss:
                hit_sl = True
                exit_price = stop_loss
                exit_day = day_idx
                break
            if h_fwd >= target_2:
                hit_t2 = True
                hit_t1 = True
                exit_price = target_2
                exit_day = day_idx
                break
            elif h_fwd >= target_1:
                hit_t1 = True

        pnl_pct = ((exit_price - entry) / entry) * 100.0
        r_mult = (exit_price - entry) / risk if (hit_t2 or hit_sl) else (exit_price - entry) / risk

        dma_20 = float(df["close"].iloc[i-20:i].mean())
        is_above_20dma = close > dma_20

        trades_all.append({
            "symbol": sym,
            "date": df.index[i] if hasattr(df.index[i], "strftime") else str(df.iloc[i].get("date", i)),
            "entry": entry,
            "exit": exit_price,
            "pnl_pct": pnl_pct,
            "r_multiple": r_mult,
            "hit_target_1": hit_t1,
            "hit_target_2": hit_t2,
            "hit_sl": hit_sl,
            "vol_ratio": vol_ratio,
            "is_above_20dma": is_above_20dma,
            "prev_cpr_w": prev_cpr_w,
            "curr_cpr_w": cpr_w,
            "spread_pct": spread_pct,
        })

df_bt = pd.DataFrame(trades_all)
print(f"Total Historical CPR Breakout Setups Identified: {len(df_bt)}")

if not df_bt.empty:
    print("\n--- PERFORMANCE BREAKDOWN BY FILTER LEVEL ---")
    eval_subset(df_bt, "1. All CPR Breakouts (Spread <= 0.15%)")
    eval_subset(df_bt[df_bt["vol_ratio"] >= 1.2], "2. Breakout + Vol Expansion (>= 1.2x)")
    eval_subset(df_bt[df_bt["vol_ratio"] >= 1.5], "3. Breakout + Strong Vol Expansion (>= 1.5x)")
    eval_subset(df_bt[df_bt["is_above_20dma"] == True], "4. Breakout + Trend (Above 20 DMA)")
    eval_subset(df_bt[(df_bt["vol_ratio"] >= 1.3) & (df_bt["is_above_20dma"] == True)], "5. [INSTITUTIONAL GRADE] Vol >= 1.3x + Above 20 DMA")
    eval_subset(df_bt[(df_bt["vol_ratio"] >= 1.5) & (df_bt["is_above_20dma"] == True) & (df_bt["spread_pct"] <= 0.08)], "6. [ELITE SNIPER] Spread <= 0.08% + Vol >= 1.5x + 20 DMA")
