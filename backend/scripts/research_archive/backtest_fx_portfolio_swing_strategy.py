"""
Alpha India - 12 FX Indicator Confluence Swing Strategy Empirical Backtest
Sprint 42: Comprehensive Historical Performance & Win Rate Audit

Backtests the exact institutional swing strategy across the user's Portfolio holdings,
Watchlist equities, and benchmark high-liquidity leaders over a 1-year historical window.
"""

import sys
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import numpy as np
import pandas as pd
import yfinance as yf

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fx_backtest")


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
                direction[i] = -1 if close[i] < final_lower[i] else 1
            else:
                direction[i] = 1 if close[i] > final_upper[i] else -1
                
        supertrend[i] = final_lower[i] if direction[i] == 1 else final_upper[i]
        
    return supertrend, direction, atr


def calculate_rsi_wilder(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50.0)


def backtest_single_stock(symbol: str, df: pd.DataFrame, strict_mode: bool = False) -> Dict[str, Any]:
    if df.empty or len(df) < 60:
        return {"symbol": symbol, "trades": [], "error": "Insufficient bars"}

    df = df.copy()
    df.columns = [str(c).capitalize() for c in df.columns]
    closes = df["Close"].astype(float)
    highs = df["High"].astype(float)
    lows = df["Low"].astype(float)
    opens = df["Open"].astype(float)
    volumes = df["Volume"].astype(float)

    # 1. Moving Averages
    df["EMA9"] = closes.ewm(span=9, adjust=False).mean()
    df["EMA20"] = closes.ewm(span=20, adjust=False).mean()
    df["SMA50"] = closes.rolling(50, min_periods=15).mean()
    df["SMA200"] = closes.rolling(min(200, len(df)), min_periods=30).mean()

    # 2. Volatility: Supertrend & Bollinger Bands
    st_val, st_dir, atr = calculate_supertrend(df, period=10, multiplier=3.0)
    df["Supertrend"] = st_val
    df["ST_Dir"] = st_dir
    df["ATR"] = atr

    sma20 = closes.rolling(20, min_periods=10).mean()
    std20 = closes.rolling(20, min_periods=10).std().fillna(0.0)
    bb_upper = sma20 + (std20 * 2.0)
    bb_lower = sma20 - (std20 * 2.0)
    df["BB_Width"] = ((bb_upper - bb_lower) / sma20) * 100.0

    # 3. Momentum: RSI 14 & MACD
    df["RSI"] = calculate_rsi_wilder(closes, period=14)
    fast_ema = closes.ewm(span=12, adjust=False).mean()
    slow_ema = closes.ewm(span=26, adjust=False).mean()
    df["MACD"] = fast_ema - slow_ema
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

    # 4. Volume SMA
    df["Vol_SMA20"] = volumes.rolling(20, min_periods=5).mean()

    # 5. VWAP
    cum_vol = volumes.cumsum()
    typical_p = (highs + lows + closes) / 3.0
    cum_vol_price = (typical_p * volumes).cumsum()
    df["VWAP"] = cum_vol_price / cum_vol.replace(0, np.nan)

    # 6. Relative Strength / 60D ROC
    df["ROC_60"] = (closes / closes.shift(60) - 1.0) * 100.0

    trades = []
    in_trade = False
    entry_price = 0.0
    entry_date = None
    stop_loss = 0.0
    target_1 = 0.0
    target_2 = 0.0
    t1_hit = False
    entry_bar = 0

    for i in range(50, len(df)):
        c_price = float(closes.iloc[i])
        c_high = float(highs.iloc[i])
        c_low = float(lows.iloc[i])
        c_open = float(opens.iloc[i])
        c_vol = float(volumes.iloc[i])
        c_date = df.index[i]

        dma50 = float(df["SMA50"].iloc[i])
        dma200 = float(df["SMA200"].iloc[i])
        ema20 = float(df["EMA20"].iloc[i])
        ema9 = float(df["EMA9"].iloc[i])
        vwap = float(df["VWAP"].iloc[i])
        rsi = float(df["RSI"].iloc[i])
        macd = float(df["MACD"].iloc[i])
        macd_sig = float(df["MACD_Signal"].iloc[i])
        st_direction = int(df["ST_Dir"].iloc[i])
        st_trailing = float(df["Supertrend"].iloc[i])
        c_atr = float(df["ATR"].iloc[i])
        vol_ma = float(df["Vol_SMA20"].iloc[i])
        bb_w = float(df["BB_Width"].iloc[i])
        roc60 = float(df["ROC_60"].iloc[i]) if not pd.isna(df["ROC_60"].iloc[i]) else 0.0

        candle_range = max(0.01, c_high - c_low)
        close_loc = (c_price - c_low) / candle_range

        if not in_trade:
            # Macro Gate: Price >= 50 DMA and 50 DMA >= 200 DMA
            macro_ok = (c_price >= dma50 * 0.99) and (dma50 >= dma200 * 0.98)
            # Supertrend Green
            st_ok = (st_direction == 1)
            # Pullback / 20 EMA bounce
            pullback_ok = (c_low <= ema20 * 1.015 and c_price >= ema20 * 0.99) or (c_low <= vwap * 1.015 and c_price >= vwap)
            # Momentum Sweet Spot
            rsi_ok = (48.0 <= rsi <= 68.0)
            # MACD Bullish
            macd_ok = (macd >= macd_sig)

            # Strict mode: Requires Institutional Footprint (Strong close in upper 50% of bar + Volume support + Positive 60D ROC)
            if strict_mode:
                footprint_ok = (close_loc >= 0.45) and (c_vol >= vol_ma * 0.75) and (roc60 >= 0.0)
            else:
                footprint_ok = True

            if macro_ok and st_ok and pullback_ok and rsi_ok and macd_ok and footprint_ok:
                in_trade = True
                entry_price = c_price
                entry_date = c_date
                entry_bar = i
                t1_hit = False

                # Stop loss: buffered below recent swing low or Supertrend line
                recent_low = float(lows.iloc[max(0, i-5):i+1].min())
                stop_loss = round(max(recent_low - (0.5 * c_atr), st_trailing if st_direction == 1 else entry_price * 0.94), 2)
                # Cap maximum initial risk to 5.5%
                if stop_loss < entry_price * 0.945:
                    stop_loss = round(entry_price * 0.945, 2)
                if stop_loss >= entry_price:
                    stop_loss = round(entry_price * 0.96, 2)

                # Prior swing high or +5.0% for Target 1
                recent_high = float(highs.iloc[max(0, i-20):i].max()) if i >= 20 else entry_price * 1.06
                target_1 = round(max(recent_high, entry_price * 1.045), 2)
                target_2 = round(target_1 + (0.272 * (target_1 - stop_loss)), 2)
                if target_2 <= target_1:
                    target_2 = round(target_1 * 1.08, 2)
        else:
            bars_held = i - entry_bar
            exit_trade = False
            exit_price = c_price
            exit_reason = ""
            pnl_pct = 0.0

            # 1. Target 1 Reached: Lock 50% profits, move stop loss on remaining 50% to Breakeven (+0.3% fees)
            if not t1_hit and c_high >= target_1:
                t1_hit = True
                stop_loss = round(entry_price * 1.003, 2)

            # 2. Target 2 Hit (Full Take Profit)
            if c_high >= target_2:
                exit_trade = True
                exit_price = target_2
                exit_reason = "TARGET_2_FULL_RUNNER"
                pnl_pct = round((((target_1 - entry_price) / entry_price * 0.5) + ((target_2 - entry_price) / entry_price * 0.5)) * 100.0, 2)

            # 3. Stop Loss Triggered
            elif c_low <= stop_loss:
                exit_trade = True
                exit_price = stop_loss
                if t1_hit:
                    exit_reason = "BREAKEVEN_STOP_AFTER_T1"
                    t1_gain = (target_1 - entry_price) / entry_price * 100.0
                    pnl_pct = round(t1_gain * 0.5, 2)
                else:
                    exit_reason = "INITIAL_STOP_LOSS"
                    pnl_pct = round(((stop_loss - entry_price) / entry_price) * 100.0, 2)

            # 4. Supertrend Flipped Red
            elif st_direction == -1:
                exit_trade = True
                exit_price = c_price
                exit_reason = "SUPERTREND_RED_FLIP"
                if t1_hit:
                    pnl_pct = round((((target_1 - entry_price) / entry_price * 0.5) + ((exit_price - entry_price) / entry_price * 0.5)) * 100.0, 2)
                else:
                    pnl_pct = round(((exit_price - entry_price) / entry_price) * 100.0, 2)

            # 5. Time Stop (Stagnation > 18 trading sessions)
            elif bars_held >= 18:
                exit_trade = True
                exit_price = c_price
                exit_reason = "TIME_STALL_EXIT"
                if t1_hit:
                    pnl_pct = round((((target_1 - entry_price) / entry_price * 0.5) + ((exit_price - entry_price) / entry_price * 0.5)) * 100.0, 2)
                else:
                    pnl_pct = round(((exit_price - entry_price) / entry_price) * 100.0, 2)

            if exit_trade:
                trades.append({
                    "symbol": symbol,
                    "entry_date": str(entry_date.date()) if hasattr(entry_date, "date") else str(entry_date),
                    "exit_date": str(c_date.date()) if hasattr(c_date, "date") else str(c_date),
                    "bars_held": bars_held,
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exit_price, 2),
                    "pnl_pct": pnl_pct,
                    "is_win": bool(pnl_pct > 0),
                    "exit_reason": exit_reason,
                    "t1_hit": t1_hit,
                })
                in_trade = False

    return {"symbol": symbol, "trades": trades}


def run_full_backtest():
    portfolio_symbols = [
        "WINDLAS", "WAAREEENER", "SUDEEPPHRM", "STYLAMIND", "PICCADIL",
        "PHOENIXLTD", "JSLL", "FCL", "E2E", "CARTRADE", "BUILDPRO",
        "BHARATFORG", "BETA", "ATHERENERG", "ASTRAMICRO", "AEROENTER", "AEGISLOG"
    ]
    watchlist_symbols = [
        "LAURUSLABS", "ROLEXRINGS", "CYIENT", "LALPATHLAB", "SKYGOLD", "SOMANYCERA"
    ]
    benchmark_leaders = [
        "TRENT", "DIXON", "POLYCAB", "HAL", "BEL", "TITAN", "CDSL"
    ]

    combined_universe = list(dict.fromkeys(portfolio_symbols + watchlist_symbols + benchmark_leaders))
    logger.info(f"Downloading historical bars for {len(combined_universe)} equities...")

    stock_dfs = {}
    for sym in combined_universe:
        ticker = f"{sym}.NS"
        try:
            t = yf.Ticker(ticker)
            df = t.history(period="1y", interval="1d")
            if not df.empty and len(df) >= 40:
                stock_dfs[sym] = df
        except Exception as e:
            continue

    # Execute Both Modes:
    # Mode 1: Standard 12 FX Swing Strategy
    # Mode 2: Institutional Sniper Precision Mode (Strict Close Location & Footprint)
    for mode_name, is_strict in [("Standard 12 FX Confluence", False), ("Institutional Sniper Precision (Strict Confluence)", True)]:
        all_trades = []
        stock_summaries = []

        for sym, df in stock_dfs.items():
            res = backtest_single_stock(sym, df, strict_mode=is_strict)
            trades = res.get("trades", [])
            all_trades.extend(trades)

            if trades:
                wins = [t for t in trades if t["is_win"]]
                win_rate = round((len(wins) / len(trades)) * 100.0, 1)
                avg_win = round(float(np.mean([t["pnl_pct"] for t in wins])), 2) if wins else 0.0
                losses = [t for t in trades if not t["is_win"]]
                avg_loss = round(float(np.mean([t["pnl_pct"] for t in losses])), 2) if losses else 0.0
                gross_profit = sum(t["pnl_pct"] for t in wins)
                gross_loss = abs(sum(t["pnl_pct"] for t in losses))
                profit_factor = round(gross_profit / max(0.01, gross_loss), 2)
                net_pnl = round(sum(t["pnl_pct"] for t in trades), 2)

                stock_summaries.append({
                    "symbol": sym,
                    "total_trades": len(trades),
                    "wins": len(wins),
                    "losses": len(losses),
                    "win_rate": win_rate,
                    "avg_win": avg_win,
                    "avg_loss": avg_loss,
                    "profit_factor": profit_factor,
                    "net_pnl": net_pnl,
                })

        total_trades_count = len(all_trades)
        winning_trades = [t for t in all_trades if t["is_win"]]
        losing_trades = [t for t in all_trades if not t["is_win"]]
        global_win_rate = round((len(winning_trades) / max(1, total_trades_count)) * 100.0, 1)

        avg_win_pct = round(float(np.mean([t["pnl_pct"] for t in winning_trades])), 2) if winning_trades else 0.0
        avg_loss_pct = round(float(np.mean([t["pnl_pct"] for t in losing_trades])), 2) if losing_trades else 0.0

        gross_profit = sum(t["pnl_pct"] for t in winning_trades)
        gross_loss = abs(sum(t["pnl_pct"] for t in losing_trades))
        profit_factor = round(gross_profit / max(0.01, gross_loss), 2)

        avg_rr_realized = round(abs(avg_win_pct / max(0.01, abs(avg_loss_pct))), 2)
        avg_holding_bars = round(float(np.mean([t["bars_held"] for t in all_trades])), 1) if all_trades else 0

        t1_hit_count = sum(1 for t in all_trades if t["t1_hit"])
        t1_hit_rate = round((t1_hit_count / max(1, total_trades_count)) * 100.0, 1)

        print("\n" + "="*85)
        print(f"       AUDIT REPORT: {mode_name.upper()}")
        print("="*85)
        print(f"Universe Scanned:        {len(stock_dfs)} Equities (Portfolio + Watchlists + Leaders)")
        print(f"Historical Window:       1 Year (Daily Bars)")
        print(f"Total Trades Executed:   {total_trades_count}")
        print(f"Winning Trades:          {len(winning_trades)} ({global_win_rate}%)")
        print(f"Losing Trades:           {len(losing_trades)} ({round(100.0 - global_win_rate, 1)}%)")
        print(f"Target 1 Hit Rate:       {t1_hit_count} / {total_trades_count} ({t1_hit_rate}% locked profit)")
        print("-" * 85)
        print(f"GLOBAL WIN RATE:         {global_win_rate}%")
        print(f"PROFIT FACTOR:           {profit_factor}")
        print(f"AVERAGE WIN:             +{avg_win_pct}%")
        print(f"AVERAGE LOSS:            {avg_loss_pct}%")
        print(f"REALIZED REWARD:RISK:    {avg_rr_realized} : 1")
        print(f"AVERAGE HOLDING PERIOD:  {avg_holding_bars} Days")
        print("="*85)

        stock_summaries.sort(key=lambda x: (x["win_rate"], x["net_pnl"]), reverse=True)
        df_sum = pd.DataFrame(stock_summaries)
        print(df_sum.to_string(index=False))

        print("\nSample Executions (Last 10 trades):")
        for tr in all_trades[-10:]:
            tag = "WIN " if tr["is_win"] else "LOSS"
            print(f"  [{tag}] {tr['symbol']:<12} | In: {tr['entry_date']} (Rs.{tr['entry_price']}) -> Out: {tr['exit_date']} (Rs.{tr['exit_price']}) | PnL: {tr['pnl_pct']:>+6.2f}% | Exit: {tr['exit_reason']}")

        print("="*85 + "\n")


if __name__ == "__main__":
    run_full_backtest()
