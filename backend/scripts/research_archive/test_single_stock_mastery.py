"""
Deep Single-Stock Mastery & Pattern Discovery
Finding the High-Conversion / Positive Expectancy Setup on Single Institutional Leaders
"""

import pandas as pd
import numpy as np
from pathlib import Path

cache_dir = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"

TARGETS = ["TCS", "TATAPOWER", "RELIANCE", "TRENT", "DIVISLAB", "BHARATFORG"]

def analyze_single_stock_patterns(sym: str):
    f = cache_dir / f"{sym}_5m.parquet"
    if not f.exists(): return
    df = pd.read_parquet(f)
    df['Date'] = pd.to_datetime(df.index).date
    dates = sorted(list(df['Date'].unique()))
    
    print(f"\n=======================================================")
    print(f"  DEEP PATTERN SCAN FOR: {sym} ({len(dates)} Trading Days)")
    print(f"=======================================================")

    # Test Setup 1: Previous Day High Reclaim with Open=Low (Uncontested Momentum)
    # Test Setup 2: Deep 3-Day Compression + Morning Gap Hold
    # Test Setup 3: Intraday VWAP Spring after 10:00 AM (Trend Retest)
    # Test Setup 4: 9:45 AM Expansion Bar (Body > 80%, Volume > 3x, Zero Wick)
    
    setups = {
        "1. Open=Low + Breaks PDH (No sellers)": [],
        "2. VWAP Spring after 10 AM (Absorption)": [],
        "3. 2-Day Inside Contraction + Morning Break": [],
        "4. First 15M High Cross with Volume > 2x": [],
        "5. 10:30 AM Breakout of Morning Consolidation": []
    }
    
    for i in range(2, len(dates)):
        curr = df[df['Date'] == dates[i]].copy()
        prev = df[df['Date'] == dates[i-1]].copy()
        prev_prev = df[df['Date'] == dates[i-2]].copy()
        
        if len(curr) < 40 or len(prev) < 25 or len(prev_prev) < 25: continue
        
        p_high = prev['High'].max()
        p_low = prev['Low'].min()
        p_close = prev['Close'].iloc[-1]
        
        pp_high = prev_prev['High'].max()
        pp_low = prev_prev['Low'].min()
        
        # VWAP
        cum_vol = curr['Volume'].cumsum()
        cum_pv = (curr['Close'] * curr['Volume']).cumsum()
        curr['VWAP'] = cum_pv / np.maximum(1, cum_vol)
        
        open_0 = curr['Open'].iloc[0]
        
        # SETUP 1: Open = Low + Breaks PDH in first 30 mins
        m30 = curr.iloc[:6]
        low_30 = m30['Low'].min()
        high_30 = m30['High'].max()
        close_30 = m30['Close'].iloc[-1]
        
        is_ol = (open_0 - low_30) / open_0 <= 0.0006 # practically zero wick
        if is_ol and close_30 > p_high:
            entry = close_30
            sl = open_0 * 0.9985
            risk = entry - sl
            if risk > 0 and (risk/entry) <= 0.009:
                t1 = entry + 1.5 * risk
                sub = curr.iloc[6:]
                hit_t1, hit_sl = False, False
                for _, b in sub.iterrows():
                    if b['Low'] <= sl: hit_sl = True; break
                    if b['High'] >= t1: hit_t1 = True; break
                last_c = sub['Close'].iloc[-1]
                pnl = 1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk)
                setups["1. Open=Low + Breaks PDH (No sellers)"].append(pnl)

        # SETUP 2: VWAP Spring after 10 AM
        m_bars = curr.iloc[:9]
        m_high = m_bars['High'].max()
        if (m_high - open_0)/open_0 >= 0.01:
            m_vol = m_bars['Volume'].mean()
            for idx in range(9, min(32, len(curr)-6)):
                b = curr.iloc[idx]
                vwap = b['VWAP']
                if b['Low'] <= vwap * 1.002 and b['Close'] >= vwap * 0.9985:
                    if curr.iloc[max(0, idx-3):idx]['Volume'].mean() <= 0.5 * m_vol:
                        if b['Close'] > b['Open']:
                            entry = b['Close']
                            sl = min(curr.iloc[max(0, idx-3):idx+1]['Low'].min() * 0.9985, vwap * 0.9975)
                            risk = entry - sl
                            if risk > 0 and (risk/entry) <= 0.008:
                                t1 = entry + 1.5 * risk
                                sub = curr.iloc[idx+1:]
                                hit_t1, hit_sl = False, False
                                for _, sb in sub.iterrows():
                                    if sb['Low'] <= sl: hit_sl = True; break
                                    if sb['High'] >= t1: hit_t1 = True; break
                                last_c = sub['Close'].iloc[-1]
                                pnl = 1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk)
                                setups["2. VWAP Spring after 10 AM (Absorption)"].append(pnl)
                                break

        # SETUP 3: 2-Day Inside Contraction + Morning Break
        is_inside = (p_high <= pp_high and p_low >= pp_low)
        if is_inside and close_30 > p_high:
            entry = close_30
            sl = open_0 * 0.9985
            risk = entry - sl
            if risk > 0 and (risk/entry) <= 0.009:
                t1 = entry + 1.5 * risk
                sub = curr.iloc[6:]
                hit_t1, hit_sl = False, False
                for _, b in sub.iterrows():
                    if b['Low'] <= sl: hit_sl = True; break
                    if b['High'] >= t1: hit_t1 = True; break
                last_c = sub['Close'].iloc[-1]
                pnl = 1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk)
                setups["3. 2-Day Inside Contraction + Morning Break"].append(pnl)

        # SETUP 5: 10:30 AM Breakout of Tight Morning Base (Range < 0.6%)
        base = curr.iloc[3:15] # 9:30 to 10:30
        b_high = base['High'].max()
        b_low = base['Low'].min()
        b_range_pct = (b_high - b_low) / b_low * 100.0
        if b_range_pct <= 0.65: # Tight compression
            for idx in range(15, min(28, len(curr)-6)):
                b = curr.iloc[idx]
                if b['Close'] > b_high and b['Volume'] >= 2.0 * base['Volume'].mean():
                    entry = b['Close']
                    sl = (b_high + b_low) / 2.0
                    risk = entry - sl
                    if risk > 0 and (risk/entry) <= 0.007:
                        t1 = entry + 1.5 * risk
                        sub = curr.iloc[idx+1:]
                        hit_t1, hit_sl = False, False
                        for _, sb in sub.iterrows():
                            if sb['Low'] <= sl: hit_sl = True; break
                            if sb['High'] >= t1: hit_t1 = True; break
                        last_c = sub['Close'].iloc[-1]
                        pnl = 1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk)
                        setups["5. 10:30 AM Breakout of Morning Consolidation"].append(pnl)
                        break

    for name, pnl_list in setups.items():
        if not pnl_list:
            print(f"{name:<45} | 0 trades")
            continue
        tot = len(pnl_list)
        wins = sum(1 for p in pnl_list if p > 0)
        wr = wins / tot * 100.0
        w_sum = sum(p for p in pnl_list if p > 0)
        l_sum = abs(sum(p for p in pnl_list if p <= 0))
        pf = w_sum / max(0.01, l_sum)
        avg_r = sum(pnl_list) / tot
        print(f"{name:<45} | Trades: {tot:2d} | Win%: {wr:5.1f}% | PF: {pf:5.2f} | Avg R: {avg_r:+5.2f}")

if __name__ == "__main__":
    for s in TARGETS:
        analyze_single_stock_patterns(s)
