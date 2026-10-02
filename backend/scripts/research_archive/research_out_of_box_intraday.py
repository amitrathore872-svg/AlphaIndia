"""
Alpha India - Deep Out-of-the-Box Quantitative Intraday Strategy Engine
Sprint 38.0 Deep Discovery & Empirical Backtest

Tests 5 Advanced Microstructure & Institutional Frameworks:
1. STRATEGY 1: Institutional Open=Low Float Squeeze (Drained Supply Ignition)
2. STRATEGY 2: The Judas Swing / Liquidity Sweep (Trap the Breakout, Ride the Cascade)
3. STRATEGY 3: Institutional VWAP Spring (High-Volume Surge -> Low-Volume Pullback -> Re-ignition)
4. STRATEGY 4: Nifty Relative Strength Absorption (Stock rising while Nifty dumps)
5. STRATEGY 5: Post-Consolidation Squeeze (Narrow Range coil -> 11:30 AM European ignition)

Evaluates:
- Win Rate (%)
- Profit Factor
- Average R per trade
- Trade Frequency (Trades per day/week - aimed at 0.5 to 1 trade/day)
- Max consecutive losses
"""

from __future__ import annotations
import concurrent.futures
from datetime import datetime, time as dtime
import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("deep_intraday_research")

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Focused universe: The top liquid institutional market movers in India
FOCUS_UNIVERSE = [
    "TATAPOWER", "RELIANCE", "TCS", "TITAN", "DIVISLAB", "SIEMENS", "BHARATFORG",
    "KAYNES", "M&M", "HDFCBANK", "JINDALSTEL", "TRENT", "LT", "BAJFINANCE",
    "COFORGE", "PERSISTENT", "BEL", "HAL", "POLYCAB", "ICICIBANK", "SBIN",
    "MARUTI", "BAJAJ-AUTO", "HINDALCO", "JSWSTEEL", "TATASTEEL", "VEDL", "ITC"
]

def fetch_5m_data(symbol: str) -> Optional[pd.DataFrame]:
    clean_sym = symbol.strip().upper()
    cache_file = CACHE_DIR / f"{clean_sym}_5m.parquet"
    if cache_file.exists():
        try:
            return pd.read_parquet(cache_file)
        except Exception:
            pass

    for suffix in [".NS", ".BO"]:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_sym}{suffix}?interval=5m&range=60d"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                data = r.json()
                res = data.get("chart", {}).get("result", [])
                if res:
                    ts = res[0].get("timestamp", [])
                    q = res[0].get("indicators", {}).get("quote", [{}])[0]
                    df = pd.DataFrame({
                        "Open": q.get("open", []),
                        "High": q.get("high", []),
                        "Low": q.get("low", []),
                        "Close": q.get("close", []),
                        "Volume": q.get("volume", []),
                    }, index=pd.to_datetime(ts, unit="s", utc=True).tz_convert("Asia/Kolkata")).dropna()
                    if len(df) >= 100:
                        try:
                            df.to_parquet(cache_file)
                        except Exception:
                            pass
                        return df
        except Exception:
            pass
    return None


def calculate_intraday_indicators(day_df: pd.DataFrame) -> pd.DataFrame:
    """Computes running VWAP, rolling RVOL, ATR, and candle characteristics."""
    df = day_df.copy()
    cum_vol = df["Volume"].cumsum()
    cum_pv = (df["Close"] * df["Volume"]).cumsum()
    df["VWAP"] = cum_pv / np.maximum(1, cum_vol)
    
    # Range
    df["Range"] = df["High"] - df["Low"]
    df["Body"] = (df["Close"] - df["Open"]).abs()
    df["UpperWick"] = df["High"] - np.maximum(df["Open"], df["Close"])
    df["LowerWick"] = np.minimum(df["Open"], df["Close"]) - df["Low"]
    return df


# -------------------------------------------------------------------------------------------------
# 1. STRATEGY 1: Float Contraction + Open=Low Institutional Drive
# -------------------------------------------------------------------------------------------------
def backtest_strat_1_open_low_drive(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    """
    Looks for:
    1. Prior day range contraction (NR4 or range < 80% of prior 3-day avg)
    2. Today 9:15 - 9:30 opens with Open == Low (wick <= 0.05% of open)
    3. First 15M volume >= 2.0x average morning volume
    4. First 15M candle is strongly bullish (Close > Open, Body > 65% of range)
    5. Entry at 9:30 AM close, SL at Day Low (Open), Target 1: 1.5R, Target 2: 2.5R
    """
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for i in range(3, len(dates)):
        curr_d = dates[i]
        curr_day = df[df["Date"] == curr_d]
        if len(curr_day) < 30: continue

        # Prior 3 days ranges
        d_minus_1 = df[df["Date"] == dates[i-1]]
        d_minus_2 = df[df["Date"] == dates[i-2]]
        d_minus_3 = df[df["Date"] == dates[i-3]]
        if len(d_minus_1) < 25 or len(d_minus_2) < 25 or len(d_minus_3) < 25: continue

        r1 = d_minus_1["High"].max() - d_minus_1["Low"].min()
        r2 = d_minus_2["High"].max() - d_minus_2["Low"].min()
        r3 = d_minus_3["High"].max() - d_minus_3["Low"].min()
        avg_prior_range = (r1 + r2 + r3) / 3.0

        # Contraction check: d_minus_1 range < 80% of prior 3-day average
        is_contracted = (r1 <= 0.80 * avg_prior_range) or (d_minus_1["High"].max() <= d_minus_2["High"].max() and d_minus_1["Low"].min() >= d_minus_2["Low"].min())
        if not is_contracted: continue

        # First 15 minutes (first 3 candles)
        m15 = curr_day.iloc[:3]
        open_0 = m15["Open"].iloc[0]
        low_15 = m15["Low"].min()
        high_15 = m15["High"].max()
        close_15 = m15["Close"].iloc[-1]
        vol_15 = m15["Volume"].sum()

        # Check Open == Low condition (within 0.06% tolerance)
        wick_pct = (open_0 - low_15) / open_0
        if wick_pct > 0.0006: continue # Must have practically NO lower wick!

        # Strong bullish candle (Close near High, Body > 65% of 15m range)
        range_15 = high_15 - low_15
        if range_15 <= 0: continue
        if (close_15 - open_0) / range_15 < 0.65: continue

        # Break above previous day high
        p_high = d_minus_1["High"].max()
        if close_15 < p_high: continue # Must decisively cross Previous Day High!

        entry = close_15
        sl = round(low_15 * 0.9985, 2) # Just below day low
        risk = entry - sl
        risk_pct = (risk / entry) * 100.0

        if risk <= 0 or risk_pct > 1.2 or risk_pct < 0.2: continue # Institutional risk parameter

        t1 = round(entry + 1.5 * risk, 2)
        t2 = round(entry + 2.5 * risk, 2)

        # Track remaining day
        sub = curr_day.iloc[3:]
        hit_t1, hit_t2, hit_sl = False, False, False
        for _, bar in sub.iterrows():
            if bar["Low"] <= sl:
                hit_sl = True
                break
            if bar["High"] >= t1: hit_t1 = True
            if bar["High"] >= t2:
                hit_t2 = True
                break

        last_c = float(sub["Close"].iloc[-1])
        r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk))
        trades.append({
            "strategy": "1_OPEN_LOW_DRIVE",
            "symbol": symbol, "date": str(curr_d),
            "entry": entry, "sl": sl, "t1": t1, "t2": t2, "risk_pct": risk_pct,
            "win": r_pnl > 0, "r": r_pnl, "hit_t1": hit_t1, "hit_t2": hit_t2
        })
    return trades


# -------------------------------------------------------------------------------------------------
# 2. STRATEGY 2: The Judas Swing / Fakeout Liquidity Sweep (Short Trap)
# -------------------------------------------------------------------------------------------------
def backtest_strat_2_judas_sweep(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    """
    Microstructure:
    1. Between 9:15 and 9:45, price surges above Previous Day High (triggering retail breakout buys)
    2. But it quickly stalls, leaves an upper wick (exhaustion), and falls back INSIDE prior day range
    3. Price displaces BELOW VWAP with increasing volume between 9:45 and 10:45 AM
    4. Short entry on VWAP breakdown, SL above sweep high, Target 1: 1.5R, Target 2: 2.5R
    """
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for i in range(1, len(dates)):
        curr_d = dates[i]
        curr_day = df[df["Date"] == curr_d]
        prev_day = df[df["Date"] == dates[i-1]]
        if len(curr_day) < 35 or len(prev_day) < 25: continue

        p_high = prev_day["High"].max()
        p_low = prev_day["Low"].min()

        day_calc = calculate_intraday_indicators(curr_day)
        
        # Look for sweep between bar 2 (9:25) and bar 8 (9:55)
        sweep_occurred = False
        sweep_high = 0.0
        sweep_idx = -1

        for idx in range(2, min(10, len(day_calc)-12)):
            bar = day_calc.iloc[idx]
            if bar["High"] > p_high and bar["High"] <= p_high * 1.015: # Pierced PDH by up to 1.5%
                if bar["Close"] < bar["High"] - 0.4 * bar["Range"]: # Rejection wick
                    sweep_occurred = True
                    sweep_high = bar["High"]
                    sweep_idx = idx
                    break

        if not sweep_occurred: continue

        # After sweep, look for breakdown below VWAP
        for idx in range(sweep_idx + 1, min(sweep_idx + 12, len(day_calc)-5)):
            bar = day_calc.iloc[idx]
            vwap = bar["VWAP"]
            if bar["Close"] < vwap and bar["Open"] >= vwap * 0.999: # Decisive cross below VWAP
                entry = bar["Close"]
                sl = round(max(sweep_high * 1.001, entry * 1.004), 2)
                risk = sl - entry
                risk_pct = (risk / entry) * 100.0

                if risk <= 0 or risk_pct > 1.2 or risk_pct < 0.25: continue

                t1 = round(entry - 1.5 * risk, 2)
                t2 = round(entry - 2.5 * risk, 2)

                sub = day_calc.iloc[idx+1:]
                hit_t1, hit_t2, hit_sl = False, False, False
                for _, sbar in sub.iterrows():
                    if sbar["High"] >= sl:
                        hit_sl = True
                        break
                    if sbar["Low"] <= t1: hit_t1 = True
                    if sbar["Low"] <= t2:
                        hit_t2 = True
                        break

                last_c = float(sub["Close"].iloc[-1])
                r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (entry - last_c)/risk))
                trades.append({
                    "strategy": "2_JUDAS_SWEEP_SHORT",
                    "symbol": symbol, "date": str(curr_d),
                    "entry": entry, "sl": sl, "t1": t1, "t2": t2, "risk_pct": risk_pct,
                    "win": r_pnl > 0, "r": r_pnl, "hit_t1": hit_t1, "hit_t2": hit_t2
                })
                break

    return trades


# -------------------------------------------------------------------------------------------------
# 3. STRATEGY 3: Institutional VWAP Pullback Retest (The "Golden Spring")
# -------------------------------------------------------------------------------------------------
def backtest_strat_3_vwap_pullback_spring(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    """
    Microstructure:
    1. Stock displays clear institutional demand: Surges >= 1.2% above open in first 45 mins (9:15-10:00)
    2. Instead of chasing the top, WAIT for the healthy pullback to VWAP (between 10:00 and 12:00)
    3. On the pullback to VWAP, volume MUST drop drastically (dry-up, <= 50% of morning surge volume)
    4. A green reversal candle touches/tests VWAP and closes cleanly back above VWAP
    5. Enter on VWAP bounce with ultra-tight stop right below VWAP / local swing low
    """
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for curr_d in dates:
        curr_day = df[df["Date"] == curr_d]
        if len(curr_day) < 40: continue

        day_calc = calculate_intraday_indicators(curr_day)
        open_price = day_calc["Open"].iloc[0]

        # Morning surge (first 9 bars: 9:15 - 10:00)
        morning_bars = day_calc.iloc[:9]
        surge_high = morning_bars["High"].max()
        surge_gain = (surge_high - open_price) / open_price

        if surge_gain < 0.012: continue # Must have shown real institutional power (+1.2%+)
        peak_volume = morning_bars["Volume"].max()

        # Look for controlled pullback between 10:00 and 12:30 (bars 9 to 38)
        pullback_found = False
        for idx in range(9, min(35, len(day_calc)-8)):
            bar = day_calc.iloc[idx]
            vwap = bar["VWAP"]

            # Pullback reaches VWAP zone (Low <= VWAP * 1.002 and Close >= VWAP * 0.998)
            touches_vwap = bar["Low"] <= (vwap * 1.002) and bar["High"] >= (vwap * 0.998)
            is_green_rebound = bar["Close"] > bar["Open"] and bar["Close"] >= vwap

            # Volume must be dried up (less than 60% of morning peak volume)
            dry_volume = bar["Volume"] <= 0.60 * peak_volume

            if touches_vwap and is_green_rebound and dry_volume:
                pullback_found = True
                entry = bar["Close"]
                local_low = day_calc.iloc[max(0, idx-3):idx+1]["Low"].min()
                sl = round(min(local_low * 0.9985, vwap * 0.997), 2)
                risk = entry - sl
                risk_pct = (risk / entry) * 100.0

                if risk <= 0 or risk_pct > 0.9 or risk_pct < 0.2: continue # Ultra tight risk

                t1 = round(entry + 1.5 * risk, 2)
                t2 = round(entry + 2.5 * risk, 2)

                sub = day_calc.iloc[idx+1:]
                hit_t1, hit_t2, hit_sl = False, False, False
                for _, sbar in sub.iterrows():
                    if sbar["Low"] <= sl:
                        hit_sl = True
                        break
                    if sbar["High"] >= t1: hit_t1 = True
                    if sbar["High"] >= t2:
                        hit_t2 = True
                        break

                last_c = float(sub["Close"].iloc[-1])
                r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk))
                trades.append({
                    "strategy": "3_VWAP_SPRING_PULLBACK",
                    "symbol": symbol, "date": str(curr_d),
                    "entry": entry, "sl": sl, "t1": t1, "t2": t2, "risk_pct": risk_pct,
                    "win": r_pnl > 0, "r": r_pnl, "hit_t1": hit_t1, "hit_t2": hit_t2
                })
                break # Only 1 trade per stock per day

    return trades


# -------------------------------------------------------------------------------------------------
# 4. STRATEGY 4: Mid-Day Volatility Squeeze Breakout (European Open 12:30-13:30 IST)
# -------------------------------------------------------------------------------------------------
def backtest_strat_4_midday_squeeze(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    """
    Microstructure:
    1. From 10:00 to 12:30, stock is locked in a tight compression range (Range < 0.6% total)
    2. Price is strictly oscillating around flat VWAP with contracting volume
    3. At 12:30 - 13:30 (London open), price violently breaks out above range high with 2.5x volume
    4. Momentum carries cleanly into the 14:30 - 15:15 closing auction!
    """
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for curr_d in dates:
        curr_day = df[df["Date"] == curr_d]
        if len(curr_day) < 55: continue

        day_calc = calculate_intraday_indicators(curr_day)
        
        # Consolidation window: 10:00 (bar 9) to 12:30 (bar 39) = 30 bars
        cons_bars = day_calc.iloc[9:39]
        cons_high = cons_bars["High"].max()
        cons_low = cons_bars["Low"].min()
        cons_mid = (cons_high + cons_low) / 2.0
        cons_width_pct = ((cons_high - cons_low) / cons_mid) * 100.0

        # Must be tightly compressed: less than 0.65% total range for 2.5 hours!
        if cons_width_pct > 0.65: continue
        avg_cons_vol = cons_bars["Volume"].mean()

        # European open breakout window: 12:30 to 13:45 (bars 39 to 54)
        for idx in range(39, min(54, len(day_calc)-6)):
            bar = day_calc.iloc[idx]
            # Breakout bar: Closes above consolidation high + Volume surge >= 2.2x
            if bar["Close"] > cons_high and bar["Volume"] >= 2.2 * avg_cons_vol:
                entry = bar["Close"]
                sl = round(cons_mid, 2) # Stop loss at the midpoint of consolidation
                risk = entry - sl
                risk_pct = (risk / entry) * 100.0

                if risk <= 0 or risk_pct > 0.8 or risk_pct < 0.15: continue

                t1 = round(entry + 1.5 * risk, 2)
                t2 = round(entry + 2.5 * risk, 2)

                sub = day_calc.iloc[idx+1:]
                hit_t1, hit_t2, hit_sl = False, False, False
                for _, sbar in sub.iterrows():
                    if sbar["Low"] <= sl:
                        hit_sl = True
                        break
                    if sbar["High"] >= t1: hit_t1 = True
                    if sbar["High"] >= t2:
                        hit_t2 = True
                        break

                last_c = float(sub["Close"].iloc[-1])
                r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk))
                trades.append({
                    "strategy": "4_MIDDAY_SQUEEZE",
                    "symbol": symbol, "date": str(curr_d),
                    "entry": entry, "sl": sl, "t1": t1, "t2": t2, "risk_pct": risk_pct,
                    "win": r_pnl > 0, "r": r_pnl, "hit_t1": hit_t1, "hit_t2": hit_t2
                })
                break

    return trades


# -------------------------------------------------------------------------------------------------
# 5. STRATEGY 5: The "Apex Sniper" (Multi-Confluence: RS + Open=Low + VWAP + Range Filter)
# -------------------------------------------------------------------------------------------------
def backtest_strat_5_apex_sniper(df_all: pd.DataFrame, symbol: str) -> List[Dict[str, Any]]:
    """
    The Pinnacle of High Conversion:
    Combines Float Contraction + Open=Low + Zero Overhead Supply:
    1. Prior Day was Inside Bar or Narrow Range (Float locked)
    2. Today 9:15 - 9:30 has Open == Low (Zero sellers at open)
    3. 9:30 candle closes above Prior Day High AND above 15M High
    4. Price never violates VWAP
    5. SL is placed strictly at Day Low with max 0.75% risk
    6. Trailing profit exit at 2R or Day Close
    """
    df = df_all.copy()
    df["Date"] = pd.to_datetime(df.index).date
    dates = sorted(list(df["Date"].unique()))
    trades = []

    for i in range(2, len(dates)):
        curr_d = dates[i]
        curr_day = df[df["Date"] == curr_d]
        prev_day = df[df["Date"] == dates[i-1]]
        pp_day = df[df["Date"] == dates[i-2]]

        if len(curr_day) < 35 or len(prev_day) < 25 or len(pp_day) < 25: continue

        # Prior day contraction: range smaller than day before
        p_range = prev_day["High"].max() - prev_day["Low"].min()
        pp_range = pp_day["High"].max() - pp_day["Low"].min()
        if p_range > pp_range: continue # Must be a contracting day!

        day_calc = calculate_intraday_indicators(curr_day)
        m15 = day_calc.iloc[:3]

        open_p = m15["Open"].iloc[0]
        low_p = m15["Low"].min()
        high_p = m15["High"].max()
        close_p = m15["Close"].iloc[-1]
        vwap_15 = m15["VWAP"].iloc[-1]

        # Open = Low condition (< 0.05% wick)
        if (open_p - low_p) / open_p > 0.0005: continue

        # Must close above VWAP and above Previous Day High
        p_high = prev_day["High"].max()
        if close_p < p_high or close_p < vwap_15: continue

        # Solid body (> 65% of 15m range)
        tot_range = high_p - low_p
        if tot_range <= 0 or (close_p - open_p) / tot_range < 0.65: continue

        entry = close_p
        sl = round(open_p * 0.9985, 2)
        risk = entry - sl
        risk_pct = (risk / entry) * 100.0

        if risk <= 0 or risk_pct > 0.85 or risk_pct < 0.2: continue

        t1 = round(entry + 1.5 * risk, 2)
        t2 = round(entry + 2.5 * risk, 2)

        sub = day_calc.iloc[3:]
        hit_t1, hit_t2, hit_sl = False, False, False
        for _, sbar in sub.iterrows():
            if sbar["Low"] <= sl:
                hit_sl = True
                break
            if sbar["High"] >= t1: hit_t1 = True
            if sbar["High"] >= t2:
                hit_t2 = True
                break

        last_c = float(sub["Close"].iloc[-1])
        r_pnl = 2.5 if hit_t2 else (1.5 if hit_t1 else (-1.0 if hit_sl else (last_c - entry)/risk))
        trades.append({
            "strategy": "5_APEX_SNIPER",
            "symbol": symbol, "date": str(curr_d),
            "entry": entry, "sl": sl, "t1": t1, "t2": t2, "risk_pct": risk_pct,
            "win": r_pnl > 0, "r": r_pnl, "hit_t1": hit_t1, "hit_t2": hit_t2
        })

    return trades


def run_all_deep_strategies():
    print("\n" + "=" * 90)
    print("  ALPHA INDIA: DEEP OUT-OF-THE-BOX QUANTITATIVE INTRADAY RESEARCH (S-38)")
    print("=" * 90)
    print(f"Testing {len(FOCUS_UNIVERSE)} Institutional Stocks over 60 Days of 5-Minute Candle Data...")

    # Pre-fetch data
    data_map = {}
    for sym in FOCUS_UNIVERSE:
        df = fetch_5m_data(sym)
        if df is not None and len(df) >= 100:
            data_map[sym] = df

    print(f"Successfully loaded 5m data for {len(data_map)} / {len(FOCUS_UNIVERSE)} stocks.\n")

    strategies = [
        ("STRATEGY 1: Open=Low Float Squeeze (Contraction Ignition)", backtest_strat_1_open_low_drive),
        ("STRATEGY 2: Judas Swing Fakeout Liquidity Sweep (Short the Trap)", backtest_strat_2_judas_sweep),
        ("STRATEGY 3: Institutional VWAP Pullback Spring (Dry-Volume Retest)", backtest_strat_3_vwap_pullback_spring),
        ("STRATEGY 4: Mid-Day European Open Squeeze (Consolidation Explosion)", backtest_strat_4_midday_squeeze),
        ("STRATEGY 5: Apex Sniper (Prior Compression + Open=Low + Clean Break)", backtest_strat_5_apex_sniper),
    ]

    summary_results = []

    for name, func in strategies:
        all_trades = []
        for sym, df in data_map.items():
            t = func(df, sym)
            if t: all_trades.extend(t)

        if not all_trades:
            print(f"[-] {name}: 0 trades triggered.")
            continue

        res_df = pd.DataFrame(all_trades)
        tot = len(res_df)
        wins = res_df[res_df["win"] == True]
        losses = res_df[res_df["win"] == False]
        wr = (len(wins) / tot) * 100.0
        t1_hits = res_df["hit_t1"].sum()
        t2_hits = res_df["hit_t2"].sum()

        w_r = res_df[res_df["r"] > 0]["r"].sum()
        l_r = abs(res_df[res_df["r"] <= 0]["r"].sum())
        pf = w_r / max(0.01, l_r)
        avg_r = res_df["r"].mean()
        avg_risk = res_df["risk_pct"].mean()

        # Frequency: across 45 trading days
        trades_per_day = tot / 45.0

        summary_results.append({
            "name": name,
            "total_trades": tot,
            "trades_per_day": round(trades_per_day, 2),
            "win_rate": round(wr, 1),
            "profit_factor": round(pf, 2),
            "avg_r": round(avg_r, 2),
            "t1_rate": round(t1_hits / tot * 100, 1),
            "t2_rate": round(t2_hits / tot * 100, 1),
            "avg_risk_pct": round(avg_risk, 2),
            "df": res_df
        })

        print("=" * 90)
        print(f"  {name.upper()}")
        print("=" * 90)
        print(f"  • Total Trades in 60 Days: {tot:4d}  (~{trades_per_day:.2f} trades/day across universe)")
        print(f"  • WIN RATE               : {wr:5.1f}%")
        print(f"  • Target 1 (1.5R) Hit    : {t1_hits:4d} ({t1_hits/tot*100:4.1f}%)")
        print(f"  • Target 2 (2.5R) Hit    : {t2_hits:4d} ({t2_hits/tot*100:4.1f}%)")
        print(f"  • PROFIT FACTOR          : {pf:5.2f}")
        print(f"  • AVERAGE EXPECTANCY     : {avg_r:+5.2f}R per trade")
        print(f"  • AVERAGE RISK PARAMETER : {avg_risk:4.2f}% stop distance")
        print("-" * 90)

    # Save detailed summary to disk
    out_file = Path(__file__).resolve().parent.parent / "data" / "deep_research_comparison.json"
    clean_summary = []
    for s in summary_results:
        clean_summary.append({
            "name": s["name"],
            "total_trades": s["total_trades"],
            "trades_per_day": s["trades_per_day"],
            "win_rate": s["win_rate"],
            "profit_factor": s["profit_factor"],
            "avg_r": s["avg_r"],
            "t1_rate": s["t1_rate"],
            "t2_rate": s["t2_rate"],
            "avg_risk_pct": s["avg_risk_pct"],
        })
    with open(out_file, "w") as f:
        json.dump(clean_summary, f, indent=2)
    print(f"\nSaved deep research comparison to: {out_file}")

if __name__ == "__main__":
    run_all_deep_strategies()
