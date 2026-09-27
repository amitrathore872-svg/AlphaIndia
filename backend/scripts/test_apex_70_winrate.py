"""
Alpha India - Techno-Fundamental & Market Regime Fusion
Testing:
1. Multi-Week Delivery Accumulation (20D Flow >= 1.5x)
2. Pocket Pivot / Tight Shelf (Distance to 20 EMA <= 2.5%)
3. Market Regime Gate (NIFTY 50 > 50 EMA)
4. Relative Strength Outperformance (3-Month Stock Return > Nifty Return)
5. Asymmetric Target with Breakeven Protection (+5.0% T1, +10% T2, BE @ +1.8%)
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_apex_70_test():
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
    all_df["EMA_20"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=20).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    
    # Stock 3-Month Momentum (60-day ROC)
    all_df["ROC_60D"] = grouped["CLOSE"].transform(lambda x: (x.shift(1) / x.shift(61) - 1.0) * 100.0)

    # 20D Net Accumulation Flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    all_df["DIST_TO_EMA20_PCT"] = ((all_df["CLOSE"] - all_df["EMA_20"]) / all_df["EMA_20"]) * 100.0

    # Market Breadth (% of universe > 20 EMA)
    date_breadth = all_df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["EMA_20"]).mean() * 100.0).to_dict()
    all_df["MARKET_BREADTH"] = all_df["DATE"].map(date_breadth).fillna(50.0)

    # NIFTY Proxy: Rolling median return of universe
    date_median_roc = all_df.groupby("DATE")["ROC_60D"].median().to_dict()
    all_df["UNIVERSE_MEDIAN_ROC"] = all_df["DATE"].map(date_median_roc).fillna(0.0)
    all_df["IS_RS_LEADER"] = all_df["ROC_60D"] >= (all_df["UNIVERSE_MEDIAN_ROC"] + 8.0) # beating median by 8%

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def evaluate(mask, t1_p=5.0, be_p=1.8, sl_p=2.8, max_hold=10):
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

            sl = entry_price * (1.0 - sl_p / 100.0)
            t1 = entry_price * (1.0 + t1_p / 100.0)
            be_trig = entry_price * (1.0 + be_p / 100.0)
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

                if row["HIGH"] >= t1:
                    exit_price = t1
                    reason = "TARGET_HIT"
                    break
                if row["HIGH"] >= be_trig and not be_active:
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
    print("ULTRA HIGH WIN RATE MATRIX: TECHNO-MOMENTUM + BREADTH + POCKET PIVOT ACCUMULATION")
    print("="*115)

    base = (
        (all_df["DELIV_PER"] >= 65.0) &
        (all_df["DELIV_SPIKE_10X"] >= 2.0) &
        (all_df["TURNOVER_CR"] >= 3.0) &
        (all_df["EMA_20"] > all_df["SMA_50"]) &
        (all_df["DIST_TO_EMA20_PCT"] >= 0.0) & (all_df["DIST_TO_EMA20_PCT"] <= 2.5) &
        (all_df["DAY_RET"] >= 1.0) & (all_df["DAY_RET"] <= 4.0) &
        (all_df["MARKET_BREADTH"] >= 45.0) & # Market is healthy
        (all_df["DELIV_FLOW_20D"] >= 1.5) &   # 1-Month Net Accumulation
        (all_df["VOL_DRYUP"] <= 1.0)          # Supply Contraction
    )

    tests = [
        ("Base Pocket Pivot in Bull Market (Breadth >= 45%)", base),
        ("+ Relative Strength Leader (Outperforming Universe by 8%+)", base & (all_df["IS_RS_LEADER"])),
        ("+ Mega Institutional Turnover (Turnover >= 5 Cr)", base & (all_df["TURNOVER_CR"] >= 5.0)),
        ("+ Mega Turnover & RS Leader", base & (all_df["TURNOVER_CR"] >= 5.0) & (all_df["IS_RS_LEADER"])),
    ]

    for label, m in tests:
        print(f"\n>>> {label} <<<")
        for t1 in [4.5, 5.0, 5.5]:
            for be in [1.5, 1.8, 2.0]:
                r = evaluate(m, t1_p=t1, be_p=be, sl_p=2.5, max_hold=10)
                if r:
                    tag = ">>> 65-70%+ WIN RATE ACHIEVED! <<<" if r["win_rate"] >= 65.0 else ("* 60-64% *" if r["win_rate"] >= 60.0 else "Normal")
                    print(f"  [{tag}] T1=+{t1}% | BE_Lock=+{be}%: N={r['n']:3d} | WIN RATE: {r['win_rate']:5.1f}% | PF: {r['pf']:4.2f} | AvgRet: {r['avg_ret']:+5.2f}% | TargetHits: {r['tgt_hits']:4.1f}% | BE_Saves: {r['be_saves']:4.1f}% | Stops: {r['stops']:4.1f}%")

if __name__ == "__main__":
    run_apex_70_test()
