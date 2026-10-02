"""
Alpha India - Quality-Filtered Institutional Delivery Accumulation Test
Tests:
1. Close Location in Upper 30% of Candle (Absorption vs Distribution)
2. Pre-Ignition Supply Dry-up (Volume 5 SMA < Volume 20 SMA)
3. Delivery Turnover Floor (>= 5 Crore)
4. Sweet Spot 15-30 Day Base vs 60-90 Day Stagnation
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_quality_test():
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(glob.glob(str(base_dir / "sec_bhavdata_full_*.csv")))
    import datetime
    def parse_file_date(f):
        try:
            raw = os.path.basename(f).replace("sec_bhavdata_full_", "").replace(".csv", "")
            return datetime.datetime.strptime(raw, "%d%m%Y")
        except Exception:
            return datetime.datetime.min
    files = sorted(files, key=parse_file_date)

    master_path = Path(__file__).resolve().parent.parent / "data" / "nse_companies_master.csv"
    comp_df = pd.read_csv(master_path)
    valid_symbols = set(comp_df["SYMBOL"].dropna().str.strip())

    records = []
    for f in files:
        try:
            df = pd.read_csv(f)
            df.columns = [c.strip() for c in df.columns]
            if "SERIES" in df.columns:
                df = df[df["SERIES"].str.strip() == "EQ"]
            df["SYMBOL"] = df["SYMBOL"].str.strip()
            df = df[df["SYMBOL"].isin(valid_symbols)]
            df["DATE"] = pd.to_datetime(df["DATE1"].str.strip(), format="%d-%b-%Y")
            df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
            df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
            df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
            df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)
            records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VOLUME", "TURNOVER_CR", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    grouped = all_df.groupby("SYMBOL", group_keys=False)

    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["DELIV_TURNOVER_CR"] = all_df["TURNOVER_CR"] * (all_df["DELIV_PER"] / 100.0)
    
    # Close Location: 1.0 = Closed at High of Day, 0.0 = Closed at Low of Day
    candle_range = all_df["HIGH"] - all_df["LOW"]
    all_df["CLOSE_LOCATION"] = np.where(candle_range > 0, (all_df["CLOSE"] - all_df["LOW"]) / candle_range, 0.5)

    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)

    # 20D (1-month) Net Delivery Inflow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["NET_DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)

    # Forward returns
    for hold in [10, 20]:
        fwd_close = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}"] = ((fwd_close - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    print("\n" + "="*85)
    print("EMPIRICAL TEST: WHAT SEPARATES REAL INSTITUTIONAL INTEREST FROM FAKE DELIVERY SPIKES?")
    print("="*85)

    tests = [
        ("Raw 1-Day Delivery Spike Alone (Deliv >= 65%, Spike >= 2.5x)", 
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["TURNOVER_CR"] >= 2.0)),

        ("Fake Spike Trap: High Delivery but Closed in LOWER HALF of Candle (Close Location < 0.40)",
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE_LOCATION"] < 0.40)),

        ("Genuine Absorption: High Delivery & Closed at UPPER 30% of Candle (Close Location >= 0.70)",
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE_LOCATION"] >= 0.70)),

        ("Genuine Absorption + Institutional Capital Floor (Deliv Turnover >= 5 Cr)",
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DELIV_TURNOVER_CR"] >= 5.0) & (all_df["CLOSE_LOCATION"] >= 0.70)),

        ("Apex Model: Prior Volume Dry-Up (Vol5/Vol20 <= 1.0) + Absorption + Breakout Shelf",
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DELIV_TURNOVER_CR"] >= 5.0) & \
         (all_df["CLOSE_LOCATION"] >= 0.70) & (all_df["VOL_DRYUP"] <= 1.0) & (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98)),

        ("Full System: Apex Model + 1-Month Net Accumulation Flow >= 1.25x",
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DELIV_TURNOVER_CR"] >= 5.0) & \
         (all_df["CLOSE_LOCATION"] >= 0.70) & (all_df["VOL_DRYUP"] <= 1.0) & (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98) & \
         (all_df["NET_DELIV_FLOW_20D"] >= 1.25)),
    ]

    for label, mask in tests:
        sub = all_df[mask]
        print(f"\n{label} (N={len(sub)}):")
        for hold in [10, 20]:
            v = sub[f"FWD_RET_{hold}"].dropna()
            if len(v) == 0: continue
            wr = (v > 0).mean() * 100
            avg = v.mean()
            med = v.median()
            profit = v[v > 0].sum()
            loss = abs(v[v < 0].sum())
            pf = profit / loss if loss > 0 else 0
            big_win = (v >= 10.0).mean() * 100
            big_loss = (v <= -8.0).mean() * 100
            print(f"  Hold {hold:2d}D: N={len(v):4d} | WinRate={wr:5.1f}% | AvgRet={avg:+5.2f}% | MedRet={med:+5.2f}% | PF={pf:4.2f} | >+10% Win={big_win:4.1f}% | <-8% Loss={big_loss:4.1f}%")

if __name__ == "__main__":
    run_quality_test()
