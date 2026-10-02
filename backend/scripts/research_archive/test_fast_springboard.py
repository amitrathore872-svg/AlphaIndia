"""
Test: Fast 1-3 Day Scalp Engine using 9/20 EMA Pullback Springboard & Supertrend Defense
"""
import numpy as np
import pandas as pd
import yfinance as yf
from compare_dma_supertrend_fast_scalp import TEST_UNIVERSE, calculate_supertrend

def test_fast_springboard(stock_dfs, t1_target=0.025, max_sl=0.025):
    all_trades = []
    
    for sym, raw_df in stock_dfs.items():
        if raw_df.empty or len(raw_df) < 60:
            continue
        df = raw_df.copy()
        df.columns = [str(c).capitalize() for c in df.columns]
        closes = df["Close"].astype(float).ffill()
        highs = df["High"].astype(float).ffill()
        lows = df["Low"].astype(float).ffill()
        opens = df["Open"].astype(float).ffill()
        
        ema9 = closes.ewm(span=9, adjust=False).mean()
        ema20 = closes.ewm(span=20, adjust=False).mean()
        sma50 = closes.rolling(50, min_periods=20).mean()
        st_val, st_dir, atr = calculate_supertrend(df, period=10, multiplier=3.0)
        
        in_trade = False
        entry_price = 0.0
        entry_bar = 0
        t1_hit = False
        target_1 = 0.0
        stop_loss = 0.0
        
        for i in range(50, len(df)):
            c_p = float(closes.iloc[i])
            c_h = float(highs.iloc[i])
            c_l = float(lows.iloc[i])
            c_o = float(opens.iloc[i])
            p_h = float(highs.iloc[i-1])
            p_l = float(lows.iloc[i-1])
            
            e9 = float(ema9.iloc[i])
            e20 = float(ema20.iloc[i])
            d50 = float(sma50.iloc[i])
            st_d = int(st_dir[i])
            c_atr = float(atr[i])
            
            if not in_trade:
                # 1. Trend Foundation: 9 EMA > 20 EMA > 50 DMA, Supertrend Green
                bullish_stack = (e9 >= e20) and (e20 >= d50) and (st_d == 1)
                
                # 2. Fast Springboard Dip: Low in last 2 days dipped near 9 EMA or 20 EMA
                dipped_to_ema = (min(c_l, p_l) <= e9 * 1.01)
                
                # 3. Quick Turn Trigger: Green candle, broke prior day high, closed upper half
                rng = max(0.01, c_h - c_l)
                close_loc = (c_p - c_l) / rng
                quick_turn = (c_p >= c_o) and (c_h > p_h) and (close_loc >= 0.55)
                
                if bullish_stack and dipped_to_ema and quick_turn:
                    in_trade = True
                    entry_price = c_p
                    entry_bar = i
                    t1_hit = False
                    target_1 = round(entry_price * (1.0 + t1_target), 2)
                    # Tight stop below trigger bar low
                    stop_loss = round(max(c_l - (0.2 * c_atr), entry_price * (1.0 - max_sl)), 2)
                    if stop_loss >= entry_price:
                        stop_loss = round(entry_price * 0.975, 2)
            else:
                bars_held = i - entry_bar
                exit_trade = False
                pnl = 0.0
                
                # Target 1 Hit (+2.5%): Full exit or 80% lock
                if c_h >= target_1:
                    exit_trade = True
                    pnl = t1_target * 100.0
                    
                # Stop loss hit
                elif c_l <= stop_loss:
                    exit_trade = True
                    pnl = round((stop_loss - entry_price) / entry_price * 100.0, 2)
                    
                # 9 EMA cross below 20 EMA or Supertrend Red
                elif e9 < e20 or st_d == -1:
                    exit_trade = True
                    pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                    
                # Time limit for fast scalp: 4 trading sessions max
                elif bars_held >= 4:
                    exit_trade = True
                    pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                    
                if exit_trade:
                    all_trades.append({
                        "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": bars_held
                    })
                    in_trade = False
                    
    tot = len(all_trades)
    if tot == 0:
        return 0, 0, 0, 0, 0
    wins = [t for t in all_trades if t["is_win"]]
    losses = [t for t in all_trades if not t["is_win"]]
    wr = round(len(wins) / tot * 100.0, 1)
    tot_w = sum(t["pnl"] for t in wins)
    tot_l = abs(sum(t["pnl"] for t in losses))
    pf = round(tot_w / max(0.01, tot_l), 2)
    aw = round(tot_w / len(wins), 2) if wins else 0.0
    al = round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0.0
    ab = round(float(np.mean([t["bars"] for t in all_trades])), 1)
    return tot, len(wins), wr, pf, aw, al, ab

if __name__ == "__main__":
    print("\n--- Testing Fast EMA/Supertrend Springboard (1-4 Days Quick In & Out) ---")
    stock_dfs = {}
    for sym in TEST_UNIVERSE:
        ticker = f"{sym}.NS"
        try:
            t = yf.Ticker(ticker)
            df = t.history(period="1y", interval="1d")
            if not df.empty and len(df) >= 60:
                stock_dfs[sym] = df
        except Exception:
            pass
            
    for t1 in [0.020, 0.025, 0.030]:
        for sl in [0.020, 0.025]:
            tot, wins, wr, pf, aw, al, ab = test_fast_springboard(stock_dfs, t1_target=t1, max_sl=sl)
            print(f"Target: +{t1*100:.1f}% | Stop: -{sl*100:.1f}% -> Trades: {tot} | Wins: {wins} | "
                  f"WIN RATE: {wr}% | PF: {pf} | AvgWin: +{aw}% | AvgLoss: {al}% | Hold: {ab} Days")
