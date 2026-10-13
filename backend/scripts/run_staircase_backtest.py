"""
Alpha India - Institutional Staircase / Creeping Bull Quantitative Backtest Engine
Validates the performance of the Cupid Archetype / Staircase Momentum Strategy
across Indian equities (NSE) over a 2-year rolling period.
"""

import sys
import os
import json
import math
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
import yfinance as yf

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "backend")

from app.services.staircase_screener_service import StaircaseScreenerService

# Universe of high-momentum, growth, mid-cap, and institutional equities
BACKTEST_UNIVERSE = [
    "CUPID", "TATAPOWER", "TRENT", "DIXON", "KAYNES", "BEL", "HAL",
    "COCHINSHIP", "MAZDOCK", "BSE", "CDSL", "HUDCO", "NBCC", "IREDA",
    "RVNL", "RAILTEL", "IRFC", "SUZLON", "MOTHERSON", "CESC",
    "FEDERALBNK", "AARTIIND", "ABB", "ABCAPITAL", "ADANIENT", "ADANIPORTS",
    "AMBUJACEM", "APOLLOHOSP", "ASHOKLEY", "ASTRAL", "AUBANK", "AUROPHARMA",
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BALKRISIND", "BANDHANBNK",
    "BANKBARODA", "BERGEPAINT", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD",
    "BPCL", "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA",
    "COFORGE", "COLPAL", "CONCOR", "COROMANDEL", "CROMPTON", "CUMMINSIND",
    "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB", "DLF", "DRREDDY",
    "EICHERMOT", "ESCORTS", "EXIDEIND", "GAIL", "GLENMARK",
    "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM",
    "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO",
    "HINDALCO", "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK",
    "ICICIGI", "ICICIPRULI", "IDEA", "IDFCFIRSTB", "IEX",
    "IGL", "INDHOTEL", "INDIACEM", "INDIAMART", "INDIGO", "INDUSINDBK",
    "INDUSTOWER", "INFY", "IOC", "IPCALAB", "ITC", "JINDALSTEL",
    "JKCEMENT", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LALPATHLAB",
    "LAURUSLABS", "LICHSGFIN", "LT", "LTF", "LUPIN", "M&M",
    "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "METROPOLIS", "MFSL",
    "MPHASIS", "MRF", "MUTHOOTFIN", "NATIONALUM", "NAUKRI", "NESTLEIND",
    "NMDC", "NTPC", "OBEROIRLTY", "OFSS", "ONGC", "PAGEIND",
    "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
    "POLYCAB", "POONAWALLA", "POWERGRID", "PRESTIGE", "PVRINOX",
    "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL", "SBICARD",
    "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF",
    "SUNPHARMA", "SUNTV", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM",
    "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM",
    "TORNTPOWER", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VBL",
    "VEDL", "VOLTAS", "WIPRO", "ZYDUSLIFE"
]


class StaircaseBacktester:
    """
    Simulates daily signal generation and trade lifecycle execution for Staircase setups.
    """

    def __init__(self, symbols: List[str], period: str = "2y"):
        self.symbols = symbols
        self.period = period
        self.results: List[Dict[str, Any]] = []

    def fetch_data(self) -> Dict[str, pd.DataFrame]:
        print(f"Downloading historical data for {len(self.symbols)} equities (period: {self.period})...")
        formatted = [f"{s}.NS" for s in self.symbols]
        try:
            raw = yf.download(
                formatted,
                period=self.period,
                interval="1d",
                group_by="ticker",
                threads=True,
                progress=False,
            )
        except Exception as e:
            print(f"Batch download failed: {e}")
            raw = None

        data_map: Dict[str, pd.DataFrame] = {}
        for s in self.symbols:
            t_key = f"{s}.NS"
            df = None
            if raw is not None and t_key in raw:
                df = raw[t_key].dropna()
            if df is None or len(df) < 100:
                try:
                    df = yf.download(t_key, period=self.period, interval="1d", progress=False)
                    if df is not None:
                        df = df.dropna()
                except Exception:
                    pass

            if df is not None and len(df) >= 100:
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                data_map[s] = df

        print(f"Successfully loaded clean data for {len(data_map)} equities.")
        return data_map

    def run_backtest(self, data_map: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """
        Walks forward daily across all symbols, generating signals and tracking trades.
        """
        all_trades: List[Dict[str, Any]] = []
        
        # Track cooldowned entries so we don't double-enter the same run
        active_entries: Dict[str, int] = {}

        for sym, df in data_map.items():
            closes = df["Close"].values
            highs = df["High"].values
            lows = df["Low"].values
            opens = df["Open"].values
            dates = df.index

            n_bars = len(df)
            if n_bars < 120:
                continue

            # Rolling loop starting at bar 60 (to ensure enough lookback for 50 DMA)
            cooldown_until = 0

            for i in range(60, n_bars - 15):
                if i < cooldown_until:
                    continue

                # Slice window up to current decision bar i
                sub_df = df.iloc[: i + 1]

                # Quick check: 10-day Kaufman Efficiency
                c_10 = closes[i - 9 : i + 1]
                net_10 = abs(c_10[-1] - c_10[0])
                sum_10 = np.sum(np.abs(np.diff(c_10)))
                ker_10 = net_10 / sum_10 if sum_10 > 0 else 0

                # Must have high directional efficiency
                if ker_10 < 0.68:
                    continue

                # Positive days in last 10
                daily_diffs = np.diff(c_10)
                green_days = (daily_diffs > 0).sum()
                if green_days < 7:
                    continue

                # Check moving average alignment: Close > 10 EMA > 20 EMA > 50 SMA
                ema_10_series = pd.Series(closes[: i + 1]).ewm(span=10, adjust=False).mean().values
                ema_20_series = pd.Series(closes[: i + 1]).ewm(span=20, adjust=False).mean().values
                sma_50_series = pd.Series(closes[: i + 1]).rolling(50).mean().values

                cur_c = closes[i]
                cur_ema10 = ema_10_series[-1]
                cur_ema20 = ema_20_series[-1]
                cur_sma50 = sma_50_series[-1]

                if not (cur_c > cur_ema10 > cur_ema20 > cur_sma50):
                    continue

                # Base Launchpad check: detect prior base high
                base_window = closes[max(0, i - 55) : max(1, i - 10)]
                base_high = np.max(base_window) if len(base_window) > 0 else cur_c
                dist_from_base = ((cur_c - base_high) / base_high) * 100

                # Sweet spot: between 3% and 24% above prior base
                if not (2.0 <= dist_from_base <= 24.0):
                    continue

                # Signal confirmed on bar i!
                # Entry executed at open of bar i+1
                entry_bar = i + 1
                entry_date = dates[entry_bar]
                entry_price = float(opens[entry_bar])

                if entry_price <= 0:
                    continue

                # ------------------------------------------------------------------
                # SIMULATE TRADE WITH 10 EMA TRAILING STOP & FIXED HORIZONS
                # ------------------------------------------------------------------
                max_hold_bars = min(n_bars - entry_bar, 60)
                exit_bar = entry_bar + max_hold_bars - 1
                exit_price = float(closes[exit_bar])
                exit_reason = "MAX_TIME_60D"

                highest_price = entry_price
                lowest_price = entry_price

                # Track day by day
                for h in range(entry_bar, entry_bar + max_hold_bars):
                    bar_h_close = closes[h]
                    bar_h_high = highs[h]
                    bar_h_low = lows[h]

                    if bar_h_high > highest_price:
                        highest_price = bar_h_high
                    if bar_h_low < lowest_price:
                        lowest_price = bar_h_low

                    # Calculate 10 EMA at bar h
                    current_ema10 = pd.Series(closes[: h + 1]).ewm(span=10, adjust=False).mean().iloc[-1]

                    # Stop condition: Daily close breaks below 10 EMA (Mechanical Trail)
                    if bar_h_close < current_ema10 and h > entry_bar + 2:
                        exit_bar = h
                        exit_price = float(bar_h_close)
                        exit_reason = "10_EMA_TRAIL_BREACH"
                        break

                    # Hard catastrophic stop loss: -7% from entry
                    if (bar_h_low - entry_price) / entry_price <= -0.07:
                        exit_bar = h
                        exit_price = float(entry_price * 0.93)
                        exit_reason = "HARD_STOP_7PCT"
                        break

                trade_return_pct = ((exit_price - entry_price) / entry_price) * 100
                mfe_pct = ((highest_price - entry_price) / entry_price) * 100
                mae_pct = ((lowest_price - entry_price) / entry_price) * 100
                hold_days = exit_bar - entry_bar

                all_trades.append({
                    "symbol": sym,
                    "entry_date": str(entry_date)[:10],
                    "entry_price": round(entry_price, 2),
                    "exit_date": str(dates[exit_bar])[:10],
                    "exit_price": round(exit_price, 2),
                    "return_pct": round(trade_return_pct, 2),
                    "mfe_pct": round(mfe_pct, 2),
                    "mae_pct": round(mae_pct, 2),
                    "hold_days": hold_days,
                    "exit_reason": exit_reason,
                    "ker_at_entry": round(ker_10, 3),
                    "green_days_10d": int(green_days),
                    "dist_from_base": round(dist_from_base, 1),
                })

                # Cooldown so we don't spam signals on the same wave
                cooldown_until = exit_bar + 5

        return self.compute_statistics(all_trades)

    def compute_statistics(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not trades:
            return {"total_trades": 0, "message": "No trades triggered"}

        df_trades = pd.DataFrame(trades)
        returns = df_trades["return_pct"]

        total_trades = len(df_trades)
        winning_trades = df_trades[returns > 0]
        losing_trades = df_trades[returns <= 0]

        win_rate = (len(winning_trades) / total_trades) * 100
        avg_return = float(returns.mean())
        median_return = float(returns.median())

        avg_win = float(winning_trades["return_pct"].mean()) if len(winning_trades) > 0 else 0.0
        avg_loss = float(losing_trades["return_pct"].mean()) if len(losing_trades) > 0 else 0.0

        gross_profit = float(winning_trades["return_pct"].sum()) if len(winning_trades) > 0 else 0.0
        gross_loss = abs(float(losing_trades["return_pct"].sum())) if len(losing_trades) > 0 else 0.001
        profit_factor = gross_profit / gross_loss

        avg_mfe = float(df_trades["mfe_pct"].mean())
        avg_mae = float(df_trades["mae_pct"].mean())
        avg_hold_days = float(df_trades["hold_days"].mean())

        # Multibaggers / Big runners: Trades gaining > +20% and > +40%
        runners_20pct = int((returns >= 20.0).sum())
        runners_40pct = int((returns >= 40.0).sum())
        runners_pct = (runners_20pct / total_trades) * 100

        # Maximum consecutive wins / losses
        is_win = (returns > 0).astype(int).tolist()
        max_consec_wins = 0
        cur_wins = 0
        for w in is_win:
            if w == 1:
                cur_wins += 1
                if cur_wins > max_consec_wins:
                    max_consec_wins = cur_wins
            else:
                cur_wins = 0

        # Exit reasons breakdown
        exit_counts = df_trades["exit_reason"].value_counts().to_dict()

        # Sort top winning trades
        top_trades = df_trades.sort_values(by="return_pct", ascending=False).head(10).to_dict(orient="records")

        # Sort worst trades
        worst_trades = df_trades.sort_values(by="return_pct", ascending=True).head(5).to_dict(orient="records")

        return {
            "total_trades": total_trades,
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2),
            "avg_return_pct": round(avg_return, 2),
            "median_return_pct": round(median_return, 2),
            "avg_win_pct": round(avg_win, 2),
            "avg_loss_pct": round(avg_loss, 2),
            "win_loss_ratio": round(abs(avg_win / avg_loss), 2) if avg_loss != 0 else 99.0,
            "avg_mfe_pct": round(avg_mfe, 2),
            "avg_mae_pct": round(avg_mae, 2),
            "avg_hold_days": round(avg_hold_days, 1),
            "runners_over_20pct_count": runners_20pct,
            "runners_over_20pct_rate": round(runners_pct, 1),
            "runners_over_40pct_count": runners_40pct,
            "max_consecutive_wins": max_consec_wins,
            "exit_reasons": exit_counts,
            "top_trades": top_trades,
            "worst_trades": worst_trades,
            "raw_trades": trades,
        }


if __name__ == "__main__":
    backtester = StaircaseBacktester(symbols=BACKTEST_UNIVERSE, period="2y")
    data = backtester.fetch_data()
    results = backtester.run_backtest(data)

    output_path = Path("backend/data/staircase_backtest_results.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        # Save summary without full raw trades to keep file compact
        summary = {k: v for k, v in results.items() if k != "raw_trades"}
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 70)
    print("STAIRCASE MOMENTUM / CUPID ARCHETYPE - 2-YEAR QUANT BACKTEST RESULTS")
    print("=" * 70)
    print(f"Total Completed Trades:      {results['total_trades']}")
    print(f"Win Rate:                    {results['win_rate_pct']}%")
    print(f"Profit Factor:               {results['profit_factor']}")
    print(f"Average Trade Return:        {results['avg_return_pct']}%")
    print(f"Median Trade Return:         {results['median_return_pct']}%")
    print(f"Average Win:                 +{results['avg_win_pct']}%")
    print(f"Average Loss:                {results['avg_loss_pct']}%")
    print(f"Win/Loss Realized Ratio:     {results['win_loss_ratio']}:1")
    print(f"Average Peak Run-Up (MFE):   +{results['avg_mfe_pct']}%")
    print(f"Average Drawdown (MAE):      {results['avg_mae_pct']}%")
    print(f"Average Holding Period:      {results['avg_hold_days']} trading days")
    print(f"Trades with > +20% Return:   {results['runners_over_20pct_count']} ({results['runners_over_20pct_rate']}%)")
    print(f"Trades with > +40% Return:   {results['runners_over_40pct_count']}")
    print(f"Exit Reasons Breakdown:      {results['exit_reasons']}")
    print("\nTOP 5 WINNING TRADES:")
    for t in results.get("top_trades", [])[:5]:
        print(f"  • {t['symbol']} | Entry: {t['entry_date']} (₹{t['entry_price']}) -> Exit: {t['exit_date']} (₹{t['exit_price']}) | Return: +{t['return_pct']}% in {t['hold_days']}d (Peak MFE: +{t['mfe_pct']}%)")
    print("=" * 70)
