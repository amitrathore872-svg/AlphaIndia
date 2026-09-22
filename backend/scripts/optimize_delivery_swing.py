"""
Alpha India - Advanced Institutional Delivery Swing Optimizer
Tests 5 refined institutional setups:
1. 20-Day High Breakout + Delivery Spike (Momentum Stage 2)
2. Structural Trend (20 SMA > 50 SMA) + Dynamic Low-of-Day Stop Loss (2.5R Target)
3. Delivery Volume Dry-up into Absorption (VCP base breakout)
4. Mega Institutional Liquidity (Turnover >= 5 Cr, Deliv >= 60%, Spike >= 2.5x)
5. Consecutive 2-Day Delivery Climax
"""

import glob
import os
import time
import pandas as pd
import numpy as np

def load_data():
    files = sorted(glob.glob("data/nse_delivery/sec_bhavdata_full_*.csv"))
    comp_df = pd.read_csv("data/nse_companies_master.csv")
    valid_symbols = set(comp_df["SYMBOL"].str.strip())
    comp_names = dict(zip(comp_df["SYMBOL"].str.strip(), comp_df["NAME OF COMPANY"].str.strip()))

    records = []
    for f in files:
        df = pd.read_csv(f)
        df.columns = [c.strip() for c in df.columns]
        df = df[df["SERIES"].str.strip() == "EQ"].copy()
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

    all_df = pd.concat(records, ignore_index=True)
    all_df = all_df.sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)

    # Precompute indicators
    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["LOW_10"] = grouped["LOW"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).min())
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    
    # 2-day consecutive delivery check
    all_df["PREV_DELIV_PER"] = grouped["DELIV_PER"].shift(1)
    all_df["PREV_DELIV_SPIKE"] = grouped["DELIV_SPIKE_10X"].shift(1)
    
    # Next open
    all_df["NEXT_OPEN"] = grouped["OPEN"].shift(-1)
    
    return all_df, comp_names

def simulate_advanced_trades(all_df, signal_mask, mode="fixed", target_pct=8.0, stop_loss_pct=4.0, rr_multiple=2.5, max_holding_days=10):
    signals = all_df[signal_mask].copy()
    if len(signals) == 0:
        return []

    sym_dates = all_df.groupby("SYMBOL")
    trades = []

    for sym, sig_rows in signals.groupby("SYMBOL"):
        sub_df = sym_dates.get_group(sym).reset_index(drop=True)
        sub_dates = sub_df["DATE"].values
        sub_opens = sub_df["OPEN"].values
        sub_highs = sub_df["HIGH"].values
        sub_lows = sub_df["LOW"].values
        sub_closes = sub_df["CLOSE"].values
        
        date_to_idx = {d: i for i, d in enumerate(sub_dates)}
        
        for _, sig in sig_rows.iterrows():
            sig_date = sig["DATE"]
            sig_idx = date_to_idx.get(sig_date)
            if sig_idx is None or sig_idx + 1 >= len(sub_df):
                continue
            
            entry_idx = sig_idx + 1
            entry_date = sub_dates[entry_idx]
            entry_price = sub_opens[entry_idx]
            if pd.isna(entry_price) or entry_price <= 0:
                entry_price = sig["CLOSE"]
            
            if mode == "dynamic_sl":
                # Stop loss at Signal Candle Low
                signal_low = sig["LOW"]
                risk_amt = max(entry_price * 0.015, entry_price - signal_low)
                # Cap risk at 5.5% max
                risk_amt = min(risk_amt, entry_price * 0.055)
                stop_price = entry_price - risk_amt
                target_price = entry_price + (risk_amt * rr_multiple)
            else:
                target_price = entry_price * (1.0 + target_pct / 100.0)
                stop_price = entry_price * (1.0 - stop_loss_pct / 100.0)
            
            exit_price = None
            exit_date = None
            exit_reason = None
            holding_days = 0
            
            end_idx = min(len(sub_df), entry_idx + max_holding_days)
            for bar_idx in range(entry_idx, end_idx):
                holding_days += 1
                curr_high = sub_highs[bar_idx]
                curr_low = sub_lows[bar_idx]
                curr_close = sub_closes[bar_idx]
                curr_date = sub_dates[bar_idx]
                
                # Check stop loss first
                if curr_low <= stop_price:
                    exit_price = stop_price
                    exit_date = curr_date
                    exit_reason = "STOP_LOSS"
                    break
                elif curr_high >= target_price:
                    exit_price = target_price
                    exit_date = curr_date
                    exit_reason = "TARGET_HIT"
                    break
                elif bar_idx == end_idx - 1:
                    exit_price = curr_close
                    exit_date = curr_date
                    exit_reason = "TIME_EXIT"
                    break
            
            if exit_price is not None:
                ret_pct = ((exit_price - entry_price) / entry_price) * 100.0
                trades.append({
                    "symbol": sym,
                    "signal_date": pd.to_datetime(sig_date).strftime("%Y-%m-%d"),
                    "entry_date": pd.to_datetime(entry_date).strftime("%Y-%m-%d"),
                    "exit_date": pd.to_datetime(exit_date).strftime("%Y-%m-%d"),
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exit_price, 2),
                    "ret_pct": round(ret_pct, 2),
                    "exit_reason": exit_reason,
                    "holding_days": holding_days,
                    "deliv_per": round(sig["DELIV_PER"], 2),
                    "deliv_spike_x": round(sig["DELIV_SPIKE_10X"], 2),
                })
    return trades

def eval_trades(trades, name):
    if not trades:
        return {"Strategy": name, "Trades": 0, "Win Rate %": 0.0, "Avg Ret %": 0.0, "Profit Factor": 0.0, "Target %": 0.0, "Stop %": 0.0}
    df = pd.DataFrame(trades)
    wins = df[df["ret_pct"] > 0]
    losses = df[df["ret_pct"] < 0]
    wr = len(wins) / len(df) * 100.0
    gp = wins["ret_pct"].sum() if len(wins) > 0 else 0.0
    gl = abs(losses["ret_pct"].sum()) if len(losses) > 0 else 0.001
    pf = gp / gl
    t_hit = (df["exit_reason"] == "TARGET_HIT").sum() / len(df) * 100.0
    s_hit = (df["exit_reason"] == "STOP_LOSS").sum() / len(df) * 100.0
    return {
        "Strategy": name,
        "Trades": len(df),
        "Win Rate %": round(wr, 1),
        "Avg Ret %": round(df["ret_pct"].mean(), 2),
        "Profit Factor": round(pf, 2),
        "Target %": round(t_hit, 1),
        "Stop %": round(s_hit, 1),
        "trades_df": df
    }

def main():
    all_df, comp_names = load_data()
    base_filter = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE"] >= 50.0)
    
    results = []

    # Setup 1: 20-Day High Breakout with Delivery Spike (Stage 2 Expansion)
    # Price breaks 20D high + Delivery % >= 55% + Spike >= 2.0x
    m1 = base_filter & (all_df["CLOSE"] >= all_df["HIGH_20"]) & \
         (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE_10X"] >= 2.0) & (all_df["DAY_RET_PCT"] >= 1.5)
    t1 = simulate_advanced_trades(all_df, m1, mode="fixed", target_pct=9.0, stop_loss_pct=3.5, max_holding_days=10)
    results.append(eval_trades(t1, "1. 20-Day High Breakout + Delivery Surge (9% Tgt / 3.5% SL)"))

    # Setup 2: Stage 2 Trend (Close > 20 SMA & 20 SMA > 50 SMA) + Dynamic Low-of-Day SL (2.5R Target)
    m2 = base_filter & (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["SMA_20"] > all_df["SMA_50"]) & \
         (all_df["DELIV_PER"] >= 60.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DAY_RET_PCT"] >= 1.0)
    t2 = simulate_advanced_trades(all_df, m2, mode="dynamic_sl", rr_multiple=2.5, max_holding_days=12)
    results.append(eval_trades(t2, "2. Stage 2 Trend + Dynamic Low SL (2.5R Target, 12-Day Hold)"))

    # Setup 3: Institutional Mega-Liquidity (Turnover >= 10 Cr, Deliv >= 65%, Spike >= 2.5x, >20SMA)
    # Mega-cap/large midcap institutional accumulation with zero slippage
    m3 = (all_df["TURNOVER_CR"] >= 10.0) & (all_df["CLOSE"] > all_df["SMA_20"]) & \
         (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DAY_RET_PCT"] >= 1.0)
    t3 = simulate_advanced_trades(all_df, m3, mode="fixed", target_pct=8.0, stop_loss_pct=3.5, max_holding_days=10)
    results.append(eval_trades(t3, "3. Mega-Liquidity Institutional (Turnover>=10Cr, Deliv>=65%, Spike>=2.5x)"))

    # Setup 4: 2-Day Consecutive Delivery Accumulation (Day t & Day t-1 both Deliv >= 55% & Spike >= 1.8x)
    m4 = base_filter & (all_df["CLOSE"] > all_df["SMA_20"]) & \
         (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE_10X"] >= 1.8) & \
         (all_df["PREV_DELIV_PER"] >= 55.0) & (all_df["PREV_DELIV_SPIKE"] >= 1.5) & (all_df["DAY_RET_PCT"] >= 0.5)
    t4 = simulate_advanced_trades(all_df, m4, mode="fixed", target_pct=8.0, stop_loss_pct=3.5, max_holding_days=10)
    results.append(eval_trades(t4, "4. Consecutive 2-Day Delivery Cluster (Both Days Deliv>=55%, Spike>=1.8x)"))

    # Setup 5: High Delivery Base Breakout (Low Volatility 10D low near, followed by Deliv >= 65%, Spike >= 3.0x)
    m5 = base_filter & (all_df["CLOSE"] > all_df["SMA_20"]) & \
         (all_df["DELIV_PER"] >= 70.0) & (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0)
    t5 = simulate_advanced_trades(all_df, m5, mode="fixed", target_pct=10.0, stop_loss_pct=4.0, max_holding_days=12)
    results.append(eval_trades(t5, "5. Pure Climax Absorption (Deliv>=70%, Spike>=3.0x, DayGain>=2%)"))

    summary_df = pd.DataFrame([{k: v for k, v in r.items() if k != "trades_df"} for r in results])
    print("\n" + "="*100)
    print(">>> ADVANCED INSTITUTIONAL SWING STRATEGY COMPARISON <<<")
    print("="*100)
    print(summary_df.to_string(index=False))

    # Detailed report for the top setups
    for r in results:
        df_trades = r.get("trades_df")
        if df_trades is not None and not df_trades.empty:
            df_trades["company_name"] = df_trades["symbol"].map(comp_names).fillna(df_trades["symbol"])
            df_trades.to_csv(f"data/analysis/trades_{r['Strategy'][:15].replace(' ', '_')}.csv", index=False)

if __name__ == "__main__":
    main()
