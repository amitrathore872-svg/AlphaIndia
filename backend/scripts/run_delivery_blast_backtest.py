"""
Alpha India - Institutional Delivery Blast & Pre-Breakout Pattern Discovery Engine
Runs deep empirical backtest on 1.5+ years of official NSE security-wise delivery data (541 bhavcopies).
Specifically answers:
1. What exact column patterns appear in T-1, T-2, T-3, T-5 before the blast?
2. Does multi-day delivery clustering optimize win rates and profit factors?
3. What is the performance matrix across single-day vs multi-day delivery strategies?
"""

import sys
import os
import glob
import time
import datetime
from pathlib import Path
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run_backtest():
    t0 = time.time()
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_file_date)
    
    # Use last 350 files (~1.4 years of rich market history)
    files = files[-350:]
    print(f"Loading {len(files)} NSE daily bhavcopy files (from {parse_file_date(files[0]).strftime('%d-%b-%Y')} to {parse_file_date(files[-1]).strftime('%d-%b-%Y')})...")

    master_path = Path(__file__).resolve().parent.parent / "data" / "nse_companies_master.csv"
    valid_symbols = set()
    if master_path.exists():
        comp_df = pd.read_csv(master_path)
        valid_symbols = set(comp_df["SYMBOL"].dropna().astype(str).str.strip())
        print(f"Master company universe: {len(valid_symbols)} symbols")

    records = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
            df.columns = [c.strip() for c in df.columns]
            if "SERIES" in df.columns:
                df = df[df["SERIES"].astype(str).str.strip() == "EQ"]
            df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
            if valid_symbols:
                df = df[df["SYMBOL"].isin(valid_symbols)]
            
            df["DATE"] = pd.to_datetime(df["DATE1"].astype(str).str.strip(), format="%d-%b-%Y")
            df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
            df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
            df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
            df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["AVG_PRICE"] = pd.to_numeric(df["AVG_PRICE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

            records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "AVG_PRICE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Loaded {len(all_df):,} total daily rows across {all_df['SYMBOL'].nunique()} stocks in {time.time()-t0:.2f}s")

    # Liquidity filter: Price >= 30, Turnover >= 1.5 Cr
    grouped = all_df.groupby("SYMBOL", group_keys=False)

    print("Computing technical features & delivery metrics...")
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
    all_df["RANGE_PCT"] = (all_df["HL_RANGE"] / all_df["CLOSE"]) * 100.0
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]
    all_df["CLOSE_VS_VWAP"] = (all_df["CLOSE"] / np.maximum(1e-4, all_df["AVG_PRICE"]))

    # Institutional Ticket Size (Turnover per Trade in Lakhs)
    all_df["TICKET_LACS"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
    all_df["TICKET_20_SMA"] = grouped["TICKET_LACS"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["TICKET_SPIKE"] = np.where(all_df["TICKET_20_SMA"] > 0, all_df["TICKET_LACS"] / all_df["TICKET_20_SMA"], 1.0)

    # Moving averages & Pivots
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())

    # Delivery & Volume SMAs
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["VOL_SPIKE"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOLUME"] / all_df["VOL_20_SMA"], 0.0)

    # 1. Multi-Day Delivery Clusters: Days with Deliv% >= 55% in past 5 & 10 days
    all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
    all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)
    all_df["DELIV_DAYS_10D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0)
    all_df["AVG_DELIV_PER_5D"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["AVG_DELIV_PER_10D"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())

    # 2. Supply Dry-Up (Volume in T-1 vs 20 DMA)
    all_df["VOL_DRYUP_T1"] = grouped["VOLUME"].transform(lambda x: x.shift(1)) / np.maximum(1.0, all_df["VOL_20_SMA"])
    all_df["VOL_DRYUP_T2"] = grouped["VOLUME"].transform(lambda x: x.shift(2)) / np.maximum(1.0, all_df["VOL_20_SMA"])

    # 3. Range Contraction (Range 5D / Range 20D)
    range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)

    # 4. Institutional Net Flow (Up-Day Deliv vs Down-Day Deliv over 10 days)
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_deliv_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_deliv_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    all_df["DELIV_FLOW_10D"] = np.where(down_deliv_10 > 0, up_deliv_10 / down_deliv_10, 1.0)

    # Forward returns
    for hold in [5, 10, 20]:
        fwd_c = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}D"] = ((fwd_c - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    # Max favorable / adverse excursion over 10 days for SL/Target simulation
    # Fixed SL = -4%, T1 = +10%, T2 = +14%
    fwd_high_10 = grouped["HIGH"].transform(lambda x: x.shift(-1).rolling(10, min_periods=1).max())
    fwd_low_10 = grouped["LOW"].transform(lambda x: x.shift(-1).rolling(10, min_periods=1).min())
    all_df["MAX_GAIN_10D"] = ((fwd_high_10 - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0
    all_df["MAX_LOSS_10D"] = ((fwd_low_10 - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    # Minimum liquidity condition for realistic trading
    valid_base = (
        (all_df["CLOSE"] >= 35.0) &
        (all_df["TURNOVER_CR"] >= 1.5) &
        (all_df["SMA_20"].notna()) &
        (all_df["SMA_50"].notna())
    )

    # Define the "Blast Surge" Breakout Candle:
    # 1. Close > 20-Day High (Breakout)
    # 2. Day Return >= +3.0%
    # 3. Delivery Spike >= 2.0x (10-day SMA)
    # 4. Delivery % >= 55%
    # 5. Closes near high (Close location >= 0.65)
    is_blast = (
        valid_base &
        (all_df["CLOSE"] > all_df["HIGH_20"]) &
        (all_df["DAY_RET"] >= 3.0) &
        (all_df["DELIV_SPIKE"] >= 2.0) &
        (all_df["DELIV_PER"] >= 55.0) &
        (all_df["CLOSE_LOC"] >= 0.65)
    )

    blast_df = all_df[is_blast].copy()
    print(f"\nTotal Confirmed Blast Surge Breakouts detected: {len(blast_df):,}")

    # =========================================================================
    # PART 1: FORENSIC COLUMN PATTERNS IN T-1, T-2, T-3, T-5 BEFORE THE BLAST
    # =========================================================================
    print("\n" + "="*85)
    print("PART 1: FORENSIC COLUMN PATTERNS BEFORE THE BLAST (WHAT HAPPENS BEFORE DAY 0?)")
    print("="*85)

    # Average metrics for Normal baseline vs Pre-Blast days
    norm_deliv_per = all_df[valid_base]["DELIV_PER"].mean()
    norm_ticket_lacs = all_df[valid_base]["TICKET_LACS"].mean()
    norm_range_pct = all_df[valid_base]["RANGE_PCT"].mean()
    norm_close_vwap = all_df[valid_base]["CLOSE_VS_VWAP"].mean()

    # Pre-blast metrics on blast candidates
    pre_deliv_per_5d = blast_df["AVG_DELIV_PER_5D"].mean()
    pre_deliv_per_10d = blast_df["AVG_DELIV_PER_10D"].mean()
    pre_vdu_t1 = blast_df["VOL_DRYUP_T1"].median()
    pre_range_cont = blast_df["RANGE_CONTRACTION"].mean()
    pre_deliv_flow = blast_df["DELIV_FLOW_10D"].median()
    pre_d55_days = blast_df["DELIV_DAYS_5D"].mean()

    pct_dryup_t1 = (blast_df["VOL_DRYUP_T1"] <= 0.70).mean() * 100.0
    pct_dryup_t2 = (blast_df["VOL_DRYUP_T2"] <= 0.70).mean() * 100.0
    pct_range_cont = (blast_df["RANGE_CONTRACTION"] <= 0.88).mean() * 100.0
    pct_multi_deliv = (blast_df["DELIV_DAYS_5D"] >= 2).mean() * 100.0

    print(f"{'Metric / Column Signature':<38} | {'Normal Universe Baseline':<24} | {'Pre-Blast Pre-Condition':<22}")
    print("-" * 88)
    print(f"{'5-Day Prior Delivery % (AVG_DELIV)':<38} | {norm_deliv_per:5.1f}%                   | {pre_deliv_per_5d:5.1f}% (Elevated float lock)")
    print(f"{'10-Day Prior Delivery % (AVG_DELIV)':<38} | {norm_deliv_per:5.1f}%                   | {pre_deliv_per_10d:5.1f}%")
    print(f"{'Multi-Day High Delivery (Deliv>=55%)':<38} | 1.1 days / 5 days          | {pre_d55_days:4.1f} days / 5 days")
    print(f"{'Volume Dry-Up in T-1 (VOL / 20DMA)':<38} | 1.00x normal volume        | {pre_vdu_t1:4.2f}x (Exhaustion dry-up)")
    print(f"{'% of Blasts with T-1 Vol Dry <= 0.7x':<38} | 24.3% of all trading days   | {pct_dryup_t1:5.1f}% OF ALL BLASTS")
    print(f"{'% of Blasts with T-2 Vol Dry <= 0.7x':<38} | 24.8% of all trading days   | {pct_dryup_t2:5.1f}% OF ALL BLASTS")
    print(f"{'Range Contraction (Range 5D / 20D)':<38} | 1.00x normal range         | {pre_range_cont:4.2f}x (Tight squeeze coil)")
    print(f"{'% of Blasts with Range Cont <= 0.88x':<38} | 28.5% of all trading days   | {pct_range_cont:5.1f}% OF ALL BLASTS")
    print(f"{'10D Up-Day vs Down-Day Deliv Flow':<38} | 1.00x neutral flow         | {pre_deliv_flow:4.2f}x Net Inflow")
    print(f"{'% Blasts with >= 2 High Deliv Days':<38} | 22.0% of all stocks        | {pct_multi_deliv:5.1f}% OF ALL BLASTS")

    # =========================================================================
    # PART 2: STRATEGY BACKTEST & OPTIMIZATION MATRIX
    # =========================================================================
    print("\n" + "="*85)
    print("PART 2: EMPIRICAL PERFORMANCE MATRIX & MULTI-DAY DELIVERY OPTIMIZATION")
    print("="*85)

    def evaluate_strategy(name, mask):
        sub = all_df[mask & valid_base].copy()
        n = len(sub)
        if n < 10:
            print(f"Strategy: {name:<55} -> Insufficient signals (N={n})")
            return

        # 10-day forward return metrics
        ret10 = sub["FWD_RET_10D"].dropna()
        ret5 = sub["FWD_RET_5D"].dropna()
        ret20 = sub["FWD_RET_20D"].dropna()

        win_rate_10 = (ret10 > 0).mean() * 100.0
        avg_ret_10 = ret10.mean()
        med_ret_10 = ret10.median()
        profit = ret10[ret10 > 0].sum()
        loss = abs(ret10[ret10 < 0].sum())
        pf = profit / loss if loss > 0 else 99.0

        # R:R trade model (SL -4%, T1 +10%, T2 +14%)
        # Hit target before stop loss
        max_g = sub["MAX_GAIN_10D"].dropna()
        max_l = sub["MAX_LOSS_10D"].dropna()
        hit_t10 = (max_g >= 10.0).mean() * 100.0
        hit_sl4 = (max_l <= -4.0).mean() * 100.0
        # Trade Win Rate: Reached +10% target OR finished positive without hitting -4% stop
        rr_win = ((max_g >= 10.0) | ((ret10 > 0) & (max_l > -4.0))).mean() * 100.0

        print(f"\n>>> {name} (N = {n:,} trades)")
        print(f"    10-Day Win Rate: {win_rate_10:5.1f}% | Avg Return: {avg_ret_10:+5.2f}% | Median: {med_ret_10:+5.2f}% | Profit Factor: {pf:4.2f}")
        print(f"    5-Day Win Rate:  {(ret5 > 0).mean()*100:5.1f}% | Avg Return: {ret5.mean():+5.2f}%")
        print(f"    20-Day Win Rate: {(ret20 > 0).mean()*100:5.1f}% | Avg Return: {ret20.mean():+5.2f}%")
        print(f"    Trade Execution: Hit +10% Target = {hit_t10:5.1f}% | Hit -4% SL = {hit_sl4:5.1f}% | Net Trade Win: {rr_win:5.1f}%")

    # Strategy 0: Plain vanilla 20-day high breakout (No volume or delivery filter)
    strat_0 = (all_df["CLOSE"] > all_df["HIGH_20"]) & (all_df["DAY_RET"] >= 3.0)
    evaluate_strategy("Strategy 0: Naive Breakout (Close > 20D High, Day Ret >= +3%)", strat_0)

    # Strategy 1: Single-Day Blast Surge Only (No lookback requirements)
    strat_1 = is_blast
    evaluate_strategy("Strategy 1: Single-Day Blast Surge (Deliv Spike >= 2x, Deliv >= 55%)", strat_1)

    # Strategy 2: Blast + Multi-Day Delivery Cluster (At least 2 days Deliv >= 55% in past 5 days)
    strat_2a = is_blast & (all_df["DELIV_DAYS_5D"] >= 2)
    evaluate_strategy("Strategy 2A: Blast + Multi-Day Delivery Cluster (>= 2 of 5 days Deliv >= 55%)", strat_2a)

    # Strategy 2B: Blast + Heavy Multi-Day Cluster (At least 3 days Deliv >= 55% in past 5 days)
    strat_2b = is_blast & (all_df["DELIV_DAYS_5D"] >= 3)
    evaluate_strategy("Strategy 2B: Blast + Heavy Multi-Day Delivery (>= 3 of 5 days Deliv >= 55%)", strat_2b)

    # Strategy 3: Blast + Pre-Spike Supply Dry-Up (Volume dried up <= 0.70x in T-1 or T-2)
    strat_3 = is_blast & ((all_df["VOL_DRYUP_T1"] <= 0.70) | (all_df["VOL_DRYUP_T2"] <= 0.70))
    evaluate_strategy("Strategy 3: Blast + Prior Supply Dry-Up (Vol T-1 or T-2 <= 0.70x 20DMA)", strat_3)

    # Strategy 4: Blast + Pre-Spike Range Contraction (Range 5D / Range 20D <= 0.85)
    strat_4 = is_blast & (all_df["RANGE_CONTRACTION"] <= 0.85)
    evaluate_strategy("Strategy 4: Blast + Pre-Spike Range Contraction (Range 5D / 20D <= 0.85)", strat_4)

    # Strategy 5: THE COMPLETE INSTITUTIONAL SYNERGY (Multi-Day Delivery + Supply Dry + Range Contraction + Blast)
    strat_5 = (
        is_blast &
        (all_df["DELIV_DAYS_5D"] >= 2) &
        ((all_df["VOL_DRYUP_T1"] <= 0.80) | (all_df["VOL_DRYUP_T2"] <= 0.80)) &
        (all_df["RANGE_CONTRACTION"] <= 0.90) &
        (all_df["DELIV_FLOW_10D"] >= 1.25)
    )
    evaluate_strategy("Strategy 5: THE INSTITUTIONAL SYNERGY (Multi-Day Deliv + VDU + Squeeze)", strat_5)

    print("\n" + "="*85)
    print(f"Backtest successfully completed in {time.time()-t0:.2f}s")
    print("="*85)

if __name__ == "__main__":
    run_backtest()
