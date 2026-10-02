"""
Alpha India - Portfolio Capacity & Frequency Optimization
Tests how to achieve 65%+ Win Rate with HEALTHY TRADE FREQUENCY:
Target: 250 - 600 trades over 2 years (3 - 6 high-conviction trades per week)
without suffocating the pipeline down to 29 trades.
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_capacity_research():
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
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["EMA_10"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=10).mean())
    all_df["EMA_20"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=20).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    
    # 20D Net Accumulation Flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    # Distance to High 50 and EMA 20
    all_df["PIVOT_PROXIMITY_PCT"] = ((all_df["HIGH_50"] - all_df["CLOSE"]) / all_df["HIGH_50"]) * 100.0
    all_df["DIST_TO_EMA20_PCT"] = ((all_df["CLOSE"] - all_df["EMA_20"]) / all_df["EMA_20"]) * 100.0

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def simulate_portfolio_capacity(mask, t1_pct=5.0, t2_pct=10.0, be_trigger=2.2, sl_pct=3.5, max_hold=12, max_positions=5):
        signals = all_df[mask]
        if len(signals) == 0: return None
        dates = sorted(all_df["DATE"].unique())
        daily_sigs = {d: df_d for d, df_d in signals.groupby("DATE")}

        capital = 1000000.0
        cash = capital
        slot_val = capital / max_positions
        positions = []
        closed_trades = []

        for curr_date in dates:
            # 1. Update active positions
            still_open = []
            for pos in positions:
                sym = pos["sym"]
                sub = sym_map.get(sym)
                cur_rows = sub[sub["DATE"] == curr_date]
                if cur_rows.empty:
                    still_open.append(pos)
                    continue
                row = cur_rows.iloc[0]
                pos["hold_days"] += 1

                # Check T1
                if not pos["t1_hit"] and row["HIGH"] >= pos["t1"]:
                    pos["t1_hit"] = True
                    # Book 50%
                    cash += pos["shares"] * 0.5 * pos["t1"] * (1 - 0.0015)
                    pos["shares"] *= 0.5
                    pos["be_active"] = True
                    pos["sl"] = pos["entry"] * 1.004

                # Check BE Trigger
                if not pos["be_active"] and row["HIGH"] >= pos["be_trig"]:
                    pos["be_active"] = True
                    pos["sl"] = pos["entry"] * 1.004

                # Check T2
                if pos["t1_hit"] and row["HIGH"] >= pos["t2"]:
                    cash += pos["shares"] * pos["t2"] * (1 - 0.0015)
                    closed_trades.append({"ret": (pos["t2"] - pos["entry"]) / pos["entry"] * 100, "win": True, "reason": "T2_WIN"})
                    continue

                # Check Stop Loss
                if row["LOW"] <= pos["sl"]:
                    cash += pos["shares"] * pos["sl"] * (1 - 0.0015)
                    ret = (pos["sl"] - pos["entry"]) / pos["entry"] * 100
                    closed_trades.append({"ret": ret, "win": ret > 0, "reason": "BE_LOCK" if pos["be_active"] else "STOP_LOSS"})
                    continue

                # Check Time Exit
                if pos["hold_days"] >= max_hold:
                    cash += pos["shares"] * row["CLOSE"] * (1 - 0.0015)
                    ret = (row["CLOSE"] - pos["entry"]) / pos["entry"] * 100
                    closed_trades.append({"ret": ret, "win": ret > 0, "reason": "TIME_EXIT"})
                    continue

                still_open.append(pos)
            positions = still_open

            # 2. Open new positions if slots available
            available_slots = max_positions - len(positions)
            if available_slots > 0 and curr_date in daily_sigs:
                new_sigs = daily_sigs[curr_date]
                for _, sig in new_sigs.iterrows():
                    if available_slots <= 0: break
                    if any(p["sym"] == sig["SYMBOL"] for p in positions): continue
                    sub = sym_map.get(sig["SYMBOL"])
                    d_idx = sub.index[sub["DATE"] == curr_date].tolist()
                    if not d_idx or d_idx[0] + 1 >= len(sub): continue
                    entry_p = sub.loc[d_idx[0] + 1, "OPEN"]
                    if pd.isna(entry_p) or entry_p <= 0: entry_p = sig["CLOSE"]

                    alloc = slot_val
                    shares = alloc / entry_p
                    positions.append({
                        "sym": sig["SYMBOL"],
                        "entry": entry_p,
                        "shares": shares,
                        "sl": entry_p * (1.0 - sl_pct / 100.0),
                        "t1": entry_p * (1.0 + t1_pct / 100.0),
                        "t2": entry_p * (1.0 + t2_pct / 100.0),
                        "be_trig": entry_p * (1.0 + be_trigger / 100.0),
                        "t1_hit": False,
                        "be_active": False,
                        "hold_days": 0,
                    })
                    available_slots -= 1

        if not closed_trades: return None
        tdf = pd.DataFrame(closed_trades)
        wins = tdf[tdf["win"] == True]
        wr = len(wins) / len(tdf) * 100.0
        profit = tdf[tdf["ret"] > 0]["ret"].sum()
        loss = abs(tdf[tdf["ret"] <= 0]["ret"].sum())
        pf = profit / loss if loss > 0 else 99.0
        total_pnl = cash + sum(p["shares"] * p["entry"] for p in positions) - capital
        tot_ret = (total_pnl / capital) * 100.0
        cagr = ((1.0 + tot_ret / 100.0) ** (1.0 / 2.0) - 1.0) * 100.0
        return {
            "n_signals": len(signals),
            "trades_taken": len(tdf),
            "win_rate": round(wr, 1),
            "pf": round(pf, 2),
            "cagr": round(cagr, 2),
            "total_ret": round(tot_ret, 1),
            "be_saves": round((tdf["reason"] == "BE_LOCK").mean() * 100.0, 1),
            "stops": round((tdf["reason"] == "STOP_LOSS").mean() * 100.0, 1),
        }

    print("\n" + "="*115)
    print("MAPPING THE EFFICIENT FRONTIER: WIN RATE vs TRADE FREQUENCY vs PORTFOLIO CAGR")
    print("="*115)

    # We test 4 realistic trade tiers
    tiers = [
        # Tier 1: The 29-trade hyper-restrictive model (User flagged: 1 trade/month)
        ("Tier 1 (Hyper-Restricted - 1 Trade/mo)",
         (all_df["TURNOVER_CR"] >= 5.0) & (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.0) & \
         (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["SMA_20"] > all_df["SMA_50"]) & \
         (all_df["DIST_TO_EMA20_PCT"] >= 0.0) & (all_df["DIST_TO_EMA20_PCT"] <= 2.5) & \
         (all_df["DELIV_FLOW_20D"] >= 1.5) & (all_df["DAY_RET"] >= 1.0) & (all_df["DAY_RET"] <= 4.0),
         dict(t1_pct=5.0, be_trigger=1.8, sl_pct=2.8)),

        # Tier 2: Institutional Flow Focus (Turnover >= 2.5 Cr, Deliv >= 60%, Deliv Spike >= 1.8x, D-A/D >= 1.25x)
        ("Tier 2 (Core Institutional Flow - ~6-10 Trades/mo)",
         (all_df["TURNOVER_CR"] >= 2.5) & (all_df["DELIV_PER"] >= 60.0) & (all_df["DELIV_SPIKE_10X"] >= 1.8) & \
         (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["SMA_20"] > all_df["SMA_50"]) & \
         (all_df["DELIV_FLOW_20D"] >= 1.25) & (all_df["PIVOT_PROXIMITY_PCT"] <= 3.5),
         dict(t1_pct=5.5, be_trigger=2.2, sl_pct=3.5)),

        # Tier 3: Dual-Engine (50D Breakouts + EMA Pullbacks with High Delivery)
        ("Tier 3 (Dual-Engine: Breakout + EMA Retest - ~15-20 Trades/mo)",
         (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 58.0) & (all_df["DELIV_SPIKE_10X"] >= 1.6) & \
         (all_df["CLOSE"] > all_df["SMA_20"]) & \
         ((all_df["PIVOT_PROXIMITY_PCT"] <= 2.5) | ((all_df["DIST_TO_EMA20_PCT"] >= -0.5) & (all_df["DIST_TO_EMA20_PCT"] <= 3.0))),
         dict(t1_pct=5.5, be_trigger=2.2, sl_pct=3.8)),

        # Tier 4: Broad Radar Universe (Delivery >= 55%, Spike >= 1.5x, Stage 2 Trend)
        ("Tier 4 (High-Frequency Radar - ~30 Trades/mo)",
         (all_df["TURNOVER_CR"] >= 1.5) & (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE_10X"] >= 1.5) & \
         (all_df["CLOSE"] > all_df["SMA_50"]),
         dict(t1_pct=6.0, be_trigger=2.5, sl_pct=4.0)),
    ]

    for name, m, p in tiers:
        res = simulate_portfolio_capacity(m, **p)
        if res:
            trades_per_month = round(res['trades_taken'] / 24.0, 1)
            print(f"\n>>> {name} <<<")
            print(f"  Signals Generated: {res['n_signals']:4d} | Executed Trades: {res['trades_taken']:4d} ({trades_per_month} trades/mo)")
            print(f"  WIN RATE: {res['win_rate']:5.1f}% | Profit Factor: {res['pf']:4.2f}")
            print(f"  Total Portfolio Return: {res['total_ret']:+6.1f}% | 2Y CAGR: {res['cagr']:+5.2f}%")
            print(f"  BE Lock Saves: {res['be_saves']:4.1f}% | Full Stop Outs: {res['stops']:4.1f}%")

if __name__ == "__main__":
    run_capacity_research()
