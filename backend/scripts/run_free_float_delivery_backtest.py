"""
Alpha India - Free Float Delivery Absorption Backtest Engine
Evaluates:
1. Delivery volume / value as a direct percentage of Free Float Market Cap.
2. Float size stratification: Low Float (< Rs 1,500 Cr) vs High Float (> Rs 5,000 Cr).
3. Cumulative 5-day and 10-day Free Float Absorption (% of total non-promoter float absorbed).
4. Performance differential across win rates, profit factors, and explosive multi-bagger runners.
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

# Ensure backend is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run_free_float_backtest():
    t0 = time.time()
    print("Loading Free Float metadata from Database...")
    db = SessionLocal()
    records = db.query(
        ScreenerGrowthRecord.symbol,
        ScreenerGrowthRecord.market_cap,
        ScreenerGrowthRecord.current_price,
        ScreenerGrowthRecord.promoter_holding,
        ScreenerGrowthRecord.public_holding
    ).all()
    db.close()

    meta_df = pd.DataFrame(records, columns=['symbol', 'market_cap', 'current_price', 'promoter_holding', 'public_holding'])
    meta_df['symbol'] = meta_df['symbol'].astype(str).str.strip()
    meta_df['promoter_holding'] = pd.to_numeric(meta_df['promoter_holding'], errors='coerce').fillna(50.0)
    meta_df['market_cap'] = pd.to_numeric(meta_df['market_cap'], errors='coerce')
    
    # Free float calculations
    meta_df['free_float_pct'] = np.clip(100.0 - meta_df['promoter_holding'], 5.0, 95.0)
    meta_df['free_float_mcap_cr'] = meta_df['market_cap'] * (meta_df['free_float_pct'] / 100.0)
    
    valid_symbols = set(meta_df.dropna(subset=['market_cap'])['symbol'].unique())
    print(f"Loaded Free Float metadata for {len(meta_df)} symbols ({len(valid_symbols)} with valid Market Cap).")

    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_file_date)[-350:]
    print(f"Reading {len(files)} bhavcopy files...")

    bhav_records = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
            df.columns = [c.strip() for c in df.columns]
            if "SERIES" in df.columns:
                df = df[df["SERIES"].astype(str).str.strip() == "EQ"]
            df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
            df = df[df["SYMBOL"].isin(valid_symbols)]
            
            df["DATE"] = pd.to_datetime(df["DATE1"].astype(str).str.strip(), format="%d-%b-%Y")
            df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
            df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
            df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

            bhav_records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VOLUME", "TURNOVER_CR", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(bhav_records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Loaded {len(all_df):,} daily records in {time.time()-t0:.2f}s. Merging Free Float metadata...")

    # Merge Free Float columns
    all_df = all_df.merge(meta_df[['symbol', 'market_cap', 'promoter_holding', 'free_float_pct', 'free_float_mcap_cr']], left_on='SYMBOL', right_on='symbol', how='inner')
    print(f"Merged dataset shape: {all_df.shape}")

    grouped = all_df.groupby("SYMBOL", group_keys=False)

    print("Computing technical indicators and free-float absorption ratios...")
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]

    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())

    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)

    # Free Float Delivery metrics
    all_df["DELIV_CR"] = (all_df["TURNOVER_CR"] * all_df["DELIV_PER"]) / 100.0
    
    # 1-day Free Float Turnover (% of free float absorbed today)
    all_df["FLOAT_ABSORB_1D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["DELIV_CR"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

    # Multi-day Cumulative Free Float Absorption
    deliv_5d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0.0)
    deliv_10d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0.0)
    all_df["FLOAT_ABSORB_5D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_5d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
    all_df["FLOAT_ABSORB_10D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_10d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

    # Multi-Day Delivery Clusters
    all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
    all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)

    # Institutional Net Up/Down Flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    all_df["DELIV_FLOW_10D"] = np.where(down_10 > 0, up_10 / down_10, 1.0)

    # Range Contraction
    range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)

    # Forward returns
    for hold in [5, 10, 20]:
        fwd_c = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}D"] = ((fwd_c - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    valid_base = (
        (all_df["CLOSE"] >= 35.0) &
        (all_df["TURNOVER_CR"] >= 1.5) &
        (all_df["market_cap"] >= 500.0) &
        (all_df["free_float_mcap_cr"] > 0)
    )

    is_stage2 = (all_df["CLOSE"] > all_df["SMA_50"]) & (all_df["CLOSE"] > all_df["SMA_20"])

    is_blast = (
        valid_base &
        is_stage2 &
        (all_df["CLOSE"] > all_df["HIGH_20"]) &
        (all_df["DAY_RET"] >= 3.0) &
        (all_df["DELIV_SPIKE"] >= 2.0) &
        (all_df["DELIV_PER"] >= 55.0) &
        (all_df["CLOSE_LOC"] >= 0.65)
    )

    print(f"\nTotal Stage-2 Delivery Blasts with full Free Float telemetry: {is_blast.sum():,}")

    def eval_group(title, mask):
        sub = all_df[mask & valid_base].copy()
        n = len(sub)
        if n < 5:
            print(f"Group: {title:<65} -> Insufficient signals (N={n})")
            return
        r5 = sub["FWD_RET_5D"].dropna()
        r10 = sub["FWD_RET_10D"].dropna()
        r20 = sub["FWD_RET_20D"].dropna()

        wr10 = (r10 > 0).mean() * 100.0
        avg10 = r10.mean()
        med10 = r10.median()
        profit = r10[r10 > 0].sum()
        loss = abs(r10[r10 < 0].sum())
        pf = profit / loss if loss > 0 else 99.0
        runner10 = (r10 >= 10.0).mean() * 100.0
        runner15 = (r10 >= 15.0).mean() * 100.0

        print(f"\n>>> {title} (N = {n:,} trades)")
        print(f"    Hold 10D: WinRate = {wr10:5.1f}% | AvgRet = {avg10:+5.2f}% | MedRet = {med10:+5.2f}% | ProfitFactor = {pf:4.2f} | >+10% Win = {runner10:4.1f}% | >+15% SuperWin = {runner15:4.1f}%")
        print(f"    Hold  5D: WinRate = {(r5>0).mean()*100:5.1f}% | AvgRet = {r5.mean():+5.2f}%")
        print(f"    Hold 20D: WinRate = {(r20>0).mean()*100:5.1f}% | AvgRet = {r20.mean():+5.2f}% | ProfitFactor 20D = {(r20[r20>0].sum()/max(1e-4,abs(r20[r20<0].sum()))):4.2f}")

    # =========================================================================
    # TEST 1: FREE FLOAT SIZE STRATIFICATION
    # =========================================================================
    print("\n" + "="*85)
    print("TEST 1: FREE FLOAT SIZE STRATIFICATION (LOW FLOAT vs MEGA FLOAT)")
    print("="*85)

    eval_group("Baseline: All Stage-2 Blasts (Any Float Size)", is_blast)
    eval_group("TIGHT FREE FLOAT (< Rs 1,000 Cr Free Float MCap)", is_blast & (all_df["free_float_mcap_cr"] < 1000.0))
    eval_group("MID FREE FLOAT (Rs 1,000 Cr to Rs 3,500 Cr Free Float MCap)", is_blast & (all_df["free_float_mcap_cr"].between(1000.0, 3500.0)))
    eval_group("LARGE / MEGA FREE FLOAT (> Rs 3,500 Cr Free Float MCap)", is_blast & (all_df["free_float_mcap_cr"] > 3500.0))

    # =========================================================================
    # TEST 2: SINGLE-DAY FREE FLOAT ABSORPTION INTENSITY
    # =========================================================================
    print("\n" + "="*85)
    print("TEST 2: DAY-OF-BLAST FREE FLOAT ABSORPTION (DELIVERY CR as % OF FREE FLOAT)")
    print("="*85)

    eval_group("Blast Day Absorbs >= 0.5% of ENTIRE Free Float", is_blast & (all_df["FLOAT_ABSORB_1D"] >= 0.50))
    eval_group("Blast Day Absorbs >= 1.0% of ENTIRE Free Float", is_blast & (all_df["FLOAT_ABSORB_1D"] >= 1.00))
    eval_group("Blast Day Absorbs >= 2.0% of ENTIRE Free Float (High Absorption Shock)", is_blast & (all_df["FLOAT_ABSORB_1D"] >= 2.00))

    # =========================================================================
    # TEST 3: MULTI-DAY CUMULATIVE FREE FLOAT ABSORPTION (STEALTH FLOAT LOCK)
    # =========================================================================
    print("\n" + "="*85)
    print("TEST 3: MULTI-DAY CUMULATIVE FREE FLOAT ABSORPTION (PRE-BLAST FLOAT LOCK)")
    print("="*85)

    eval_group("5-Day Prior Delivery Absorbed >= 1.5% of Free Float", is_blast & (all_df["FLOAT_ABSORB_5D"] >= 1.5))
    eval_group("5-Day Prior Delivery Absorbed >= 3.0% of Free Float", is_blast & (all_df["FLOAT_ABSORB_5D"] >= 3.0))
    eval_group("10-Day Prior Delivery Absorbed >= 5.0% of Free Float", is_blast & (all_df["FLOAT_ABSORB_10D"] >= 5.0))
    eval_group("10-Day Prior Delivery Absorbed >= 8.0% of Free Float (Heavy Float Cornering)", is_blast & (all_df["FLOAT_ABSORB_10D"] >= 8.0))

    # =========================================================================
    # TEST 4: THE ULTIMATE LOW-FLOAT MULTI-DAY APEX FORMULA
    # =========================================================================
    print("\n" + "="*85)
    print("TEST 4: THE ULTIMATE LOW-FLOAT MULTI-DAY APEX ENGINE")
    print("="*85)

    apex_low_float = (
        is_blast &
        (all_df["free_float_mcap_cr"] <= 2500.0) &      # Tight to moderate float
        (all_df["FLOAT_ABSORB_1D"] >= 0.75) &          # High single-day float absorption shock
        (all_df["DELIV_DAYS_5D"] >= 2) &               # Multi-day persistence
        (all_df["DELIV_FLOW_10D"] >= 1.4)              # Institutional net inflow
    )
    eval_group("ULTIMATE APEX FORMULA: Tight Float (<=2500 Cr) + Day Float Absorb >=0.75% + Multi-Deliv >=2D + Inflow >=1.4x", apex_low_float)

    print("\n" + "="*85)
    print(f"Free Float Backtest successfully completed in {time.time()-t0:.2f}s")
    print("="*85)

if __name__ == "__main__":
    run_free_float_backtest()
