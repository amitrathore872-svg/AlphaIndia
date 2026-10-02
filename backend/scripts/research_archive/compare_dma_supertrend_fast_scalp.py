"""
Empirical Comparison: Naive DMA Crossovers vs. Supertrend for Quick In & Out
=============================================================================
Tests:
1. Naive 9/20 EMA Crossover (In on Bullish Cross, Out on Bearish Cross)
2. Naive Supertrend 10/3 (In on Green Flip, Out on Red Flip)
3. Fast Supertrend 7/2 (Fast Scalp settings: In on Green, Out on Red)
4. Hybrid Supertrend + 20 EMA Trend Gate (In on ST Green while Price > 20 EMA > 50 DMA)
5. Fast Scalp with Asymmetric Target 1 (+2.0% to +2.5% quick profit lock)
"""
import os
import sys
import logging
import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Fast_Scalp_Comparison")

TEST_UNIVERSE = [
    # Momentum Leaders & Portfolio
    "ATHERENERG", "POLYCAB", "BHARATFORG", "LAURUSLABS", "AEGISLOG", "TORNTPHARM",
    "SANSERA", "BELRISE", "AJANTPHARM", "HFCL", "CGPOWER", "WELCORP",
    "WINDLAS", "STYLAMIND", "BUILDPRO", "SUDEEPPHRM", "BEL", "TITAN", "HAL", "CDSL",
    # Choppy / Rangebound / Corrective stocks for stress-testing whipsaws
    "CYIENT", "CARTRADE", "E2E", "FCL", "ROLEXRINGS", "SOMANYCERA"
]

def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0):
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


def test_strategy(stock_dfs, strategy_name="NAIVE_9_20_EMA"):
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
        sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
        st10_val, st10_dir, atr10 = calculate_supertrend(df, period=10, multiplier=3.0)
        st7_val, st7_dir, atr7 = calculate_supertrend(df, period=7, multiplier=2.0)
        
        in_trade = False
        entry_price = 0.0
        entry_date = None
        entry_bar = 0
        t1_hit = False
        stop_loss = 0.0
        target_1 = 0.0
        
        for i in range(50, len(df)):
            c_p = float(closes.iloc[i])
            c_h = float(highs.iloc[i])
            c_l = float(lows.iloc[i])
            p_p = float(closes.iloc[i-1])
            c_date = df.index[i]
            
            e9_c = float(ema9.iloc[i])
            e9_p = float(ema9.iloc[i-1])
            e20_c = float(ema20.iloc[i])
            e20_p = float(ema20.iloc[i-1])
            d50_c = float(sma50.iloc[i])
            
            st10_d_c = int(st10_dir[i])
            st10_d_p = int(st10_dir[i-1])
            st7_d_c = int(st7_dir[i])
            st7_d_p = int(st7_dir[i-1])
            c_atr = float(atr10[i])
            
            # --- 1. NAIVE 9/20 EMA CROSSOVER ---
            if strategy_name == "NAIVE_9_20_EMA":
                if not in_trade:
                    # In: 9 EMA crosses above 20 EMA
                    if e9_p <= e20_p and e9_c > e20_c:
                        in_trade = True
                        entry_price = c_p
                        entry_date = c_date
                        entry_bar = i
                else:
                    # Out: 9 EMA crosses below 20 EMA
                    if e9_c < e20_c:
                        pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                        all_trades.append({
                            "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": i - entry_bar
                        })
                        in_trade = False

            # --- 2. NAIVE SUPERTREND (10, 3) ---
            elif strategy_name == "NAIVE_SUPERTREND_10_3":
                if not in_trade:
                    # In: Supertrend flips Green (from -1 to 1)
                    if st10_d_p == -1 and st10_d_c == 1:
                        in_trade = True
                        entry_price = c_p
                        entry_date = c_date
                        entry_bar = i
                else:
                    # Out: Supertrend flips Red (from 1 to -1)
                    if st10_d_c == -1:
                        pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                        all_trades.append({
                            "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": i - entry_bar
                        })
                        in_trade = False

            # --- 3. FAST SUPERTREND (7, 2) SCALP ---
            elif strategy_name == "FAST_SUPERTREND_7_2":
                if not in_trade:
                    # In: Fast 7/2 Supertrend flips Green
                    if st7_d_p == -1 and st7_d_c == 1:
                        in_trade = True
                        entry_price = c_p
                        entry_date = c_date
                        entry_bar = i
                else:
                    # Out: Fast 7/2 Supertrend flips Red
                    if st7_d_c == -1:
                        pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                        all_trades.append({
                            "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": i - entry_bar
                        })
                        in_trade = False

            # --- 4. FILTERED HYBRID: SUPERTREND GREEN + STAGE 2 TREND GATE ---
            elif strategy_name == "FILTERED_SUPERTREND_STAGE2":
                if not in_trade:
                    # Supertrend flips Green ONLY when Price > 50 DMA
                    if (st10_d_p == -1 and st10_d_c == 1) and (c_p >= d50_c) and (e20_c >= d50_c * 0.99):
                        in_trade = True
                        entry_price = c_p
                        entry_date = c_date
                        entry_bar = i
                else:
                    # Exit: Supertrend flips Red or slices below 20 EMA
                    if st10_d_c == -1 or (c_p < e20_c and (i - entry_bar) >= 2):
                        pnl = round((c_p - entry_price) / entry_price * 100.0, 2)
                        all_trades.append({
                            "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": i - entry_bar
                        })
                        in_trade = False

            # --- 5. FAST SCALP ENGINE WITH TARGET 1 HARVEST & BREAKEVEN SHIELD ---
            elif strategy_name == "FAST_SCALP_T1_BREAKEVEN":
                if not in_trade:
                    # Trigger: Supertrend Green flip OR 9/20 EMA cross while Price > 50 DMA
                    st_trigger = (st10_d_p == -1 and st10_d_c == 1)
                    ema_trigger = (e9_p <= e20_p and e9_c > e20_c)
                    trend_ok = (c_p >= d50_c) and (c_p >= e20_c)
                    
                    if (st_trigger or ema_trigger) and trend_ok:
                        in_trade = True
                        entry_price = c_p
                        entry_date = c_date
                        entry_bar = i
                        t1_hit = False
                        target_1 = round(entry_price * 1.025, 2) # Quick +2.5% scalp target
                        target_2 = round(entry_price * 1.060, 2) # Runner +6.0%
                        stop_loss = round(entry_price * 0.965, 2) # 3.5% initial risk stop
                else:
                    bars_held = i - entry_bar
                    exit_trade = False
                    pnl = 0.0
                    
                    # Target 1: Quick +2.5% locked (75% position), stop moved to breakeven (+0.2%)
                    if not t1_hit and c_h >= target_1:
                        t1_hit = True
                        stop_loss = round(entry_price * 1.002, 2)
                        
                    # Target 2: Full exit
                    if c_h >= target_2:
                        exit_trade = True
                        pnl = round((2.5 * 0.75) + (6.0 * 0.25), 2)
                        
                    # Stop Hit
                    elif c_l <= stop_loss:
                        exit_trade = True
                        if t1_hit:
                            pnl = round(2.5 * 0.75, 2) # Locked 75% gain
                        else:
                            pnl = round((stop_loss - entry_price) / entry_price * 100.0, 2)
                            
                    # Supertrend Red or 9 EMA below 20 EMA
                    elif st10_d_c == -1:
                        exit_trade = True
                        curr_pnl = (c_p - entry_price) / entry_price * 100.0
                        if t1_hit:
                            pnl = round((2.5 * 0.75) + (curr_pnl * 0.25), 2)
                        else:
                            pnl = round(curr_pnl, 2)
                            
                    elif bars_held >= 8: # Fast scalp: max 8 days
                        exit_trade = True
                        curr_pnl = (c_p - entry_price) / entry_price * 100.0
                        if t1_hit:
                            pnl = round((2.5 * 0.75) + (curr_pnl * 0.25), 2)
                        else:
                            pnl = round(curr_pnl, 2)
                            
                    if exit_trade:
                        all_trades.append({
                            "symbol": sym, "pnl": pnl, "is_win": pnl > 0, "bars": bars_held
                        })
                        in_trade = False
                        
    tot = len(all_trades)
    if tot == 0:
        return {"name": strategy_name, "trades": 0, "win_rate": 0, "pf": 0, "avg_win": 0, "avg_loss": 0, "avg_bars": 0}
        
    wins = [t for t in all_trades if t["is_win"]]
    losses = [t for t in all_trades if not t["is_win"]]
    wr = round(len(wins) / tot * 100.0, 1)
    tot_w = sum(t["pnl"] for t in wins)
    tot_l = abs(sum(t["pnl"] for t in losses))
    pf = round(tot_w / max(0.01, tot_l), 2)
    aw = round(tot_w / len(wins), 2) if wins else 0.0
    al = round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0.0
    ab = round(float(np.mean([t["bars"] for t in all_trades])), 1)
    
    return {
        "name": strategy_name,
        "trades": tot,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": wr,
        "pf": pf,
        "avg_win": aw,
        "avg_loss": al,
        "avg_bars": ab
    }

if __name__ == "__main__":
    logger.info("Downloading historical bars for test universe...")
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
            
    logger.info(f"Loaded {len(stock_dfs)} equities. Benchmarking Fast In & Out Strategies:\n")
    
    strategies = [
        "NAIVE_9_20_EMA",
        "NAIVE_SUPERTREND_10_3",
        "FAST_SUPERTREND_7_2",
        "FILTERED_SUPERTREND_STAGE2",
        "FAST_SCALP_T1_BREAKEVEN"
    ]
    
    print("="*95)
    print(f"{'STRATEGY NAME':<30} | {'TRADES':<7} | {'WINS':<5} | {'LOSSES':<6} | {'WIN RATE':<9} | {'PF':<6} | {'AVG WIN':<8} | {'AVG LOSS':<8} | {'HOLD DAYS'}")
    print("="*95)
    
    for s in strategies:
        res = test_strategy(stock_dfs, s)
        print(f"{res['name']:<30} | {res['trades']:<7} | {res['wins']:<5} | {res['losses']:<6} | {res['win_rate']:>7.1f}% | {res['pf']:>6.2f} | {f'+{res['avg_win']}%':<8} | {f'{res['avg_loss']}%':<8} | {res['avg_bars']}d")
    print("="*95)
