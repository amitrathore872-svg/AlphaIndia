"""
Alpha India - Technical Indicator Optimization Engine
Tests technical indicators to enhance the Delivery % Swing Strategy:
1. Indicator 1: RSI (14) Momentum Sweet-Spot (52 <= RSI <= 68 - Bullish Momentum, Not Overbought)
2. Indicator 2: Moving Average Ribbon Alignment (EMA 9 > EMA 21 > SMA 50)
3. Indicator 3: Bollinger Band Volatility Squeeze Breakout (Bandwidth <= 12% expanding into upper band)
4. Indicator 4: MACD Bullish Momentum Expansion (MACD > Signal and Histogram > 0)
5. Indicator 5: ATR-Based Dynamic Volatility Risk-Reward (Stop = 1.8x ATR, Target = 4.5x ATR)
6. Master Technical + Delivery Confluence Model
"""

import glob
import os
import time
import pandas as pd
import numpy as np

def compute_technical_indicators():
    print("Loading delivery bhavcopies and calculating technical indicators...")
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

    # Core Delivery metrics
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE_10X"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0

    # 1. Moving Averages: EMA 9, EMA 21, SMA 50
    all_df["EMA_9"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=9, adjust=False).mean())
    all_df["EMA_21"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=21, adjust=False).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.rolling(50, min_periods=20).mean())
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.rolling(20, min_periods=10).mean())
    all_df["MA_RIBBON_BULLISH"] = (all_df["EMA_9"] > all_df["EMA_21"]) & (all_df["EMA_21"] > all_df["SMA_50"])

    # 2. RSI (14)
    def calc_rsi(series, period=14):
        delta = series.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.rolling(window=period, min_periods=period).mean()
        avg_loss = loss.rolling(window=period, min_periods=period).mean()
        rs = avg_gain / np.maximum(1e-9, avg_loss)
        return 100.0 - (100.0 / (1.0 + rs))

    all_df["RSI_14"] = grouped["CLOSE"].transform(calc_rsi)

    # 3. Bollinger Bands & Bandwidth
    rolling_mean_20 = grouped["CLOSE"].transform(lambda x: x.rolling(20, min_periods=15).mean())
    rolling_std_20 = grouped["CLOSE"].transform(lambda x: x.rolling(20, min_periods=15).std())
    upper_bb = rolling_mean_20 + (rolling_std_20 * 2.0)
    lower_bb = rolling_mean_20 - (rolling_std_20 * 2.0)
    all_df["BB_BANDWIDTH"] = ((upper_bb - lower_bb) / np.maximum(0.01, rolling_mean_20)) * 100.0
    all_df["BB_UPPER"] = upper_bb

    # 4. ATR (14) for Volatility Sizing
    tr1 = all_df["HIGH"] - all_df["LOW"]
    tr2 = (all_df["HIGH"] - all_df["PREV_CLOSE"]).abs()
    tr3 = (all_df["LOW"] - all_df["PREV_CLOSE"]).abs()
    all_df["TR"] = np.maximum(tr1, np.maximum(tr2, tr3))
    all_df["ATR_14"] = grouped["TR"].transform(lambda x: x.rolling(14, min_periods=7).mean())
    all_df["ATR_PCT"] = (all_df["ATR_14"] / all_df["CLOSE"]) * 100.0

    # 5. MACD (12, 26, 9)
    ema12 = grouped["CLOSE"].transform(lambda x: x.ewm(span=12, adjust=False).mean())
    ema26 = grouped["CLOSE"].transform(lambda x: x.ewm(span=26, adjust=False).mean())
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    all_df["MACD_BULLISH"] = (macd_line > signal_line) & (macd_line > 0)

    print("Indicators successfully computed.")
    return all_df, comp_names

def run_technical_backtest(all_df, comp_names, strategy_name, signal_mask,
                           mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14,
                           atr_sl_mult=1.8, atr_tp_mult=4.5,
                           initial_capital=1000000.0, max_positions=5, slippage_pct=0.15):
    """
    Simulates portfolio with technical indicator setups:
    Supports fixed percentage brackets OR ATR volatility brackets.
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
                    "shares": pos["shares"],
                    "invested_amt": round(pos["invested_amt"], 2),
                    "exit_amt": round(exit_price * pos["shares"], 2),
                    "pnl": round(pnl, 2),
                    "ret_pct": round(ret_pct, 2),
                    "exit_reason": exit_reason,
                    "holding_days": pos["holding_days"],
                    "deliv_per": pos["deliv_per"],
                    "deliv_spike_x": pos["deliv_spike_x"],
                    "rsi": pos.get("rsi", 0),
                    "atr_pct": pos.get("atr_pct", 0),
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

                    if mode == "atr_brackets":
                        # ATR based dynamic volatility stops
                        sig_atr = float(sig["ATR_14"]) if not pd.isna(sig["ATR_14"]) else entry_price * 0.025
                        stop_p = entry_price - (sig_atr * atr_sl_mult)
                        target_p = entry_price + (sig_atr * atr_tp_mult)
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
                        "rsi": round(sig.get("RSI_14", 0), 1),
                        "atr_pct": round(sig.get("ATR_PCT", 0), 2),
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
        target_hits = (trades_df["exit_reason"] == "TARGET_HIT").sum()
        stop_hits = (trades_df["exit_reason"] == "STOP_LOSS").sum()
        time_exits = (trades_df["exit_reason"] == "TIME_EXIT").sum()
        avg_hold = trades_df["holding_days"].mean()
    else:
        win_rate = profit_factor = avg_trade_pnl = avg_hold = 0.0
        target_hits = stop_hits = time_exits = 0

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
        "Target Hits": target_hits,
        "Stop Hits": stop_hits,
        "Time Exits": time_exits,
        "Avg Trade P&L (INR)": round(avg_trade_pnl, 2),
        "Avg Holding Days": round(avg_hold, 1),
        "trades_df": trades_df,
        "eq_df": eq_df
    }

def main():
    all_df, comp_names = compute_technical_indicators()

    # Core Delivery foundation
    base_deliv_mask = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["DELIV_PER"] >= 70.0) & \
                      (all_df["DELIV_SPIKE_10X"] >= 3.0) & (all_df["DAY_RET_PCT"] >= 2.0) & \
                      (all_df["CLOSE"] > all_df["SMA_20"]) & (all_df["VOL_DRYUP_RATIO"] <= 1.25)

    results = []

    # 1. Baseline: Delivery Supply Dry-Up (Our V3 Winner from before)
    r_base = run_technical_backtest(
        all_df, comp_names,
        strategy_name="Baseline: Delivery Dry-Up Base (12% Tgt / 4% SL)",
        signal_mask=base_deliv_mask,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_base)

    # 2. Indicator 1: RSI (14) Momentum Sweet-Spot (52 <= RSI <= 68)
    # Ensures strong momentum without being overextended
    mask_rsi = base_deliv_mask & (all_df["RSI_14"] >= 52.0) & (all_df["RSI_14"] <= 68.0)
    r_rsi = run_technical_backtest(
        all_df, comp_names,
        strategy_name="T1: + RSI Momentum Sweet-Spot (52 <= RSI <= 68)",
        signal_mask=mask_rsi,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_rsi)

    # 3. Indicator 2: Moving Average Ribbon Alignment (EMA 9 > EMA 21 > SMA 50)
    mask_ribbon = base_deliv_mask & (all_df["MA_RIBBON_BULLISH"] == True)
    r_ribbon = run_technical_backtest(
        all_df, comp_names,
        strategy_name="T2: + Moving Average Ribbon (EMA 9 > EMA 21 > SMA 50)",
        signal_mask=mask_ribbon,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_ribbon)

    # 4. Indicator 3: Bollinger Band Squeeze Breakout (Bandwidth <= 15% expanding into upper band)
    mask_bb = base_deliv_mask & (all_df["BB_BANDWIDTH"] <= 15.0) & (all_df["CLOSE"] >= all_df["BB_UPPER"] * 0.98)
    r_bb = run_technical_backtest(
        all_df, comp_names,
        strategy_name="T3: + Bollinger Squeeze Breakout (Bandwidth <= 15%)",
        signal_mask=mask_bb,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_bb)

    # 5. Indicator 4: MACD Bullish Expansion (MACD Line > Signal & Histogram > 0)
    mask_macd = base_deliv_mask & (all_df["MACD_BULLISH"] == True)
    r_macd = run_technical_backtest(
        all_df, comp_names,
        strategy_name="T4: + MACD Bullish Momentum Expansion (MACD > Signal)",
        signal_mask=mask_macd,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_macd)

    # 6. Indicator 5: ATR Dynamic Volatility Risk-Reward (SL = 1.8x ATR, TP = 4.5x ATR)
    r_atr = run_technical_backtest(
        all_df, comp_names,
        strategy_name="T5: + ATR Volatility Adaptive Brackets (1.8x ATR SL, 4.5x ATR TP)",
        signal_mask=base_deliv_mask,
        mode="atr_brackets", atr_sl_mult=1.8, atr_tp_mult=4.5, max_hold=14
    )
    results.append(r_atr)

    # 7. THE MASTER TECHNICO-DELIVERY MATRIX (RSI Sweetspot + MA Ribbon + Delivery Dry-up Base)
    mask_master = base_deliv_mask & (all_df["RSI_14"] >= 50.0) & (all_df["RSI_14"] <= 72.0) & \
                  (all_df["EMA_9"] > all_df["EMA_21"])
    r_tech_master = run_technical_backtest(
        all_df, comp_names,
        strategy_name="TECH-DELIVERY APEX: (RSI 50-72 + EMA 9>21 + Delivery Dry-Up Base)",
        signal_mask=mask_master,
        mode="fixed_bracket", target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r_tech_master)

    print("\n" + "="*120)
    print(">>> TECHNICAL INDICATOR ENHANCEMENT MATRIX (INR 10,00,000 CAPITAL - 185 TRADING SESSIONS) <<<")
    print("="*120)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Trades", "Win Rate %", "Profit Factor", "Avg Holding Days"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in results]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    os.makedirs("data/analysis/tech_indicators", exist_ok=True)
    r_tech_master["trades_df"].to_csv("data/analysis/tech_indicators/tech_master_trades.csv", index=False)
    r_tech_master["eq_df"].to_csv("data/analysis/tech_indicators/tech_master_equity.csv", index=False)
    r_rsi["trades_df"].to_csv("data/analysis/tech_indicators/rsi_trades.csv", index=False)

    print("\n" + "="*90)
    print(">>> TECH-DELIVERY APEX MONTHLY BREAKDOWN <<<")
    print("="*90)
    tm = r_tech_master["trades_df"]
    tm["exit_month"] = pd.to_datetime(tm["exit_date"]).dt.strftime("%Y-%m")
    m_pnl = tm.groupby("exit_month").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
        Target_Hits=("exit_reason", lambda x: (x == "TARGET_HIT").sum()),
        Stop_Hits=("exit_reason", lambda x: (x == "STOP_LOSS").sum()),
    ).reset_index()
    print(m_pnl.to_string(index=False))

    print("\n" + "="*90)
    print(">>> RECENT WINNING TRADES WITH TECHNICAL INDICATORS <<<")
    print("="*90)
    cols_s = ["symbol", "company_name", "entry_date", "exit_date", "entry_price", "exit_price", "pnl", "ret_pct", "rsi", "deliv_per", "deliv_spike_x", "exit_reason"]
    print(tm.sort_values(by="entry_date", ascending=False).head(10)[cols_s].to_string(index=False))

if __name__ == "__main__":
    main()
