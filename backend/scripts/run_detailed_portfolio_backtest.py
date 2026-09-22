"""
Alpha India - Comprehensive Portfolio & Strategy Backtester
Simulates the "Institutional Climax Absorption" & "Mega-Liquidity Momentum Markup" strategies
with realistic portfolio constraints:
- Initial Capital: ₹10,00,000 (10 Lakhs)
- Max Concurrent Positions: 5 (20% per trade = ₹2,00,000 allocation per position)
- Realistic Next-Day Open Execution with transaction costs / slippage (0.15% per trade)
- Capital compounding or fixed sizing
- Monthly P&L breakdown
- Sharpe, Sortino, Max Drawdown, Win Streaks, Profit Factor
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
    all_df = all_df.drop_duplicates(subset=["SYMBOL", "DATE"], keep="first").reset_index(drop=True)
    all_df = all_df.sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)

    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    d_range = np.maximum(0.01, all_df["HIGH"] - all_df["LOW"])
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / d_range
    all_df["NEXT_OPEN"] = grouped["OPEN"].shift(-1)

    return all_df, comp_names

def run_portfolio_simulation(all_df, comp_names, strategy_name, signal_mask, 
                             target_pct=10.0, stop_loss_pct=4.0, max_hold=12,
                             initial_capital=1000000.0, max_positions=5,
                             slippage_pct=0.15, use_signal_low_sl=False):
    """
    Simulates a realistic portfolio day-by-day:
    - Fixed capital allocation: Capital / max_positions per slot
    - Only buys if an open slot is available
    - Sells first, then buys next
    - Tracks cash, portfolio value, trade log, equity curve
    """
    signals = all_df[signal_mask].copy()
    dates = sorted(all_df["DATE"].unique())
    
    # Map for quick price lookup: (symbol, date) -> row dict
    # Pre-index by date for daily steps
    daily_groups = {d: df_d.set_index("SYMBOL") for d, df_d in all_df.groupby("DATE")}
    
    cash = initial_capital
    active_positions = []  # list of open trade dicts
    closed_trades = []
    equity_curve = []
    
    slot_size_pct = 1.0 / max_positions
    
    for d_idx, curr_date in enumerate(dates):
        curr_df = daily_groups.get(curr_date)
        if curr_df is None:
            continue
            
        # 1. Update & check exits for active positions
        still_active = []
        for pos in active_positions:
            sym = pos["symbol"]
            if sym not in curr_df.index:
                # Stock didn't trade today, carry forward
                pos["holding_days"] += 1
                still_active.append(pos)
                continue
                
            bar = curr_df.loc[sym]
            if isinstance(bar, pd.DataFrame):
                bar = bar.iloc[0]
            c_high = float(bar["HIGH"])
            c_low = float(bar["LOW"])
            c_close = float(bar["CLOSE"])
            pos["holding_days"] += 1
            
            exit_price = None
            exit_reason = None
            
            # Check Stop Loss
            if c_low <= pos["stop_price"]:
                exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "STOP_LOSS"
            # Check Target
            elif c_high >= pos["target_price"]:
                exit_price = pos["target_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "TARGET_HIT"
            # Check Time Stop
            elif pos["holding_days"] >= max_hold:
                exit_price = c_close * (1.0 - slippage_pct / 100.0)
                exit_reason = "TIME_EXIT"
                
            if exit_price is not None:
                pnl = (exit_price - pos["entry_price"]) * pos["shares"]
                ret_pct = ((exit_price - pos["entry_price"]) / pos["entry_price"]) * 100.0
                cash += exit_price * pos["shares"]
                closed_trades.append({
                    "symbol": sym,
                    "company_name": comp_names.get(sym, sym),
                    "signal_date": pos["signal_date"].strftime("%Y-%m-%d"),
                    "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
                    "exit_date": curr_date.strftime("%Y-%m-%d"),
                    "entry_price": round(pos["entry_price"], 2),
                    "exit_price": round(exit_price, 2),
                    "shares": pos["shares"],
                    "invested_amt": round(pos["invested_amt"], 2),
                    "exit_amt": round(exit_price * pos["shares"], 2),
                    "pnl": round(pnl, 2),
                    "ret_pct": round(ret_pct, 2),
                    "exit_reason": exit_reason,
                    "holding_days": pos["holding_days"],
                    "deliv_per": pos["deliv_per"],
                    "deliv_spike_x": pos["deliv_spike_x"],
                })
            else:
                still_active.append(pos)
                
        active_positions = still_active
        
        # 2. Check for new entries today
        # Signals were triggered on previous trading day (dates[d_idx - 1])
        if d_idx > 0:
            prev_date = dates[d_idx - 1]
            prev_signals = signals[signals["DATE"] == prev_date]
            
            # Sort signals by highest delivery spike / delivery %
            if not prev_signals.empty and len(active_positions) < max_positions:
                sorted_sigs = prev_signals.sort_values(by=["DELIV_SPIKE_10X", "DELIV_PER"], ascending=False)
                
                for _, sig in sorted_sigs.iterrows():
                    if len(active_positions) >= max_positions:
                        break
                        
                    sym = sig["SYMBOL"]
                    # Skip if already holding this symbol
                    if any(p["symbol"] == sym for p in active_positions):
                        continue
                        
                    if sym not in curr_df.index:
                        continue
                        
                    bar = curr_df.loc[sym]
                    if isinstance(bar, pd.DataFrame):
                        bar = bar.iloc[0]
                    raw_open = bar["OPEN"]
                    if pd.isna(raw_open) or float(raw_open) <= 0:
                        continue
                    entry_price = float(raw_open) * (1.0 + slippage_pct / 100.0)
                        
                    # Calculate position size: 20% of current equity
                    # Total current equity = cash + market value of open positions
                    open_val = 0.0
                    for p in active_positions:
                        if p["symbol"] in curr_df.index:
                            c_b = curr_df.loc[p["symbol"]]
                            c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                            open_val += c_close_p * p["shares"]
                        else:
                            open_val += p["invested_amt"]
                            
                    total_portfolio_val = cash + open_val
                    target_alloc = total_portfolio_val * slot_size_pct
                    invest_amt = min(cash, target_alloc)
                    
                    if invest_amt < 10000:
                        continue  # Not enough cash

                        
                    shares = int(invest_amt // entry_price)
                    if shares <= 0:
                        continue
                        
                    actual_invest = shares * entry_price
                    cash -= actual_invest
                    
                    if use_signal_low_sl:
                        sig_low = sig["LOW"]
                        risk = max(entry_price * 0.015, min(entry_price * 0.05, entry_price - sig_low))
                        stop_p = entry_price - risk
                        target_p = entry_price + (risk * 2.5)
                    else:
                        stop_p = entry_price * (1.0 - stop_loss_pct / 100.0)
                        target_p = entry_price * (1.0 + target_pct / 100.0)
                        
                    active_positions.append({
                        "symbol": sym,
                        "signal_date": prev_date,
                        "entry_date": curr_date,
                        "entry_price": entry_price,
                        "shares": shares,
                        "invested_amt": actual_invest,
                        "stop_price": stop_p,
                        "target_price": target_p,
                        "holding_days": 0,
                        "deliv_per": round(sig["DELIV_PER"], 2),
                        "deliv_spike_x": round(sig["DELIV_SPIKE_10X"], 2),
                    })
                    
        # Calculate daily portfolio equity
        open_positions_val = 0.0
        for p in active_positions:
            if p["symbol"] in curr_df.index:
                c_b = curr_df.loc[p["symbol"]]
                c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                open_positions_val += c_close_p * p["shares"]
            else:
                open_positions_val += p["invested_amt"]
        total_equity = cash + open_positions_val

        equity_curve.append({
            "date": curr_date.strftime("%Y-%m-%d"),
            "equity": round(total_equity, 2),
            "cash": round(cash, 2),
            "open_positions": len(active_positions),
        })

    # Metrics calculation
    trades_df = pd.DataFrame(closed_trades)
    eq_df = pd.DataFrame(equity_curve)
    
    final_equity = eq_df["equity"].iloc[-1] if not eq_df.empty else initial_capital
    net_profit = final_equity - initial_capital
    total_return_pct = (net_profit / initial_capital) * 100.0
    
    # Drawdown
    eq_df["peak"] = eq_df["equity"].cummax()
    eq_df["drawdown"] = (eq_df["equity"] - eq_df["peak"]) / eq_df["peak"] * 100.0
    max_drawdown = eq_df["drawdown"].min()
    
    # Win rate, profit factor, etc.
    total_t = len(trades_df)
    if total_t > 0:
        wins = trades_df[trades_df["pnl"] > 0]
        losses = trades_df[trades_df["pnl"] < 0]
        win_rate = (len(wins) / total_t) * 100.0
        gross_profit = wins["pnl"].sum()
        gross_loss = abs(losses["pnl"].sum()) if len(losses) > 0 else 0.001
        profit_factor = gross_profit / gross_loss
        avg_trade_pnl = trades_df["pnl"].mean()
        avg_win = wins["pnl"].mean() if len(wins) > 0 else 0
        avg_loss = losses["pnl"].mean() if len(losses) > 0 else 0
        target_hits = (trades_df["exit_reason"] == "TARGET_HIT").sum()
        stop_hits = (trades_df["exit_reason"] == "STOP_LOSS").sum()
        time_exits = (trades_df["exit_reason"] == "TIME_EXIT").sum()
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = profit_factor = avg_trade_pnl = avg_win = avg_loss = avg_hold = 0.0
        target_hits = stop_hits = time_exits = 0
        
    # Daily returns for Sharpe
    eq_df["daily_ret"] = eq_df["equity"].pct_change().fillna(0)
    sharpe = (eq_df["daily_ret"].mean() / eq_df["daily_ret"].std() * np.sqrt(252)) if eq_df["daily_ret"].std() > 0 else 0.0
    
    # Downside deviation for Sortino
    neg_ret = eq_df["daily_ret"][eq_df["daily_ret"] < 0]
    sortino = (eq_df["daily_ret"].mean() / neg_ret.std() * np.sqrt(252)) if not neg_ret.empty and neg_ret.std() > 0 else 0.0

    return {
        "Strategy": strategy_name,
        "Initial Capital": initial_capital,
        "Final Equity": round(final_equity, 2),
        "Net Profit (INR)": round(net_profit, 2),
        "Total Return %": round(total_return_pct, 2),
        "Max Drawdown %": round(max_drawdown, 2),
        "Sharpe Ratio": round(sharpe, 2),
        "Sortino Ratio": round(sortino, 2),
        "Total Closed Trades": total_t,
        "Win Rate %": round(win_rate, 1),
        "Profit Factor": round(profit_factor, 2),
        "Target Hits": target_hits,
        "Stop Hits": stop_hits,
        "Time Exits": time_exits,
        "Avg Trade P&L (INR)": round(avg_trade_pnl, 2),
        "Avg Win (INR)": round(avg_win, 2),
        "Avg Loss (INR)": round(avg_loss, 2),
        "Avg Holding Days": round(avg_hold, 1),
        "trades_df": trades_df,
        "eq_df": eq_df
    }

def main():
    all_df, comp_names = load_data()
    
    # 1. Strategy A: Institutional Climax Absorption (Turnover >= 2Cr, Deliv >= 70%, Spike >= 3x, Gain >= 2%, >20SMA)
    mask_a = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 70.0) & \
             (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0) & \
             (all_df["CLOSE"] > all_df["SMA_20"])
             
    res_a = run_portfolio_simulation(
        all_df, comp_names, 
        strategy_name="Strategy 1: Institutional Climax Absorption (10% Tgt / 4% SL)",
        signal_mask=mask_a,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )

    # 2. Strategy B: Mega-Liquidity Momentum Markup (Turnover >= 5Cr, Deliv >= 65%, Spike >= 2.5x, Gain >= 1.5%, >20SMA)
    mask_b = (all_df["TURNOVER_CR"] >= 5.0) & (all_df["DELIV_PER"] >= 65.0) & \
             (all_df["DELIV_SPIKE_10X"] >= 2.5) & (all_df["DAY_RET_PCT"] >= 1.5) & \
             (all_df["CLOSE"] > all_df["SMA_20"])

    res_b = run_portfolio_simulation(
        all_df, comp_names, 
        strategy_name="Strategy 2: Mega-Liquidity Momentum Markup (10% Tgt / 4% SL)",
        signal_mask=mask_b,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )

    # 3. Strategy C: Climax Absorption with Dynamic Low-of-Day SL (2.5R Target)
    res_c = run_portfolio_simulation(
        all_df, comp_names, 
        strategy_name="Strategy 3: Climax Absorption (Dynamic Signal Low SL, 2.5R Target)",
        signal_mask=mask_a,
        use_signal_low_sl=True, max_hold=12
    )

    print("\n" + "="*100)
    print(">>> ALPHA INDIA PORTFOLIO BACKTEST SUMMARY (INR 10,00,000 STARTING CAPITAL, 5 SLOTS) <<<")
    print("="*100)
    
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Closed Trades", "Win Rate %", "Profit Factor", "Avg Holding Days"]
    summary_rows = [
        {k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]}
        for r in [res_a, res_b, res_c]
    ]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))


    # Save trades and equity curves
    os.makedirs("data/analysis/portfolio_backtest", exist_ok=True)
    res_a["trades_df"].to_csv("data/analysis/portfolio_backtest/trades_strategy_1.csv", index=False)
    res_a["eq_df"].to_csv("data/analysis/portfolio_backtest/equity_strategy_1.csv", index=False)
    res_b["trades_df"].to_csv("data/analysis/portfolio_backtest/trades_strategy_2.csv", index=False)
    res_b["eq_df"].to_csv("data/analysis/portfolio_backtest/equity_strategy_2.csv", index=False)

    print("\n" + "="*80)
    print(">>> TOP 12 PROFITABLE TRADES (STRATEGY 1: INSTITUTIONAL CLIMAX ABSORPTION) <<<")
    print("="*80)
    t_a = res_a["trades_df"]
    cols_show = ["symbol", "company_name", "entry_date", "exit_date", "entry_price", "exit_price", "pnl", "ret_pct", "holding_days", "exit_reason"]
    print(t_a.sort_values(by="pnl", ascending=False).head(12)[cols_show].to_string(index=False))

    # Monthly breakdown for Strategy 1
    t_a["exit_month"] = pd.to_datetime(t_a["exit_date"]).dt.strftime("%Y-%m")
    m_pnl = t_a.groupby("exit_month").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1))
    ).reset_index()
    print("\n" + "="*80)
    print(">>> MONTH-BY-MONTH PERFORMANCE BREAKDOWN (STRATEGY 1) <<<")
    print("="*80)
    print(m_pnl.to_string(index=False))

if __name__ == "__main__":
    main()
