import pandas as pd
import numpy as np
from pathlib import Path

cache_dir = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"
stocks = ['TCS', 'DIVISLAB', 'BHARATFORG', 'TATAPOWER', 'M&M', 'TRENT', 'RELIANCE', 'JINDALSTEL', 'COFORGE', 'PERSISTENT']

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
        
        cum_vol = curr['Volume'].cumsum()
        cum_pv = (curr['Close'] * curr['Volume']).cumsum()
        curr['VWAP'] = cum_pv / np.maximum(1, cum_vol)
        
        open_p = curr['Open'].iloc[0]
        
        m_bars = curr.iloc[:8]
        m_high = m_bars['High'].max()
        gain_pct = (m_high - open_p) / open_p * 100.0
        
        if gain_pct < 1.0 or gain_pct > 4.0: continue
        m_avg_vol = m_bars['Volume'].mean()
        
        for idx in range(8, min(30, len(curr)-8)):
            bar = curr.iloc[idx]
            vwap = bar['VWAP']
            
            if bar['Low'] <= vwap * 1.002 and bar['Close'] >= vwap * 0.9985:
                pullback_vol = curr.iloc[max(0, idx-3):idx]['Volume'].mean()
                if pullback_vol <= 0.45 * m_avg_vol:
                    if bar['Close'] > bar['Open']:
                        entry = float(bar['Close'])
                        local_low = float(curr.iloc[max(0, idx-3):idx+1]['Low'].min())
                        sl = round(min(local_low * 0.9985, vwap * 0.9975), 2)
                        risk = entry - sl
                        risk_pct = (risk / entry) * 100.0
                        
                        if risk <= 0 or risk_pct < 0.35 or risk_pct > 0.75: continue
                        
                        t1 = round(entry + 1.5 * risk, 2)
                        t2 = round(entry + 2.5 * risk, 2)
                        
                        sub = curr.iloc[idx+1:]
                        hit_t1 = False
                        hit_t2 = False
                        hit_sl = False
                        hit_be = False
                        
                        for _, sb in sub.iterrows():
                            current_sl = entry * 1.001 if hit_t1 else sl
                            
                            if sb['Low'] <= current_sl:
                                if hit_t1: hit_be = True
                                else: hit_sl = True
                                break
                            
                            if sb['High'] >= t1:
                                hit_t1 = True
                            if sb['High'] >= t2:
                                hit_t2 = True
                                break
                        
                        last_c = float(sub['Close'].iloc[-1])
                        
                        # Institutional Profit Protocol:
                        # 60% locked at Target 1 (+1.5R)
                        # Remaining 40% trailed to Target 2 (+2.5R) or stopped at Breakeven
                        if hit_t2:
                            pnl_r = 0.6 * 1.5 + 0.4 * 2.5
                        elif hit_t1 and hit_be:
                            pnl_r = 0.6 * 1.5 + 0.4 * 0.0 # = +0.90R profit!
                        elif hit_t1:
                            rem_r = max(0.0, (last_c - entry) / risk)
                            pnl_r = 0.6 * 1.5 + 0.4 * rem_r
                        elif hit_sl:
                            pnl_r = -1.0
                        else:
                            pnl_r = (last_c - entry) / risk
                        
                        all_trades.append({
                            'symbol': sym,
                            'date': str(dates[i]),
                            'entry': entry,
                            'sl': sl,
                            'risk_pct': round(risk_pct, 2),
                            'pnl_r': round(pnl_r, 2),
                            'win': pnl_r > 0,
                            'hit_t1': hit_t1,
                            'hit_t2': hit_t2,
                            'hit_sl': hit_sl,
                            'hit_be': hit_be,
                        })
                        break

tdf = pd.DataFrame(all_trades)
print('='*70)
print('  TRIPLE-ENGINE ALIGNMENT WITH INSTITUTIONAL PROFIT LOCK')
print('='*70)
print('Total Trades over 60 Days:', len(tdf))
print(f"Trades per Day across Universe: {len(tdf)/45.0:.2f} (~{len(tdf)/9.0:.1f} trades/week)")
wins = tdf[tdf['win'] == True]
losses = tdf[tdf['win'] == False]
wr = len(wins) / len(tdf) * 100.0
w_sum = tdf[tdf['pnl_r'] > 0]['pnl_r'].sum()
l_sum = abs(tdf[tdf['pnl_r'] <= 0]['pnl_r'].sum())
pf = w_sum / max(0.01, l_sum)
t1_cnt = tdf['hit_t1'].sum()
t2_cnt = tdf['hit_t2'].sum()
be_cnt = tdf['hit_be'].sum()

print(f"WIN RATE                   : {wr:.1f}%")
print(f"Target 1 (1.5R) Hit Rate   : {t1_cnt} ({t1_cnt/len(tdf)*100:.1f}%)")
print(f"Target 2 (2.5R) Hit Rate   : {t2_cnt} ({t2_cnt/len(tdf)*100:.1f}%)")
print(f"Breakeven Saved (Zero Loss): {be_cnt} trades ({be_cnt/len(tdf)*100:.1f}%)")
print(f"PROFIT FACTOR              : {pf:.2f}")
print(f"AVERAGE EXPECTANCY (R)     : {tdf['pnl_r'].mean():+.2f}R per trade")
print(f"AVERAGE RISK PER TRADE     : {tdf['risk_pct'].mean():.2f}%")
print('='*70)
