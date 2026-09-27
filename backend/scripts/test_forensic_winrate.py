"""
Alpha India - Forensic Analysis: How to Reach 65-70%+ Win Rate on Delivery Setups
Tests:
1. Gap-Up Chase vs Pullback / Limit Entry
2. Structural Stop (Prior Base Low) vs Arbitrary Percentage Stop
3. Near-Pivot Base Accumulation (Pre-Breakout Coil) vs Breakout Chase
4. Regime-Adaptive Exit Rules
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_forensic_analysis():
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
    all_df["LOW_5"] = grouped["LOW"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).min())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    
    # Next day gap
    all_df["NEXT_OPEN"] = grouped["OPEN"].shift(-1)
    all_df["NEXT_LOW"] = grouped["LOW"].shift(-1)
    all_df["NEXT_GAP_PCT"] = ((all_df["NEXT_OPEN"] - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    # 20D Net Accumulation Flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    all_df["PIVOT_PROXIMITY_PCT"] = ((all_df["HIGH_50"] - all_df["CLOSE"]) / all_df["HIGH_50"]) * 100.0
    all_df["IS_50D_BREAKOUT"] = all_df["CLOSE"] >= all_df["HIGH_50"]
    all_df["IS_NEAR_PIVOT"] = (all_df["PIVOT_PROXIMITY_PCT"] <= 2.5) & (all_df["PIVOT_PROXIMITY_PCT"] >= 0)

    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}

    def simulate_entry_and_stops(mask, entry_mode="open", sl_mode="fixed", sl_param=4.0, tgt_pct=8.0, be_trigger=3.5, max_hold=14):
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
            next_row = sub.loc[next_idx]

            # Entry modes:
            # 'open': buy next open
            # 'limit_retest': limit order at signal close (only filled if next low <= signal close)
            # 'pullback_shelf': buy on minor dip to breakout pivot
            if entry_mode == "open":
                entry_price = next_row["OPEN"]
            elif entry_mode == "limit_close":
                # If next low didn't dip to signal close, we didn't get filled
                if next_row["LOW"] > sig["CLOSE"]:
                    continue # missed entry, avoided gap-up chase!
                entry_price = sig["CLOSE"]
            elif entry_mode == "limit_dip_1pct":
                target_dip = sig["CLOSE"] * 0.99
                if next_row["LOW"] > target_dip:
                    continue
                entry_price = target_dip

            if pd.isna(entry_price) or entry_price <= 0: continue

            # Stop loss modes:
            # 'fixed': fixed percentage (e.g. -4.0%)
            # 'structural_base': stop at low of prior 5 sessions (with 6% max cap)
            if sl_mode == "fixed":
                sl = entry_price * (1.0 - sl_param / 100.0)
            elif sl_mode == "structural":
                base_low = sig["LOW_5"] if pd.notna(sig["LOW_5"]) and sig["LOW_5"] > 0 else sig["LOW"]
                sl = min(entry_price * 0.985, max(entry_price * 0.94, base_low * 0.995)) # between -1.5% and -6%

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

                # Target check
                if row["HIGH"] >= tgt:
                    exit_price = tgt
                    reason = "TARGET_HIT"
                    break
                # Breakeven lock check
                if row["HIGH"] >= be_trig_p and not be_active:
                    be_active = True
                    sl = entry_price * 1.005 # locked breakeven + 0.5%
                # Stop loss check
                if row["LOW"] <= sl:
                    exit_price = sl
                    reason = "BE_STOP" if be_active else "STOP_LOSS"
                    break
                if d == max_hold:
                    exit_price = row["CLOSE"]

            ret = ((exit_price - entry_price) / entry_price) * 100.0 - 0.15 # slippage
            trades.append({"ret": ret, "reason": reason, "hold": hold_days})

        if not trades: return None
        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["ret"] > 0]
        losses = tdf[tdf["ret"] <= 0]
        wr = len(wins) / len(tdf) * 100.0
        profit = wins["ret"].sum()
        loss = abs(losses["ret"].sum())
        pf = profit / loss if loss > 0 else 99.0
        tgt_pct_hits = (tdf["reason"] == "TARGET_HIT").mean() * 100.0
        be_saves = (tdf["reason"] == "BE_STOP").mean() * 100.0
        stops = (tdf["reason"] == "STOP_LOSS").mean() * 100.0
        return {
            "n": len(tdf),
            "win_rate": round(wr, 1),
            "pf": round(pf, 2),
            "avg_ret": round(tdf["ret"].mean(), 2),
            "tgt_hits": round(tgt_pct_hits, 1),
            "be_saves": round(be_saves, 1),
            "stops": round(stops, 1),
        }

    # Core institutional delivery filter
    base_mask = (all_df["TURNOVER_CR"] >= 3.0) & \
                (all_df["DELIV_PER"] >= 65.0) & \
                (all_df["DELIV_SPIKE_10X"] >= 2.2) & \
                (all_df["CLOSE"] > all_df["SMA_20"]) & \
                (all_df["SMA_20"] > all_df["SMA_50"]) & \
                (all_df["DELIV_FLOW_20D"] >= 1.40) & \
                (all_df["VOL_DRYUP"] <= 1.10) & \
                ((all_df["IS_50D_BREAKOUT"]) | (all_df["IS_NEAR_PIVOT"]))

    print("\n" + "="*115)
    print("TESTING STRATEGIES TO ACHIEVE 65% - 70%+ WIN RATE")
    print("="*115)

    experiments = [
        ("1. Standard Open Entry (Tight -3.5% SL / +8% Tgt / +3.5% BE)",
         dict(entry_mode="open", sl_mode="fixed", sl_param=3.5, tgt_pct=8.0, be_trigger=3.5)),

        ("2. Standard Open Entry (Structural Shelf SL / +8% Tgt / +3.5% BE)",
         dict(entry_mode="open", sl_mode="structural", tgt_pct=8.0, be_trigger=3.5)),

        ("3. Anti-Chase Limit Entry at Signal Close (Structural SL / +8% Tgt / +3.0% BE)",
         dict(entry_mode="limit_close", sl_mode="structural", tgt_pct=8.0, be_trigger=3.0)),

        ("4. Patient Pullback Entry (-1% Dip below Close) (Structural SL / +7% Tgt / +2.5% BE)",
         dict(entry_mode="limit_dip_1pct", sl_mode="structural", tgt_pct=7.0, be_trigger=2.5)),

        ("5. Near-Pivot Pre-Breakout Setups Only (Anti-Chase Limit Close / +6% Tgt / +2.5% BE)",
         dict(entry_mode="limit_close", sl_mode="structural", tgt_pct=6.0, be_trigger=2.5),
         base_mask & (all_df["IS_NEAR_PIVOT"])),

        ("6. High-Conviction Ignition Only (Turnover >= 5 Cr, Deliv >= 70%, Limit Close, +6% Tgt, +2.5% BE)",
         dict(entry_mode="limit_close", sl_mode="structural", tgt_pct=6.0, be_trigger=2.5),
         base_mask & (all_df["TURNOVER_CR"] >= 5.0) & (all_df["DELIV_PER"] >= 70.0)),

        ("7. WINNER CLIMAX: 20D Flow >= 1.8x + Volume Dryup <= 0.85 + Anti-Chase Limit + +5.5% Tgt + +2.5% BE",
         dict(entry_mode="limit_close", sl_mode="structural", tgt_pct=5.5, be_trigger=2.5),
         base_mask & (all_df["DELIV_FLOW_20D"] >= 1.8) & (all_df["VOL_DRYUP"] <= 0.85)),

        ("8. WINNER APEX 70%+: Volume Dryup <= 0.80 + Limit Dip -1% + +5.0% Tgt + +2.0% BE",
         dict(entry_mode="limit_dip_1pct", sl_mode="structural", tgt_pct=5.0, be_trigger=2.0),
         base_mask & (all_df["VOL_DRYUP"] <= 0.80)),
    ]

    for item in experiments:
        name = item[0]
        params = item[1]
        mask = item[2] if len(item) > 2 else base_mask
        res = simulate_entry_and_stops(mask, **params)
        if res:
            tag = "🎯 65-70%+ WIN RATE!" if res["win_rate"] >= 65.0 else ("🔥 60-64% Near Target" if res["win_rate"] >= 60.0 else "Normal")
            print(f"\n{name}:")
            print(f"  [{tag}] Trades: {res['n']:4d} | WIN RATE: {res['win_rate']:5.1f}% | Profit Factor: {res['pf']:4.2f} | Avg Return: {res['avg_ret']:+5.2f}% | Target Hits: {res['tgt_hits']:4.1f}% | BE Saves: {res['be_saves']:4.1f}% | Stops: {res['stops']:4.1f}%")

if __name__ == "__main__":
    run_forensic_analysis()
