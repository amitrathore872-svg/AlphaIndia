"""
Alpha India - Strategy Optimization & Improvement Engine
Implements 4 major enhancements to the Delivery Swing Strategy:
1. Enhancement 1: Breakeven Profit Locker (Move SL to +0.5% Breakeven once +4.5% gain is reached)
2. Enhancement 2: Market Regime Filter (Only buy when NIFTY 50 > 50 SMA / 20 EMA)
3. Enhancement 3: Stage 2 Structural Alignment (20 SMA > 50 SMA & Close > 20 SMA)
4. Enhancement 4: Volume Contraction Pre-Condition (Volume Dry-up before delivery surge)
5. Combined V2 Pro Strategy
"""

import glob
import os
import time
import pandas as pd
import numpy as np
import yfinance as yf

def load_data_with_market():
    print("Loading NSE delivery data and NIFTY benchmark...")
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

    # Precompute indicators
    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0

    # Fetch Nifty 50 and compute trend
    nifty = yf.Ticker("^NSEI").history(period="1y")
    nifty["DATE"] = pd.to_datetime(nifty.index.date)
    nifty["NIFTY_SMA_50"] = nifty["Close"].rolling(50).mean()
    nifty["NIFTY_EMA_20"] = nifty["Close"].ewm(span=20).mean()
    nifty["NIFTY_BULLISH"] = nifty["Close"] >= nifty["NIFTY_SMA_50"]
    nifty_map = dict(zip(nifty["DATE"], nifty["NIFTY_BULLISH"]))

    # Also compute Market Breadth across our stock universe: % of stocks above 20 SMA
    breadth = all_df.groupby("DATE").apply(lambda df_d: (df_d["CLOSE"] > df_d["SMA_20"]).sum() / max(1, len(df_d)) * 100.0).to_dict()

    all_df["NIFTY_BULLISH"] = all_df["DATE"].map(nifty_map).fillna(True)
    all_df["MARKET_BREADTH"] = all_df["DATE"].map(breadth).fillna(50.0)

    return all_df, comp_names

def run_improved_simulation(all_df, comp_names, strategy_name, signal_mask,
                            target_pct=10.0, stop_loss_pct=4.0, max_hold=12,
                            initial_capital=1000000.0, max_positions=5,
                            slippage_pct=0.15, 
                            use_breakeven_lock=False, breakeven_trigger_pct=4.5,
                            market_filter=None):
    """
    Simulates portfolio with advanced features:
    - Breakeven Profit Locker (Moves SL to +0.5% once +4.5% is achieved)
    - Market Filter (Skip buys if Nifty is below 50 SMA or breadth < 40%)
    """
    signals = all_df[signal_mask].copy()
    dates = sorted(all_df["DATE"].unique())
    daily_groups = {d: df_d.set_index("SYMBOL") for d, df_d in all_df.groupby("DATE")}

    cash = initial_capital
    active_positions = []
    closed_trades = []
    equity_curve = []
    slot_size_pct = 1.0 / max_positions

    for d_idx, curr_date in enumerate(dates):
        curr_df = daily_groups.get(curr_date)
        if curr_df is None:
            continue

        # 1. Update & exit active positions
        still_active = []
        for pos in active_positions:
            sym = pos["symbol"]
            if sym not in curr_df.index:
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

            # Breakeven Profit Lock update
            if use_breakeven_lock and not pos.get("is_breakeven_locked", False):
                gain_from_entry = ((c_high - pos["entry_price"]) / pos["entry_price"]) * 100.0
                if gain_from_entry >= breakeven_trigger_pct:
                    # Move stop loss to +0.5% (protects capital and covers all brokerage & slippage)
                    pos["stop_price"] = max(pos["stop_price"], pos["entry_price"] * 1.005)
                    pos["is_breakeven_locked"] = True

            exit_price = None
            exit_reason = None

            # Check Stop Loss first
            if c_low <= pos["stop_price"]:
                exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "BREAKEVEN_STOP" if pos.get("is_breakeven_locked", False) else "STOP_LOSS"
            # Check Target
            elif c_high >= pos["target_price"]:
                exit_price = pos["target_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "TARGET_HIT"
            # Check Time Exit
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
        if d_idx > 0:
            prev_date = dates[d_idx - 1]
            prev_signals = signals[signals["DATE"] == prev_date]

            # Market Regime Filter check on entry day
            allow_buys = True
            if market_filter == "nifty_50sma":
                nifty_bull = curr_df["NIFTY_BULLISH"].iloc[0] if "NIFTY_BULLISH" in curr_df.columns else True
                if not nifty_bull:
                    allow_buys = False
            elif market_filter == "breadth_40":
                m_breadth = curr_df["MARKET_BREADTH"].iloc[0] if "MARKET_BREADTH" in curr_df.columns else 50.0
                if m_breadth < 40.0:
                    allow_buys = False

            if allow_buys and not prev_signals.empty and len(active_positions) < max_positions:
                sorted_sigs = prev_signals.sort_values(by=["DELIV_SPIKE_10X", "DELIV_PER"], ascending=False)
                for _, sig in sorted_sigs.iterrows():
                    if len(active_positions) >= max_positions:
                        break

                    sym = sig["SYMBOL"]
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
                        continue

                    shares = int(invest_amt // entry_price)
                    if shares <= 0:
                        continue

                    actual_invest = shares * entry_price
                    cash -= actual_invest

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
                        "is_breakeven_locked": False,
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

    trades_df = pd.DataFrame(closed_trades)
    eq_df = pd.DataFrame(equity_curve)

    final_equity = eq_df["equity"].iloc[-1] if not eq_df.empty else initial_capital
    net_profit = final_equity - initial_capital
    total_return_pct = (net_profit / initial_capital) * 100.0

    eq_df["peak"] = eq_df["equity"].cummax()
    eq_df["drawdown"] = (eq_df["equity"] - eq_df["peak"]) / eq_df["peak"] * 100.0
    max_drawdown = eq_df["drawdown"].min()

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
        be_stops = (trades_df["exit_reason"] == "BREAKEVEN_STOP").sum()
        time_exits = (trades_df["exit_reason"] == "TIME_EXIT").sum()
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = profit_factor = avg_trade_pnl = avg_win = avg_loss = avg_hold = 0.0
        target_hits = stop_hits = be_stops = time_exits = 0

    eq_df["daily_ret"] = eq_df["equity"].pct_change().fillna(0)
    sharpe = (eq_df["daily_ret"].mean() / eq_df["daily_ret"].std() * np.sqrt(252)) if eq_df["daily_ret"].std() > 0 else 0.0
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
        "Breakeven Hits": be_stops,
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
    all_df, comp_names = load_data_with_market()

    base_mask = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 70.0) & \
                (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0) & \
                (all_df["CLOSE"] > all_df["SMA_20"])

    # 1. Baseline Strategy 1 (From earlier)
    r0 = run_improved_simulation(
        all_df, comp_names,
        strategy_name="Baseline: Strategy 1 (No Enhancements)",
        signal_mask=base_mask,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )

    # 2. Enhancement 1: Breakeven Profit Locker (Lock BE at +4.5% gain)
    r1 = run_improved_simulation(
        all_df, comp_names,
        strategy_name="V2.1: + Breakeven Profit Locker (Lock at +4.5%)",
        signal_mask=base_mask,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12,
        use_breakeven_lock=True, breakeven_trigger_pct=4.5
    )

    # 3. Enhancement 2: Market Regime Filter (NIFTY > 50 SMA)
    r2 = run_improved_simulation(
        all_df, comp_names,
        strategy_name="V2.2: + Market Regime Filter (NIFTY >= 50 SMA)",
        signal_mask=base_mask,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12,
        market_filter="nifty_50sma"
    )

    # 4. Enhancement 3: Stage 2 Structural Uptrend (20 SMA > 50 SMA)
    mask_stage2 = base_mask & (all_df["SMA_20"] > all_df["SMA_50"])
    r3 = run_improved_simulation(
        all_df, comp_names,
        strategy_name="V2.3: + Stage 2 Uptrend (20 SMA > 50 SMA)",
        signal_mask=mask_stage2,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )

    # 5. Enhancement 4: Volume Dry-Up Pre-Condition (5D/20D Vol <= 1.25)
    mask_dryup = base_mask & (all_df["VOL_DRYUP_RATIO"] <= 1.25)
    r4 = run_improved_simulation(
        all_df, comp_names,
        strategy_name="V2.4: + Pre-Spike Volume Dry-Up Consolidation",
        signal_mask=mask_dryup,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )

    # 6. MASTER COMBO: Institutional Alpha V2 Pro
    # (Stage 2 + Market Filter + Breakeven Locker + ₹5 Cr Turnover)
    master_mask = (all_df["TURNOVER_CR"] >= 3.5) & (all_df["DELIV_PER"] >= 68.0) & \
                  (all_df["DELIV_SPIKE_10X"] >= 2.8) & (all_df["DAY_RET_PCT"] >= 1.8) & \
                  (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["SMA_20"] > all_df["SMA_50"])
                  
    r_master = run_improved_simulation(
        all_df, comp_names,
        strategy_name="ALPHA V2 PRO: Master Institutional System",
        signal_mask=master_mask,
        target_pct=10.0, stop_loss_pct=3.8, max_hold=12,
        use_breakeven_lock=True, breakeven_trigger_pct=4.0,
        market_filter="nifty_50sma"
    )

    all_res = [r0, r1, r2, r3, r4, r_master]

    print("\n" + "="*110)
    print(">>> STRATEGY EVOLUTION COMPARISON: BASELINE vs ENHANCED VARIANTS <<<")
    print("="*110)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Closed Trades", "Win Rate %", "Profit Factor"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in all_res]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    # Save master trades and equity curve
    os.makedirs("data/analysis/improved_strategy", exist_ok=True)
    r_master["trades_df"].to_csv("data/analysis/improved_strategy/master_trades.csv", index=False)
    r_master["eq_df"].to_csv("data/analysis/improved_strategy/master_equity.csv", index=False)

    print("\n" + "="*90)
    print(">>> MASTER V2 PRO MONTHLY BREAKDOWN <<<")
    print("="*90)
    t_m = r_master["trades_df"]
    t_m["exit_month"] = pd.to_datetime(t_m["exit_date"]).dt.strftime("%Y-%m")
    m_pnl = t_m.groupby("exit_month").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
        Target_Hits=("exit_reason", lambda x: (x == "TARGET_HIT").sum()),
        BE_Stops=("exit_reason", lambda x: (x == "BREAKEVEN_STOP").sum()),
        Full_Stops=("exit_reason", lambda x: (x == "STOP_LOSS").sum()),
    ).reset_index()
    print(m_pnl.to_string(index=False))

    print("\n" + "="*90)
    print(">>> MASTER V2 PRO RECENT TRADES <<<")
    print("="*90)
    cols_show = ["symbol", "company_name", "entry_date", "exit_date", "entry_price", "exit_price", "pnl", "ret_pct", "holding_days", "exit_reason"]
    print(t_m.sort_values(by="entry_date", ascending=False).head(12)[cols_show].to_string(index=False))

if __name__ == "__main__":
    main()
