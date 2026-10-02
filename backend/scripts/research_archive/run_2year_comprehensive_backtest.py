"""
Alpha India - 2-Year Comprehensive Backtester (517 Trading Sessions)
Period: September 2024 - September 2026 (2 Full Years)
Dataset: 517 Official NSE Daily Delivery Bhavcopies (~1.2M+ records)
Starting Capital: INR 10,00,000 (10 Lakhs)
Max Concurrent Positions: 5 (20% allocation per slot)
Transaction Slippage: 0.15% per side
"""

import glob
import os
import time
import pandas as pd
import numpy as np

def load_2y_data():
    print("Loading 517 NSE delivery bhavcopies across 2 full years...")
    t0 = time.time()
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
    print(f"Loaded {len(all_df)} records across {all_df['SYMBOL'].nunique()} equities in {time.time() - t0:.2f}s.")

    # Compute technical and delivery metrics
    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.rolling(50, min_periods=25).mean())
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0

    # RSI (14)
    def calc_rsi(series, period=14):
        delta = series.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.rolling(window=period, min_periods=period).mean()
        avg_loss = loss.rolling(window=period, min_periods=period).mean()
        rs = avg_gain / np.maximum(1e-9, avg_loss)
        return 100.0 - (100.0 / (1.0 + rs))

    all_df["RSI_14"] = grouped["CLOSE"].transform(calc_rsi)

    # 20-day return for Relative Strength
    all_df["RET_20D"] = grouped["CLOSE"].transform(lambda x: (x - x.shift(20)) / x.shift(20) * 100.0)

    # NIFTY benchmark
    import yfinance as yf
    nifty = yf.Ticker("^NSEI").history(period="3y")
    nifty["DATE"] = pd.to_datetime(nifty.index.date)
    nifty["NIFTY_RET_20D"] = (nifty["Close"] - nifty["Close"].shift(20)) / nifty["Close"].shift(20) * 100.0
    nifty_ret_map = dict(zip(nifty["DATE"], nifty["NIFTY_RET_20D"]))
    all_df["NIFTY_RET_20D"] = all_df["DATE"].map(nifty_ret_map).fillna(0.0)
    all_df["RS_OUTPERFORM"] = all_df["RET_20D"] >= all_df["NIFTY_RET_20D"]

    return all_df, comp_names

def run_portfolio_2y(all_df, comp_names, strategy_name, signal_mask,
                     target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                     scaleout=False, target1_pct=8.0, target2_pct=16.0,
                     initial_capital=1000000.0, max_positions=5, slippage_pct=0.15):
    """
    Simulates portfolio day-by-day across the full 2 years (517 sessions).
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

            if scaleout:
                # Scale-out logic
                if not pos["t1_hit"]:
                    if c_high >= pos["target1_price"]:
                        exit_p1 = pos["target1_price"] * (1.0 - slippage_pct / 100.0)
                        half_shares = pos["shares"] // 2
                        pnl_half = (exit_p1 - pos["entry_price"]) * half_shares
                        cash += exit_p1 * half_shares
                        pos["t1_hit"] = True
                        pos["shares"] -= half_shares
                        pos["realized_pnl"] += pnl_half
                        pos["stop_price"] = pos["entry_price"] * 1.005

                exit_price = None
                exit_reason = None
                if c_low <= pos["stop_price"]:
                    exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                    exit_reason = "STOP_LOSS" if not pos["t1_hit"] else "RUNNER_BREAKEVEN"
                elif pos["t1_hit"] and c_high >= pos["target2_price"]:
                    exit_price = pos["target2_price"] * (1.0 - slippage_pct / 100.0)
                    exit_reason = "TARGET2_HIT"
                elif pos["holding_days"] >= max_hold:
                    exit_price = c_close * (1.0 - slippage_pct / 100.0)
                    exit_reason = "TIME_EXIT"

                if exit_price is not None:
                    pnl_rem = (exit_price - pos["entry_price"]) * pos["shares"]
                    tot_pnl = pos["realized_pnl"] + pnl_rem
                    cash += exit_price * pos["shares"]
                    ret_pct = (tot_pnl / pos["initial_invested"]) * 100.0
                    closed_trades.append({
                        "symbol": sym,
                        "company_name": comp_names.get(sym, sym),
                        "signal_date": pos["signal_date"].strftime("%Y-%m-%d"),
                        "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
                        "exit_date": curr_date.strftime("%Y-%m-%d"),
                        "entry_price": round(pos["entry_price"], 2),
                        "exit_price": round(exit_price, 2),
                        "invested_amt": round(pos["initial_invested"], 2),
                        "pnl": round(tot_pnl, 2),
                        "ret_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                        "holding_days": pos["holding_days"],
                        "deliv_per": pos["deliv_per"],
                        "deliv_spike_x": pos["deliv_spike_x"],
                        "rsi": pos.get("rsi", 0),
                    })
                else:
                    still_active.append(pos)
            else:
                # Fixed single target logic
                exit_price = None
                exit_reason = None
                if c_low <= pos["stop_price"]:
                    exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                    exit_reason = "STOP_LOSS"
                elif c_high >= pos["target_price"]:
                    exit_price = pos["target_price"] * (1.0 - slippage_pct / 100.0)
                    exit_reason = "TARGET_HIT"
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
                        "invested_amt": round(pos["invested_amt"], 2),
                        "pnl": round(pnl, 2),
                        "ret_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                        "holding_days": pos["holding_days"],
                        "deliv_per": pos["deliv_per"],
                        "deliv_spike_x": pos["deliv_spike_x"],
                        "rsi": pos.get("rsi", 0),
                    })
                else:
                    still_active.append(pos)

        active_positions = still_active

        # Check new entries
        if d_idx > 0:
            prev_date = dates[d_idx - 1]
            prev_signals = signals[signals["DATE"] == prev_date]

            if not prev_signals.empty and len(active_positions) < max_positions:
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

                    open_val = 0.0
                    for p in active_positions:
                        if p["symbol"] in curr_df.index:
                            c_b = curr_df.loc[p["symbol"]]
                            c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                            open_val += c_close_p * p["shares"]
                        else:
                            open_val += p.get("initial_invested", p.get("invested_amt", 0))

                    total_portfolio_val = cash + open_val
                    target_alloc = total_portfolio_val * slot_size_pct
                    invest_amt = min(cash, target_alloc)

                    if invest_amt < 10000:
                        continue

                    shares = int(invest_amt // entry_price)
                    if shares < (2 if scaleout else 1):
                        continue

                    actual_invest = shares * entry_price
                    cash -= actual_invest

                    stop_p = entry_price * (1.0 - stop_loss_pct / 100.0)

                    if scaleout:
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
                            "rsi": round(sig.get("RSI_14", 0), 1),
                        })
                    else:
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
                            "rsi": round(sig.get("RSI_14", 0), 1),
                        })

        # Calculate daily portfolio equity
        open_positions_val = 0.0
        for p in active_positions:
            if p["symbol"] in curr_df.index:
                c_b = curr_df.loc[p["symbol"]]
                c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                open_positions_val += c_close_p * p["shares"]
            else:
                open_positions_val += p.get("initial_invested", p.get("invested_amt", 0))

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
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = profit_factor = avg_trade_pnl = avg_hold = 0.0

    eq_df["daily_ret"] = eq_df["equity"].pct_change().fillna(0)
    sharpe = (eq_df["daily_ret"].mean() / eq_df["daily_ret"].std() * np.sqrt(252)) if eq_df["daily_ret"].std() > 0 else 0.0
    neg_ret = eq_df["daily_ret"][eq_df["daily_ret"] < 0]
    sortino = (eq_df["daily_ret"].mean() / neg_ret.std() * np.sqrt(252)) if not neg_ret.empty and neg_ret.std() > 0 else 0.0

    # Calmar ratio (Annualized return / Max Drawdown)
    cagr = ((final_equity / initial_capital) ** (1.0 / 2.0) - 1.0) * 100.0
    calmar = abs(cagr / max_drawdown) if abs(max_drawdown) > 0 else 0.0

    return {
        "Strategy": strategy_name,
        "Initial Capital": initial_capital,
        "Final Equity": round(final_equity, 2),
        "Net Profit (INR)": round(net_profit, 2),
        "Total Return %": round(total_return_pct, 2),
        "2Y CAGR %": round(cagr, 2),
        "Max Drawdown %": round(max_drawdown, 2),
        "Sharpe Ratio": round(sharpe, 2),
        "Sortino Ratio": round(sortino, 2),
        "Calmar Ratio": round(calmar, 2),
        "Total Trades": total_t,
        "Win Rate %": round(win_rate, 1),
        "Profit Factor": round(profit_factor, 2),
        "Avg Trade P&L (INR)": round(avg_trade_pnl, 2),
        "Avg Holding Days": round(avg_hold, 1),
        "trades_df": trades_df,
        "eq_df": eq_df
    }

def main():
    all_df, comp_names = load_2y_data()

    base_filter = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 70.0) & \
                  (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0) & \
                  (all_df["CLOSE"] > all_df["SMA_20"])

    results = []

    # 1. Strategy 1: Baseline Delivery Model (10% Tgt / 4% SL)
    r1 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="1. Baseline Delivery Spike (10% Tgt / 4% SL)",
        signal_mask=base_filter,
        target_pct=10.0, stop_loss_pct=4.0, max_hold=12
    )
    results.append(r1)

    # 2. Strategy 2: Pre-Spike Supply Dry-Up Base (Vol Dryup <= 1.25, 12% Tgt / 4% SL)
    mask_dry = base_filter & (all_df["VOL_DRYUP_RATIO"] <= 1.25)
    r2 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="2. Supply Dry-Up Base Breakout (12% Tgt / 4% SL - 3:1 RR)",
        signal_mask=mask_dry,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r2)

    # 3. Strategy 3: Technical RSI Momentum Sweet-Spot (52 <= RSI <= 68)
    mask_rsi = base_filter & (all_df["VOL_DRYUP_RATIO"] <= 1.25) & \
               (all_df["RSI_14"] >= 52.0) & (all_df["RSI_14"] <= 68.0)
    r3 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="3. Technico-Delivery RSI Sweet-Spot (52 <= RSI <= 68)",
        signal_mask=mask_rsi,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r3)

    # 4. Strategy 4: The 2-Year Apex Scale-Out (50% @ +8%, 50% @ +16% Runner + RS Outperformance)
    mask_scaleout = base_filter & (all_df["VOL_DRYUP_RATIO"] <= 1.25) & (all_df["RS_OUTPERFORM"] == True)
    r4 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="4. Apex Scale-Out Free Ride (50% @ +8%, 50% @ +16% Runner + RS)",
        signal_mask=mask_scaleout,
        scaleout=True, target1_pct=8.0, target2_pct=16.0, stop_loss_pct=4.0, max_hold=15
    )
    results.append(r4)

    print("\n" + "="*125)
    print(">>> 2-YEAR COMPREHENSIVE BACKTEST SUMMARY (517 TRADING SESSIONS: SEP 2024 - SEP 2026) <<<")
    print("="*125)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "2Y CAGR %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Calmar Ratio", "Total Trades", "Win Rate %", "Profit Factor"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in results]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    # Detailed yearly breakdown for Top Strategy
    best_strat = max(results, key=lambda x: x["Total Return %"])
    print("\n" + "="*80)
    print(f">>> YEAR-BY-YEAR BREAKDOWN: {best_strat['Strategy']} <<<")
    print("="*80)
    tb = best_strat["trades_df"]
    tb["exit_year"] = pd.to_datetime(tb["exit_date"]).dt.year
    y_pnl = tb.groupby("exit_year").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
        Avg_Return=("ret_pct", "mean"),
    ).reset_index()
    print(y_pnl.to_string(index=False))

    # Save to disk
    os.makedirs("data/analysis/2year_backtest", exist_ok=True)
    best_strat["trades_df"].to_csv("data/analysis/2year_backtest/trades_2year_best.csv", index=False)
    best_strat["eq_df"].to_csv("data/analysis/2year_backtest/equity_2year_best.csv", index=False)
    sum_df.to_csv("data/analysis/2year_backtest/summary_2year.csv", index=False)

    print("\n" + "="*80)
    print(f">>> TOP 12 BIGGEST PROFIT TRADES (OVER 2 YEARS) <<<")
    print("="*80)
    cols_s = ["symbol", "company_name", "entry_date", "exit_date", "entry_price", "exit_price", "pnl", "ret_pct", "holding_days", "exit_reason"]
    print(tb.sort_values(by="pnl", ascending=False).head(12)[cols_s].to_string(index=False))

if __name__ == "__main__":
    main()
