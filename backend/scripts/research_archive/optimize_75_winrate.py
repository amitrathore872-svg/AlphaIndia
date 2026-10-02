"""
Alpha India - 75%+ Win Rate Institutional Delivery Discovery Engine
Constraints:
- Market Cap >= 1,000 Cr
- Price >= Rs 40
Tests permutations across:
1. Multi-Day Delivery Clusters (D55 >= 2 in last 5 days)
2. Institutional Ticket Size Spike (Turnover/Trades >= 1.2x - 1.5x)
3. 20-Day D-A/D Flow Ratio (>= 1.4x - 2.0x)
4. Base Contraction & Vol Dry-Up
5. RS Leader (60D ROC >= 15% - 25%)
6. Market Regime Filter (Breadth >= 42% - 50%)
7. Trade Execution: Limit Buy Corridor vs Next Open, BE Shield at +1.8%, T1 +4.0% - +5.0%
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def run_grid_search():
    t0 = time.time()
    db = SessionLocal()
    records = db.query(ScreenerGrowthRecord.symbol, ScreenerGrowthRecord.market_cap).all()
    mcap_dict = {r.symbol.strip().upper(): float(r.market_cap) for r in records if r.symbol and r.market_cap}
    db.close()
    
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(glob.glob(str(base_dir / "sec_bhavdata_full_*.csv")))
    print(f"Loading {len(files)} historical NSE delivery bhavcopies...")
    
    dfs = []
    for f in files:
        try:
            d = pd.read_csv(f)
            d.columns = [c.strip() for c in d.columns]
            if "SERIES" in d.columns:
                d = d[d["SERIES"].str.strip() == "EQ"]
            d["SYMBOL"] = d["SYMBOL"].str.strip()
            d["DATE"] = pd.to_datetime(d["DATE1"].str.strip(), format="%d-%b-%Y")
            d["CLOSE"] = pd.to_numeric(d["CLOSE_PRICE"], errors="coerce")
            d["OPEN"] = pd.to_numeric(d["OPEN_PRICE"], errors="coerce")
            d["HIGH"] = pd.to_numeric(d["HIGH_PRICE"], errors="coerce")
            d["LOW"] = pd.to_numeric(d["LOW_PRICE"], errors="coerce")
            d["PREV_CLOSE"] = pd.to_numeric(d["PREV_CLOSE"], errors="coerce")
            d["VWAP"] = pd.to_numeric(d["AVG_PRICE"], errors="coerce")
            d["TURNOVER_CR"] = pd.to_numeric(d["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            d["NO_OF_TRADES"] = pd.to_numeric(d["NO_OF_TRADES"], errors="coerce").fillna(1)
            d["DELIV_QTY"] = pd.to_numeric(d["DELIV_QTY"], errors="coerce").fillna(0)
            d["DELIV_PER"] = pd.to_numeric(d["DELIV_PER"], errors="coerce").fillna(0)
            dfs.append(d[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VWAP", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue
            
    df = pd.concat(dfs, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(["SYMBOL", "DATE"]).reset_index(drop=True)
    
    # 1. Apply Market Cap and Price Floor
    df["MCAP"] = df["SYMBOL"].map(mcap_dict).fillna(0)
    df = df[(df["MCAP"] >= 1000.0) & (df["CLOSE"] >= 40.0)].reset_index(drop=True)
    print(f"Filtered Universe (MCap >= 1,000 Cr & Price >= Rs 40): {len(df):,} records across {df['SYMBOL'].nunique()} symbols ({time.time()-t0:.1f}s)")
    
    grouped = df.groupby("SYMBOL")
    df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    df["DELIV_SPIKE"] = np.where(df["DELIV_10_SMA"] > 0, df["DELIV_QTY"] / df["DELIV_10_SMA"], 0.0)
    
    df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    df["SMA_200"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(100, min_periods=40).mean())
    df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())
    df["ROC_60"] = grouped["CLOSE"].transform(lambda x: (x.shift(1) / x.shift(61) - 1.0) * 100.0)
    
    df["TRADE_SIZE"] = (df["TURNOVER_CR"] * 100.0) / np.maximum(1, df["NO_OF_TRADES"])
    df["AVG_TRADE_SIZE_20"] = grouped["TRADE_SIZE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    df["TICKET_SPIKE"] = np.where(df["AVG_TRADE_SIZE_20"] > 0, df["TRADE_SIZE"] / df["AVG_TRADE_SIZE_20"], 1.0)
    
    hl_range = np.maximum(0.01, df["HIGH"] - df["LOW"])
    df["CLOSE_LOC"] = (df["CLOSE"] - df["LOW"]) / hl_range
    df["UPPER_WICK"] = (df["HIGH"] - np.maximum(df["OPEN"], df["CLOSE"])) / hl_range
    
    # Range Contraction
    df["HL_DIFF"] = df["HIGH"] - df["LOW"]
    df["RANGE_5D"] = grouped["HL_DIFF"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    df["RANGE_20D"] = grouped["HL_DIFF"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    df["RANGE_CONTRACTION"] = np.where(df["RANGE_20D"] > 0, df["RANGE_5D"] / df["RANGE_20D"], 1.0)
    
    # Multi-day delivery cluster
    df["D55"] = (df["DELIV_PER"] >= 55.0).astype(float)
    df["DELIV_CLUSTER_5D"] = grouped["D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).sum())
    
    # 20D D-A/D Flow
    day_ret = (df["CLOSE"] - df["PREV_CLOSE"]) / df["PREV_CLOSE"] * 100.0
    df["DELIV_UP"] = np.where(day_ret > 0, df["DELIV_QTY"], 0.0)
    df["DELIV_DOWN"] = np.where(day_ret < 0, df["DELIV_QTY"], 0.0)
    df["UP_SUM"] = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    df["DOWN_SUM"] = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    df["DELIV_FLOW_20D"] = np.where(df["DOWN_SUM"] > 0, df["UP_SUM"] / df["DOWN_SUM"], 1.0)
    
    # Market Breadth
    breadth_map = df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["SMA_20"]).mean() * 100.0).to_dict()
    df["MARKET_BREADTH"] = df["DATE"].map(breadth_map)
    
    sym_map = {s: d.reset_index(drop=True) for s, d in df.groupby("SYMBOL")}
    
    def simulate(mask, entry_mode="NEXT_OPEN", t1=4.0, t2=8.0, be=1.8, max_hold=10, name=""):
        sigs = df[mask].copy()
        if len(sigs) < 10:
            return None
        trades = []
        for _, sig in sigs.iterrows():
            sub = sym_map.get(sig["SYMBOL"])
            if sub is None:
                continue
            idx = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not idx or idx[0] + 1 >= len(sub):
                continue
            e_idx = idx[0] + 1
            
            if entry_mode == "NEXT_OPEN":
                entry = sub.loc[e_idx, "OPEN"]
                if pd.isna(entry) or entry <= 0:
                    entry = sig["CLOSE"]
            elif entry_mode == "BUY_CORRIDOR_LIMIT":
                limit_p = sig["HIGH_50"] * 1.008
                filled = False
                for d in range(0, min(3, len(sub) - e_idx)):
                    if sub.loc[e_idx + d, "LOW"] <= limit_p:
                        entry = limit_p
                        e_idx = e_idx + d
                        filled = True
                        break
                if not filled:
                    continue
            else:
                entry = sig["CLOSE"]
                
            sl = sig["LOW"] * 0.995 # Structural stop at breakout candle low
            sl = max(entry * 0.965, sl) # bounded at 3.5% max risk
            
            t1_price = entry * (1.0 + t1 / 100.0)
            t2_price = entry * (1.0 + t2 / 100.0)
            be_price = entry * (1.0 + be / 100.0)
            
            t1_hit = False
            be_active = False
            pnl = 0.0
            
            for d in range(1, max_hold + 1):
                cur = e_idx + d
                if cur >= len(sub):
                    ret = (sub.loc[cur - 1, "CLOSE"] - entry) / entry * 100.0
                    pnl += 0.5 * ret if t1_hit else ret
                    break
                bar = sub.loc[cur]
                
                # Check T1
                if bar["HIGH"] >= t1_price and not t1_hit:
                    t1_hit = True
                    pnl += 0.5 * t1
                    sl = entry * 1.004
                    be_active = True
                    
                # Check BE
                if bar["HIGH"] >= be_price and not be_active:
                    be_active = True
                    sl = entry * 1.004
                    
                # Check SL
                if bar["LOW"] <= sl:
                    loss = (sl - entry) / entry * 100.0
                    pnl += 0.5 * loss if t1_hit else loss
                    break
                    
                # Check T2
                if bar["HIGH"] >= t2_price:
                    pnl += 0.5 * t2 if t1_hit else t2
                    break
                    
                if d == max_hold:
                    ret = (bar["CLOSE"] - entry) / entry * 100.0
                    pnl += 0.5 * ret if t1_hit else ret
                    
            trades.append(pnl - 0.15)
            
        s = pd.Series(trades)
        wr = (s > 0).mean() * 100
        pf = s[s > 0].sum() / abs(s[s <= 0].sum()) if (s <= 0).sum() != 0 else 99.0
        return {
            "name": name,
            "trades": len(s),
            "win_rate": round(wr, 1),
            "profit_factor": round(pf, 2),
            "avg_pnl": round(s.mean(), 2),
            "total_pnl": round(s.sum(), 1),
        }
        
    print("\n" + "="*120)
    print("TESTING PROGRESSIVE FILTERS FOR >= 75% WIN RATE (MCAP >= 1000 CR | PRICE >= RS 40)")
    print("="*120)
    
    # Base filter
    m_base = (
        (df["TURNOVER_CR"] >= 3.0) &
        (df["DELIV_PER"] >= 55.0) &
        (df["DELIV_SPIKE"] >= 1.6) &
        (df["CLOSE"] >= df["HIGH_50"] * 0.98) &
        (df["CLOSE"] > df["SMA_20"])
    )
    r0 = simulate(m_base, entry_mode="NEXT_OPEN", t1=5.0, t2=10.0, be=2.0, name="Baseline (MCap>=1000Cr, Price>=40)")
    print(f"Level 0 (Baseline):                       N={r0['trades']:<4d} | WR={r0['win_rate']:<5.1f}% | PF={r0['profit_factor']:<4.2f} | AvgPnL={r0['avg_pnl']:+5.2f}%")
    
    # Level 1: Institutional Footprint (VWAP + Ticket Spike >= 1.25x + Upper Wick <= 20%)
    m_l1 = m_base & (df["CLOSE"] >= df["VWAP"]) & (df["TICKET_SPIKE"] >= 1.25) & (df["UPPER_WICK"] <= 0.20) & (df["CLOSE_LOC"] >= 0.70)
    r1 = simulate(m_l1, entry_mode="NEXT_OPEN", t1=4.5, t2=9.0, be=2.0, name="Level 1 (+ VWAP Hold + Ticket Spike >= 1.25x)")
    print(f"Level 1 (+ Institutional Footprint):      N={r1['trades']:<4d} | WR={r1['win_rate']:<5.1f}% | PF={r1['profit_factor']:<4.2f} | AvgPnL={r1['avg_pnl']:+5.2f}%")
    
    # Level 2: + 20-Day Sustained Flow (D-A/D >= 1.5x) + Multi-day Delivery Cluster (>= 2 of last 5 days Deliv >= 55%)
    m_l2 = m_l1 & (df["DELIV_FLOW_20D"] >= 1.50) & (df["DELIV_CLUSTER_5D"] >= 2)
    r2 = simulate(m_l2, entry_mode="NEXT_OPEN", t1=4.5, t2=9.0, be=2.0, name="Level 2 (+ Multi-day Delivery Cluster + Flow >= 1.5x)")
    print(f"Level 2 (+ Delivery Cluster & Flow):      N={r2['trades']:<4d} | WR={r2['win_rate']:<5.1f}% | PF={r2['profit_factor']:<4.2f} | AvgPnL={r2['avg_pnl']:+5.2f}%")
    
    # Level 3: + RS Leader (60D ROC >= 15%) + Base Contraction (Range 5D / Range 20D <= 0.88)
    m_l3 = m_l2 & (df["ROC_60"] >= 15.0) & (df["RANGE_CONTRACTION"] <= 0.88) & (df["CLOSE"] > df["SMA_50"])
    r3 = simulate(m_l3, entry_mode="NEXT_OPEN", t1=4.0, t2=8.0, be=1.8, name="Level 3 (+ RS Leader + Base Contraction)")
    print(f"Level 3 (+ RS Leader + Base Contraction): N={r3['trades']:<4d} | WR={r3['win_rate']:<5.1f}% | PF={r3['profit_factor']:<4.2f} | AvgPnL={r3['avg_pnl']:+5.2f}%")
    
    # Level 4: + Market Regime Shield (Breadth >= 45%) + Fast Breakeven Lock at +1.8%
    m_l4 = m_l3 & (df["MARKET_BREADTH"] >= 45.0)
    r4 = simulate(m_l4, entry_mode="NEXT_OPEN", t1=4.0, t2=8.0, be=1.8, name="Level 4 (+ Market Regime Breadth >= 45%)")
    print(f"Level 4 (+ Market Regime Breadth >= 45%): N={r4['trades']:<4d} | WR={r4['win_rate']:<5.1f}% | PF={r4['profit_factor']:<4.2f} | AvgPnL={r4['avg_pnl']:+5.2f}%")

    # Level 5: APEX SNIPER 75%+ (All of Level 4 + Ticket Spike >= 1.40x OR High Turnover >= 8 Cr + Dynamic Scaling)
    m_l5 = m_l4 & (df["TICKET_SPIKE"] >= 1.35) & (df["TURNOVER_CR"] >= 6.0)
    r5 = simulate(m_l5, entry_mode="NEXT_OPEN", t1=3.8, t2=7.5, be=1.6, name="Level 5 (APEX 75%+ Elite Institutional Sniper)")
    if r5:
        print(f"\n[LEVEL 5: APEX 75%+ ELITE SNIPER]:        N={r5['trades']:<4d} | WIN RATE={r5['win_rate']:<5.1f}% | PF={r5['profit_factor']:<4.2f} | AvgPnL={r5['avg_pnl']:+5.2f}% | Total={r5['total_pnl']:+6.1f}%")

    # Level 6: Limit Buy Corridor (Pullback to Pivot + 0.8%)
    r6 = simulate(m_l4, entry_mode="BUY_CORRIDOR_LIMIT", t1=4.0, t2=8.0, be=1.8, name="Level 6 (Buy Corridor Limit Entry at Pivot+0.8%)")
    if r6:
        print(f"[LEVEL 6: BUY CORRIDOR LIMIT ENTRY]:     N={r6['trades']:<4d} | WIN RATE={r6['win_rate']:<5.1f}% | PF={r6['profit_factor']:<4.2f} | AvgPnL={r6['avg_pnl']:+5.2f}% | Total={r6['total_pnl']:+6.1f}%")
        
    print("\nExecution finished in {:.1f}s".format(time.time() - t0))

if __name__ == "__main__":
    run_grid_search()
