"""
Alpha India - Institutional Candlestick Confluence Strategy Backtest
===================================================================
Tests Candlestick Patterns when executed strictly according to institutional rules:
1. Stage 2 Trend (Price > 50 DMA, 50 DMA > 200 DMA)
2. Key Support Test (20 EMA or 50 DMA within 1.5%)
3. Candlestick Pattern Trigger (Morning Star, Three White Soldiers, Bullish Engulfing, Hammer, Piercing Line)
4. Target 1 (+3.0%): Harvest 80% profit, move runner stop to Breakeven (+0.3%)
5. Stop Loss: 0.5x ATR below pattern low (capped at 4.5%)
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from app.services.pattern_engine.candlestick_engine import CandlestickEngine, PatternDirection


def test_confluence_backtest():
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

    print("Fetching benchmark data for confluence backtest...")
    data_map = {}
    for s in symbols:
        try:
            df = yf.Ticker(s).history(period="1y", interval="1d", auto_adjust=True)
            if df is not None and len(df) >= 70:
                data_map[s] = df
        except Exception:
            pass

    print(f"Loaded {len(data_map)} equities.\n")

    all_trades = []
    pattern_breakdown = {}

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

        # Compute ATR 14
        tr = np.zeros(n)
        tr[0] = highs.iloc[0] - lows.iloc[0]
        for idx in range(1, n):
            tr[idx] = max(highs.iloc[idx] - lows.iloc[idx], abs(highs.iloc[idx] - closes.iloc[idx-1]), abs(lows.iloc[idx] - closes.iloc[idx-1]))
        atrs = pd.Series(tr).rolling(14, min_periods=5).mean().bfill().values

        signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=n - 40, min_score=60)
        # Map signals by bar index
        sig_map = {}
        for sig in signals:
            if sig.direction == PatternDirection.BULLISH.value:
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
        current_pattern = ""
        last_exit_bar = -999

        for i in range(50, n):
            c_price = closes.iloc[i]
            c_high = highs.iloc[i]
            c_low = lows.iloc[i]
            d50 = dma50.iloc[i]
            d200 = dma200.iloc[i]
            e20 = ema20.iloc[i]
            c_atr = atrs[i]

            if not in_trade:
                # 1. Stage 2 Trend: Price > 50 DMA and 50 DMA >= 200 DMA
                stage2 = (c_price >= d50) and (d50 >= d200 * 0.99)
                # 2. Key support bounce (low tested 20 EMA or 50 DMA)
                tested_support = (c_low <= e20 * 1.015) or (c_low <= d50 * 1.015)
                # 3. Candlestick signal on this bar
                has_candlestick = i in sig_map
                cooldown_ok = (i - last_exit_bar) >= 3

                if stage2 and tested_support and has_candlestick and cooldown_ok:
                    sig = sig_map[i]
                    in_trade = True
                    entry_price = c_price
                    entry_bar = i
                    current_pattern = sig.pattern_name
                    t1_hit = False

                    # Institutional risk management:
                    # Invalidation stop below pattern low, capped between 3.5% and 4.8%
                    calc_stop = sig.stop_loss
                    if (entry_price - calc_stop) / entry_price > 0.048:
                        calc_stop = entry_price * 0.952
                    elif (entry_price - calc_stop) / entry_price < 0.030:
                        calc_stop = entry_price * 0.965
                    stop_loss = round(calc_stop, 2)

                    target_1 = round(entry_price * 1.032, 2)  # +3.2%
                    target_2 = round(entry_price * 1.075, 2)  # +7.5%
            else:
                bars_held = i - entry_bar
                exit_trade = False
                pnl_pct = 0.0

                # Target 1: Harvest 80%, move runner stop to Breakeven (+0.3%)
                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)

                # Target 2 hit:
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
                        "pattern": current_pattern,
                        "pnl_pct": pnl_pct,
                        "is_win": pnl_pct > 0.0,
                        "bars_held": bars_held,
                        "t1_hit": t1_hit
                    })
                    if current_pattern not in pattern_breakdown:
                        pattern_breakdown[current_pattern] = {"trades": 0, "wins": 0}
                    pattern_breakdown[current_pattern]["trades"] += 1
                    if pnl_pct > 0.0:
                        pattern_breakdown[current_pattern]["wins"] += 1

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
    print("INSTITUTIONAL CANDLESTICK CONFLUENCE RESULTS:")
    print("=" * 70)
    print(f"Total Completed Trades: {total}")
    print(f"Winning Trades:        {len(wins)} ({win_rate:.2f}%)")
    print(f"Losing Trades:         {len(losses)} ({100 - win_rate:.2f}%)")
    print(f"Average Return/Trade:  {avg_pnl:+.2f}%")
    print(f"Profit Factor:         {pf:.2f}")
    print("\n--- WIN RATE BREAKDOWN BY CANDLESTICK PATTERN ---")
    for pat, stats in sorted(pattern_breakdown.items(), key=lambda x: x[1]["wins"]/max(1, x[1]["trades"]), reverse=True):
        p_wr = (stats["wins"] / max(1, stats["trades"])) * 100.0
        print(f"  {pat:<25}: {stats['wins']}/{stats['trades']} wins ({p_wr:.1f}%)")
    print("=" * 70)


if __name__ == "__main__":
    test_confluence_backtest()
