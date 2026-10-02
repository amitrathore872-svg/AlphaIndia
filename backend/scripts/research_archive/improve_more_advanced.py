"""
Alpha India - Advanced Quant Strategy Enhancer (V4 System)
Tests institutional hedge-fund level enhancements:
1. Scale-Out Execution (50% at +8%, 50% trailing / +16% runner)
2. Dynamic Market Regime Hedging (0-2 positions when NIFTY < 50 SMA, 5 positions when NIFTY > 50 SMA)
3. 20-Day Relative Strength (RS) Outperformance Filter vs NIFTY 50
4. Delivery Rupee Turnover Filter (Pure Institutional Smart Money >= 5 Cr Delivery)
5. Comprehensive Combined Master Engine
"""

import glob
import os
import time
import pandas as pd
import numpy as np
import yfinance as yf

def load_master_data():
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

    # Deliverable Turnover in Crores
    all_df["DELIV_TURNOVER_CR"] = all_df["TURNOVER_CR"] * (all_df["DELIV_PER"] / 100.0)

    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=25).mean())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    
    # 20-day stock performance for Relative Strength
    all_df["RET_20D"] = grouped["CLOSE"].transform(lambda x: (x - x.shift(20)) / x.shift(20) * 100.0)

    # Fetch NIFTY benchmark
    nifty = yf.Ticker("^NSEI").history(period="1y")
    nifty["DATE"] = pd.to_datetime(nifty.index.date)
    nifty["NIFTY_SMA_50"] = nifty["Close"].rolling(50).mean()
    nifty["NIFTY_SMA_20"] = nifty["Close"].rolling(20).mean()
    nifty["NIFTY_RET_20D"] = (nifty["Close"] - nifty["Close"].shift(20)) / nifty["Close"].shift(20) * 100.0
    
    nifty_map_50 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_SMA_50"]))
    nifty_map_20 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_SMA_20"]))
    nifty_ret_map = dict(zip(nifty["DATE"], nifty["NIFTY_RET_20D"]))

    all_df["NIFTY_ABOVE_50"] = all_df["DATE"].map(nifty_map_50).fillna(True)
    all_df["NIFTY_ABOVE_20"] = all_df["DATE"].map(nifty_map_20).fillna(True)
    all_df["NIFTY_RET_20D"] = all_df["DATE"].map(nifty_ret_map).fillna(0.0)
    
    # Outperforming Nifty over last 20 days
    all_df["RS_OUTPERFORM"] = all_df["RET_20D"] >= all_df["NIFTY_RET_20D"]

    return all_df, comp_names

def run_scaleout_simulation(all_df, comp_names, strategy_name, signal_mask,
                            target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15,
                            initial_capital=1000000.0, max_positions=5,
                            slippage_pct=0.15,
                            adaptive_market_sizing=False,
                            rs_filter=False):
    """
    Institutional Scale-Out Engine:
    - 50% Position exited at Target 1 (+8%)
    - Stop loss on remaining 50% moved to Entry + 0.5% (Free Ride)
    - Remaining 50% exits at Target 2 (+16%) or Trailing Stop / Time Exit
    """
    signals = all_df[signal_mask].copy()
    if rs_filter:
        signals = signals[signals["RS_OUTPERFORM"] == True]

    dates = sorted(all_df["DATE"].unique())
    daily_groups = {d: df_d.set_index("SYMBOL") for d, df_d in all_df.groupby("DATE")}

    cash = initial_capital
    active_positions = []
    closed_trades = []
    equity_curve = []

    for d_idx, curr_date in enumerate(dates):
        curr_df = daily_groups.get(curr_date)
        if curr_df is None:
            continue

        nifty_50_bull = curr_df["NIFTY_ABOVE_50"].iloc[0] if "NIFTY_ABOVE_50" in curr_df.columns else True
        nifty_20_bull = curr_df["NIFTY_ABOVE_20"].iloc[0] if "NIFTY_ABOVE_20" in curr_df.columns else True

        # Adaptive Market Sizing: In bear regimes, reduce active slots to 2 to protect capital
        current_max_slots = max_positions
        if adaptive_market_sizing:
            if not nifty_50_bull:
                current_max_slots = 1
            elif not nifty_20_bull:
                current_max_slots = 3

        slot_size_pct = 1.0 / max(1, current_max_slots)

        # 1. Update active positions
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

            # Phase 1: Check Target 1 for the first half
            if not pos["t1_hit"]:
                if c_high >= pos["target1_price"]:
                    # Exit 50% at Target 1
                    exit_p1 = pos["target1_price"] * (1.0 - slippage_pct / 100.0)
                    half_shares = pos["shares"] // 2
                    pnl_half = (exit_p1 - pos["entry_price"]) * half_shares
                    cash += exit_p1 * half_shares
                    
                    pos["t1_hit"] = True
                    pos["shares"] -= half_shares
                    pos["realized_pnl"] += pnl_half
                    # Move stop loss on the remaining half to Breakeven (+0.5%)
                    pos["stop_price"] = pos["entry_price"] * 1.005

            # Phase 2: Check exits for remaining position
            exit_price = None
            exit_reason = None

            if c_low <= pos["stop_price"]:
                exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "STOP_LOSS" if not pos["t1_hit"] else "RUNNER_BREAKEVEN"
            elif pos["t1_hit"] and c_high >= pos["target2_price"]:
                exit_price = pos["target2_price"] * (1.0 - slippage_pct / 100.0)
                exit_reason = "MEGA_RUNNER_TARGET"
            elif pos["holding_days"] >= max_hold:
                exit_price = c_close * (1.0 - slippage_pct / 100.0)
                exit_reason = "TIME_EXIT"

            if exit_price is not None:
                pnl_remaining = (exit_price - pos["entry_price"]) * pos["shares"]
                total_trade_pnl = pos["realized_pnl"] + pnl_remaining
                cash += exit_price * pos["shares"]
                total_ret_pct = (total_trade_pnl / pos["initial_invested"]) * 100.0

                closed_trades.append({
                    "symbol": sym,
                    "company_name": comp_names.get(sym, sym),
                    "signal_date": pos["signal_date"].strftime("%Y-%m-%d"),
                    "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
                    "exit_date": curr_date.strftime("%Y-%m-%d"),
                    "entry_price": round(pos["entry_price"], 2),
                    "final_exit_price": round(exit_price, 2),
                    "initial_invested": round(pos["initial_invested"], 2),
                    "total_pnl": round(total_trade_pnl, 2),
                    "ret_pct": round(total_ret_pct, 2),
                    "t1_hit": pos["t1_hit"],
                    "exit_reason": exit_reason,
                    "holding_days": pos["holding_days"],
                    "deliv_per": pos["deliv_per"],
                    "deliv_spike_x": pos["deliv_spike_x"],
                })
            else:
                still_active.append(pos)

        active_positions = still_active

        # 2. Check for new entries
        if d_idx > 0:
            prev_date = dates[d_idx - 1]
            prev_signals = signals[signals["DATE"] == prev_date]

            # In bear regime under adaptive sizing, stop taking new buys if slots full
            if not prev_signals.empty and len(active_positions) < current_max_slots:
                sorted_sigs = prev_signals.sort_values(by=["DELIV_SPIKE_10X", "DELIV_PER"], ascending=False)
                for _, sig in sorted_sigs.iterrows():
                    if len(active_positions) >= current_max_slots:
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

                    open_val = 0.0
                    for p in active_positions:
                        if p["symbol"] in curr_df.index:
                            c_b = curr_df.loc[p["symbol"]]
                            c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                            open_val += c_close_p * p["shares"]
                        else:
                            open_val += p["initial_invested"]

                    total_portfolio_val = cash + open_val
                    target_alloc = total_portfolio_val * slot_size_pct
                    invest_amt = min(cash, target_alloc)

                    if invest_amt < 10000:
                        continue

                    shares = int(invest_amt // entry_price)
                    if shares < 2:
                        continue

                    actual_invest = shares * entry_price
                    cash -= actual_invest

                    stop_p = entry_price * (1.0 - stop_loss_pct / 100.0)
                    t1_p = entry_price * (1.0 + target1_pct / 100.0)
                    t2_p = entry_price * (1.0 + target2_pct / 100.0)

                    active_positions.append({
                        "symbol": sym,
                        "signal_date": prev_date,
                        "entry_date": curr_date,
                        "entry_price": entry_price,
                        "shares": shares,
                        "initial_shares": shares,
                        "initial_invested": actual_invest,
                        "realized_pnl": 0.0,
                        "stop_price": stop_p,
                        "target1_price": t1_p,
                        "target2_price": t2_p,
                        "t1_hit": False,
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
                open_positions_val += p["initial_invested"]

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
        wins = trades_df[trades_df["total_pnl"] > 0]
        losses = trades_df[trades_df["total_pnl"] < 0]
        win_rate = (len(wins) / total_t) * 100.0
        gross_profit = wins["total_pnl"].sum()
        gross_loss = abs(losses["total_pnl"].sum()) if len(losses) > 0 else 0.001
        profit_factor = gross_profit / gross_loss
        avg_trade_pnl = trades_df["total_pnl"].mean()
        target2_hits = (trades_df["exit_reason"] == "MEGA_RUNNER_TARGET").sum()
        t1_partial_hits = trades_df["t1_hit"].sum()
        stop_hits = (trades_df["exit_reason"] == "STOP_LOSS").sum()
        runner_be = (trades_df["exit_reason"] == "RUNNER_BREAKEVEN").sum()
        time_exits = (trades_df["exit_reason"] == "TIME_EXIT").sum()
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = profit_factor = avg_trade_pnl = avg_hold = 0.0
        target2_hits = t1_partial_hits = stop_hits = runner_be = time_exits = 0

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
        "Total Trades": total_t,
        "Win Rate %": round(win_rate, 1),
        "Profit Factor": round(profit_factor, 2),
        "T1 Partials Hit": t1_partial_hits,
        "Mega Runners (+16%)": target2_hits,
        "Full Stops (-4%)": stop_hits,
        "Runner BE Exits": runner_be,
        "Time Exits": time_exits,
        "Avg Trade P&L (INR)": round(avg_trade_pnl, 2),
        "Avg Holding Days": round(avg_hold, 1),
        "trades_df": trades_df,
        "eq_df": eq_df
    }

def main():
    all_df, comp_names = load_master_data()

    # Core high-probability setup
    core_mask = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 70.0) & \
                (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0) & \
                (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["VOL_DRYUP_RATIO"] <= 1.25)

    # 1. Scale-Out Model: 50% at +8%, 50% at +16% (Free Ride)
    m1 = run_scaleout_simulation(
        all_df, comp_names,
        strategy_name="1. Scale-Out Model (50% @ +8%, 50% @ +16% Runner)",
        signal_mask=core_mask,
        target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15
    )

    # 2. Scale-Out + Adaptive Market Hedging (NIFTY filter slots)
    m2 = run_scaleout_simulation(
        all_df, comp_names,
        strategy_name="2. Scale-Out + Adaptive Market Hedging (NIFTY Filter)",
        signal_mask=core_mask,
        target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15,
        adaptive_market_sizing=True
    )

    # 3. Scale-Out + 20-Day Relative Strength Outperformance Filter
    m3 = run_scaleout_simulation(
        all_df, comp_names,
        strategy_name="3. Scale-Out + Relative Strength Filter (RS > NIFTY)",
        signal_mask=core_mask,
        target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15,
        rs_filter=True
    )

    # 4. Pure Mega-Institutional Delivery Turnover (Deliv Turnover >= 5 Cr)
    mask_mega = core_mask & (all_df["DELIV_TURNOVER_CR"] >= 5.0)
    m4 = run_scaleout_simulation(
        all_df, comp_names,
        strategy_name="4. Mega Institutional Delivery Turnover (Deliv Value >= 5 Cr)",
        signal_mask=mask_mega,
        target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15
    )

    # 5. THE APEX QUANT ENGINE (V4 APEX):
    # Scale-Out (50% @ +8.5%, 50% @ +16%) + RS Outperformance + Adaptive Hedging
    m5 = run_scaleout_simulation(
        all_df, comp_names,
        strategy_name="5. APEX QUANT V4 (Scale-Out + RS Outperformance + Adaptive Hedging)",
        signal_mask=core_mask,
        target1_pct=8.5, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15,
        adaptive_market_sizing=True,
        rs_filter=True
    )

    all_mods = [m1, m2, m3, m4, m5]

    print("\n" + "="*115)
    print(">>> INSTITUTIONAL ENHANCEMENT COMPARISON: SCALE-OUT & QUANT ENGINES (INR 10,00,000 CAPITAL) <<<")
    print("="*115)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Trades", "Win Rate %", "Profit Factor", "Mega Runners (+16%)"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in all_mods]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    os.makedirs("data/analysis/apex_v4", exist_ok=True)
    m5["trades_df"].to_csv("data/analysis/apex_v4/apex_trades.csv", index=False)
    m5["eq_df"].to_csv("data/analysis/apex_v4/apex_equity.csv", index=False)

    print("\n" + "="*90)
    print(">>> APEX V4 MONTHLY PERFORMANCE BREAKDOWN <<<")
    print("="*90)
    t5 = m5["trades_df"]
    t5["exit_month"] = pd.to_datetime(t5["exit_date"]).dt.strftime("%Y-%m")
    m_pnl = t5.groupby("exit_month").agg(
        Trades=("total_pnl", "count"),
        Net_Profit=("total_pnl", "sum"),
        Win_Rate=("total_pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
        Mega_Runners=("exit_reason", lambda x: (x == "MEGA_RUNNER_TARGET").sum()),
        Full_Stops=("exit_reason", lambda x: (x == "STOP_LOSS").sum()),
    ).reset_index()
    print(m_pnl.to_string(index=False))

    print("\n" + "="*90)
    print(">>> APEX V4 TOP 10 BIGGEST GAIN TRADES <<<")
    print("="*90)
    cols_s = ["symbol", "company_name", "entry_date", "exit_date", "entry_price", "final_exit_price", "total_pnl", "ret_pct", "holding_days", "exit_reason"]
    print(t5.sort_values(by="total_pnl", ascending=False).head(10)[cols_s].to_string(index=False))

if __name__ == "__main__":
    main()
