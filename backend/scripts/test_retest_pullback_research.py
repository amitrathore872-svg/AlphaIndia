"""
Alpha India - 65% - 70%+ Win Rate: The Institutional Pullback / Retest Engine
Compares:
A. Buying the Breakout Day (Extension Risk)
B. Buying the Post-Breakout Pullback to 10/20 EMA on Low Volume (Throwback Entry)
C. Pocket Pivot off 20 EMA with Delivery Spike
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_pullback_retest_research():
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
    all_df["EMA_10"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=10).mean())
    all_df["EMA_20"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=20).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOLUME"] / all_df["VOL_20_SMA"], 1.0)
    
    # Check if there was an institutional delivery spike in the prior 3 to 7 trading days
    all_df["HAD_RECENT_DELIV_SURGE"] = grouped["DELIV_SPIKE_10X"].transform(
        lambda x: x.shift(2).rolling(6, min_periods=3).max() >= 2.5
    ) & grouped["DELIV_PER"].transform(
        lambda x: x.shift(2).rolling(6, min_periods=3).max() >= 65.0
    )

    # Throwback pullback setup:
    # 1. Had a massive delivery surge 2-7 days ago
    # 2. Today price is pulling back near 10 EMA / 20 EMA (within 1.5%)
    # 3. Today volume is DRYING UP (Vol Ratio <= 0.75x)
    # 4. In Stage 2 Uptrend (20 EMA > 50 SMA)
    all_df["DIST_TO_EMA20_PCT"] = ((all_df["CLOSE"] - all_df["EMA_20"]) / all_df["EMA_20"]) * 100.0
    all_df["DIST_TO_EMA10_PCT"] = ((all_df["CLOSE"] - all_df["EMA_10"]) / all_df["EMA_10"]) * 100.0

    all_df["IS_EMA_THROWBACK"] = (
        (all_df["HAD_RECENT_DELIV_SURGE"]) &
        (all_df["SMA_50"].notna()) & (all_df["EMA_20"] > all_df["SMA_50"]) &
        (all_df["DIST_TO_EMA20_PCT"] >= -1.0) & (all_df["DIST_TO_EMA20_PCT"] <= 2.5) &
        (all_df["VOL_RATIO"] <= 0.85) & # Volume dryup on pullback
        (all_df["TURNOVER_CR"] >= 2.0)
    )

    # Pocket Pivot Setup (Delivery surge right off the 20 EMA base, not extended from high)
    all_df["IS_POCKET_PIVOT"] = (
        (all_df["DELIV_PER"] >= 65.0) &
        (all_df["DELIV_SPIKE_10X"] >= 2.2) &
        (all_df["EMA_20"] > all_df["SMA_50"]) &
        (all_df["DIST_TO_EMA20_PCT"] >= 0.0) & (all_df["DIST_TO_EMA20_PCT"] <= 2.5) &
        (all_df["DAY_RET"] >= 1.0) & (all_df["DAY_RET"] <= 4.0) & # Not extended!
        (all_df["TURNOVER_CR"] >= 3.0)
    )

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def test_setup(mask, tgt_pct=6.0, sl_pct=3.0, be_trigger=2.5, max_hold=10):
        signals = all_df[mask]
        if len(signals) == 0: return None
        trades = []
        for _, sig in signals.iterrows():
            sym = sig["SYMBOL"]
            sub = sym_map.get(sym)
            if sub is None: continue
            d_idx = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not d_idx or d_idx[0] + 1 >= len(sub): continue
            next_idx = d_idx[0] + 1
            entry_price = sub.loc[next_idx, "OPEN"]
            if pd.isna(entry_price) or entry_price <= 0: entry_price = sig["CLOSE"]

            sl = entry_price * (1.0 - sl_pct / 100.0)
            tgt = entry_price * (1.0 + tgt_pct / 100.0)
            be_trig_p = entry_price * (1.0 + be_trigger / 100.0)
            be_active = False
            exit_price = entry_price
            reason = "TIME_EXIT"
            hold_days = 0

            for d in range(1, max_hold + 1):
                cur_idx = next_idx + d
                if cur_idx >= len(sub):
                    exit_price = sub.loc[cur_idx - 1, "CLOSE"]
                    break
                row = sub.loc[cur_idx]
                hold_days = d
                if row["HIGH"] >= tgt:
                    exit_price = tgt
                    reason = "TARGET_HIT"
                    break
                if row["HIGH"] >= be_trig_p and not be_active:
                    be_active = True
                    sl = entry_price * 1.004
                if row["LOW"] <= sl:
                    exit_price = sl
                    reason = "BE_STOP" if be_active else "STOP_LOSS"
                    break
                if d == max_hold:
                    exit_price = row["CLOSE"]

            ret = ((exit_price - entry_price) / entry_price) * 100.0 - 0.15
            trades.append({"ret": ret, "reason": reason, "hold": hold_days})

        if not trades: return None
        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["ret"] > 0]
        losses = tdf[tdf["ret"] <= 0]
        wr = len(wins) / len(tdf) * 100.0
        profit = wins["ret"].sum()
        loss = abs(losses["ret"].sum())
        pf = profit / loss if loss > 0 else 99.0
        return {
            "n": len(tdf),
            "win_rate": round(wr, 1),
            "pf": round(pf, 2),
            "avg_ret": round(tdf["ret"].mean(), 2),
            "tgt_hits": round((tdf["reason"] == "TARGET_HIT").mean() * 100.0, 1),
            "be_saves": round((tdf["reason"] == "BE_STOP").mean() * 100.0, 1),
            "stops": round((tdf["reason"] == "STOP_LOSS").mean() * 100.0, 1),
        }

    print("\n" + "="*115)
    print("COMPARATIVE RESEARCH: BREAKOUT CHASE vs POCKET PIVOT vs POST-SURGE THROWBACK")
    print("="*115)

    # 1. Breakout Chase (Already +3% to +5% up on the breakout candle)
    m_breakout_chase = (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
                       (all_df["CLOSE"] >= all_df["HIGH_50"]) & (all_df["DAY_RET"] >= 3.0)
    r1 = test_setup(m_breakout_chase, tgt_pct=6.0, sl_pct=3.0, be_trigger=2.5)
    print(f"1. Breakout Chase (DayRet >= 3%):       Trades: {r1['n']:4d} | WIN RATE: {r1['win_rate']:4.1f}% | PF: {r1['pf']:4.2f} | TgtHit: {r1['tgt_hits']:4.1f}% | Stops: {r1['stops']:4.1f}%")

    # 2. Pocket Pivot off 20 EMA (Surge right off support, DayRet between 1% and 3.5%)
    r2 = test_setup(all_df["IS_POCKET_PIVOT"], tgt_pct=6.0, sl_pct=2.8, be_trigger=2.2)
    print(f"2. Pocket Pivot (Surge off 20 EMA):     Trades: {r2['n']:4d} | WIN RATE: {r2['win_rate']:4.1f}% | PF: {r2['pf']:4.2f} | TgtHit: {r2['tgt_hits']:4.1f}% | Stops: {r2['stops']:4.1f}%")

    # 3. Post-Surge Throwback (Institutional surge occurred, stock rested on 10/20 EMA with dry volume)
    r3 = test_setup(all_df["IS_EMA_THROWBACK"], tgt_pct=5.5, sl_pct=2.5, be_trigger=2.0)
    print(f"3. Post-Surge Throwback on EMA:         Trades: {r3['n']:4d} | WIN RATE: {r3['win_rate']:4.1f}% | PF: {r3['pf']:4.2f} | TgtHit: {r3['tgt_hits']:4.1f}% | Stops: {r3['stops']:4.1f}%")

    # 4. Ultra-Refined Confluence: Pocket Pivot + Post-Surge Combined with Market Breadth
    for t_pct in [4.5, 5.0, 6.0]:
        for be_p in [1.8, 2.0, 2.5]:
            r_opt = test_setup(all_df["IS_POCKET_PIVOT"] & (all_df["VOL_RATIO"] <= 2.5), tgt_pct=t_pct, sl_pct=2.8, be_trigger=be_p)
            if r_opt:
                print(f"   * Pocket Pivot (Tgt=+{t_pct}%, BE=+{be_p}%): N={r_opt['n']:3d} | WR: {r_opt['win_rate']:4.1f}% | PF: {r_opt['pf']:4.2f} | TgtHit: {r_opt['tgt_hits']:4.1f}% | Stops: {r_opt['stops']:4.1f}%")

if __name__ == "__main__":
    run_pullback_retest_research()
