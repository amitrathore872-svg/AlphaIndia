"""
Alpha India - Nifty 500 Candlestick-Enhanced FX Swing Backtest
=============================================================
Compares:
A) Baseline 12 FX Swing Strategy (Generic green bar bounce)
B) Candlestick-Enhanced FX Swing Strategy (Validated 1-bar, 2-bar, and 3-bar reversal patterns:
   Morning Star, Three White Soldiers, Bullish Engulfing, Three Inside/Outside Up, Hammer, Piercing Line)

Evaluates Win Rate (%), Total Trades, Profit Factor, and Average Trade Return over 1-year daily bars.
"""

import os
import sys
import time
import json
import logging
from typing import Dict, Any, List, Tuple
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

# Setup path to import backend modules
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from app.services.pattern_engine.candlestick_engine import CandlestickEngine, PatternDirection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Candlestick_Backtest")


def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    high = df['High'].values
    low = df['Low'].values
    close = df['Close'].values
    n = len(df)
    if n < period:
        return close, np.ones(n, dtype=int), np.zeros(n)
        
    tr = np.zeros(n)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i-1]), abs(low[i] - close[i-1]))
        
    atr = pd.Series(tr).rolling(period).mean().bfill().fillna(1.0).values
    hl2 = (high + low) / 2.0
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)
    
    final_upper = np.copy(basic_upper)
    final_lower = np.copy(basic_lower)
    supertrend = np.zeros(n)
    direction = np.zeros(n, dtype=int)
    
    for i in range(1, n):
        if basic_upper[i] < final_upper[i-1] or close[i-1] > final_upper[i-1]:
            final_upper[i] = basic_upper[i]
        else:
            final_upper[i] = final_upper[i-1]
            
        if basic_lower[i] > final_lower[i-1] or close[i-1] < final_lower[i-1]:
            final_lower[i] = basic_lower[i]
        else:
            final_lower[i] = final_lower[i-1]
            
        if i == 1:
            direction[i] = 1 if close[i] > final_upper[i] else -1
        else:
            if direction[i-1] == 1:
                if close[i] < final_lower[i]:
                    direction[i] = -1
                    supertrend[i] = final_upper[i]
                else:
                    direction[i] = 1
                    supertrend[i] = final_lower[i]
            else:
                if close[i] > final_upper[i]:
                    direction[i] = 1
                    supertrend[i] = final_lower[i]
                else:
                    direction[i] = -1
                    supertrend[i] = final_upper[i]
                    
    return supertrend, direction, atr


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)


def backtest_symbol(df: pd.DataFrame, sym: str, use_candlestick_filter: bool = False) -> List[Dict[str, Any]]:
    if df is None or len(df) < 60:
        return []
        
    closes = df["Close"].astype(float)
    highs = df["High"].astype(float)
    lows = df["Low"].astype(float)
    opens = df["Open"].astype(float)
    volumes = df["Volume"].astype(float)
    n = len(df)

    # Technical Indicators
    dma50 = closes.rolling(50, min_periods=20).mean().bfill()
    dma200 = closes.rolling(200, min_periods=30).mean().bfill()
    ema20 = closes.ewm(span=20, adjust=False).mean()
    ema9 = closes.ewm(span=9, adjust=False).mean()
    vol_sma20 = volumes.rolling(20, min_periods=5).mean().bfill()
    rsi14 = calculate_rsi(closes, 14)
    supertrend_vals, supertrend_dirs, atrs = calculate_supertrend(df, 10, 3.0)

    # Fast pre-calculation of candlestick patterns if enabled
    candle_bullish_bars = set()
    if use_candlestick_filter:
        signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=n - 30, min_score=65)
        for sig in signals:
            if sig.direction == PatternDirection.BULLISH.value:
                # Find matching bar index by timestamp
                ts_str = sig.timestamp
                for idx, t in enumerate(df.index):
                    if str(t)[:10] == ts_str:
                        candle_bullish_bars.add(idx)

    trades = []
    in_trade = False
    entry_price = 0.0
    entry_bar = 0
    stop_loss = 0.0
    target_1 = 0.0
    target_2 = 0.0
    t1_hit = False
    last_exit_bar = -999

    for i in range(50, n):
        c_price = closes.iloc[i]
        c_high = highs.iloc[i]
        c_low = lows.iloc[i]
        c_open = opens.iloc[i]
        c_vol = volumes.iloc[i]
        c_atr = atrs[i]

        d50 = dma50.iloc[i]
        d200 = dma200.iloc[i]
        e20 = ema20.iloc[i]
        v_ma = vol_sma20.iloc[i]
        r14 = rsi14.iloc[i]
        st_d = supertrend_dirs[i]

        if not in_trade:
            # 1. Base Trend & Support condition
            is_uptrend = (c_price >= d50) and (d50 >= d200 * 0.98) and (st_d == 1)
            is_healthy_rsi = (42.0 <= r14 <= 68.0)
            tested_support = (c_low <= e20 * 1.015) or (c_low <= d50 * 1.015)
            cooldown_ok = (i - last_exit_bar) >= 3

            # 2. Trigger verification
            if use_candlestick_filter:
                # Must have confirmed high-probability candlestick pattern
                trigger_ok = (i in candle_bullish_bars)
            else:
                # Standard generic green bounce
                p_close = closes.iloc[i-1]
                p_high = highs.iloc[i-1]
                close_loc = (c_price - c_low) / max(1e-4, (c_high - c_low))
                trigger_ok = (c_price >= c_open) and (close_loc >= 0.52) and (c_high >= p_high) and (c_price > p_close)

            if is_uptrend and is_healthy_rsi and tested_support and trigger_ok and cooldown_ok:
                in_trade = True
                entry_price = c_price
                entry_bar = i
                t1_hit = False

                # Stop loss
                sw_low = float(lows.iloc[max(0, i-4):i+1].min())
                stop_loss = round(max(sw_low - (0.5 * c_atr), entry_price * 0.955), 2)
                target_1 = round(entry_price * 1.032, 2)  # +3.2%
                target_2 = round(entry_price * 1.075, 2)  # +7.5%
        else:
            bars_held = i - entry_bar
            exit_trade = False
            pnl_pct = 0.0

            # Target 1: Harvest 80%, trail runner stop to +0.3%
            if not t1_hit and c_high >= target_1:
                t1_hit = True
                stop_loss = round(entry_price * 1.003, 2)

            # Target 2: Runner exit
            if c_high >= target_2:
                exit_trade = True
                t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                t2_pnl = (target_2 - entry_price) / entry_price * 100.0
                pnl_pct = round((t1_pnl * 0.8) + (t2_pnl * 0.2), 2)
            elif c_low <= stop_loss:
                exit_trade = True
                if t1_hit:
                    t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                    pnl_pct = round(t1_pnl * 0.8, 2)
                else:
                    pnl_pct = round((stop_loss - entry_price) / entry_price * 100.0, 2)
            elif st_d == -1 and c_price < e20:
                exit_trade = True
                exit_pnl = (c_price - entry_price) / entry_price * 100.0
                if t1_hit:
                    t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                    pnl_pct = round((t1_pnl * 0.8) + (exit_pnl * 0.2), 2)
                else:
                    pnl_pct = round(exit_pnl, 2)
            elif bars_held >= 12:
                exit_trade = True
                exit_pnl = (c_price - entry_price) / entry_price * 100.0
                if t1_hit:
                    t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                    pnl_pct = round((t1_pnl * 0.8) + (exit_pnl * 0.2), 2)
                else:
                    pnl_pct = round(exit_pnl, 2)

            if exit_trade:
                trades.append({
                    "symbol": sym,
                    "pnl_pct": pnl_pct,
                    "is_win": pnl_pct > 0.0,
                    "bars_held": bars_held,
                })
                in_trade = False
                last_exit_bar = i

    return trades


def run_comparison():
    print("=" * 70)
    print("ALPHA INDIA: CANDLESTICK RECOGNITION BACKTEST ON LIQUID EQUITIES")
    print("=" * 70)

    # Representative diverse equities across sectors
    symbols = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "LICI.NS", "ITC.NS", "HINDUNILVR.NS",
        "LT.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS",
        "TATAMOTORS.NS", "AXISBANK.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS",
        "KOTAKBANK.NS", "ADANIENT.NS", "COALINDIA.NS", "BAJAJFINSV.NS", "ZOMATO.NS",
        "HAL.NS", "BEL.NS", "VBL.NS", "TRENT.NS", "DLF.NS",
        "VEDL.NS", "JSWSTEEL.NS", "TATASTEEL.NS", "SIEMENS.NS", "ABB.NS",
        "CHOLAFIN.NS", "DIVISLAB.NS", "CIPLA.NS", "DRREDDY.NS", "EICHERMOT.NS"
    ]

    print(f"Downloading historical 1-year OHLCV for {len(symbols)} benchmark equities...")
    data_map = {}
    for s in symbols:
        try:
            t = yf.Ticker(s)
            df = t.history(period="1y", interval="1d", auto_adjust=True)
            if df is not None and len(df) >= 60:
                data_map[s] = df
        except Exception as e:
            logger.warning(f"Failed to fetch {s}: {e}")

    print(f"Successfully loaded {len(data_map)} equities with valid historical bars.\n")

    # Run Baseline Backtest
    baseline_trades = []
    for s, df in data_map.items():
        baseline_trades.extend(backtest_symbol(df, s, use_candlestick_filter=False))

    # Run Candlestick-Enhanced Backtest
    candlestick_trades = []
    for s, df in data_map.items():
        candlestick_trades.extend(backtest_symbol(df, s, use_candlestick_filter=True))

    def summarize(trades: List[Dict[str, Any]], label: str):
        total = len(trades)
        if total == 0:
            print(f"[{label}] No trades generated.")
            return {}
        wins = [t for t in trades if t["is_win"]]
        losses = [t for t in trades if not t["is_win"]]
        win_rate = (len(wins) / total) * 100.0
        avg_pnl = np.mean([t["pnl_pct"] for t in trades])
        
        gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0.0
        gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 1e-4
        profit_factor = gross_profit / max(1e-4, gross_loss)

        print(f"--- {label} ---")
        print(f"Total Completed Trades: {total}")
        print(f"Winning Trades:        {len(wins)} ({win_rate:.2f}%)")
        print(f"Losing Trades:         {len(losses)} ({100 - win_rate:.2f}%)")
        print(f"Average PnL per Trade: {avg_pnl:+.2f}%")
        print(f"Profit Factor:         {profit_factor:.2f}")
        print()
        return {
            "total": total,
            "win_rate": round(win_rate, 2),
            "avg_pnl": round(avg_pnl, 2),
            "profit_factor": round(profit_factor, 2)
        }

    res_base = summarize(baseline_trades, "BASELINE 12 FX STRATEGY (Generic Bounce)")
    res_candle = summarize(candlestick_trades, "CANDLESTICK-ENHANCED FX STRATEGY (Triple/Double Patterns)")

    if res_base and res_candle:
        wr_diff = res_candle["win_rate"] - res_base["win_rate"]
        pf_diff = res_candle["profit_factor"] - res_base["profit_factor"]
        print("=" * 70)
        print(f"CANDLESTICK IMPACT SUMMARY:")
        print(f"  Win-Rate Change:     {wr_diff:+.2f}% points ({res_base['win_rate']}% -> {res_candle['win_rate']}%)")
        print(f"  Profit Factor Boost: {pf_diff:+.2f} ({res_base['profit_factor']} -> {res_candle['profit_factor']})")
        print("=" * 70)


if __name__ == "__main__":
    run_comparison()
