"""
Alpha India - 2-Year Macro & Indicator Optimization
Evaluates how Macro Regime Filters (NIFTY 50 / 200 SMA) and Stage 2 Trend Templates
impact the 2-Year Backtest (Sep 2024 - Sep 2026).
"""

import sys
sys.path.append(".")
import pandas as pd
import numpy as np
import yfinance as yf
from scripts.run_2year_comprehensive_backtest import load_2y_data, run_portfolio_2y


def main():
    all_df, comp_names = load_2y_data()

    # Fetch Nifty 50
    nifty = yf.Ticker("^NSEI").history(period="3y")
    nifty["DATE"] = pd.to_datetime(nifty.index.date)
    nifty["NIFTY_SMA_50"] = nifty["Close"].rolling(50).mean()
    nifty["NIFTY_SMA_200"] = nifty["Close"].rolling(200).mean()
    nifty["NIFTY_EMA_20"] = nifty["Close"].ewm(span=20).mean()
    
    nifty_map_50 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_SMA_50"]))
    nifty_map_200 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_SMA_200"]))
    nifty_map_20 = dict(zip(nifty["DATE"], nifty["Close"] >= nifty["NIFTY_EMA_20"]))

    all_df["NIFTY_BULL_50"] = all_df["DATE"].map(nifty_map_50).fillna(True)
    all_df["NIFTY_BULL_200"] = all_df["DATE"].map(nifty_map_200).fillna(True)
    all_df["NIFTY_BULL_20"] = all_df["DATE"].map(nifty_map_20).fillna(True)

    # Core Technico-Delivery Setup:
    # 1. Delivery % >= 70%
    # 2. Delivery Spike >= 3.0x
    # 3. Day Return >= 2.0%
    # 4. Close > 20 SMA
    # 5. Volume Dry-Up Ratio <= 1.25
    # 6. RSI (14) between 52 and 68
    base_tech = (all_df["TURNOVER_CR"] >= 2.0) & \
                (all_df["DELIV_PER"] >= 70.0) & \
                (all_df["DELIV_SPIKE_10X"] >= 3.0) & \
                (all_df["DAY_RET_PCT"] >= 2.0) & \
                (all_df["CLOSE"] > all_df["SMA_20"]) & \
                (all_df["VOL_DRYUP_RATIO"] <= 1.25) & \
                (all_df["RSI_14"] >= 52.0) & (all_df["RSI_14"] <= 68.0)

    results = []

    # 1. Unfiltered (Trades even during bear markets)
    r1 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="1. Technico-Delivery (No Macro Filter)",
        signal_mask=base_tech,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r1)

    # 2. Bull Market Regime Only (NIFTY >= 200 SMA)
    mask_200 = base_tech & (all_df["NIFTY_BULL_200"] == True)
    r2 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="2. Bull Market Filter (NIFTY >= 200 SMA)",
        signal_mask=mask_200,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r2)

    # 3. Intermediate Trend Filter (NIFTY >= 50 SMA)
    mask_50 = base_tech & (all_df["NIFTY_BULL_50"] == True)
    r3 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="3. Intermediate Trend Filter (NIFTY >= 50 SMA)",
        signal_mask=mask_50,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r3)

    # 4. Stage 2 Stock Alignment (20 SMA > 50 SMA) + NIFTY >= 50 SMA
    mask_s2_nifty = base_tech & (all_df["SMA_20"] > all_df["SMA_50"]) & (all_df["NIFTY_BULL_50"] == True)
    r4 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="4. Stage 2 Stock Uptrend + NIFTY >= 50 SMA",
        signal_mask=mask_s2_nifty,
        target_pct=12.0, stop_loss_pct=4.0, max_hold=14
    )
    results.append(r4)

    # 5. Dual Momentum Payoff: 10% Target / 3.5% Stop Loss (Almost 3:1 RR with higher hit rate) + NIFTY 50
    r5 = run_portfolio_2y(
        all_df, comp_names,
        strategy_name="5. High-Velocity (10% Target / 3.5% SL) + NIFTY >= 50 SMA",
        signal_mask=mask_50,
        target_pct=10.0, stop_loss_pct=3.5, max_hold=12
    )
    results.append(r5)

    print("\n" + "="*125)
    print(">>> 2-YEAR MACRO-ENHANCED TECHNICO-DELIVERY BACKTEST (517 SESSIONS: SEP 2024 - SEP 2026) <<<")
    print("="*125)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "2Y CAGR %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Trades", "Win Rate %", "Profit Factor"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in results]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    # Detailed yearly breakdown for Strategy 3 and 5
    for strat in [r3, r5]:
        print("\n" + "="*80)
        print(f">>> YEAR-BY-YEAR BREAKDOWN: {strat['Strategy']} <<<")
        print("="*80)
        tb = strat["trades_df"]
        tb["exit_year"] = pd.to_datetime(tb["exit_date"]).dt.year
        y_pnl = tb.groupby("exit_year").agg(
            Trades=("pnl", "count"),
            Net_Profit=("pnl", "sum"),
            Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
            Target_Hits=("exit_reason", lambda x: (x == "TARGET_HIT").sum()),
            Stop_Hits=("exit_reason", lambda x: (x == "STOP_LOSS").sum()),
        ).reset_index()
        print(y_pnl.to_string(index=False))

if __name__ == "__main__":
    main()
