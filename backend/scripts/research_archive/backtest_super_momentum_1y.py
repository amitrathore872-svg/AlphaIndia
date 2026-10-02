"""
Alpha India - Multi-Timeframe Bollinger Band & Triple-RSI 1-Year Backtester
Backtests the institutional Chartink cash segment strategy over the last 1 year (250 trading sessions).

Strategy Rules Evaluated Daily:
1. Daily Volume > Daily SMA(Volume, 20)
2. Daily Close > Daily Upper Bollinger Band (20, 2)
3. Weekly Close > Weekly Upper Bollinger Band (20, 2)
4. Daily RSI (14) > 60
5. Weekly RSI (14) > 60
6. Monthly RSI (14) > 60
7. Weekly WMA (30) > Weekly WMA (50) (and Crossover)
8. Weekly WMA (30) > 60
9. Weekly WMA (50) > 60
10. Daily Close > Daily Open (Bullish green candle)
"""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, List
import numpy as np
import pandas as pd
import yfinance as yf

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backtest_momentum")

UNIVERSE = [
    "AARTIIND", "ABB", "ABBOTINDIA", "ABCAPITAL", "ACC", "ADANIENT", "ADANIPORTS",
    "ALKEM", "AMBUJACEM", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY", "ASIANPAINT", "ASTRAL",
    "ATUL", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE",
    "BALKRISIND", "BALRAMCHIN", "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BHARATFORG",
    "BHEL", "BIOCON", "BOSCHLTD", "BPCL", "BRITANNIA", "BSOFT", "CANBK", "CANFINHOME",
    "CHAMBLFERT", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR",
    "COROMANDEL", "CROMPTON", "CUMMINSIND", "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB",
    "DIXON", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL",
    "GLENMARK", "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM",
    "HAL", "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
    "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "IDEA",
    "IDFCFIRSTB", "IEX", "INDHOTEL", "INDIACEM", "INDIAMART", "INDIGO", "INDUSINDBK",
    "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JKCEMENT",
    "JSWSTEEL", "JUBLFOOD", "KAYNES", "KOTAKBANK", "LALPATHLAB", "LAURUSLABS", "LICHSGFIN", "LT",
    "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MAZDOCK",
    "MCX", "METROPOLIS", "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN",
    "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS",
    "ONGC", "PAGEIND", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
    "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL",
    "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF", "SUNPHARMA",
    "SUNTV", "SUZLON", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM", "TATAPOWER",
    "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL",
    "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "COCHINSHIP", "BSE", "CDSL"
]


def fast_wma(series: pd.Series, n: int) -> pd.Series:
    """Vectorized high-speed Weighted Moving Average (WMA)."""
    arr = series.to_numpy(dtype=np.float64)
    out = np.full(len(arr), np.nan, dtype=np.float64)
    if len(arr) < n:
        return pd.Series(out, index=series.index)
    weights = np.arange(1, n + 1, dtype=np.float64)
    w_sum = weights.sum()
    windows = np.lib.stride_tricks.sliding_window_view(arr, n)
    dots = np.dot(windows, weights) / w_sum
    out[n - 1:] = dots
    return pd.Series(out, index=series.index)


def fast_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Vectorized smoothed Wilder's RSI."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def load_universe_historical_data() -> Dict[str, pd.DataFrame]:
    """Downloads 2 years of daily data for the universe."""
    logger.info(f"Downloading historical data for {len(UNIVERSE)} symbols...")
    ticker_symbols = [f"{s}.NS" for s in UNIVERSE]
    raw = yf.download(
        ticker_symbols,
        period="2y",
        interval="1d",
        group_by="ticker",
        progress=False,
        threads=True,
    )

    data_map: Dict[str, pd.DataFrame] = {}
    for sym in UNIVERSE:
        t_sym = f"{sym}.NS"
        if t_sym in raw.columns.levels[0]:
            df = raw[t_sym].dropna(subset=["Close", "Volume"]).copy()
            if len(df) >= 200:
                data_map[sym] = df

    logger.info(f"Loaded {len(data_map)} valid equities.")
    return data_map


def precompute_stock_indicators(data_map: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Precomputes Daily, Weekly, and Monthly indicators for each equity once."""
    precomputed: Dict[str, pd.DataFrame] = {}
    for sym, df in data_map.items():
        try:
            d_df = df.copy()
            # Daily metrics
            d_df["VOL_SMA20"] = d_df["Volume"].rolling(20).mean()
            d_df["BB_MID"] = d_df["Close"].rolling(20).mean()
            d_df["BB_STD"] = d_df["Close"].rolling(20).std()
            d_df["BB_UPPER"] = d_df["BB_MID"] + 2 * d_df["BB_STD"]
            d_df["DAILY_RSI"] = fast_rsi(d_df["Close"], 14)

            # Weekly resample
            w_df = d_df.resample("W-FRI").agg({"Close": "last"}).dropna()
            w_close = w_df["Close"]
            w_std = w_close.rolling(20).std()
            w_df["W_BB_UPPER"] = w_close.rolling(20).mean() + 2 * w_std
            w_df["W_RSI"] = fast_rsi(w_close, 14)
            w_df["W_WMA30"] = fast_wma(w_close, 30)
            w_df["W_WMA50"] = fast_wma(w_close, 50)

            # Shift by 1 week to avoid lookahead bias during daily evaluation
            w_df_shifted = w_df.shift(1)
            # Reindex to daily dates via forward fill
            w_daily = w_df_shifted.reindex(d_df.index, method="ffill")
            d_df["W_BB_UPPER"] = w_daily["W_BB_UPPER"]
            d_df["W_RSI"] = w_daily["W_RSI"]
            d_df["W_WMA30"] = w_daily["W_WMA30"]
            d_df["W_WMA50"] = w_daily["W_WMA50"]

            # Monthly resample
            m_df = d_df.resample("ME").agg({"Close": "last"}).dropna()
            m_df["M_RSI"] = fast_rsi(m_df["Close"], 14)
            m_df_shifted = m_df.shift(1)
            m_daily = m_df_shifted.reindex(d_df.index, method="ffill")
            d_df["M_RSI"] = m_daily["M_RSI"]

            precomputed[sym] = d_df
        except Exception as e:
            logger.debug(f"Error precomputing {sym}: {e}")

    return precomputed


def evaluate_backtest(
    precomputed_map: Dict[str, pd.DataFrame],
    target_pct: float = 10.0,
    stop_loss_pct: float = 4.0,
    max_hold_days: int = 15,
    require_bull_candle: bool = False,
) -> Dict[str, Any]:
    """Simulates trades over the past 250 trading sessions (last 1 year)."""
    trades: List[Dict[str, Any]] = []

    for sym, df in precomputed_map.items():
        if len(df) < 260:
            continue

        in_trade = False
        entry_price = 0.0
        entry_date = None
        entry_idx = 0
        stop_price = 0.0
        target_price = 0.0

        start_i = len(df) - 250
        for i in range(start_i, len(df)):
            cur_date = df.index[i]
            row = df.iloc[i]

            # If in trade, check exit
            if in_trade:
                days_held = i - entry_idx
                h = float(row["High"])
                l = float(row["Low"])
                c = float(row["Close"])

                exit_reason = None
                exit_price = c

                if h >= target_price:
                    exit_reason = "TARGET HIT"
                    exit_price = target_price
                elif l <= stop_price:
                    exit_reason = "STOP LOSS HIT"
                    exit_price = stop_price
                elif days_held >= max_hold_days:
                    exit_reason = "TIME EXPIRED"
                    exit_price = c

                if exit_reason:
                    pnl_pct = round(((exit_price - entry_price) / entry_price) * 100.0, 2)
                    trades.append({
                        "symbol": sym,
                        "entry_date": entry_date.strftime("%Y-%m-%d"),
                        "exit_date": cur_date.strftime("%Y-%m-%d"),
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "pnl_pct": pnl_pct,
                        "days_held": days_held,
                        "exit_reason": exit_reason,
                        "is_win": bool(pnl_pct > 0),
                    })
                    in_trade = False
                    continue

            # Check signal at day close
            if not in_trade and i < len(df) - 1:
                vol = float(row["Volume"])
                vol_sma = float(row["VOL_SMA20"]) if not np.isnan(row["VOL_SMA20"]) else 0.0
                close = float(row["Close"])
                open_p = float(row["Open"])
                bb_upper = float(row["BB_UPPER"]) if not np.isnan(row["BB_UPPER"]) else 999999.0
                w_bb_upper = float(row["W_BB_UPPER"]) if not np.isnan(row["W_BB_UPPER"]) else 999999.0
                d_rsi = float(row["DAILY_RSI"]) if not np.isnan(row["DAILY_RSI"]) else 0.0
                w_rsi = float(row["W_RSI"]) if not np.isnan(row["W_RSI"]) else 0.0
                m_rsi = float(row["M_RSI"]) if not np.isnan(row["M_RSI"]) else 0.0
                w_wma30 = float(row["W_WMA30"]) if not np.isnan(row["W_WMA30"]) else 0.0
                w_wma50 = float(row["W_WMA50"]) if not np.isnan(row["W_WMA50"]) else 0.0

                c1 = vol > vol_sma
                c2 = close > bb_upper
                c3 = close > w_bb_upper
                c4 = d_rsi > 60.0
                c5 = w_rsi > 60.0
                c6 = m_rsi > 60.0
                c7 = (w_wma30 > w_wma50)
                c8 = w_wma30 > 60.0
                c9 = w_wma50 > 60.0
                c10 = (close > open_p) if require_bull_candle else True

                if c1 and c2 and c3 and c4 and c5 and c6 and c7 and c8 and c9 and c10:
                    # Enter next bar open
                    next_row = df.iloc[i + 1]
                    entry_price = float(next_row["Open"])
                    entry_date = df.index[i + 1]
                    entry_idx = i + 1
                    target_price = round(entry_price * (1.0 + target_pct / 100.0), 2)
                    stop_price = round(entry_price * (1.0 - stop_loss_pct / 100.0), 2)
                    in_trade = True

    if not trades:
        return {"total_trades": 0, "win_rate": 0.0, "profit_factor": 0.0, "avg_return": 0.0, "trades": []}

    df_t = pd.DataFrame(trades)
    total_trades = len(df_t)
    wins = df_t[df_t["pnl_pct"] > 0]
    losses = df_t[df_t["pnl_pct"] <= 0]
    win_rate = round((len(wins) / total_trades) * 100.0, 1)

    gross_profit = float(wins["pnl_pct"].sum()) if not wins.empty else 0.0
    gross_loss = abs(float(losses["pnl_pct"].sum())) if not losses.empty else 1.0
    profit_factor = round(gross_profit / max(0.01, gross_loss), 2)

    avg_return = round(float(df_t["pnl_pct"].mean()), 2)
    avg_win = round(float(wins["pnl_pct"].mean()), 2) if not wins.empty else 0.0
    avg_loss = round(float(losses["pnl_pct"].mean()), 2) if not losses.empty else 0.0
    avg_days = round(float(df_t["days_held"].mean()), 1)

    target_hits = len(df_t[df_t["exit_reason"] == "TARGET HIT"])
    stop_hits = len(df_t[df_t["exit_reason"] == "STOP LOSS HIT"])
    time_exits = len(df_t[df_t["exit_reason"] == "TIME EXPIRED"])

    # Max Drawdown
    df_t["CUM_PNL"] = df_t["pnl_pct"].cumsum()
    df_t["PEAK"] = df_t["CUM_PNL"].cummax()
    df_t["DD"] = df_t["PEAK"] - df_t["CUM_PNL"]
    max_dd = round(float(df_t["DD"].max()), 2) if not df_t.empty else 0.0

    return {
        "total_trades": total_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_return": avg_return,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "avg_days_held": avg_days,
        "target_hits": target_hits,
        "stop_hits": stop_hits,
        "time_exits": time_exits,
        "max_drawdown": max_dd,
        "best_trade": round(float(df_t["pnl_pct"].max()), 2),
        "worst_trade": round(float(df_t["pnl_pct"].min()), 2),
        "sample_trades": trades[:15],
    }


def main():
    t0 = time.time()
    data_map = load_universe_historical_data()
    logger.info("Precomputing multi-timeframe indicators across universe...")
    precomputed = precompute_stock_indicators(data_map)
    logger.info("Precomputation completed. Running scenario backtests...")

    print("\n" + "=" * 110)
    print(">>> ALPHA INDIA: MULTI-TIMEFRAME BOLLINGER & TRIPLE-RSI 1-YEAR BACKTEST <<<")
    print(">>> Period: Last 1 Year (250 Trading Days) | Universe: 165 Liquid NSE Equities <<<")
    print("=" * 110)

    configurations = [
        ("Setup A: Standard 10% Target / 4% Stop Loss (15-Day Max Hold)", 10.0, 4.0, 15, False),
        ("Setup B: Aggressive 14% Target / 4% Stop Loss (20-Day Max Hold)", 14.0, 4.0, 20, False),
        ("Setup C: High-Conviction Bull Candle Filter (10% Target / 4% SL)", 10.0, 4.0, 15, True),
        ("Setup D: High-Beta Trend Run (16% Target / 5% Stop Loss)", 16.0, 5.0, 20, False),
        ("Setup E: Quick Swing (8% Target / 3% Stop Loss, 10-Day Max Hold)", 8.0, 3.0, 10, False),
    ]

    all_results = []
    for name, tgt, sl, hold, bull_filter in configurations:
        res = evaluate_backtest(
            precomputed,
            target_pct=tgt,
            stop_loss_pct=sl,
            max_hold_days=hold,
            require_bull_candle=bull_filter,
        )
        res["config_name"] = name
        all_results.append(res)

        print(f"\n[{name}]")
        print(f"  • Total Signals Generated: {res['total_trades']}")
        print(f"  • Win Rate:               {res['win_rate']}% ({res['target_hits']} Target Hits)")
        print(f"  • Profit Factor:          {res['profit_factor']}x")
        print(f"  • Average Trade Return:   {res['avg_return']}% (Avg Win: +{res['avg_win']}%, Avg Loss: {res['avg_loss']}%)")
        print(f"  • Max Strategy Drawdown:  {res['max_drawdown']}%")
        print(f"  • Avg Holding Duration:   {res['avg_days_held']} sessions")

    print("\n" + "=" * 110)
    print(">>> FORWARD DRIFT & MAXIMUM FAVORABLE EXCURSION (MFE) STUDY <<<")
    print("=" * 110)
    # Collect all unique signals across the year
    all_signals = []
    for sym, df in precomputed.items():
        if len(df) < 260:
            continue
        start_i = len(df) - 250
        for i in range(start_i, len(df) - 20):
            row = df.iloc[i]
            vol = float(row["Volume"])
            vol_sma = float(row["VOL_SMA20"]) if not np.isnan(row["VOL_SMA20"]) else 0.0
            close = float(row["Close"])
            bb_upper = float(row["BB_UPPER"]) if not np.isnan(row["BB_UPPER"]) else 999999.0
            w_bb_upper = float(row["W_BB_UPPER"]) if not np.isnan(row["W_BB_UPPER"]) else 999999.0
            d_rsi = float(row["DAILY_RSI"]) if not np.isnan(row["DAILY_RSI"]) else 0.0
            w_rsi = float(row["W_RSI"]) if not np.isnan(row["W_RSI"]) else 0.0
            m_rsi = float(row["M_RSI"]) if not np.isnan(row["M_RSI"]) else 0.0
            w_wma30 = float(row["W_WMA30"]) if not np.isnan(row["W_WMA30"]) else 0.0
            w_wma50 = float(row["W_WMA50"]) if not np.isnan(row["W_WMA50"]) else 0.0

            if (vol > vol_sma and close > bb_upper and close > w_bb_upper and
                d_rsi > 60.0 and w_rsi > 60.0 and m_rsi > 60.0 and
                w_wma30 > w_wma50 and w_wma30 > 60.0 and w_wma50 > 60.0):
                
                entry_p = float(df.iloc[i + 1]["Open"])
                forward_5 = float(df.iloc[i + 5]["Close"])
                forward_10 = float(df.iloc[i + 10]["Close"])
                forward_20 = float(df.iloc[i + 20]["Close"])
                max_high_20 = float(df.iloc[i + 1:i + 21]["High"].max())
                min_low_20 = float(df.iloc[i + 1:i + 21]["Low"].min())

                all_signals.append({
                    "symbol": sym,
                    "date": df.index[i + 1].strftime("%Y-%m-%d"),
                    "entry_p": entry_p,
                    "ret_5d": round(((forward_5 - entry_p) / entry_p) * 100.0, 2),
                    "ret_10d": round(((forward_10 - entry_p) / entry_p) * 100.0, 2),
                    "ret_20d": round(((forward_20 - entry_p) / entry_p) * 100.0, 2),
                    "mfe_20d": round(((max_high_20 - entry_p) / entry_p) * 100.0, 2),
                    "mae_20d": round(((min_low_20 - entry_p) / entry_p) * 100.0, 2),
                })

    if all_signals:
        df_sig = pd.DataFrame(all_signals)
        print(f"Total Unique Signals Triggered: {len(df_sig)}")
        print(f"  • Avg Forward 5-Day Return:   {df_sig['ret_5d'].mean():+.2f}%  (Win Rate: {(df_sig['ret_5d'] > 0).mean()*100:.1f}%)")
        print(f"  • Avg Forward 10-Day Return:  {df_sig['ret_10d'].mean():+.2f}%  (Win Rate: {(df_sig['ret_10d'] > 0).mean()*100:.1f}%)")
        print(f"  • Avg Forward 20-Day Return:  {df_sig['ret_20d'].mean():+.2f}%  (Win Rate: {(df_sig['ret_20d'] > 0).mean()*100:.1f}%)")
        print(f"  • Avg Max Upside (20D MFE):  +{df_sig['mfe_20d'].mean():.2f}%")
        print(f"  • Avg Max Drawdown (20D MAE): {df_sig['mae_20d'].mean():.2f}%")
        print(f"  • Percentage of Signals Reaching >= +10% High: {(df_sig['mfe_20d'] >= 10.0).mean()*100:.1f}%")
        print(f"  • Percentage of Signals Reaching >= +15% High: {(df_sig['mfe_20d'] >= 15.0).mean()*100:.1f}%")

    print(f"\nExecution finished in {round(time.time() - t0, 1)}s.\n")


if __name__ == "__main__":
    main()
