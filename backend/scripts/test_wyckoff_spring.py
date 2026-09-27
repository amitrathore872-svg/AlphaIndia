"""
Alpha India - Deep Backtest: The Wyckoff Spring (Failed Breakdown Reclaim)
Sprint 38.0 Out-of-the-Box Deep Research

Microstructure Hypothesis:
1. Stock opens and dips BELOW Previous Day Low (PDL) between 9:15 and 10:15 AM.
   This triggers retail panic selling and hits long stop losses.
2. But instead of continuing down, smart money absorbs the liquidity.
3. Price decisively surges back ABOVE Previous Day Low and reclaims VWAP with high volume.
4. Entry: Immediate on PDL Reclaim + VWAP Reclaim.
5. Stop Loss: The swing low of the dip (extremely tight risk).
6. Target: Day VWAP + 1.5R to 2.5R (mean reversion to the other extreme).
"""

import pandas as pd
import numpy as np
from pathlib import Path

cache_dir = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"
stocks = [
    "TATAPOWER", "RELIANCE", "TCS", "TITAN", "DIVISLAB", "SIEMENS", "BHARATFORG",
    "KAYNES", "M&M", "HDFCBANK", "JINDALSTEL", "TRENT", "LT", "BAJFINANCE",
    "COFORGE", "PERSISTENT", "BEL", "HAL", "POLYCAB", "ICICIBANK", "SBIN",
    "MARUTI", "BAJAJ-AUTO", "HINDALCO", "JSWSTEEL", "TATASTEEL", "VEDL", "ITC"
]

all_trades = []

for sym in stocks:
    f = cache_dir / f"{sym}_5m.parquet"
    if not f.exists(): continue
    df = pd.read_parquet(f)
    df['Date'] = pd.to_datetime(df.index).date
    dates = sorted(list(df['Date'].unique()))
    
    for i in range(1, len(dates)):
        curr = df[df['Date'] == dates[i]].copy()
        prev = df[df['Date'] == dates[i-1]].copy()
        if len(curr) < 40 or len(prev) < 25: continue
        
        p_low = prev['Low'].min()
        p_high = prev['High'].max()
        
        # VWAP
        cum_vol = curr['Volume'].cumsum()
        cum_pv = (curr['Close'] * curr['Volume']).cumsum()
        curr['VWAP'] = cum_pv / np.maximum(1, cum_vol)
        
        # Look for dip below PDL in first 10 bars (9:15 to 10:05 AM)
        dipped = False
        dip_low = 999999.0
        dip_idx = -1
        
        for idx in range(1, min(12, len(curr)-10)):
            b = curr.iloc[idx]
            if b['Low'] < p_low:
                dipped = True
                dip_low = min(dip_low, b['Low'])
                dip_idx = idx
                
        if not dipped: continue
        
        # Check if dip was a reasonable sweep (not a catastrophic crash, <= 1.5% below PDL)
        if (p_low - dip_low) / p_low > 0.015: continue
        
        # Now look for strong RECLAIM of PDL and VWAP between dip_idx+1 and 11:30 AM (bar 27)
        for idx in range(dip_idx + 1, min(28, len(curr)-6)):
            b = curr.iloc[idx]
            vwap = b['VWAP']
            
            # Reclaim: Closes back ABOVE Previous Day Low and ABOVE VWAP
            if b['Close'] > p_low and b['Close'] >= vwap:
                entry = float(b['Close'])
                sl = round(dip_low * 0.9985, 2) # Just under the trap low
                risk = entry - sl
                risk_pct = (risk / entry) * 100.0
                
                # Strict institutional risk: 0.3% to 0.9%
                if risk <= 0 or risk_pct < 0.25 or risk_pct > 0.90: continue
                
                t1 = round(entry + 1.5 * risk, 2)
                t2 = round(entry + 2.5 * risk, 2)
                
                sub = curr.iloc[idx+1:]
                hit_t1, hit_t2, hit_sl = False, False, False
                for _, sb in sub.iterrows():
                    if sb['Low'] <= sl: hit_sl = True; break
                    if sb['High'] >= t1: hit_t1 = True
                    if sb['High'] >= t2: hit_t2 = True; break
                
                last_c = float(sub['Close'].iloc[-1])
                r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk))
                all_trades.append({
                    'symbol': sym,
                    'date': str(dates[i]),
                    'entry': entry,
                    'sl': sl,
                    'risk_pct': round(risk_pct, 2),
                    'r_pnl': round(r_pnl, 2),
                    'win': r_pnl > 0,
                    'hit_t1': hit_t1,
                    'hit_t2': hit_t2,
                })
                break

tdf = pd.DataFrame(all_trades)
print("=" * 75)
print("  WYCKOFF SPRING (FAILED BREAKDOWN RECLAIM) BACKTEST")
print("=" * 75)
print(f"Total Trades Sampled (60 Days across 28 Stocks): {len(tdf)}")
if len(tdf) > 0:
    wins = tdf[tdf['win'] == True]
    wr = len(wins) / len(tdf) * 100.0
    w_sum = tdf[tdf['r_pnl'] > 0]['r_pnl'].sum()
    l_sum = abs(tdf[tdf['r_pnl'] <= 0]['r_pnl'].sum())
    pf = w_sum / max(0.01, l_sum)
    print(f"WIN RATE                   : {wr:.1f}%")
    print(f"Target 1 (1.5R) Hit Rate   : {tdf['hit_t1'].sum()} ({tdf['hit_t1'].sum()/len(tdf)*100:.1f}%)")
    print(f"Target 2 (2.5R) Hit Rate   : {tdf['hit_t2'].sum()} ({tdf['hit_t2'].sum()/len(tdf)*100:.1f}%)")
    print(f"PROFIT FACTOR              : {pf:.2f}")
    print(f"AVERAGE EXPECTANCY         : {tdf['r_pnl'].mean():+.2f}R")
    print(f"AVERAGE STOP LOSS RISK     : {tdf['risk_pct'].mean():.2f}%")
    print(f"TRADES PER DAY             : {len(tdf)/45:.2f}")
print("=" * 75)
