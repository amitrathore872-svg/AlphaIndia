"""
Alpha India - Quantitative Delivery Lookback Research
Empirically evaluates the optimal lookback window (20D / 1mo, 40D / 2mo, 60D / 3mo, 90D / 4.5mo)
and multi-session accumulation metrics vs single-day spikes.
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_lookback_research():
    t0 = time.time()
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(glob.glob(str(base_dir / "sec_bhavdata_full_*.csv")))
    if not files:
        base_dir = Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "nse_delivery"
        files = sorted(glob.glob(str(base_dir / "sec_bhavdata_full_*.csv")))

    print(f"Loading {len(files)} bhavcopy files...")
    
    # Sort files chronologically
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
        except Exception as e:
            continue

    all_df = pd.concat(records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Data loaded: {len(all_df)} rows across {all_df['SYMBOL'].nunique()} equities and {all_df['DATE'].nunique()} dates in {time.time() - t0:.1f}s.")

    grouped = all_df.groupby("SYMBOL", group_keys=False)

    # Base price indicators
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["DELIV_TURNOVER_CR"] = all_df["TURNOVER_CR"] * (all_df["DELIV_PER"] / 100.0)
    
    # Intraday candle close location (Close - Low) / (High - Low)
    candle_range = all_df["HIGH"] - all_df["LOW"]
    all_df["CLOSE_LOCATION"] = np.where(candle_range > 0, (all_df["CLOSE"] - all_df["LOW"]) / candle_range, 0.5)

    # Accumulation session flag: Delivery >= 55% AND (Close in upper 50% of bar OR Day Return >= 0)
    all_df["IS_ACCUM_DAY"] = (all_df["DELIV_PER"] >= 55.0) & ((all_df["CLOSE_LOCATION"] >= 0.5) | (all_df["DAY_RET"] >= 0.5))

    # Single-day spike flag (The status quo: 1-day spike without history check)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["SINGLE_DAY_SPIKE"] = (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_QTY"] >= 2.5 * all_df["DELIV_10_SMA"]) & (all_df["TURNOVER_CR"] >= 2.0)

    # -------------------------------------------------------------
    # Multi-window Metrics: 20D (1mo), 40D (2mo), 60D (3mo), 90D (4.5mo)
    # -------------------------------------------------------------
    windows = [20, 40, 60, 90]
    for w in windows:
        # 1. Total accumulation sessions in window
        all_df[f"ACCUM_DAYS_{w}"] = grouped["IS_ACCUM_DAY"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        all_df[f"ACCUM_RATIO_{w}"] = all_df[f"ACCUM_DAYS_{w}"] / float(w)
        
        # 2. Cumulative Delivery Turnover (Cr)
        all_df[f"DELIV_TURNOVER_SUM_{w}"] = grouped["DELIV_TURNOVER_CR"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        all_df[f"AVG_DELIV_PER_{w}"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean())
        
        # 3. Price consolidation range over window: (Max High - Min Low) / Close
        w_high = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).max())
        w_low = grouped["LOW"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).min())
        all_df[f"BASE_TIGHTNESS_{w}"] = np.where(all_df["CLOSE"] > 0, (w_high - w_low) / all_df["CLOSE"], 1.0)
        
        # 4. Proximity to window High: (High - Close) / High
        all_df[f"PROXIMITY_HIGH_{w}"] = np.where(w_high > 0, (w_high - all_df["CLOSE"]) / w_high, 1.0)

    # Forward returns: 10-day, 20-day, 40-day
    for hold in [10, 20, 40]:
        fwd_close = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}"] = ((fwd_close - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    print("\n" + "="*80)
    print("EMPIRICAL COMPARISON: SINGLE-DAY SPIKE vs MULTI-WINDOW ACCUMULATION")
    print("="*80)

    # 1. Baseline: Single-Day Spike Only (What fails today)
    single_mask = all_df["SINGLE_DAY_SPIKE"] & (all_df["TURNOVER_CR"] >= 2.0)
    single_res = all_df[single_mask]
    
    print("\n--- 1. Single-Day Spike Isolated (No Multi-Month Context) ---")
    for hold in [10, 20, 40]:
        valid = single_res[f"FWD_RET_{hold}"].dropna()
        win_rate = (valid > 0).mean() * 100
        avg_ret = valid.mean()
        median_ret = valid.median()
        profit = valid[valid > 0].sum()
        loss = abs(valid[valid < 0].sum())
        pf = profit / loss if loss > 0 else 0
        print(f"Hold {hold:2d}D: N={len(valid):5d} | WinRate={win_rate:5.1f}% | AvgRet={avg_ret:+5.2f}% | MedRet={median_ret:+5.2f}% | ProfitFactor={pf:4.2f}")

    # 2. Test Different Lookback Windows
    print("\n--- 2. Multi-Month Accumulation by Lookback Window ---")
    results_summary = []
    
    for w in windows:
        months = w / 20.0
        cond = (
            (all_df[f"ACCUM_RATIO_{w}"] >= 0.35) &           # At least 35% of all sessions had institutional accumulation
            (all_df[f"AVG_DELIV_PER_{w}"] >= 50.0) &         # Average delivery % throughout the window >= 50%
            (all_df[f"BASE_TIGHTNESS_{w}"] <= 0.25) &        # Tight horizontal base (volatility contraction <= 25%)
            (all_df[f"PROXIMITY_HIGH_{w}"] <= 0.03) &        # Within 3% of the window high (at breakout shelf)
            (all_df["TURNOVER_CR"] >= 2.0)                   # Liquid
        )
        
        w_df = all_df[cond]
        print(f"\n[Window: {w:2d} Days / {months:.1f} Months] Total qualifying signals: {len(w_df)}")
        for hold in [10, 20, 40]:
            valid = w_df[f"FWD_RET_{hold}"].dropna()
            if len(valid) == 0:
                continue
            win_rate = (valid > 0).mean() * 100
            avg_ret = valid.mean()
            median_ret = valid.median()
            profit = valid[valid > 0].sum()
            loss = abs(valid[valid < 0].sum())
            pf = profit / loss if loss > 0 else 0
            
            # Big winners (>15% return) vs Big losers (<-10% return)
            big_win = (valid >= 15.0).mean() * 100
            big_loss = (valid <= -10.0).mean() * 100
            print(f"  Hold {hold:2d}D: N={len(valid):5d} | WinRate={win_rate:5.1f}% | AvgRet={avg_ret:+5.2f}% | MedRet={median_ret:+5.2f}% | PF={pf:4.2f} | >+15% Win={big_win:4.1f}% | <-10% Loss={big_loss:4.1f}%")

    # 3. Hybrid Strategy: 1-Day Ignition Trigger + Multi-Month Accumulation Foundation
    print("\n" + "="*80)
    print("--- 3. HYBRID BLUEPRINT: Multi-Month Base Accumulation + Fresh Delivery Ignition ---")
    print("="*80)
    for w in [20, 40, 60]:
        hybrid_cond = (
            (all_df[f"ACCUM_RATIO_{w}"] >= 0.30) &
            (all_df[f"AVG_DELIV_PER_{w}"] >= 45.0) &
            (all_df[f"BASE_TIGHTNESS_{w}"] <= 0.25) &
            (all_df["SINGLE_DAY_SPIKE"])                     # Fresh ignition candle
        )
        hy_df = all_df[hybrid_cond]
        print(f"\n[Hybrid: {w:2d}D Base ({w/20:.1f}mo) + Fresh 1D Ignition] Signals: {len(hy_df)}")
        for hold in [10, 20, 40]:
            valid = hy_df[f"FWD_RET_{hold}"].dropna()
            if len(valid) == 0:
                continue
            win_rate = (valid > 0).mean() * 100
            avg_ret = valid.mean()
            profit = valid[valid > 0].sum()
            loss = abs(valid[valid < 0].sum())
            pf = profit / loss if loss > 0 else 0
            print(f"  Hold {hold:2d}D: N={len(valid):4d} | WinRate={win_rate:5.1f}% | AvgRet={avg_ret:+5.2f}% | PF={pf:4.2f}")

    print("\nResearch execution complete in {:.1f}s.".format(time.time() - t0))

if __name__ == "__main__":
    run_lookback_research()
