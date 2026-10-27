"""
Alpha India - Delivery Radar 2.0 Trading Execution Backtest
Evaluates realistic trade execution:
- Entry: T+1 Open (or T Close)
- Stop Loss: -5.0% from entry
- Profit Target: +10.0% / +15.0% partial exit
- Max Holding: 15 trading days
"""

import sys, os, time, datetime
from pathlib import Path
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run():
    db = SessionLocal()
    records = db.query(
        ScreenerGrowthRecord.symbol,
        ScreenerGrowthRecord.market_cap,
        ScreenerGrowthRecord.promoter_holding
    ).all()
    db.close()

    meta_df = pd.DataFrame(records, columns=['symbol', 'market_cap', 'promoter_holding'])
    meta_df['symbol'] = meta_df['symbol'].astype(str).str.strip()
    meta_df['promoter_holding'] = pd.to_numeric(meta_df['promoter_holding'], errors='coerce').fillna(50.0)
    meta_df['market_cap'] = pd.to_numeric(meta_df['market_cap'], errors='coerce')
    meta_df['free_float_pct'] = np.clip(100.0 - meta_df['promoter_holding'], 5.0, 95.0)
    meta_df['free_float_mcap_cr'] = meta_df['market_cap'] * (meta_df['free_float_pct'] / 100.0)
    valid_symbols = set(meta_df.dropna(subset=['market_cap'])['symbol'].unique())

    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_file_date)[-300:]

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
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)
            bhav_records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(bhav_records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    all_df = all_df.merge(meta_df[['symbol', 'market_cap', 'free_float_mcap_cr']], left_on='SYMBOL', right_on='symbol', how='inner')

    grouped = all_df.groupby("SYMBOL", group_keys=False)
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

    all_df["TICKET_LACS"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
    all_df["TICKET_20_SMA"] = grouped["TICKET_LACS"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["TICKET_SPIKE"] = np.where(all_df["TICKET_20_SMA"] > 0, all_df["TICKET_LACS"] / all_df["TICKET_20_SMA"], 1.0)

    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    all_df["DELIV_FLOW_10D"] = np.where(down_10 > 0, up_10 / down_10, 1.0)

    all_df["DELIV_CR"] = (all_df["TURNOVER_CR"] * all_df["DELIV_PER"]) / 100.0
    all_df["FLOAT_ABSORB_1D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["DELIV_CR"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
    deliv_5d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0.0)
    all_df["FLOAT_ABSORB_5D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_5d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

    all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
    all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)

    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, grouped["VOLUME"].transform(lambda x: x.shift(1)) / all_df["VOL_20_SMA"], 1.0)
    range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)
    all_df["PIVOT_DIST_PCT"] = np.where(all_df["HIGH_20"] > 0, ((all_df["HIGH_20"] - all_df["CLOSE"]) / all_df["HIGH_20"]) * 100.0, 0.0)

    tot_flow_10 = up_10 + down_10
    up_ratio_10 = np.where(tot_flow_10 > 0, up_10 / tot_flow_10, 0.5)
    ticket_factor = np.clip((all_df["TICKET_SPIKE"] - 0.8) / 1.2, 0.0, 1.0)
    loc_factor = np.clip(all_df["CLOSE_LOC"], 0.0, 1.0)
    deliv_factor = np.clip(all_df["DELIV_PER"] / 100.0, 0.0, 1.0)
    all_df["BUYER_DEMAND_RATIO"] = np.round((0.35 * up_ratio_10 + 0.25 * loc_factor + 0.20 * deliv_factor + 0.20 * ticket_factor) * 100.0, 1)

    is_climax_shock = (all_df["FLOAT_ABSORB_1D"] >= 2.0) | ((all_df["BUYER_DEMAND_RATIO"] >= 79.0) & (all_df["UPPER_WICK_PCT"] >= 0.25))
    is_sweetspot_demand = (all_df["BUYER_DEMAND_RATIO"] >= 70.0) & (all_df["BUYER_DEMAND_RATIO"] <= 76.5)

    pts_float = np.clip(all_df["FLOAT_ABSORB_5D"] * 7.5, 0.0, 30.0)
    pts_buyer = np.where(is_sweetspot_demand, 25.0, np.where(all_df["BUYER_DEMAND_RATIO"] >= 65.0, 18.0, np.where(all_df["BUYER_DEMAND_RATIO"] >= 55.0, 12.0, 5.0)))
    pts_multi = np.clip(all_df["DELIV_DAYS_5D"] * 4.0 + (all_df["DELIV_FLOW_10D"] - 1.0) * 4.0, 0.0, 20.0)
    pts_squeeze = np.where(all_df["RANGE_CONTRACTION"] <= 0.85, 15.0, np.where(all_df["RANGE_CONTRACTION"] <= 0.92, 10.0, 5.0))
    pts_qual = np.clip((all_df["TICKET_SPIKE"] - 1.0) * 4.0 + np.where((all_df["free_float_mcap_cr"] >= 1000.0) & (all_df["free_float_mcap_cr"] <= 5000.0), 4.0, 2.0), 0.0, 10.0)
    
    score = np.round(np.clip(pts_float + pts_buyer + pts_multi + pts_squeeze + pts_qual, 0.0, 100.0), 1)
    all_df["CONVICTION_SCORE"] = np.where(is_climax_shock, np.minimum(score, 45.0), score)

    # Valid Base
    valid_base = (
        (all_df["CLOSE"] >= 35.0) &
        (all_df["TURNOVER_CR"] >= 1.5) &
        (all_df["free_float_mcap_cr"] >= 500.0) &
        (all_df["CLOSE"] > all_df["SMA_50"])  # Stage-2 Trend Filter
    )

    # Multi-day forward simulation with Stop Loss (-5%) and Take Profit (+10%)
    print("Simulating realistic trade management (Stop: -5.0%, Target: +10.0%, Max Hold: 15 sessions)...")
    
    # Precompute forward prices for 1 to 15 days
    for d in range(1, 16):
        all_df[f"HIGH_D{d}"] = grouped["HIGH"].shift(-d)
        all_df[f"LOW_D{d}"] = grouped["LOW"].shift(-d)
        all_df[f"CLOSE_D{d}"] = grouped["CLOSE"].shift(-d)

    def simulate_strategy(mask, stop_pct=-5.0, target_pct=10.0):
        sub = all_df[mask & valid_base].copy().dropna(subset=["CLOSE_D15"])
        if len(sub) == 0:
            return {}

        results = []
        for _, row in sub.iterrows():
            entry = row["CLOSE"]
            stop_price = entry * (1.0 + stop_pct / 100.0)
            target_price = entry * (1.0 + target_pct / 100.0)
            
            outcome = None
            ret = 0.0
            days_held = 15

            for d in range(1, 16):
                h = row[f"HIGH_D{d}"]
                l = row[f"LOW_D{d}"]
                c = row[f"CLOSE_D{d}"]

                if pd.isna(h) or pd.isna(l):
                    break

                # Stop check first (conservative assumption)
                if l <= stop_price:
                    outcome = "STOPPED_OUT"
                    ret = stop_pct
                    days_held = d
                    break
                elif h >= target_price:
                    outcome = "TARGET_HIT"
                    ret = target_pct
                    days_held = d
                    break

            if outcome is None:
                # Time exit at day 15
                c15 = row["CLOSE_D15"]
                outcome = "TIME_EXIT"
                ret = ((c15 - entry) / entry) * 100.0
                days_held = 15

            results.append({"ret": ret, "outcome": outcome, "days": days_held})

        res_df = pd.DataFrame(results)
        wr = (res_df["ret"] > 0).mean() * 100.0
        avg_ret = res_df["ret"].mean()
        profit = res_df[res_df["ret"] > 0]["ret"].sum()
        loss = abs(res_df[res_df["ret"] < 0]["ret"].sum())
        pf = profit / loss if loss > 0 else 99.0
        target_hits = (res_df["outcome"] == "TARGET_HIT").mean() * 100.0
        stopped = (res_df["outcome"] == "STOPPED_OUT").mean() * 100.0
        
        return {
            "n": len(res_df),
            "wr": wr,
            "avg_ret": avg_ret,
            "pf": pf,
            "target_hits": target_hits,
            "stopped": stopped,
            "avg_days": res_df["days"].mean()
        }

    sim_cohorts = [
        ("Market Baseline (Stage 2 Liquid EQ)", valid_base),
        ("Radar 1.0 (Naive Delivery Blast)", valid_base & (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE"] >= 2.0)),
        ("Radar 2.0 Qualified (Score >= 70)", valid_base & (all_df["CONVICTION_SCORE"] >= 70.0)),
        ("Radar 2.0 High Conviction (Score >= 80)", valid_base & (all_df["CONVICTION_SCORE"] >= 80.0)),
        ("Radar 2.0 + Sweet-Spot (70-76.5% Buyer)", valid_base & (all_df["CONVICTION_SCORE"] >= 70.0) & is_sweetspot_demand),
        ("Radar 2.0 Breakout Expansion", valid_base & (all_df["CLOSE"] > all_df["HIGH_20"]) & (all_df["DAY_RET"] >= 2.5) & (all_df["DELIV_SPIKE"] >= 1.8)),
        ("Climax Shock Trap (Should Avoid)", valid_base & is_climax_shock),
    ]

    print("\n" + "=" * 115)
    print(f"{'Strategy Configuration':<40} | {'Trades':>6} | {'Win Rate':>9} | {'Target Hit%':>11} | {'Stopped%':>9} | {'Avg Ret%':>9} | {'Profit Factor':>13}")
    print("=" * 115)
    for name, mask in sim_cohorts:
        s = simulate_strategy(mask, stop_pct=-5.0, target_pct=10.0)
        if not s:
            continue
        print(f"{name:<40} | {s['n']:>6,} | {s['wr']:>8.1f}% | {s['target_hits']:>10.1f}% | {s['stopped']:>8.1f}% | {s['avg_ret']:>+8.2f}% | {s['pf']:>12.2f}")
    print("=" * 115)

if __name__ == "__main__":
    run()
