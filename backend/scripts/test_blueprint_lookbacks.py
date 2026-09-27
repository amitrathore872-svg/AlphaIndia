"""
Alpha India - Asymmetric Execution Lookback Comparison
Compares 10D, 20D, 40D, 60D lookbacks under an institutional trade execution blueprint:
- Stop Loss: -4.0%
- Target: +10.0%
- Trailing Breakeven at +4.0%
- Max Hold: 15 trading days
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_blueprint_lookback_test():
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
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    all_df["NEXT_OPEN"] = grouped["OPEN"].shift(-1)

    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_50_FLAG"] = (all_df["DELIV_PER"] >= 50.0).astype(float)

    # Windows to test: 10D (~2 weeks), 20D (~1 month), 40D (~2 months), 60D (~3 months)
    windows = [10, 20, 40, 60]
    for w in windows:
        # Consistency: % of sessions where delivery % >= 50%
        all_df[f"DELIV_CONSISTENCY_{w}"] = grouped["DELIV_50_FLAG"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean()) * 100.0
        # Average Delivery % over window
        all_df[f"AVG_DELIV_PER_{w}"] = grouped["DELIV_PER"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).mean())
        # Up-day delivery ratio
        up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(w, min_periods=w//2).sum())
        all_df[f"DELIV_FLOW_{w}"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)

    # Trade simulation function
    def simulate_trades(signal_mask, stop_loss_pct=4.0, target_pct=10.0, breakeven_trigger_pct=4.0, max_hold=12):
        signals = all_df[signal_mask]
        if len(signals) == 0:
            return None
        trades = []
        sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

        for _, sig in signals.iterrows():
            sym = sig["SYMBOL"]
            sub = sym_map.get(sym)
            if sub is None:
                continue
            date_idx = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not date_idx or date_idx[0] + 1 >= len(sub):
                continue
            entry_idx = date_idx[0] + 1
            entry_price = sub.loc[entry_idx, "OPEN"]
            if pd.isna(entry_price) or entry_price <= 0:
                entry_price = sig["CLOSE"]

            sl = entry_price * (1.0 - stop_loss_pct / 100.0)
            tgt = entry_price * (1.0 + target_pct / 100.0)
            be_trig = entry_price * (1.0 + breakeven_trigger_pct / 100.0)

            be_active = False
            exit_price = entry_price
            exit_reason = "HOLD_EXPIRE"
            hold_days = 0

            for d in range(1, max_hold + 1):
                cur_idx = entry_idx + d
                if cur_idx >= len(sub):
                    exit_price = sub.loc[cur_idx - 1, "CLOSE"]
                    break
                row = sub.loc[cur_idx]
                hold_days = d

                # Target check
                if row["HIGH"] >= tgt:
                    exit_price = tgt
                    exit_reason = "TARGET_HIT"
                    break
                # Breakeven activation
                if row["HIGH"] >= be_trig and not be_active:
                    be_active = True
                    sl = entry_price * 1.005 # Breakeven + 0.5% buffer
                # Stop loss check
                if row["LOW"] <= sl:
                    exit_price = sl
                    exit_reason = "BE_STOP" if be_active else "STOP_LOSS"
                    break
                if d == max_hold:
                    exit_price = row["CLOSE"]
                    exit_reason = "TIME_EXIT"

            ret = ((exit_price - entry_price) / entry_price) * 100.0 - 0.15 # slippage
            trades.append({"ret": ret, "reason": exit_reason, "hold": hold_days})

        if not trades:
            return None
        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["ret"] > 0]
        losses = tdf[tdf["ret"] <= 0]
        profit = wins["ret"].sum()
        loss = abs(losses["ret"].sum())
        pf = profit / loss if loss > 0 else 0
        wr = len(wins) / len(tdf) * 100.0
        avg_ret = tdf["ret"].mean()
        target_hit_rate = (tdf["reason"] == "TARGET_HIT").mean() * 100.0
        return {
            "n_trades": len(tdf),
            "win_rate": round(wr, 1),
            "profit_factor": round(pf, 2),
            "avg_return": round(avg_ret, 2),
            "target_hit_pct": round(target_hit_rate, 1),
        }

    print("\n" + "="*95)
    print("BACKTEST: OPTIMAL HISTORICAL LOOKBACK WINDOW FOR INSTITUTIONAL ACCUMULATION")
    print("Trade Rules: -4% SL, +10% Target, +4% Breakeven Lock, Max 12 Days Hold, 0.15% Slippage")
    print("="*95)

    # 1. Baseline: 1-Day Delivery Spike Alone (No History)
    base_spike = (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_QTY"] >= 2.5 * all_df["DELIV_10_SMA"]) & \
                 (all_df["TURNOVER_CR"] >= 3.0) & (all_df["CLOSE"] > all_df["SMA_20"])
    res_base = simulate_trades(base_spike)
    print(f"\n[BASELINE: 1-Day Spike Only - No Historical Window]:")
    print(f"  Trades: {res_base['n_trades']} | WinRate: {res_base['win_rate']}% | PF: {res_base['profit_factor']} | AvgRet: {res_base['avg_return']:+5.2f}% | TargetHits: {res_base['target_hit_pct']}%")

    # 2. Test each historical lookback window: 10D, 20D, 40D, 60D
    for w in windows:
        months = w / 20.0
        # Historical Accumulation Filter:
        # At least 45% of days in window had >= 50% delivery AND up-day delivery ratio >= 1.3x
        accum_mask = (all_df[f"DELIV_CONSISTENCY_{w}"] >= 45.0) & \
                     (all_df[f"DELIV_FLOW_{w}"] >= 1.25) & \
                     (all_df[f"AVG_DELIV_PER_{w}"] >= 52.0)
        
        # Combined with Breakout Structure & Fresh Ignition
        combined_mask = base_spike & accum_mask & (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98)
        res = simulate_trades(combined_mask)
        if res:
            print(f"\n[LOOKBACK WINDOW: {w:2d} Trading Days (~{months:.1f} Month(s))]:")
            print(f"  Trades: {res['n_trades']:4d} | WinRate: {res['win_rate']:4.1f}% | PF: {res['profit_factor']:4.2f} | AvgRet: {res['avg_return']:+5.2f}% | TargetHits: {res['target_hit_pct']:4.1f}%")

    print("\nExecution complete.")

if __name__ == "__main__":
    run_blueprint_lookback_test()
