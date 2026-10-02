"""
Alpha India - Deep Dive Delivery Accumulation Research
Tests:
1. Stage 2 Trend (Close > SMA 50 > SMA 200) + Sustained Multi-Month Delivery
2. Up-Volume vs Down-Volume Delivery Flow (D-A/D Ratio over 1, 2, 3 months)
3. Delivery Concentration: Is 1 month (20D), 2 months (40D), or 3 months (60D) optimal?
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_deep_research():
    t0 = time.time()
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
    all_df["DELIV_CR"] = all_df["TURNOVER_CR"] * (all_df["DELIV_PER"] / 100.0)

    # Trend moving averages
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=15).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=35).mean())
    all_df["SMA_200"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(200, min_periods=100).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=35).max())

    # Up-day vs Down-day delivery volume
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)

    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    # Windows: 20D (1m), 40D (2m), 60D (3m)
    for w in [20, 40, 60]:
        # Up-day delivery sum vs Down-day delivery sum
        up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        # Institutional Delivery Net Flow Ratio: Up Delivery / (Down Delivery + 1e-5)
        all_df[f"DELIV_AD_RATIO_{w}"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
        
        # Delivery % average over window
        all_df[f"AVG_DELIV_PER_{w}"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean())
        
        # Delivery volume trend: Last 10 days delivery vs w days delivery
        deliv_w = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean())
        all_df[f"DELIV_EXPANSION_{w}"] = np.where(deliv_w > 0, all_df["DELIV_10_SMA"] / deliv_w, 1.0)

    # Forward returns
    for hold in [10, 20, 40]:
        fwd_close = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}"] = ((fwd_close - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    print("Data processed. Running test matrix...")

    # Stage 2 Trend: Close > SMA 50 and (SMA 50 > SMA 200 or SMA 200 is NaN/Early) and Close > SMA 20
    is_stage2 = (all_df["CLOSE"] > all_df["SMA_50"]) & (all_df["CLOSE"] > all_df["SMA_20"]) & (
        (all_df["SMA_200"].isna()) | (all_df["SMA_50"] >= all_df["SMA_200"] * 0.98)
    )

    print("\n" + "="*85)
    print("TEST 1: STAGE 2 TREND FILTERED vs NON-TREND DELIVERY SPIKES")
    print("="*85)
    for name, mask in [
        ("Single-Day Delivery Spike in DOWNTREND (Close < SMA 50)", (all_df["DELIV_PER"] >= 65) & (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE"] < all_df["SMA_50"])),
        ("Single-Day Delivery Spike in UPTREND (Close > SMA 50)", (all_df["DELIV_PER"] >= 65) & (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE"] > all_df["SMA_50"])),
        ("Single-Day Delivery Spike in FULL STAGE 2 (Close > 50 > 200)", (all_df["DELIV_PER"] >= 65) & (all_df["TURNOVER_CR"] >= 2.0) & is_stage2),
    ]:
        sub = all_df[mask]
        print(f"\n{name} (N={len(sub)}):")
        for hold in [10, 20, 40]:
            v = sub[f"FWD_RET_{hold}"].dropna()
            if len(v) == 0: continue
            wr = (v > 0).mean() * 100
            avg = v.mean()
            med = v.median()
            profit = v[v > 0].sum()
            loss = abs(v[v < 0].sum())
            pf = profit / loss if loss > 0 else 0
            print(f"  Hold {hold:2d}D: N={len(v):5d} | WinRate={wr:5.1f}% | AvgRet={avg:+5.2f}% | MedRet={med:+5.2f}% | PF={pf:4.2f}")

    print("\n" + "="*85)
    print("TEST 2: INSTITUTIONAL ACCUMULATION FLOW (UP-DELIVERY vs DOWN-DELIVERY)")
    print("Window Comparison: 20 Days (1 Month) vs 40 Days (2 Months) vs 60 Days (3 Months)")
    print("="*85)

    for w in [20, 40, 60]:
        months = w / 20.0
        # Conditions:
        # 1. Stage 2 Trend
        # 2. Institutional Net Delivery Ratio >= 1.5x (At least 1.5x more delivery volume on up-days than down-days)
        # 3. Base Delivery % >= 55% average
        # 4. Breaking out or within 3% of 50D High
        cond = (
            is_stage2 &
            (all_df[f"DELIV_AD_RATIO_{w}"] >= 1.5) &
            (all_df[f"AVG_DELIV_PER_{w}"] >= 50.0) &
            (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.97) &
            (all_df["TURNOVER_CR"] >= 2.0)
        )
        sub = all_df[cond]
        print(f"\n[Window: {w} Days / {months:.0f} Month(s)] Net Accumulation Flow >= 1.5x | Avg Deliv >= 50% | Breakout Zone:")
        print(f"Total signals: {len(sub)}")
        for hold in [10, 20, 40]:
            v = sub[f"FWD_RET_{hold}"].dropna()
            if len(v) == 0: continue
            wr = (v > 0).mean() * 100
            avg = v.mean()
            med = v.median()
            profit = v[v > 0].sum()
            loss = abs(v[v < 0].sum())
            pf = profit / loss if loss > 0 else 0
            big_win = (v >= 15.0).mean() * 100
            big_loss = (v <= -10.0).mean() * 100
            print(f"  Hold {hold:2d}D: N={len(v):5d} | WinRate={wr:5.1f}% | AvgRet={avg:+5.2f}% | MedRet={med:+5.2f}% | PF={pf:4.2f} | >+15% Win={big_win:4.1f}% | <-10% Loss={big_loss:4.1f}%")

    print("\n" + "="*85)
    print("TEST 3: ELITE HYBRID: 1-to-3 MONTH SUSTAINED ACCUMULATION + FRESH IGNITION SPIKE")
    print("="*85)
    for w in [20, 40, 60]:
        months = w / 20.0
        cond = (
            is_stage2 &
            (all_df[f"DELIV_AD_RATIO_{w}"] >= 1.5) &
            (all_df[f"AVG_DELIV_PER_{w}"] >= 50.0) &
            (all_df["DELIV_PER"] >= 65.0) &                  # Today's delivery % >= 65%
            (all_df["DELIV_QTY"] >= 2.0 * all_df["DELIV_10_SMA"]) & # Today's volume spike >= 2x
            (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98) &
            (all_df["TURNOVER_CR"] >= 2.0)
        )
        sub = all_df[cond]
        print(f"\n[Hybrid: {w}D ({months:.0f} Mo) Up/Down Flow >= 1.5x + Today Ignition Spike >= 2.0x & Deliv >= 65%]:")
        print(f"Total signals: {len(sub)}")
        for hold in [10, 20, 40]:
            v = sub[f"FWD_RET_{hold}"].dropna()
            if len(v) == 0: continue
            wr = (v > 0).mean() * 100
            avg = v.mean()
            med = v.median()
            profit = v[v > 0].sum()
            loss = abs(v[v < 0].sum())
            pf = profit / loss if loss > 0 else 0
            big_win = (v >= 15.0).mean() * 100
            big_loss = (v <= -10.0).mean() * 100
            print(f"  Hold {hold:2d}D: N={len(v):5d} | WinRate={wr:5.1f}% | AvgRet={avg:+5.2f}% | MedRet={med:+5.2f}% | PF={pf:4.2f} | >+15% Win={big_win:4.1f}% | <-10% Loss={big_loss:4.1f}%")

    print(f"\nExecution finished in {time.time() - t0:.1f}s")

if __name__ == "__main__":
    run_deep_research()
