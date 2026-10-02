"""
Alpha India - Candlestick Integration on the 75%+ Win-Rate Engine
=================================================================
Runs the institutional 12 FX strategy from backtest_75_confluence.py,
comparing:
A) Baseline (Crude green bar placeholder)
B) CandlestickEngine (Algorithmic Triple, Double & Single patterns)
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.backtest_75_confluence import (
    EQUITY_UNIVERSE, calculate_supertrend, calculate_rsi
)
from app.services.pattern_engine.candlestick_engine import CandlestickEngine, PatternDirection


def run_test():
    print(f"Loading data for {len(EQUITY_UNIVERSE)} universe equities...")
    stock_dfs = {}
    for sym in EQUITY_UNIVERSE:
        try:
            t = f"{sym}.NS" if not sym.endswith(".NS") else sym
            df = yf.Ticker(t).history(period="1y", interval="1d", auto_adjust=True)
            if df is not None and len(df) >= 60:
                stock_dfs[sym] = df
        except Exception:
            pass

    print(f"Loaded {len(stock_dfs)} equities.\n")

    def run_engine(use_candlestick_engine: bool):
        all_trades = []
        for sym, raw_df in stock_dfs.items():
            df = raw_df.copy()
            df.columns = [str(c).capitalize() for c in df.columns]
            closes = df["Close"].astype(float).ffill()
            highs = df["High"].astype(float).ffill()
            lows = df["Low"].astype(float).ffill()
            opens = df["Open"].astype(float).ffill()
            volumes = df["Volume"].astype(float).fillna(0.0)

            sma50 = closes.rolling(50, min_periods=20).mean()
            sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
            ema20 = closes.ewm(span=20, adjust=False).mean()
            ema9 = closes.ewm(span=9, adjust=False).mean()
            st_val, st_dir, atr = calculate_supertrend(df, 10, 3.0)

            sma20_bb = closes.rolling(20, min_periods=10).mean()
            std20_bb = closes.rolling(20, min_periods=10).std().fillna(0.0)
            bb_upper = sma20_bb + (std20_bb * 2.0)
            bb_lower = sma20_bb - (std20_bb * 2.0)
            bb_range = (bb_upper - bb_lower).replace(0, 1.0)
            bb_pct_b = (closes - bb_lower) / bb_range

            rsi = calculate_rsi(closes, 14)
            fast_ema = closes.ewm(span=12, adjust=False).mean()
            slow_ema = closes.ewm(span=26, adjust=False).mean()
            macd = fast_ema - slow_ema
            macd_sig = macd.ewm(span=9, adjust=False).mean()
            vol_sma20 = volumes.rolling(20, min_periods=5).mean()

            typical_p = (highs + lows + closes) / 3.0
            cum_vp = (typical_p * volumes).cumsum()
            cum_v = volumes.cumsum().replace(0, np.nan)
            vwap = (cum_vp / cum_v).ffill()

            # Pre-compute Candlestick signals
            candlestick_bar_map = {}
            if use_candlestick_engine:
                sigs = CandlestickEngine.analyze_dataframe(df, lookback_bars=len(df)-40, min_score=60)
                for sig in sigs:
                    if sig.direction == PatternDirection.BULLISH.value:
                        for idx, t in enumerate(df.index):
                            if str(t)[:10] == sig.timestamp:
                                candlestick_bar_map[idx] = sig

            in_trade = False
            entry_price = 0.0
            stop_loss = 0.0
            target_1 = 0.0
            target_2 = 0.0
            t1_hit = False
            entry_bar = 0
            last_exit_bar = -99

            for i in range(50, len(df)):
                c_price = float(closes.iloc[i])
                c_high = float(highs.iloc[i])
                c_low = float(lows.iloc[i])
                c_open = float(opens.iloc[i])
                c_vol = float(volumes.iloc[i])

                p_high = float(highs.iloc[i-1])
                p_close = float(closes.iloc[i-1])
                p_low = float(lows.iloc[i-1])
                p_vol = float(volumes.iloc[i-1])

                d50 = float(sma50.iloc[i])
                d200 = float(sma200.iloc[i])
                e20 = float(ema20.iloc[i])
                e9 = float(ema9.iloc[i])
                c_rsi = float(rsi.iloc[i])
                c_macd = float(macd.iloc[i])
                c_sig = float(macd_sig.iloc[i])
                c_vwap = float(vwap.iloc[i])
                st_d = int(st_dir[i])
                c_atr = float(atr[i])
                v_ma = float(vol_sma20.iloc[i]) if float(vol_sma20.iloc[i]) > 0 else 1.0
                c_pct_b = float(bb_pct_b.iloc[i])

                cpr_pivot = (p_high + p_low + p_close) / 3.0
                cpr_bc = (p_high + p_low) / 2.0
                cpr_tc = (2.0 * cpr_pivot) - cpr_bc
                cpr_bot = min(cpr_tc, cpr_bc)
                cpr_r1 = (2.0 * cpr_pivot) - p_low

                # Candle check
                if use_candlestick_engine:
                    has_candle_pattern = i in candlestick_bar_map
                    candle_ok = has_candle_pattern
                else:
                    candle_ok = (c_price >= c_open and (c_price - c_low) / max(0.01, c_high - c_low) >= 0.50)

                checks = {
                    "dma50": (c_price >= d50 * 0.995, 10),
                    "dma200": (c_price >= d200 and d50 >= d200 * 0.99, 10),
                    "ema20": (c_price >= e20 * 0.995 or c_low <= e20 * 1.015, 10),
                    "ema9": (e9 >= e20, 5),
                    "vwap": (c_price >= c_vwap * 0.995, 10),
                    "supertrend": (st_d == 1, 15),
                    "bollinger": (0.35 <= c_pct_b <= 0.85, 5),
                    "cpr": (c_price >= cpr_bot * 0.995, 10),
                    "rsi": (50.0 <= c_rsi <= 67.0, 10),
                    "macd": (c_macd >= c_sig, 10),
                    "volume": (c_vol >= v_ma * 0.80 or p_vol < v_ma * 0.80, 5),
                    "candle": (candle_ok, 10)
                }

                total_weight = sum(w for _, w in checks.values())
                earned_weight = sum(w for ok, w in checks.values() if ok)
                confluence_score = (earned_weight / total_weight) * 100.0

                is_exhausted = (c_rsi > 68.0) or ((c_price - e20) > 2.2 * c_atr)

                if not in_trade:
                    if (confluence_score >= 75.0) and not is_exhausted and (i - last_exit_bar >= 3):
                        in_trade = True
                        entry_price = c_price
                        entry_bar = i
                        t1_hit = False

                        sw_low = float(lows.iloc[max(0, i-4):i+1].min())
                        calc_stop = min(sw_low - (0.5 * c_atr), entry_price * 0.962)
                        stop_loss = round(max(calc_stop, entry_price * 0.952), 2)
                        target_1 = round(max(cpr_r1, entry_price * 1.040), 2)
                        if target_1 > entry_price * 1.05:
                            target_1 = round(entry_price * 1.040, 2)
                        target_2 = round(entry_price * 1.085, 2)
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
                        pnl_pct = round((t1_pnl * 0.6) + (t2_pnl * 0.4), 2)
                    elif c_low <= stop_loss:
                        exit_trade = True
                        if t1_hit:
                            t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                            pnl_pct = round(t1_pnl * 0.6, 2)
                        else:
                            pnl_pct = round((stop_loss - entry_price) / entry_price * 100.0, 2)
                    elif st_d == -1 and c_price < e20:
                        exit_trade = True
                        exit_pnl = (c_price - entry_price) / entry_price * 100.0
                        if t1_hit:
                            t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                            pnl_pct = round((t1_pnl * 0.6) + (exit_pnl * 0.4), 2)
                        else:
                            pnl_pct = round(exit_pnl, 2)
                    elif bars_held >= 15:
                        exit_trade = True
                        exit_pnl = (c_price - entry_price) / entry_price * 100.0
                        if t1_hit:
                            t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                            pnl_pct = round((t1_pnl * 0.6) + (exit_pnl * 0.4), 2)
                        else:
                            pnl_pct = round(exit_pnl, 2)

                    if exit_trade:
                        all_trades.append({
                            "symbol": sym,
                            "pnl_pct": pnl_pct,
                            "is_win": pnl_pct > 0.0,
                            "t1_hit": t1_hit
                        })
                        in_trade = False
                        last_exit_bar = i

        total = len(all_trades)
        wins = [t for t in all_trades if t["is_win"]]
        losses = [t for t in all_trades if not t["is_win"]]
        win_rate = (len(wins) / total * 100.0) if total else 0.0
        avg_pnl = np.mean([t["pnl_pct"] for t in all_trades]) if total else 0.0
        gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0.0
        gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 1e-4
        pf = gross_profit / max(1e-4, gross_loss)

        return {
            "total": total,
            "wins": len(wins),
            "win_rate": round(win_rate, 2),
            "avg_pnl": round(avg_pnl, 2),
            "profit_factor": round(pf, 2)
        }

    base = run_engine(use_candlestick_engine=False)
    candle = run_engine(use_candlestick_engine=True)

    print("=" * 70)
    print("BACKTEST COMPARISON: 12 FX STRATEGY WITH & WITHOUT CANDLESTICK ENGINE")
    print("=" * 70)
    print(f"A) Baseline (Crude bar):")
    print(f"   Trades: {base['total']} | Win Rate: {base['win_rate']}% | Avg PnL: {base['avg_pnl']:+.2f}% | PF: {base['profit_factor']}")
    print(f"B) CandlestickEngine (Triple/Double/Single Patterns):")
    print(f"   Trades: {candle['total']} | Win Rate: {candle['win_rate']}% | Avg PnL: {candle['avg_pnl']:+.2f}% | PF: {candle['profit_factor']}")
    print("=" * 70)


if __name__ == "__main__":
    run_test()
