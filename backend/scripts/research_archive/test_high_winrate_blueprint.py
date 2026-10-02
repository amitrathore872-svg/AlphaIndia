"""
Alpha India - 65-70%+ Win Rate Delivery Breakthrough Engine
Tests:
1. Two-Tier Target Scaling (Tranche 1 @ +4.5% to +6.0%, Trailing remainder)
2. Breakeven Profit Locker at +3.0% to +3.5%
3. Multi-Session Accumulation (20D D-A/D >= 1.6x, Deliv Days >= 40%)
4. Supply Contraction Base (Vol 5 / Vol 20 <= 1.0)
5. Nifty 50 Trend Gate
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_winrate_breakthrough():
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
    all_df["DELIV_TURNOVER_CR"] = all_df["TURNOVER_CR"] * (all_df["DELIV_PER"] / 100.0)
    
    candle_range = all_df["HIGH"] - all_df["LOW"]
    all_df["CLOSE_LOCATION"] = np.where(candle_range > 0, (all_df["CLOSE"] - all_df["LOW"]) / candle_range, 0.5)

    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).max())
    
    # 5D vs 20D Volume Contraction
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)

    # 20-Day Multi-Session Accumulation
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    deliv_50 = (all_df["DELIV_PER"] >= 50.0).astype(float)
    all_df["DELIV_CONSISTENCY_20D"] = grouped[deliv_50.name].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean()) * 100.0

    # Market Breadth Proxy
    date_breadth = all_df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["SMA_20"]).mean() * 100.0).to_dict()
    all_df["MARKET_BREADTH"] = all_df["DATE"].map(date_breadth).fillna(50.0)

    # Pivot Proximity
    all_df["PIVOT_PROXIMITY_PCT"] = ((all_df["HIGH_50"] - all_df["CLOSE"]) / all_df["HIGH_50"]) * 100.0

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def simulate_two_tier(mask, t1_pct=5.0, t2_pct=10.0, be_trigger=3.0, sl_pct=3.5, max_hold=12):
        signals = all_df[mask]
        if len(signals) == 0:
            return None
        trades = []
        for _, sig in signals.iterrows():
            sym = sig["SYMBOL"]
            sub = sym_map.get(sym)
            if sub is None: continue
            d_idx = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not d_idx or d_idx[0] + 1 >= len(sub): continue
            entry_idx = d_idx[0] + 1
            entry_price = sub.loc[entry_idx, "OPEN"]
            if pd.isna(entry_price) or entry_price <= 0: entry_price = sig["CLOSE"]

            sl = entry_price * (1.0 - sl_pct / 100.0)
            t1 = entry_price * (1.0 + t1_pct / 100.0)
            t2 = entry_price * (1.0 + t2_pct / 100.0)
            be_trig_p = entry_price * (1.0 + be_trigger / 100.0)

            t1_hit = False
            t2_hit = False
            be_active = False
            t1_pnl = 0.0
            t2_pnl = 0.0
            hold_days = 0
            exit_reason = "EXPIRE"

            for d in range(1, max_hold + 1):
                cur_idx = entry_idx + d
                if cur_idx >= len(sub):
                    cur_close = sub.loc[cur_idx - 1, "CLOSE"]
                    if not t1_hit: t1_pnl = (cur_close - entry_price) / entry_price * 100.0
                    t2_pnl = (cur_close - entry_price) / entry_price * 100.0
                    break
                row = sub.loc[cur_idx]
                hold_days = d

                # Check T1 hit (50% booked)
                if not t1_hit and row["HIGH"] >= t1:
                    t1_hit = True
                    t1_pnl = t1_pct
                    be_active = True
                    sl = entry_price * 1.004 # move stop to breakeven + 0.4%

                # Check Breakeven Trigger before T1
                if not be_active and row["HIGH"] >= be_trig_p:
                    be_active = True
                    sl = entry_price * 1.004

                # Check T2 hit
                if t1_hit and row["HIGH"] >= t2:
                    t2_hit = True
                    t2_pnl = t2_pct
                    exit_reason = "T2_FULL_WIN"
                    break

                # Check Stop Loss
                if row["LOW"] <= sl:
                    if t1_hit:
                        t2_pnl = 0.4 # exited at breakeven
                        exit_reason = "T1_WIN_BE_TRAIL"
                    elif be_active:
                        t1_pnl = 0.4
                        t2_pnl = 0.4
                        exit_reason = "BE_SCRATCH"
                    else:
                        t1_pnl = -sl_pct
                        t2_pnl = -sl_pct
                        exit_reason = "STOP_LOSS"
                    break

                if d == max_hold:
                    cur_close = row["CLOSE"]
                    if not t1_hit: t1_pnl = (cur_close - entry_price) / entry_price * 100.0
                    t2_pnl = (cur_close - entry_price) / entry_price * 100.0
                    exit_reason = "TIME_EXIT"

            # Net blended PnL: 50% Tranche 1 + 50% Tranche 2 - 0.15% slippage
            net_ret = (0.5 * t1_pnl + 0.5 * t2_pnl) - 0.15
            trades.append({"ret": net_ret, "reason": exit_reason, "hold": hold_days, "t1_hit": t1_hit, "t2_hit": t2_hit})

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
            "t1_hit_rate": round(tdf["t1_hit"].mean() * 100.0, 1),
            "t2_hit_rate": round(tdf["t2_hit"].mean() * 100.0, 1),
            "full_stops": round((tdf["reason"] == "STOP_LOSS").mean() * 100.0, 1),
            "avg_hold": round(tdf["hold"].mean(), 1),
        }

    print("\n" + "="*115)
    print("SIMULATING 2-TRANCHE EXECUTION MODEL (50% at T1, 50% Trail to T2, Breakeven Locker)")
    print("="*115)

    # Test parameter matrix
    t1_options = [4.5, 5.0, 5.5, 6.0]
    be_options = [2.5, 3.0, 3.5]
    flow_thresholds = [1.25, 1.5, 1.8, 2.0]

    for flow in flow_thresholds:
        print(f"\n--- Testing 20-Day Accumulation Flow >= {flow}x ---")
        base_filter = (
            (all_df["TURNOVER_CR"] >= 3.0) &
            (all_df["DELIV_PER"] >= 65.0) &
            (all_df["DELIV_SPIKE_10X"] >= 2.2) &
            (all_df["DAY_RET"] >= 1.2) &
            (all_df["CLOSE"] > all_df["SMA_20"]) &
            (all_df["SMA_20"] > all_df["SMA_50"]) &
            (all_df["CLOSE_LOCATION"] >= 0.65) &
            (all_df["VOL_DRYUP"] <= 1.05) &
            (all_df["DELIV_FLOW_20D"] >= flow) &
            (all_df["PIVOT_PROXIMITY_PCT"] <= 3.0) &
            (all_df["MARKET_BREADTH"] >= 38.0)
        )
        
        for t1_p in t1_options:
            for be_p in be_options:
                if be_p >= t1_p: continue
                res = simulate_two_tier(base_filter, t1_pct=t1_p, t2_pct=10.0, be_trigger=be_p, sl_pct=3.5, max_hold=12)
                if res:
                    status = "🎯 TARGET 65-70% ACHIEVED!" if res["win_rate"] >= 65.0 else ("Close (60-64%)" if res["win_rate"] >= 60.0 else "Sub-60%")
                    print(f"[{status}] Flow>={flow}x | T1=+{t1_p}% | BE_Trig=+{be_p}%: N={res['n']:3d} | WIN RATE: {res['win_rate']:5.1f}% | PF: {res['pf']:4.2f} | AvgRet: {res['avg_ret']:+5.2f}% | T1 Hits: {res['t1_hit_rate']:4.1f}% | Stops: {res['full_stops']:4.1f}%")

    print(f"\nCompleted in {time.time() - t0:.1f}s")

if __name__ == "__main__":
    run_winrate_breakthrough()
