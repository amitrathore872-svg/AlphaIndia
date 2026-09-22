"""
Alpha India - Institutional Swing Strategy Backtester (Delivery % & Volume Spikes)
Evaluates multiple swing trading strategies across 185 trading sessions of official NSE OHLCV + Delivery data.
"""

import glob
import os
import time
import pandas as pd
import numpy as np

def load_all_data():
    print("Loading 185 NSE delivery bhavcopies...")
    t0 = time.time()
    files = sorted(glob.glob("data/nse_delivery/sec_bhavdata_full_*.csv"))
    
    # Official equities filter
    comp_df = pd.read_csv("data/nse_companies_master.csv")
    valid_symbols = set(comp_df["SYMBOL"].str.strip())
    comp_names = dict(zip(comp_df["SYMBOL"].str.strip(), comp_df["NAME OF COMPANY"].str.strip()))

    records = []
    for f in files:
        try:
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
        except Exception as e:
            print(f"Error loading {f}: {e}")

    all_df = pd.concat(records, ignore_index=True)
    all_df = all_df.sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Loaded {len(all_df)} records across {all_df['SYMBOL'].nunique()} equities in {time.time() - t0:.2f}s.")
    return all_df, comp_names

def precompute_indicators(all_df):
    print("Precomputing indicators (Moving Averages, Delivery Spikes, Range Locations)...")
    t0 = time.time()
    
    # Calculate rolling metrics per symbol
    grouped = all_df.groupby("SYMBOL", group_keys=False)
    
    # 10-day and 20-day Average Delivery Volume
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_20_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    
    # Delivery Spike Multipliers
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["DELIV_SPIKE_20X"] = np.where(all_df["DELIV_20_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_20_SMA"], 0.0)
    
    # Price 20 and 50 Moving Averages
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    
    # Daily Price Return %
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    
    # Day Close Location (0.0 to 1.0)
    d_range = np.maximum(0.01, all_df["HIGH"] - all_df["LOW"])
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / d_range
    
    # Next day open (realistic entry price)
    all_df["NEXT_OPEN"] = grouped["OPEN"].shift(-1)
    
    print(f"Indicators computed in {time.time() - t0:.2f}s.")
    return all_df

def simulate_swing_trades(all_df, signal_mask, target_pct=8.0, stop_loss_pct=4.0, max_holding_days=10):
    """
    Simulates swing trades based on a boolean signal_mask.
    Entry: Next Day Open (t+1).
    Exits: Tested day by day against intraday High/Low up to max_holding_days.
    """
    signals = all_df[signal_mask].copy()
    if len(signals) == 0:
        return []

    # Map each symbol to its ordered DataFrame for fast subsequent candle lookup
    sym_dates = all_df.groupby("SYMBOL")
    
    # Store trades
    trades = []
    
    # Group signals by symbol to avoid repeated indexing
    for sym, sig_rows in signals.groupby("SYMBOL"):
        sub_df = sym_dates.get_group(sym).reset_index(drop=True)
        sub_dates = sub_df["DATE"].values
        sub_opens = sub_df["OPEN"].values
        sub_highs = sub_df["HIGH"].values
        sub_lows = sub_df["LOW"].values
        sub_closes = sub_df["CLOSE"].values
        
        # Build date to index map
        date_to_idx = {d: i for i, d in enumerate(sub_dates)}
        
        for _, sig in sig_rows.iterrows():
            sig_date = sig["DATE"]
            sig_idx = date_to_idx.get(sig_date)
            if sig_idx is None or sig_idx + 1 >= len(sub_df):
                continue  # No next day data for entry
            
            entry_idx = sig_idx + 1
            entry_date = sub_dates[entry_idx]
            entry_price = sub_opens[entry_idx]
            if pd.isna(entry_price) or entry_price <= 0:
                entry_price = sig["CLOSE"]
            
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
                
                # Check stop loss first (risk-first execution model)
                if curr_low <= stop_price:
                    exit_price = stop_price
                    exit_date = curr_date
                    exit_reason = "STOP_LOSS"
                    break
                # Check target hit
                elif curr_high >= target_price:
                    exit_price = target_price
                    exit_date = curr_date
                    exit_reason = "TARGET_HIT"
                    break
                # If last holding day reached, exit at Close
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
                    "day_ret": round(sig["DAY_RET_PCT"], 2),
                })
                
    return trades

def compute_metrics(trades, strategy_name):
    if not trades:
        return {
            "Strategy": strategy_name,
            "Total Trades": 0,
            "Win Rate %": 0.0,
            "Avg Return %": 0.0,
            "Profit Factor": 0.0,
            "Target Hit %": 0.0,
            "Stop Hit %": 0.0,
            "Time Exit %": 0.0,
            "Max Win %": 0.0,
            "Max Loss %": 0.0,
            "Avg Hold Days": 0.0,
        }
        
    df_t = pd.DataFrame(trades)
    total_trades = len(df_t)
    wins = df_t[df_t["ret_pct"] > 0]
    losses = df_t[df_t["ret_pct"] < 0]
    win_rate = (len(wins) / total_trades) * 100.0
    
    avg_ret = df_t["ret_pct"].mean()
    gross_profit = wins["ret_pct"].sum() if len(wins) > 0 else 0.0
    gross_loss = abs(losses["ret_pct"].sum()) if len(losses) > 0 else 0.0001
    profit_factor = gross_profit / gross_loss
    
    target_hits = (df_t["exit_reason"] == "TARGET_HIT").sum() / total_trades * 100.0
    stop_hits = (df_t["exit_reason"] == "STOP_LOSS").sum() / total_trades * 100.0
    time_exits = (df_t["exit_reason"] == "TIME_EXIT").sum() / total_trades * 100.0
    
    return {
        "Strategy": strategy_name,
        "Total Trades": total_trades,
        "Win Rate %": round(win_rate, 1),
        "Avg Return %": round(avg_ret, 2),
        "Profit Factor": round(profit_factor, 2),
        "Target Hit %": round(target_hits, 1),
        "Stop Hit %": round(stop_hits, 1),
        "Time Exit %": round(time_exits, 1),
        "Max Win %": round(df_t["ret_pct"].max(), 2),
        "Max Loss %": round(df_t["ret_pct"].min(), 2),
        "Avg Hold Days": round(df_t["holding_days"].mean(), 1),
        "trades_df": df_t
    }

def run_all_strategies():
    all_df, comp_names = load_all_data()
    all_df = precompute_indicators(all_df)
    
    # Base universe filter: Liquid stocks, price >= 50, turnover >= 1 Cr
    base_filter = (all_df["TURNOVER_CR"] >= 1.0) & (all_df["CLOSE"] >= 50.0)
    
    results = []
    
    # -------------------------------------------------------------
    # STRATEGY 1: Pure Delivery Spike (No Price Trend Filter - Benchmark)
    # -------------------------------------------------------------
    mask1 = base_filter & (all_df["DELIV_PER"] >= 50.0) & (all_df["DELIV_SPIKE_10X"] >= 2.0)
    t1 = simulate_swing_trades(all_df, mask1, target_pct=8.0, stop_loss_pct=4.0, max_holding_days=10)
    results.append(compute_metrics(t1, "S1: Baseline Delivery (Deliv>=50%, Spike>=2x)"))

    # -------------------------------------------------------------
    # STRATEGY 2: High Delivery + Trend Alignment (Close > 20 SMA & Day Gain >= 1.5%)
    # Institutional accumulation during bullish markup
    # -------------------------------------------------------------
    mask2 = base_filter & (all_df["DELIV_PER"] >= 55.0) & (all_df["DELIV_SPIKE_10X"] >= 2.0) & \
            (all_df["DAY_RET_PCT"] >= 1.5) & (all_df["CLOSE"] > all_df["SMA_20"])
    t2 = simulate_swing_trades(all_df, mask2, target_pct=8.0, stop_loss_pct=4.0, max_holding_days=10)
    results.append(compute_metrics(t2, "S2: Momentum Markup (Deliv>=55%, Spike>=2x, +1.5%, >20SMA)"))

    # -------------------------------------------------------------
    # STRATEGY 3: Elite High Delivery Explosion (Deliv >= 65%, Spike >= 3.0x, >20SMA)
    # Massive conviction block buying
    # -------------------------------------------------------------
    mask3 = base_filter & (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 3.0) & \
            (all_df["DAY_RET_PCT"] >= 1.0) & (all_df["CLOSE"] > all_df["SMA_20"])
    t3 = simulate_swing_trades(all_df, mask3, target_pct=8.0, stop_loss_pct=4.0, max_holding_days=10)
    results.append(compute_metrics(t3, "S3: Elite Absorption (Deliv>=65%, Spike>=3x, >20SMA)"))

    # -------------------------------------------------------------
    # STRATEGY 4: The 10% Target / 4% Stop Swing (Higher Asymmetric RR 2.5:1)
    # Uses S2 signal with wider target for runners
    # -------------------------------------------------------------
    t4 = simulate_swing_trades(all_df, mask2, target_pct=10.0, stop_loss_pct=4.0, max_holding_days=12)
    results.append(compute_metrics(t4, "S4: Asymmetric 2.5:1 (S2 Entry with 10% Target / 4% SL)"))

    # -------------------------------------------------------------
    # STRATEGY 5: Institutional Range Compression & EOD Surge (Close Loc >= 0.70)
    # Closes near high with heavy delivery volume
    # -------------------------------------------------------------
    mask5 = base_filter & (all_df["DELIV_PER"] >= 60.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
            (all_df["CLOSE_LOC"] >= 0.75) & (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["DAY_RET_PCT"] >= 1.0)
    t5 = simulate_swing_trades(all_df, mask5, target_pct=8.0, stop_loss_pct=3.5, max_holding_days=10)
    results.append(compute_metrics(t5, "S5: Bullish Close Climax (CloseLoc>=75%, Deliv>=60%, Spike>=2.5x)"))

    # -------------------------------------------------------------
    # STRATEGY 6: Fast Quick-Strike Swing (6% Target / 3% SL, 5-Day Hold)
    # Quick swing capture of the post-delivery momentum impulse
    # -------------------------------------------------------------
    t6 = simulate_swing_trades(all_df, mask2, target_pct=6.0, stop_loss_pct=3.0, max_holding_days=6)
    results.append(compute_metrics(t6, "S6: Fast Quick-Strike (6% Target / 3% SL, 6-Day Hold)"))

    # -------------------------------------------------------------
    # STRATEGY 7: Extreme Volume Multiplier Spike (Deliv Spike >= 5.0x, Deliv >= 50%)
    # Pure block accumulation anomaly
    # -------------------------------------------------------------
    mask7 = base_filter & (all_df["DELIV_PER"] >= 50.0) & (all_df["DELIV_SPIKE_10X"] >= 5.0) & \
            (all_df["DAY_RET_PCT"] >= 0.5) & (all_df["CLOSE"] > all_df["SMA_20"])
    t7 = simulate_swing_trades(all_df, mask7, target_pct=8.0, stop_loss_pct=4.0, max_holding_days=10)
    results.append(compute_metrics(t7, "S7: Extreme 5x Surge Anomaly (Deliv Spike >= 5x, >20SMA)"))

    # Print summary table
    summary_cols = ["Strategy", "Total Trades", "Win Rate %", "Avg Return %", "Profit Factor", "Target Hit %", "Stop Hit %", "Time Exit %", "Avg Hold Days"]
    summary_df = pd.DataFrame([{k: v for k, v in r.items() if k != "trades_df"} for r in results])
    
    print("\n" + "="*110)
    print(">>> ALPHA INDIA SWING STRATEGY BACKTEST RESULTS (185 SESSIONS - NSE LISTED EQUITIES) <<<")
    print("="*110)
    print(summary_df[summary_cols].to_string(index=False))
    
    # Save best trades
    best_strat = max(results, key=lambda x: x["Profit Factor"])
    print("\n" + "="*80)
    print(f">>> BEST PERFORMING STRATEGY: {best_strat['Strategy']} (Profit Factor: {best_strat['Profit Factor']}) <<<")
    print("="*80)
    
    best_df = best_strat["trades_df"]
    best_df["company_name"] = best_df["symbol"].map(comp_names).fillna(best_df["symbol"])
    best_df.to_csv("data/analysis/backtest_best_strategy_trades.csv", index=False)
    summary_df.to_csv("data/analysis/backtest_strategies_summary.csv", index=False)
    
    print("\nTop 15 Big Winning Trades from the Best Strategy:")
    top_winners = best_df.sort_values(by="ret_pct", ascending=False).head(15)
    winner_cols = ["symbol", "company_name", "signal_date", "entry_date", "exit_date", "entry_price", "exit_price", "ret_pct", "deliv_per", "deliv_spike_x", "holding_days"]
    print(top_winners[winner_cols].to_string(index=False))
    
    print("\nRecent 15 Trades from the Best Strategy:")
    recent_trades = best_df.sort_values(by="signal_date", ascending=False).head(15)
    print(recent_trades[winner_cols].to_string(index=False))

if __name__ == "__main__":
    run_all_strategies()
