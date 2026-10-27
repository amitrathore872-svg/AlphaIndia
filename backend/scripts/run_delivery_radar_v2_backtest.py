"""
Alpha India - Delivery Radar 2.0 Comprehensive Backtest Engine
==============================================================
Empirically evaluates the complete Delivery Radar 2.0 methodology against 350+ trading sessions:
1. Multi-Day Free Float Absorption (5-day & 10-day)
2. Buyer vs Seller Dominance Sweet-Spot (70% - 76.5%)
3. Pre-Breakout Supply Dry-Up & Range Contraction Coils
4. Climax Distribution Shield (flags 1-day >= 2% shocks)
5. 100-Point Conviction Scoring vs Forward 5D, 10D, 20D Returns, Win Rates, Profit Factors, and Max Favorable Excursions (MFE).
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

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run_delivery_radar_v2_backtest():
    t0 = time.time()
    print("=" * 80)
    print("  ALPHA INDIA - DELIVERY RADAR 2.0 COMPREHENSIVE BACKTEST BENCHMARK")
    print("=" * 80)
    print("Loading Free Float metadata from PostgreSQL...")
    db = SessionLocal()
    records = db.query(
        ScreenerGrowthRecord.symbol,
        ScreenerGrowthRecord.company_name,
        ScreenerGrowthRecord.sector,
        ScreenerGrowthRecord.market_cap,
        ScreenerGrowthRecord.promoter_holding,
        ScreenerGrowthRecord.public_holding
    ).all()
    db.close()

    meta_df = pd.DataFrame(records, columns=['symbol', 'company_name', 'sector', 'market_cap', 'promoter_holding', 'public_holding'])
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
    print(f"Reading {len(files)} bhavcopy files ({files[0].stem} to {files[-1].stem})...")

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
            df["AVG_PRICE"] = pd.to_numeric(df["AVG_PRICE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

            bhav_records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "AVG_PRICE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(bhav_records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Loaded {len(all_df):,} daily records in {time.time()-t0:.2f}s. Merging Free Float metadata...")

    all_df = all_df.merge(meta_df[['symbol', 'market_cap', 'promoter_holding', 'free_float_pct', 'free_float_mcap_cr']], left_on='SYMBOL', right_on='symbol', how='inner')

    grouped = all_df.groupby("SYMBOL", group_keys=False)

    print("Engineering Delivery Radar 2.0 institutional metrics...")
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]
    all_df["UPPER_WICK_PCT"] = (all_df["HIGH"] - np.maximum(all_df["OPEN"], all_df["CLOSE"])) / all_df["HL_RANGE"]

    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())

    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)

    # Institutional Ticket Size Expansion
    all_df["TICKET_LACS"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
    all_df["TICKET_20_SMA"] = grouped["TICKET_LACS"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["TICKET_SPIKE"] = np.where(all_df["TICKET_20_SMA"] > 0, all_df["TICKET_LACS"] / all_df["TICKET_20_SMA"], 1.0)

    # 10-day Up/Down Delivery Inflow Ratio
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    all_df["DELIV_FLOW_10D"] = np.where(down_10 > 0, up_10 / down_10, 1.0)

    # Delivery Inflow in Crores
    all_df["DELIV_CR"] = (all_df["TURNOVER_CR"] * all_df["DELIV_PER"]) / 100.0
    
    # 1D, 5D, and 10D Free Float Absorption %
    all_df["FLOAT_ABSORB_1D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["DELIV_CR"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
    deliv_5d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0.0)
    deliv_10d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0.0)
    all_df["FLOAT_ABSORB_5D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_5d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
    all_df["FLOAT_ABSORB_10D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_10d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

    # Multi-Day Delivery Clusters
    all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
    all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)
    all_df["DELIV_DAYS_10D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0)

    # Supply Dry-up and Range Contraction
    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, grouped["VOLUME"].transform(lambda x: x.shift(1)) / all_df["VOL_20_SMA"], 1.0)
    range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)
    all_df["PIVOT_DIST_PCT"] = np.where(all_df["HIGH_20"] > 0, ((all_df["HIGH_20"] - all_df["CLOSE"]) / all_df["HIGH_20"]) * 100.0, 0.0)

    # Composite Buyer Demand Ratio
    tot_flow_10 = up_10 + down_10
    up_ratio_10 = np.where(tot_flow_10 > 0, up_10 / tot_flow_10, 0.5)
    ticket_factor = np.clip((all_df["TICKET_SPIKE"] - 0.8) / 1.2, 0.0, 1.0)
    loc_factor = np.clip(all_df["CLOSE_LOC"], 0.0, 1.0)
    deliv_factor = np.clip(all_df["DELIV_PER"] / 100.0, 0.0, 1.0)
    all_df["BUYER_DEMAND_RATIO"] = np.round((0.35 * up_ratio_10 + 0.25 * loc_factor + 0.20 * deliv_factor + 0.20 * ticket_factor) * 100.0, 1)

    # Archetype Classification
    is_climax_shock = (all_df["FLOAT_ABSORB_1D"] >= 2.0) | ((all_df["BUYER_DEMAND_RATIO"] >= 79.0) & (all_df["UPPER_WICK_PCT"] >= 0.25))
    is_sweetspot_demand = (all_df["BUYER_DEMAND_RATIO"] >= 70.0) & (all_df["BUYER_DEMAND_RATIO"] <= 76.5)
    is_breakout = (all_df["CLOSE"] > all_df["HIGH_20"]) & (all_df["DAY_RET"] >= 2.5) & (all_df["DELIV_SPIKE"] >= 1.8)
    is_coil = (all_df["RANGE_CONTRACTION"] <= 0.88) & (all_df["VOL_DRYUP_RATIO"] <= 0.75) & (all_df["PIVOT_DIST_PCT"].abs() <= 3.5)
    is_float_lock = (all_df["FLOAT_ABSORB_5D"] >= 2.5) & (all_df["DELIV_FLOW_10D"] >= 1.4) & (all_df["RANGE_CONTRACTION"] <= 0.90)
    is_multi_deliv = (all_df["DELIV_DAYS_5D"] >= 2) & (all_df["FLOAT_ABSORB_5D"] >= 1.0)

    all_df["ARCHETYPE"] = "OTHER"
    all_df.loc[is_multi_deliv, "ARCHETYPE"] = "MULTI_DAY_ACCUMULATION"
    all_df.loc[is_breakout, "ARCHETYPE"] = "BREAKOUT_EXPANSION"
    all_df.loc[is_coil, "ARCHETYPE"] = "COIL_SUPPLY_EXHAUSTION"
    all_df.loc[is_float_lock, "ARCHETYPE"] = "STEALTH_FLOAT_LOCK"
    all_df.loc[is_climax_shock, "ARCHETYPE"] = "CLIMAX_SHOCK_WARNING"

    # 100-Point Conviction Scoring
    pts_float = np.clip(all_df["FLOAT_ABSORB_5D"] * 7.5, 0.0, 30.0)
    pts_buyer = np.where(
        is_sweetspot_demand, 25.0,
        np.where(all_df["BUYER_DEMAND_RATIO"] >= 65.0, 18.0,
        np.where(all_df["BUYER_DEMAND_RATIO"] >= 55.0, 12.0, 5.0))
    )
    pts_multi = np.clip(all_df["DELIV_DAYS_5D"] * 4.0 + (all_df["DELIV_FLOW_10D"] - 1.0) * 4.0, 0.0, 20.0)
    pts_squeeze = np.where(all_df["RANGE_CONTRACTION"] <= 0.85, 15.0, np.where(all_df["RANGE_CONTRACTION"] <= 0.92, 10.0, 5.0))
    pts_qual = np.clip((all_df["TICKET_SPIKE"] - 1.0) * 4.0 + np.where((all_df["free_float_mcap_cr"] >= 1000.0) & (all_df["free_float_mcap_cr"] <= 5000.0), 4.0, 2.0), 0.0, 10.0)
    
    score = np.round(np.clip(pts_float + pts_buyer + pts_multi + pts_squeeze + pts_qual, 0.0, 100.0), 1)
    all_df["CONVICTION_SCORE"] = np.where(is_climax_shock, np.minimum(score, 45.0), score)

    # Forward returns & MFE / MAE
    print("Computing forward returns, drawdowns, and Maximum Favorable Excursions (MFE)...")
    for hold in [5, 10, 20]:
        fwd_c = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}D"] = ((fwd_c - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    # 20-Day MFE (Max Favorable Excursion - peak upside) and MAE (Max Adverse Excursion - max drawdown)
    # Roll forward 20 sessions for max HIGH and min LOW
    # Using indexing reversal trick for rolling forward
    indexer = pd.api.indexers.FixedForwardWindowIndexer(window_size=20)
    fwd_max_high = grouped["HIGH"].transform(lambda x: x.rolling(window=indexer, min_periods=5).max())
    fwd_min_low = grouped["LOW"].transform(lambda x: x.rolling(window=indexer, min_periods=5).min())
    all_df["MFE_20D"] = ((fwd_max_high - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0
    all_df["MAE_20D"] = ((fwd_min_low - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    valid_base = (
        (all_df["CLOSE"] >= 35.0) &
        (all_df["TURNOVER_CR"] >= 1.5) &
        (all_df["free_float_mcap_cr"] >= 500.0)
    )

    # Radar 1.0 Naive Delivery Blast
    radar_1_blast = valid_base & (all_df["CLOSE"] > all_df["SMA_50"]) & (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE"] >= 2.0)

    # Radar 2.0 Filters
    radar_2_qualified = valid_base & (all_df["CONVICTION_SCORE"] >= 70.0)
    radar_2_high_conv = valid_base & (all_df["CONVICTION_SCORE"] >= 80.0)
    radar_2_elite = valid_base & (all_df["CONVICTION_SCORE"] >= 85.0)

    def compute_stats(name, mask):
        sub = all_df[mask & valid_base].copy()
        n = len(sub)
        if n < 5:
            return {"name": name, "n": n, "wr10": 0, "avg10": 0, "med10": 0, "pf10": 0, "wr20": 0, "avg20": 0, "med20": 0, "pf20": 0, "mfe20": 0, "mae20": 0, "runner15": 0, "runner25": 0}
        
        r10 = sub["FWD_RET_10D"].dropna()
        r20 = sub["FWD_RET_20D"].dropna()
        mfe = sub["MFE_20D"].dropna()
        mae = sub["MAE_20D"].dropna()

        wr10 = (r10 > 0).mean() * 100.0
        avg10 = r10.mean()
        med10 = r10.median()
        profit10 = r10[r10 > 0].sum()
        loss10 = abs(r10[r10 < 0].sum())
        pf10 = profit10 / loss10 if loss10 > 0 else 99.0

        wr20 = (r20 > 0).mean() * 100.0
        avg20 = r20.mean()
        med20 = r20.median()
        profit20 = r20[r20 > 0].sum()
        loss20 = abs(r20[r20 < 0].sum())
        pf20 = profit20 / loss20 if loss20 > 0 else 99.0

        mfe20 = mfe.mean()
        mae20 = mae.mean()
        runner15 = (mfe >= 15.0).mean() * 100.0
        runner25 = (mfe >= 25.0).mean() * 100.0

        return {
            "name": name,
            "n": n,
            "wr10": wr10,
            "avg10": avg10,
            "med10": med10,
            "pf10": pf10,
            "wr20": wr20,
            "avg20": avg20,
            "med20": med20,
            "pf20": pf20,
            "mfe20": mfe20,
            "mae20": mae20,
            "runner15": runner15,
            "runner25": runner25,
        }

    cohorts = [
        ("Market Baseline (All Liquid EQ)", valid_base),
        ("Delivery Radar 1.0 (Naive Deliv% Blast)", radar_1_blast),
        ("Delivery Radar 2.0 (Conviction >= 70)", radar_2_qualified),
        ("Delivery Radar 2.0 (High Conv >= 80)", radar_2_high_conv),
        ("Delivery Radar 2.0 (Elite Conv >= 85)", radar_2_elite),
        ("--- ARCHETYPES ---", None),
        ("  🔒 Stealth Float Lock", valid_base & (all_df["ARCHETYPE"] == "STEALTH_FLOAT_LOCK")),
        ("  🟡 Supply Dry-Up Coil", valid_base & (all_df["ARCHETYPE"] == "COIL_SUPPLY_EXHAUSTION")),
        ("  🚀 Breakout Expansion", valid_base & (all_df["ARCHETYPE"] == "BREAKOUT_EXPANSION")),
        ("  📦 Multi-Day Accumulation", valid_base & (all_df["ARCHETYPE"] == "MULTI_DAY_ACCUMULATION")),
        ("  ⚠️ Climax Shock Trap (Avoided)", valid_base & (all_df["ARCHETYPE"] == "CLIMAX_SHOCK_WARNING")),
        ("--- BUYER DEMAND STRATIFICATION ---", None),
        ("  🎯 Buyer Sweet-Spot (70.0% - 76.5%)", valid_base & (all_df["BUYER_DEMAND_RATIO"] >= 70.0) & (all_df["BUYER_DEMAND_RATIO"] <= 76.5)),
        ("  ⚡ Extreme Dominance (>= 78.0%)", valid_base & (all_df["BUYER_DEMAND_RATIO"] >= 78.0)),
        ("  ❄️ Low Buyer Dominance (< 55.0%)", valid_base & (all_df["BUYER_DEMAND_RATIO"] < 55.0)),
    ]

    print("\n" + "=" * 128)
    print(f"{'Strategy / Cohort':<42} | {'Trades':>6} | {'10D Win%':>8} | {'10D Avg%':>8} | {'10D PF':>6} | {'20D Win%':>8} | {'20D Avg%':>8} | {'20D PF':>6} | {'Peak MFE%':>9} | {'Runners>15%':>11}")
    print("=" * 128)

    results_table = []
    for name, mask in cohorts:
        if mask is None:
            print("-" * 128)
            continue
        stats = compute_stats(name, mask)
        results_table.append(stats)
        print(f"{stats['name']:<42} | {stats['n']:>6,} | {stats['wr10']:>7.1f}% | {stats['avg10']:>+7.2f}% | {stats['pf10']:>6.2f} | {stats['wr20']:>7.1f}% | {stats['avg20']:>+7.2f}% | {stats['pf20']:>6.2f} | {stats['mfe20']:>+8.2f}% | {stats['runner15']:>10.1f}%")

    print("=" * 128)

    # Top historical multi-baggers caught by Delivery Radar 2.0
    print("\n" + "=" * 80)
    print("  TOP HISTORICAL WINNERS IDENTIFIED BY DELIVERY RADAR 2.0 (Elite >= 85)")
    print("=" * 80)
    elite_df = all_df[radar_2_elite & valid_base].copy()
    elite_df = elite_df.sort_values(by="MFE_20D", ascending=False).drop_duplicates(subset=["SYMBOL"]).head(15)
    
    print(f"{'Date':<11} | {'Symbol':<12} | {'Close':>8} | {'Float Absorb':>12} | {'Buyer%':>7} | {'Archetype':<24} | {'10D Ret%':>9} | {'20D Peak MFE%':>13}")
    print("-" * 105)
    for _, r in elite_df.iterrows():
        dt = r["DATE"].strftime("%Y-%m-%d")
        sym = r["SYMBOL"]
        c = r["CLOSE"]
        fa = f"{r['FLOAT_ABSORB_5D']:.2f}%"
        bd = f"{r['BUYER_DEMAND_RATIO']:.1f}%"
        arch = r["ARCHETYPE"]
        r10 = f"{r['FWD_RET_10D']:+.1f}%" if pd.notna(r['FWD_RET_10D']) else "N/A"
        mfe = f"{r['MFE_20D']:+.1f}%" if pd.notna(r['MFE_20D']) else "N/A"
        print(f"{dt:<11} | {sym:<12} | ₹{c:>7.1f} | {fa:>12} | {bd:>7} | {arch:<24} | {r10:>9} | {mfe:>13}")

    print("\nBacktest completed in " + f"{time.time() - t0:.2f}s.")

if __name__ == "__main__":
    run_delivery_radar_v2_backtest()
