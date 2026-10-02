"""
Alpha India - 2-Year Breakout & Delivery Confluence Backtester
Evaluates whether 20-day / 50-day breakout structures or consecutive delivery accumulation
overcomes choppy regimes across the full 2 years (517 sessions).
"""

import sys
sys.path.append(".")
import pandas as pd
import numpy as np
from scripts.run_2year_comprehensive_backtest import load_2y_data, run_portfolio_2y

def main():
    all_df, comp_names = load_2y_data()

    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())
    all_df["IS_20D_BREAKOUT"] = all_df["CLOSE"] >= all_df["HIGH_20"]
    all_df["IS_50D_BREAKOUT"] = all_df["CLOSE"] >= all_df["HIGH_50"]

    # 1. 20-Day High Breakout + Delivery % >= 65% + Spike >= 2.5x
    m_brk20 = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["IS_20D_BREAKOUT"]) & \
              (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
              (all_df["DAY_RET_PCT"] >= 2.0)

    # 2. 50-Day High Breakout + Delivery % >= 65% + Spike >= 2.5x
    m_brk50 = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["IS_50D_BREAKOUT"]) & \
              (all_df["DELIV_PER"] >= 65.0) & (all_df["DELIV_SPIKE_10X"] >= 2.5) & \
              (all_df["DAY_RET_PCT"] >= 2.0)

    # 3. Mega-Delivery Surge >= 5.0x with Deliv >= 70%
    m_mega = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["CLOSE"] > all_df["SMA_20"]) & \
             (all_df["DELIV_PER"] >= 70.0) & (all_df["DELIV_SPIKE_10X"] >= 5.0) & \
             (all_df["DAY_RET_PCT"] >= 2.5)

    # 4. Pullback Bounce after Delivery Climax:
    # Day t had Deliv % >= 70% and Spike >= 3x.
    # Day t+1 to t+3 pulls back and closes green while holding 5-day low.
    all_df["PRIOR_CLIMAX"] = grouped["DELIV_PER"].shift(2) >= 70.0
    all_df["PRIOR_SPIKE"] = grouped["DELIV_SPIKE_10X"].shift(2) >= 3.0
    m_pullback = (all_df["TURNOVER_CR"] >= 2.0) & (all_df["PRIOR_CLIMAX"]) & (all_df["PRIOR_SPIKE"]) & \
                 (all_df["DAY_RET_PCT"] >= 1.5) & (all_df["CLOSE"] > all_df["SMA_20"])

    setups = [
        ("20D High Breakout (12% Tgt / 4% SL)", m_brk20, 12.0, 4.0, 14),
        ("20D High Breakout (10% Tgt / 3.5% SL)", m_brk20, 10.0, 3.5, 12),
        ("50D High Breakout (12% Tgt / 4% SL)", m_brk50, 12.0, 4.0, 14),
        ("50D High Breakout (15% Tgt / 4% SL)", m_brk50, 15.0, 4.0, 15),
        ("Mega 5x Spike (12% Tgt / 4% SL)", m_mega, 12.0, 4.0, 14),
        ("Delivery Pullback Re-test (8% Tgt / 3% SL)", m_pullback, 8.0, 3.0, 10),
    ]

    results = []
    for name, mask, tgt, sl, hold in setups:
        r = run_portfolio_2y(all_df, comp_names, name, mask, target_pct=tgt, stop_loss_pct=sl, max_hold=hold)
        results.append(r)

    print("\n" + "="*125)
    print(">>> 2-YEAR BREAKOUT & STRUCTURAL SETUP BACKTEST (517 SESSIONS: SEP 2024 - SEP 2026) <<<")
    print("="*125)
    summary_cols = ["Strategy", "Net Profit (INR)", "Total Return %", "2Y CAGR %", "Max Drawdown %", "Sharpe Ratio", "Sortino Ratio", "Total Trades", "Win Rate %", "Profit Factor"]
    summary_rows = [{k: v for k, v in r.items() if k not in ["trades_df", "eq_df"]} for r in results]
    sum_df = pd.DataFrame(summary_rows)
    print(sum_df[summary_cols].to_string(index=False))

    # Inspect year-by-year for the best
    best = max(results, key=lambda x: x["Total Return %"])
    print("\n" + "="*80)
    print(f">>> YEAR-BY-YEAR BREAKDOWN: {best['Strategy']} <<<")
    print("="*80)
    tb = best["trades_df"]
    tb["exit_year"] = pd.to_datetime(tb["exit_date"]).dt.year
    y_pnl = tb.groupby("exit_year").agg(
        Trades=("pnl", "count"),
        Net_Profit=("pnl", "sum"),
        Win_Rate=("pnl", lambda x: round((x > 0).sum() / len(x) * 100, 1)),
    ).reset_index()
    print(y_pnl.to_string(index=False))

if __name__ == "__main__":
    main()
