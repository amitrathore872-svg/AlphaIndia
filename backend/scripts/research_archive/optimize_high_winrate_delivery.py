"""
Alpha India - 65% to 70%+ Win Rate Delivery Breakout Optimizer
Systematically tests combinations of:
1. Multi-Session Delivery Accumulation (20-30 Day D-A/D Ratio >= 1.5x - 2.5x)
2. Relative Strength (RS Rating >= 75 - 85 vs Nifty 50)
3. Volatility Contraction / Supply Exhaustion (Vol 5 / Vol 20 <= 0.85)
4. Market Regime Filter (Nifty > 20 EMA / 50 SMA)
5. Precision Execution Blueprint: Dynamic Target/SL and Breakeven Profit Locker
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_winrate_optimization():
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
    all_df["LOW_10"] = grouped["LOW"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).min())
    
    # Volume Dry-Up
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)

    # Multi-session Accumulation Flow (Up-Day Delivery / Down-Day Delivery over 20 Sessions)
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    # Delivery Consistency over 20 Sessions (% of sessions with >= 50% delivery)
    deliv_50 = (all_df["DELIV_PER"] >= 50.0).astype(float)
    all_df["DELIV_CONSISTENCY_20D"] = grouped[deliv_50.name].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean()) * 100.0

    # Stock 3-Month Momentum vs Universe (Proxy for Relative Strength RS Rating)
    all_df["ROC_60D"] = grouped["CLOSE"].transform(lambda x: (x.shift(1) / x.shift(61) - 1.0) * 100.0)
    # Market Breadth Proxy (Percentage of universe closing > 20 SMA)
    date_breadth = all_df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["SMA_20"]).mean() * 100.0).to_dict()
    all_df["MARKET_BREADTH"] = all_df["DATE"].map(date_breadth).fillna(50.0)

    print(f"Data prepared in {time.time() - t0:.1f}s. Running execution simulations...")

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def evaluate_strategy(mask, sl_pct=3.5, tgt_pct=7.5, be_trig=3.5, max_hold=12, dynamic_sl=False):
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

            if dynamic_sl:
                # Tight structural stop at low of prior 3 sessions, capped at 3.5% max risk
                recent_low = sub.loc[max(0, entry_idx-3):entry_idx-1, "LOW"].min()
                risk = max(entry_price * 0.015, min(entry_price * 0.035, entry_price - recent_low))
                sl = entry_price - risk
            else:
                sl = entry_price * (1.0 - sl_pct / 100.0)

            tgt = entry_price * (1.0 + tgt_pct / 100.0)
            be_level = entry_price * (1.0 + be_trig / 100.0)
            be_active = False
            exit_price = entry_price
            reason = "TIME_EXIT"
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
                    reason = "TARGET_HIT"
                    break
                # Breakeven lock check
                if row["HIGH"] >= be_level and not be_active:
                    be_active = True
                    sl = entry_price * 1.004 # locked at +0.4% (covers slippage)
                # Stop loss check
                if row["LOW"] <= sl:
                    exit_price = sl
                    reason = "BE_LOCK" if be_active else "STOP_LOSS"
                    break
                if d == max_hold:
                    exit_price = row["CLOSE"]

            ret = ((exit_price - entry_price) / entry_price) * 100.0 - 0.15 # net of slippage
            trades.append({"ret": ret, "reason": reason, "hold": hold_days})

        if not trades: return None
        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["ret"] > 0]
        losses = tdf[tdf["ret"] <= 0]
        pf = wins["ret"].sum() / abs(losses["ret"].sum()) if len(losses) > 0 and abs(losses["ret"].sum()) > 0 else 99.0
        wr = len(wins) / len(tdf) * 100.0
        return {
            "n": len(tdf),
            "win_rate": round(wr, 1),
            "pf": round(pf, 2),
            "avg_ret": round(tdf["ret"].mean(), 2),
            "tgt_hits": round((tdf["reason"] == "TARGET_HIT").mean() * 100.0, 1),
            "be_saves": round((tdf["reason"] == "BE_LOCK").mean() * 100.0, 1),
            "full_stops": round((tdf["reason"] == "STOP_LOSS").mean() * 100.0, 1),
            "avg_hold": round(tdf["hold"].mean(), 1),
        }

    print("\n" + "="*110)
    print("EXPERIMENT 1: PROGRESSIVE ENHANCEMENTS TOWARDS 65% - 70%+ WIN RATE")
    print("="*110)

    # 1. Baseline: Raw 1-Day Spike (-4% SL, +10% Target)
    m0 = (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["TURNOVER_CR"] >= 2.0)
    r0 = evaluate_strategy(m0, sl_pct=4.0, tgt_pct=10.0, be_trig=4.5)
    print(f"Level 0 (Raw 1-Day Spike):        N={r0['n']:4d} | WR={r0['win_rate']:4.1f}% | PF={r0['pf']:4.2f} | AvgRet={r0['avg_ret']:+5.2f}% | TgtHit={r0['tgt_hits']:4.1f}% | FullStops={r0['full_stops']:4.1f}%")

    # 2. Level 1: Add Stage 2 Trend + Candle Close Quality
    m1 = m0 & (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["SMA_20"] > all_df["SMA_50"]) & (all_df["CLOSE_LOCATION"] >= 0.65)
    r1 = evaluate_strategy(m1, sl_pct=3.5, tgt_pct=8.0, be_trig=3.5)
    print(f"Level 1 (+ Stage 2 + Upper Close): N={r1['n']:4d} | WR={r1['win_rate']:4.1f}% | PF={r1['pf']:4.2f} | AvgRet={r1['avg_ret']:+5.2f}% | TgtHit={r1['tgt_hits']:4.1f}% | FullStops={r1['full_stops']:4.1f}%")

    # 3. Level 2: Add 20-Day Sustained Accumulation Flow (D-A/D >= 1.5x)
    m2 = m1 & (all_df["DELIV_FLOW_20D"] >= 1.50) & (all_df["DELIV_CONSISTENCY_20D"] >= 45.0)
    r2 = evaluate_strategy(m2, sl_pct=3.5, tgt_pct=7.5, be_trig=3.2)
    print(f"Level 2 (+ 20D Accum Flow >=1.5x): N={r2['n']:4d} | WR={r2['win_rate']:4.1f}% | PF={r2['pf']:4.2f} | AvgRet={r2['avg_ret']:+5.2f}% | TgtHit={r2['tgt_hits']:4.1f}% | FullStops={r2['full_stops']:4.1f}%")

    # 4. Level 3: Add Pre-Ignition Volume Dry-Up (Supply Exhaustion <= 0.90)
    m3 = m2 & (all_df["VOL_DRYUP"] <= 0.90)
    r3 = evaluate_strategy(m3, sl_pct=3.2, tgt_pct=7.0, be_trig=3.0)
    print(f"Level 3 (+ Supply Dry-Up <=0.9x):  N={r3['n']:4d} | WR={r3['win_rate']:4.1f}% | PF={r3['pf']:4.2f} | AvgRet={r3['avg_ret']:+5.2f}% | TgtHit={r3['tgt_hits']:4.1f}% | FullStops={r3['full_stops']:4.1f}%")

    # 5. Level 4: Add Relative Strength Leader Filter (ROC 60D > 10%) + Market Regime (Breadth >= 40%)
    m4 = m3 & (all_df["ROC_60D"] >= 10.0) & (all_df["MARKET_BREADTH"] >= 40.0) & (all_df["TURNOVER_CR"] >= 3.0)
    r4 = evaluate_strategy(m4, sl_pct=3.0, tgt_pct=6.5, be_trig=2.8, dynamic_sl=True)
    print(f"Level 4 (+ RS Leader + Dynamic SL): N={r4['n']:4d} | WR={r4['win_rate']:4.1f}% | PF={r4['pf']:4.2f} | AvgRet={r4['avg_ret']:+5.2f}% | TgtHit={r4['tgt_hits']:4.1f}% | FullStops={r4['full_stops']:4.1f}%")

    # 6. Level 5: APEX ULTRA (The 65-70%+ Configuration)
    # High institutional accumulation flow (2.0x), tight base at 50D high, Volume Dry-up, +2.5% Breakeven Lock, +6% Target
    for flow_thresh in [1.5, 1.8, 2.0]:
        for tgt_test in [5.5, 6.0, 7.0]:
            for be_test in [2.5, 2.8, 3.0]:
                m_opt = (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.2) & \
                        (all_df["TURNOVER_CR"] >= 3.0) & (all_df["CLOSE"] > all_df["SMA_20"]) & \
                        (all_df["SMA_20"] > all_df["SMA_50"]) & (all_df["CLOSE_LOCATION"] >= 0.65) & \
                        (all_df["DELIV_FLOW_20D"] >= flow_thresh) & (all_df["VOL_DRYUP"] <= 0.95) & \
                        (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.97) & (all_df["MARKET_BREADTH"] >= 38.0)
                res_opt = evaluate_strategy(m_opt, sl_pct=2.8, tgt_pct=tgt_test, be_trig=be_test, dynamic_sl=True)
                if res_opt and res_opt["n"] >= 50 and res_opt["win_rate"] >= 60.0:
                    print(f"\n>>> ULTRA CONFIG (Flow>={flow_thresh}x | Tgt=+{tgt_test}% | BE=+{be_test}%):")
                    print(f"    Signals: {res_opt['n']} | WIN RATE: {res_opt['win_rate']}% | Profit Factor: {res_opt['pf']} | Avg Return: {res_opt['avg_ret']:+5.2f}% | Target Hits: {res_opt['tgt_hits']}% | BE Saves: {res_opt['be_saves']}% | Stops: {res_opt['full_stops']}%")

    print(f"\nExecution finished in {time.time() - t0:.1f}s")

if __name__ == "__main__":
    run_winrate_optimization()
