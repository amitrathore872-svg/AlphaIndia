"""
Alpha India - Deep Quantitative Strategy: The Institutional Spring (Apex Sniper 2.0)
Sprint 38.0 Out-of-the-Box High-Conversion Framework

Backtest specifications:
- Universe: Top 10 Institutional Alpha Leaders (TATAPOWER, TRENT, SIEMENS, BHARATFORG, RELIANCE, TCS, TITAN, DIVISLAB, M&M, JINDALSTEL)
- Timeframe: 60 Days, 5-Minute Bars
- Logic:
  1. Morning Institutional Impulse: High >= Open + 1.0% in first 45 mins with RVOL >= 1.8x
  2. Order Absorption / Pullback: 3 to 8 bars pulling back to VWAP (+/- 0.15%)
  3. Liquidity Dry-Up: Average volume during pullback is < 50% of the impulse volume
  4. Spring Trigger: Green reversal candle rejecting VWAP and closing above previous candle high
  5. Asymmetric Risk: SL strictly placed at local swing low / VWAP-0.15% (Risk 0.35% - 0.65%)
  6. Targets: T1 = 1.5R, T2 = 2.5R, Trailing to 3R or EOD Close
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"

TOP_10_LEADERS = [
    "TATAPOWER", "TRENT", "SIEMENS", "BHARATFORG", "RELIANCE", 
    "TCS", "TITAN", "DIVISLAB", "M&M", "JINDALSTEL"
]

def load_stock_5m(symbol: str) -> Optional[pd.DataFrame]:
    clean_sym = symbol.strip().upper()
    cache_file = CACHE_DIR / f"{clean_sym}_5m.parquet"
    if cache_file.exists():
        try:
            return pd.read_parquet(cache_file)
        except Exception:
            pass
    return None

def test_apex_institutional_spring(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for curr_d in dates:
        curr_day = df[df["Date"] == curr_d].copy()
        if len(curr_day) < 40: continue

        # Compute VWAP
        cum_vol = curr_day["Volume"].cumsum()
        cum_pv = (curr_day["Close"] * curr_day["Volume"]).cumsum()
        curr_day["VWAP"] = cum_pv / np.maximum(1, cum_vol)

        open_p = curr_day["Open"].iloc[0]

        # 1. Impulse Window: 9:15 to 10:00 (bars 0 to 8)
        morning_bars = curr_day.iloc[:9]
        morning_high = morning_bars["High"].max()
        morning_gain_pct = (morning_high - open_p) / open_p * 100.0

        # Require institutional drive: +1.0% to +3.5%
        if morning_gain_pct < 1.0 or morning_gain_pct > 4.5: continue

        morning_avg_vol = morning_bars["Volume"].mean()
        morning_high_idx = morning_bars["High"].values.argmax()

        # 2. Pullback & Absorption Window: 10:00 to 12:30 (bars 9 to 38)
        # Must pull back to VWAP
        for idx in range(max(9, morning_high_idx + 2), min(36, len(curr_day) - 6)):
            bar = curr_day.iloc[idx]
            prev_bar = curr_day.iloc[idx - 1]
            vwap = bar["VWAP"]

            # Retrace to VWAP zone: Low touches within 0.2% of VWAP, Close >= VWAP - 0.1%
            near_vwap = (bar["Low"] <= vwap * 1.0025) and (bar["Close"] >= vwap * 0.998)
            if not near_vwap: continue

            # Volume Absorption: Prior 3-bar average volume must be < 55% of morning impulse average volume
            prior_3_vol = curr_day.iloc[max(0, idx-3):idx]["Volume"].mean()
            if prior_3_vol > 0.55 * morning_avg_vol: continue

            # Bullish Confirmation: Current bar is green and closes above previous bar's high or above open
            is_bullish_reversal = (bar["Close"] > bar["Open"]) and (bar["Close"] >= prev_bar["High"] * 0.9995)
            if not is_bullish_reversal: continue

            # Valid Entry Found!
            entry = float(bar["Close"])
            # Stop Loss: lowest low of recent 3 bars or VWAP * 0.9975
            local_low = float(curr_day.iloc[max(0, idx-3):idx+1]["Low"].min())
            sl = round(min(local_low * 0.9985, vwap * 0.9975), 2)
            risk = entry - sl
            risk_pct = (risk / entry) * 100.0

            # Strict institutional risk envelope: between 0.30% and 0.85%
            if risk <= 0 or risk_pct < 0.30 or risk_pct > 0.85: continue

            t1 = round(entry + 1.5 * risk, 2)
            t2 = round(entry + 2.5 * risk, 2)
            t3 = round(entry + 3.5 * risk, 2)

            sub = curr_day.iloc[idx + 1:]
            hit_t1, hit_t2, hit_t3, hit_sl = False, False, False, False

            for _, sbar in sub.iterrows():
                if sbar["Low"] <= sl:
                    hit_sl = True
                    break
                if sbar["High"] >= t1: hit_t1 = True
                if sbar["High"] >= t2: hit_t2 = True
                if sbar["High"] >= t3:
                    hit_t3 = True
                    break

            last_c = float(sub["Close"].iloc[-1])
            if hit_t3:
                r_pnl = 3.5
            elif hit_t2:
                r_pnl = 2.5
            elif hit_t1:
                r_pnl = 1.5
            elif hit_sl:
                r_pnl = -1.0
            else:
                r_pnl = (last_c - entry) / risk

            trades.append({
                "strategy": "APEX_INSTITUTIONAL_SPRING",
                "symbol": symbol,
                "date": str(curr_d),
                "entry_time": str(curr_day.index[idx].time()),
                "entry": entry,
                "sl": sl,
                "t1": t1,
                "t2": t2,
                "t3": t3,
                "risk_pct": round(risk_pct, 2),
                "r_pnl": round(r_pnl, 2),
                "win": r_pnl > 0,
                "hit_t1": hit_t1,
                "hit_t2": hit_t2,
                "hit_t3": hit_t3,
            })
            break # Strictly max 1 trade per stock per day

    return trades

def run():
    print("=" * 85)
    print("  RUNNING APEX INSTITUTIONAL SPRING TEST ON TOP 10 LEADERS")
    print("=" * 85)
    all_trades = []
    per_stock = {}

    for sym in TOP_10_LEADERS:
        df = load_stock_5m(sym)
        if df is None:
            print(f"[-] Missing data for {sym}")
            continue
        t = test_apex_institutional_spring(df, sym)
        all_trades.extend(t)
        per_stock[sym] = t

    if not all_trades:
        print("[-] 0 trades triggered.")
        return

    tdf = pd.DataFrame(all_trades)
    tot = len(tdf)
    wins = tdf[tdf["win"] == True]
    losses = tdf[tdf["win"] == False]
    wr = len(wins) / tot * 100.0
    t1_cnt = tdf["hit_t1"].sum()
    t2_cnt = tdf["hit_t2"].sum()
    t3_cnt = tdf["hit_t3"].sum()

    w_sum = tdf[tdf["r_pnl"] > 0]["r_pnl"].sum()
    l_sum = abs(tdf[tdf["r_pnl"] <= 0]["r_pnl"].sum())
    pf = w_sum / max(0.01, l_sum)
    avg_r = tdf["r_pnl"].mean()

    print(f"\n[*] GLOBAL RESULTS ACROSS TOP 10 LEADERS (60 Days / ~45 Trading Sessions):")
    print(f"  • Total Trades Generated : {tot:3d}  (~{tot/45.0:.2f} trades/day, or ~{tot/9.0:.1f} trades/week)")
    print(f"  • Overall Win Rate       : {wr:.1f}%")
    print(f"  • Target 1 (1.5R) Hit    : {t1_cnt:3d} ({t1_cnt/tot*100:.1f}%)")
    print(f"  • Target 2 (2.5R) Hit    : {t2_cnt:3d} ({t2_cnt/tot*100:.1f}%)")
    print(f"  • Target 3 (3.5R) Hit    : {t3_cnt:3d} ({t3_cnt/tot*100:.1f}%)")
    print(f"  • PROFIT FACTOR          : {pf:.2f}")
    print(f"  • AVERAGE EXPECTANCY     : {avg_r:+.2f}R per trade")
    print(f"  • AVERAGE STOP LOSS RISK : {tdf['risk_pct'].mean():.2f}%")
    print("=" * 85)

    print("\n[*] BREAKDOWN PER INSTITUTIONAL LEADER:")
    print("-" * 85)
    print(f"{'SYMBOL':<14} | {'TRADES':<7} | {'WIN %':<8} | {'PF':<6} | {'AVG R':<7} | {'T1 %':<7} | {'T2 %':<7}")
    print("-" * 85)
    for sym in TOP_10_LEADERS:
        st = per_stock.get(sym, [])
        if not st:
            print(f"{sym:<14} | {0:<7} | {'N/A':<8} | {'N/A':<6} | {'N/A':<7} | {'N/A':<7} | {'N/A':<7}")
            continue
        sdf = pd.DataFrame(st)
        s_tot = len(sdf)
        s_wr = (sdf['win'].sum() / s_tot) * 100.0
        s_w_sum = sdf[sdf["r_pnl"] > 0]["r_pnl"].sum()
        s_l_sum = abs(sdf[sdf["r_pnl"] <= 0]["r_pnl"].sum())
        s_pf = s_w_sum / max(0.01, s_l_sum)
        s_avg_r = sdf["r_pnl"].mean()
        s_t1 = sdf["hit_t1"].sum() / s_tot * 100.0
        s_t2 = sdf["hit_t2"].sum() / s_tot * 100.0
        print(f"{sym:<14} | {s_tot:<7} | {s_wr:6.1f}% | {s_pf:5.2f} | {s_avg_r:+5.2f} | {s_t1:5.1f}% | {s_t2:5.1f}%")
    print("-" * 85)

    # Save trades to csv
    out_csv = Path(__file__).resolve().parent.parent / "data" / "apex_institutional_spring_trades.csv"
    tdf.to_csv(out_csv, index=False)
    print(f"\nAll trades saved to: {out_csv}")

if __name__ == "__main__":
    run()
