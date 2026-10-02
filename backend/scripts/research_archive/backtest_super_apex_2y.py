"""
Alpha India - Super Apex 2-Year Backtester (517 Sessions)
Evaluating the Step-by-Step Improvements Recommended:
1. 50D Breakout Baseline
2. + RSI Sweet-Spot (52-68) & Supply Dryup (Vol <= 1.25)
3. + NIFTY Regime Gate (NIFTY > 50 EMA)
4. + Trend-Riding Trailing Stop (50% @ +10%, remainder trailing 10-EMA or +25% target)
5. + Dynamic Slot Sizing (4 slots @ 25% + Liquid Cash Yield @ 6.5% p.a.)
"""

import sys
import os
import glob
import time
import pandas as pd
import numpy as np
import yfinance as yf

def load_data():
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

    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.rolling(20, min_periods=10).mean())
    all_df["EMA_10"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.rolling(50, min_periods=25).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())
    all_df["IS_50D_BREAKOUT"] = all_df["CLOSE"] >= all_df["HIGH_50"]

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

    # NIFTY 50 Regime Filter
    nifty = yf.Ticker("^NSEI").history(period="3y")
    nifty["DATE"] = pd.to_datetime(nifty.index.date)
    nifty["NIFTY_EMA_50"] = nifty["Close"].ewm(span=50).mean()
    nifty["NIFTY_SMA_200"] = nifty["Close"].rolling(200).mean()
    nifty_map_50 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_EMA_50"]))
    nifty_map_200 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_SMA_200"]))
    all_df["NIFTY_BULL_50"] = all_df["DATE"].map(nifty_map_50).fillna(True)
    all_df["NIFTY_BULL_200"] = all_df["DATE"].map(nifty_map_200).fillna(True)

    return all_df, comp_names


def simulate_portfolio(all_df, comp_names, strategy_name, signal_mask,
                       mode="fixed", target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                       trail_t1_pct=10.0, runner_target_pct=25.0,
                       max_positions=5, cash_yield_pct=6.5, slippage_pct=0.15):
    """
    Simulates portfolio.
    mode:
      - 'fixed': standard fixed target / stop loss
      - 'trail_runner': 50% sold at trail_t1_pct, remainder trailed using 10-EMA or runner_target_pct
    """
    initial_capital = 1000000.0
    signals = all_df[signal_mask].copy()
    dates = sorted(all_df["DATE"].unique())
    daily_groups = {d: df_d.set_index("SYMBOL") for d, df_d in all_df.groupby("DATE")}

    cash = initial_capital
    active_positions = []
    closed_trades = []
    equity_curve = []
    slot_size_pct = 1.0 / max_positions
    daily_yield_factor = (cash_yield_pct / 100.0) / 252.0 if cash_yield_pct > 0 else 0.0

    for d_idx, curr_date in enumerate(dates):
        curr_df = daily_groups.get(curr_date)
        if curr_df is None:
            continue

        # Add overnight liquid yield on idle cash
        if cash > 0 and daily_yield_factor > 0:
            cash += cash * daily_yield_factor

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
            c_ema10 = float(bar.get("EMA_10", c_close))
            pos["holding_days"] += 1

            if mode == "trail_runner":
                # 1. First target hit (+10%) -> sell 50%, lock breakeven
                if not pos["t1_hit"]:
                    if c_high >= pos["t1_price"]:
                        exit_p1 = pos["t1_price"] * (1.0 - slippage_pct / 100.0)
                        half_shares = pos["shares"] // 2
                        pnl_half = (exit_p1 - pos["entry_price"]) * half_shares
                        cash += exit_p1 * half_shares
                        pos["t1_hit"] = True
                        pos["shares"] -= half_shares
                        pos["realized_pnl"] += pnl_half
                        pos["stop_price"] = pos["entry_price"] * 1.01  # lock +1% gain on runner

                exit_price = None
                exit_reason = None

                # Check Stop Loss / Breakeven
                if c_low <= pos["stop_price"]:
                    exit_price = pos["stop_price"] * (1.0 - slippage_pct / 100.0)
                    exit_reason = "STOP_LOSS" if not pos["t1_hit"] else "RUNNER_PROFIT_LOCK"
                elif pos["t1_hit"]:
                    # Check Runner Target (+25%)
                    if c_high >= pos["runner_target"]:
                        exit_price = pos["runner_target"] * (1.0 - slippage_pct / 100.0)
                        exit_reason = "RUNNER_SUPER_TARGET"
                    # Or trail if price closes below 10-EMA
                    elif c_close < c_ema10 and pos["holding_days"] >= 5:
                        exit_price = c_close * (1.0 - slippage_pct / 100.0)
                        exit_reason = "EMA10_TRAIL_EXIT"
                    elif pos["holding_days"] >= 30:
                        exit_price = c_close * (1.0 - slippage_pct / 100.0)
                        exit_reason = "MAX_HOLD_EXIT"
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
                        "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
                        "exit_date": curr_date.strftime("%Y-%m-%d"),
                        "entry_price": round(pos["entry_price"], 2),
                        "exit_price": round(exit_price, 2),
                        "invested_amt": round(pos["initial_invested"], 2),
                        "pnl": round(tot_pnl, 2),
                        "ret_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                        "holding_days": pos["holding_days"],
                    })
                else:
                    still_active.append(pos)

            else:
                # Fixed mode
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
                        "entry_date": pos["entry_date"].strftime("%Y-%m-%d"),
                        "exit_date": curr_date.strftime("%Y-%m-%d"),
                        "entry_price": round(pos["entry_price"], 2),
                        "exit_price": round(exit_price, 2),
                        "invested_amt": round(pos["invested_amt"], 2),
                        "pnl": round(pnl, 2),
                        "ret_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                        "holding_days": pos["holding_days"],
                    })
                else:
                    still_active.append(pos)

        active_positions = still_active

        # Entry logic on previous day signals
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
                    if shares < (2 if mode == "trail_runner" else 1):
                        continue

                    actual_invest = shares * entry_price
                    cash -= actual_invest
                    stop_p = entry_price * (1.0 - stop_loss_pct / 100.0)

                    if mode == "trail_runner":
                        t1_p = entry_price * (1.0 + trail_t1_pct / 100.0)
                        runner_p = entry_price * (1.0 + runner_target_pct / 100.0)
                        active_positions.append({
                            "symbol": sym,
                            "entry_date": curr_date,
                            "entry_price": entry_price,
                            "shares": shares,
                            "initial_invested": actual_invest,
                            "realized_pnl": 0.0,
                            "stop_price": stop_p,
                            "t1_price": t1_p,
                            "runner_target": runner_p,
                            "t1_hit": False,
                            "holding_days": 0,
                        })
                    else:
                        tgt_p = entry_price * (1.0 + target_pct / 100.0)
                        active_positions.append({
                            "symbol": sym,
                            "entry_date": curr_date,
                            "entry_price": entry_price,
                            "shares": shares,
                            "invested_amt": actual_invest,
                            "stop_price": stop_p,
                            "target_price": tgt_p,
                            "holding_days": 0,
                        })

        open_val = 0.0
        for p in active_positions:
            if p["symbol"] in curr_df.index:
                c_b = curr_df.loc[p["symbol"]]
                c_close_p = float(c_b["CLOSE"].iloc[0] if isinstance(c_b, pd.DataFrame) else c_b["CLOSE"])
                open_val += c_close_p * p["shares"]
            else:
                open_val += p.get("initial_invested", p.get("invested_amt", 0))

        tot_eq = cash + open_val
        equity_curve.append({"date": curr_date, "equity": tot_eq, "cash": cash, "open_pos": len(active_positions)})

    eq_df = pd.DataFrame(equity_curve)
    trades_df = pd.DataFrame(closed_trades)

    final_equity = eq_df["equity"].iloc[-1] if not eq_df.empty else initial_capital
    net_profit = final_equity - initial_capital
    total_ret = (net_profit / initial_capital) * 100.0
    cagr = ((final_equity / initial_capital) ** (1.0 / 2.0) - 1.0) * 100.0

    eq_df["peak"] = eq_df["equity"].cummax()
    eq_df["dd"] = (eq_df["equity"] - eq_df["peak"]) / eq_df["peak"] * 100.0
    max_dd = eq_df["dd"].min()

    tot_t = len(trades_df)
    if tot_t > 0:
        wins = trades_df[trades_df["pnl"] > 0]
        losses = trades_df[trades_df["pnl"] < 0]
        win_rate = (len(wins) / tot_t) * 100.0
        gross_p = wins["pnl"].sum()
        gross_l = abs(losses["pnl"].sum()) if len(losses) > 0 else 0.001
        pf = gross_p / gross_l
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = pf = avg_hold = 0.0

    eq_df["daily_ret"] = eq_df["equity"].pct_change().fillna(0)
    sharpe = (eq_df["daily_ret"].mean() / eq_df["daily_ret"].std() * np.sqrt(252)) if eq_df["daily_ret"].std() > 0 else 0.0
    neg_ret = eq_df["daily_ret"][eq_df["daily_ret"] < 0]
    sortino = (eq_df["daily_ret"].mean() / neg_ret.std() * np.sqrt(252)) if not neg_ret.empty and neg_ret.std() > 0 else 0.0

    return {
        "Strategy": strategy_name,
        "Net Profit (INR)": round(net_profit, 2),
        "Total Return %": round(total_ret, 2),
        "2Y CAGR %": round(cagr, 2),
        "Max Drawdown %": round(max_dd, 2),
        "Sharpe Ratio": round(sharpe, 2),
        "Sortino Ratio": round(sortino, 2),
        "Total Trades": tot_t,
        "Win Rate %": round(win_rate, 1),
        "Profit Factor": round(pf, 2),
        "Avg Holding Days": round(avg_hold, 1),
        "trades_df": trades_df,
        "eq_df": eq_df,
    }


def main():
    all_df, comp_names = load_data()

    # Base: 50-Day Breakout + Delivery Surge >= 2.5x + Delivery % >= 65% + Day Return >= 2%
    m_base_50 = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["IS_50D_BREAKOUT"]) & \
                (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
                (all_df["DAY_RET_PCT"] >= 2.0)

    # Filter 2: + Supply Dryup & RSI Sweet-Spot (52-68)
    m_refined = m_base_50 & (all_df["VOL_DRYUP_RATIO"] <= 1.25) & \
                (all_df["RSI_14"] >= 52.0) & (all_df["RSI_14"] <= 68.0)

    # Filter 3: + NIFTY 50 Regime Filter (Only trade when NIFTY >= 50-day EMA)
    m_regime_50 = m_refined & (all_df["NIFTY_BULL_50"] == True)

    results = []

    # 1. 50D Breakout Baseline (5 slots @ 20%, 12% Tgt / 4% SL, 0% cash yield)
    r1 = simulate_portfolio(all_df, comp_names,
                            "1. 50D Breakout Baseline (12% Tgt / 4% SL)",
                            m_base_50, mode="fixed", target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                            max_positions=5, cash_yield_pct=0.0)
    results.append(r1)

    # 2. + RSI (52-68) & Supply Dry-up Base
    r2 = simulate_portfolio(all_df, comp_names,
                            "2. + RSI Sweet-Spot (52-68) & Supply Dryup Base",
                            m_refined, mode="fixed", target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                            max_positions=5, cash_yield_pct=0.0)
    results.append(r2)

    # 3. + NIFTY 50 Regime Gate (Trade only when NIFTY >= 50-EMA)
    r3 = simulate_portfolio(all_df, comp_names,
                            "3. + NIFTY 50 Regime Gate (NIFTY >= 50-EMA)",
                            m_regime_50, mode="fixed", target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                            max_positions=5, cash_yield_pct=0.0)
    results.append(r3)

    # 4. + Trend-Riding Trailing Stop (50% @ +10%, remainder trailing 10-EMA or +25% target)
    r4 = simulate_portfolio(all_df, comp_names,
                            "4. + Trailing Runner (50% @ +10%, 50% Trail 10-EMA / +25% Tgt)",
                            m_regime_50, mode="trail_runner", trail_t1_pct=10.0, runner_target_pct=25.0,
                            stop_loss_pct=4.0, max_hold=14, max_positions=5, cash_yield_pct=0.0)
    results.append(r4)

    # 5. + Dynamic Slot Sizing (4 slots @ 25%) & Liquid Yield on Idle Cash (6.5% p.a.)
    r5 = simulate_portfolio(all_df, comp_names,
                            "5. + Dynamic Sizing (4 Slots @ 25%) & 6.5% Cash Yield",
                            m_regime_50, mode="trail_runner", trail_t1_pct=10.0, runner_target_pct=25.0,
                            stop_loss_pct=4.0, max_hold=14, max_positions=4, cash_yield_pct=6.5)
    results.append(r5)

    print("\n" + "="*125)
    print(">>> 2-YEAR STEP-BY-STEP STRATEGY IMPROVEMENT ANALYSIS (517 SESSIONS: SEP 2024 - SEP 2026) <<<")
    print("="*125)
    cols = ["Strategy", "Net Profit (INR)", "Total Return %", "2Y CAGR %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Trades", "Win Rate %", "Profit Factor", "Avg Holding Days"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in results]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[cols].to_string(index=False))

    # Print Year-by-Year breakdown for Strategy 5
    print("\n" + "="*80)
    print(">>> YEAR-BY-YEAR PERFORMANCE: STRATEGY 5 (DYNAMIC SIZING + CASH YIELD + TRAILING) <<<")
    print("="*80)
    tb = r5["trades_df"]
    tb["exit_year"] = pd.to_datetime(tb["exit_date"]).dt.year
    y_pnl = tb.groupby("exit_year").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
        Avg_Return=("ret_pct", "mean"),
    ).reset_index()
    print(y_pnl.to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP 10 WINNING TRADES (STRATEGY 5) <<<")
    print("="*80)
    print(tb.sort_values(by="pnl", ascending=False).head(10)[["symbol", "company_name", "entry_date", "exit_date", "entry_price", "exit_price", "pnl", "ret_pct", "holding_days", "exit_reason"]].to_string(index=False))

if __name__ == "__main__":
    main()
