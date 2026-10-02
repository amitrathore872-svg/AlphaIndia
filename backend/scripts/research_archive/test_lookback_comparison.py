"""
Alpha India - Lookback Window on Top of Proven Institutional Filters
"""
import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_test():
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
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_50_FLAG"] = (all_df["DELIV_PER"] >= 50.0).astype(float)

    for w in [15, 30, 45, 60, 90]:
        all_df[f"DELIV_CONSISTENCY_{w}"] = grouped["DELIV_50_FLAG"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean()) * 100.0
        all_df[f"AVG_DELIV_PER_{w}"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean())
        up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        all_df[f"DELIV_FLOW_{w}"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)

    # Core Institutional Foundation Mask
    core_mask = (all_df["TURNOVER_CR"] >= 3.0) & \
                (all_df["DELIV_PER"] >= 65.0) & \
                (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
                (all_df["DAY_RET"] >= 1.5) & \
                (all_df["CLOSE"] > all_df["SMA_20"]) & \
                (all_df["SMA_20"] > all_df["SMA_50"]) & \
                (all_df["VOL_DRYUP"] <= 1.30) & \
                (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98)

    def simulate_trades(signal_mask):
        signals = all_df[signal_mask]
        if len(signals) == 0:
            return None
        trades = []
        sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

        for _, sig in signals.iterrows():
            sym = sig["SYMBOL"]
            sub = sym_map.get(sym)
            if sub is None: continue
            d_idx = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not d_idx or d_idx[0] + 1 >= len(sub): continue
            entry_idx = d_idx[0] + 1
            entry_price = sub.loc[entry_idx, "OPEN"]
            if pd.isna(entry_price) or entry_price <= 0: entry_price = sig["CLOSE"]

            sl = entry_price * 0.96 # -4%
            tgt = entry_price * 1.10 # +10%
            be_trig = entry_price * 1.04 # +4%
            be_active = False
            exit_price = entry_price
            reason = "TIME_EXIT"
            hold_days = 0

            for d in range(1, 13):
                cur_idx = entry_idx + d
                if cur_idx >= len(sub):
                    exit_price = sub.loc[cur_idx - 1, "CLOSE"]
                    break
                row = sub.loc[cur_idx]
                hold_days = d
                if row["HIGH"] >= tgt:
                    exit_price = tgt
                    reason = "TARGET_HIT"
                    break
                if row["HIGH"] >= be_trig and not be_active:
                    be_active = True
                    sl = entry_price * 1.005
                if row["LOW"] <= sl:
                    exit_price = sl
                    reason = "BE_STOP" if be_active else "STOP_LOSS"
                    break
                if d == 12:
                    exit_price = row["CLOSE"]

            ret = ((exit_price - entry_price) / entry_price) * 100.0 - 0.15
            trades.append({"ret": ret, "reason": reason})

        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["ret"] > 0]
        losses = tdf[tdf["ret"] <= 0]
        pf = wins["ret"].sum() / abs(losses["ret"].sum()) if len(losses) > 0 else 0
        wr = len(wins) / len(tdf) * 100.0
        return {
            "n": len(tdf),
            "win_rate": round(wr, 1),
            "pf": round(pf, 2),
            "avg_ret": round(tdf["ret"].mean(), 2),
            "tgt_pct": round((tdf["reason"] == "TARGET_HIT").mean() * 100.0, 1),
        }

    print("\n" + "="*80)
    print("INSTITUTIONAL ACCUMULATION WINDOW COMPARISON (15D, 30D, 45D, 60D, 90D)")
    print("="*80)

    # Baseline: Core filters without historical lookback
    r_base = simulate_trades(core_mask)
    print(f"Base Setup (No History):   N={r_base['n']:3d} | WinRate={r_base['win_rate']:4.1f}% | PF={r_base['pf']:4.2f} | AvgRet={r_base['avg_ret']:+5.2f}% | TargetHit={r_base['tgt_pct']:4.1f}%")

    for w in [15, 30, 45, 60, 90]:
        months = w / 20.0
        # Require net accumulation flow >= 1.2x and delivery consistency >= 40%
        history_mask = core_mask & (all_df[f"DELIV_FLOW_{w}"] >= 1.20) & (all_df[f"DELIV_CONSISTENCY_{w}"] >= 40.0)
        r = simulate_trades(history_mask)
        if r:
            print(f"+ {w:2d}D ({months:.1f}mo) Accumulation: N={r['n']:3d} | WinRate={r['win_rate']:4.1f}% | PF={r['pf']:4.2f} | AvgRet={r['avg_ret']:+5.2f}% | TargetHit={r['tgt_pct']:4.1f}%")

if __name__ == "__main__":
    run_test()
