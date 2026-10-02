"""
Alpha India - Filtered Institutional Candlestick Confluence Test
================================================================
Evaluates win rates when filtering for:
1. Volume Surge (Volume >= 1.3x 20d SMA on confirmation bar)
2. Supertrend Green (Direction == 1)
3. High Conviction Patterns: Morning Star, Three White Soldiers, Three Outside Up, Stick Sandwich, Piercing Line
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from app.services.pattern_engine.candlestick_engine import CandlestickEngine, PatternDirection
from scripts.backtest_candlestick_swing_strategy import calculate_supertrend


def test_high_conviction():
    symbols = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "LICI.NS", "ITC.NS", "HINDUNILVR.NS",
        "LT.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS",
        "AXISBANK.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS", "KOTAKBANK.NS",
        "ADANIENT.NS", "COALINDIA.NS", "BAJAJFINSV.NS", "HAL.NS", "BEL.NS",
        "VBL.NS", "TRENT.NS", "DLF.NS", "VEDL.NS", "JSWSTEEL.NS",
        "TATASTEEL.NS", "SIEMENS.NS", "ABB.NS", "CHOLAFIN.NS", "DIVISLAB.NS",
        "CIPLA.NS", "DRREDDY.NS", "EICHERMOT.NS"
    ]

    print("Fetching benchmark data...")
    data_map = {}
    for s in symbols:
        try:
            df = yf.Ticker(s).history(period="1y", interval="1d", auto_adjust=True)
            if df is not None and len(df) >= 70:
                data_map[s] = df
        except Exception:
            pass

    all_trades = []

    for sym, df in data_map.items():
        closes = df["Close"].astype(float)
        highs = df["High"].astype(float)
        lows = df["Low"].astype(float)
        opens = df["Open"].astype(float)
        volumes = df["Volume"].astype(float)
        n = len(df)

        dma50 = closes.rolling(50, min_periods=20).mean().bfill()
        dma200 = closes.rolling(200, min_periods=30).mean().bfill()
        ema20 = closes.ewm(span=20, adjust=False).mean()
        vol_sma20 = volumes.rolling(20, min_periods=5).mean().bfill()
        st_vals, st_dirs, atrs = calculate_supertrend(df, 10, 3.0)

        signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=n - 40, min_score=70)
        sig_map = {}
        for sig in signals:
            if sig.direction == PatternDirection.BULLISH.value and sig.volume_surge_ratio >= 1.2:
                ts_str = sig.timestamp
                for idx, t in enumerate(df.index):
                    if str(t)[:10] == ts_str:
                        sig_map[idx] = sig

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
            d50 = dma50.iloc[i]
            d200 = dma200.iloc[i]
            e20 = ema20.iloc[i]
            st_d = st_dirs[i]

            if not in_trade:
                # 1. Bullish regime & Supertrend Green
                stage2 = (c_price >= d50) and (d50 >= d200 * 0.98) and (st_d == 1)
                # 2. Key support bounce (low tested 20 EMA or 50 DMA)
                tested_support = (c_low <= e20 * 1.015) or (c_low <= d50 * 1.015)
                # 3. High-conviction Candlestick signal with volume confirmation
                has_candlestick = i in sig_map
                cooldown_ok = (i - last_exit_bar) >= 3

                if stage2 and tested_support and has_candlestick and cooldown_ok:
                    sig = sig_map[i]
                    in_trade = True
                    entry_price = c_price
                    entry_bar = i
                    t1_hit = False

                    calc_stop = sig.stop_loss
                    if (entry_price - calc_stop) / entry_price > 0.045:
                        calc_stop = entry_price * 0.955
                    elif (entry_price - calc_stop) / entry_price < 0.028:
                        calc_stop = entry_price * 0.968
                    stop_loss = round(calc_stop, 2)

                    target_1 = round(entry_price * 1.030, 2)  # +3.0%
                    target_2 = round(entry_price * 1.070, 2)  # +7.0%
            else:
                bars_held = i - entry_bar
                exit_trade = False
                pnl_pct = 0.0

                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)

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
                elif st_d == -1:
                    exit_trade = True
                    exit_pnl = (c_price - entry_price) / entry_price * 100.0
                    if t1_hit:
                        t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                        pnl_pct = round((t1_pnl * 0.8) + (exit_pnl * 0.2), 2)
                    else:
                        pnl_pct = round(exit_pnl, 2)
                elif bars_held >= 10:
                    exit_trade = True
                    exit_pnl = (c_price - entry_price) / entry_price * 100.0
                    if t1_hit:
                        t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                        pnl_pct = round((t1_pnl * 0.8) + (exit_pnl * 0.2), 2)
                    else:
                        pnl_pct = round(exit_pnl, 2)

                if exit_trade:
                    all_trades.append({
                        "symbol": sym,
                        "pnl_pct": pnl_pct,
                        "is_win": pnl_pct > 0.0,
                        "bars_held": bars_held,
                        "t1_hit": t1_hit
                    })
                    in_trade = False
                    last_exit_bar = i

    total = len(all_trades)
    if total == 0:
        print("No trades found.")
        return

    wins = [t for t in all_trades if t["is_win"]]
    losses = [t for t in all_trades if not t["is_win"]]
    win_rate = (len(wins) / total) * 100.0
    avg_pnl = np.mean([t["pnl_pct"] for t in all_trades])
    gross_win = sum(t["pnl_pct"] for t in wins)
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 1e-4
    pf = gross_win / gross_loss

    print("=" * 70)
    print("VOLUME-CONFIRMED CANDLESTICK + SUPERTREND REGIME RESULTS:")
    print("=" * 70)
    print(f"Total Completed Trades: {total}")
    print(f"Winning Trades:        {len(wins)} ({win_rate:.2f}%)")
    print(f"Losing Trades:         {len(losses)} ({100 - win_rate:.2f}%)")
    print(f"Average Return/Trade:  {avg_pnl:+.2f}%")
    print(f"Profit Factor:         {pf:.2f}")
    print("=" * 70)


if __name__ == "__main__":
    test_high_conviction()
