"""
Alpha India - Nifty 500 Comprehensive 12 FX Swing Strategy Backtest
===================================================================
Executes the institutional 12 FX Confluence Strategy across all ~500
equities of the official Nifty 500 index over 1 year of daily market bars.

Architecture:
1. Multi-threaded data ingestion (ThreadPoolExecutor with 20 workers).
2. Nifty 50 Market Regime Shield (^NSEI trend filter).
3. Stage 2 Trend Alignment (Price > 50 DMA > 200 DMA + Rising 50 DMA + RS ROC60 >= 4%).
4. 12 FX Indicator Confluence Scoring (Threshold >= 80%).
5. Reversal Confirmation Trigger (Green bar, close in upper 50%, breakout of prior high).
6. Asymmetric Profit Harvesting:
   - Target 1 (+2.8% to +3.5%): Lock 80% profit, trail runner stop to Breakeven (+0.3%).
   - Target 2 (+7.0% to +10.0%): Runner exit.
   - Stop Loss: 0.5x ATR below swing low (risk capped 4.0% - 5.5%).
7. Outputs Global Win Rate, Profit Factor, Sector Win Rates, and Top Equities.
"""
import os
import sys
import time
import json
import logging
import concurrent.futures
from datetime import datetime
from typing import Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Nifty500_Backtest")


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


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)


def fetch_single_stock(sym: str) -> Tuple[str, Optional[pd.DataFrame]]:
    for suffix in [".NS", ".BO"]:
        ticker = f"{sym}{suffix}"
        try:
            t = yf.Ticker(ticker)
            df = t.history(period="1y", interval="1d")
            if not df.empty and len(df) >= 60:
                return sym, df
        except Exception:
            pass
    return sym, None


def load_nifty500_data() -> Tuple[Dict[str, pd.DataFrame], Dict[str, str], Optional[pd.DataFrame]]:
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "ind_nifty500list.csv")
    if not os.path.exists(csv_path):
        logger.info("Downloading official Nifty 500 list from NSE...")
        import urllib.request
        req = urllib.request.Request('https://archives.nseindia.com/content/indices/ind_nifty500list.csv', headers={'User-Agent': 'Mozilla/5.0'})
        data = urllib.request.urlopen(req, timeout=10).read()
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        with open(csv_path, 'wb') as f:
            f.write(data)
            
    df_meta = pd.read_csv(csv_path)
    symbols = df_meta["Symbol"].str.strip().tolist()
    industry_map = dict(zip(df_meta["Symbol"].str.strip(), df_meta["Industry"].fillna("General")))
    
    logger.info(f"Loaded {len(symbols)} Nifty 500 symbols from catalog. Downloading bars with 20 threads...")
    t0 = time.time()
    
    stock_dfs = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(fetch_single_stock, symbols)
        for sym, df in results:
            if df is not None:
                stock_dfs[sym] = df
                
    elapsed = time.time() - t0
    logger.info(f"Successfully downloaded {len(stock_dfs)}/{len(symbols)} equities in {elapsed:.1f}s.")
    
    # Download Nifty 50 for Market Shield
    nifty_df = None
    try:
        t_nifty = yf.Ticker("^NSEI")
        nifty_df = t_nifty.history(period="1y", interval="1d")
        logger.info(f"Loaded Nifty 50 benchmark: {len(nifty_df)} bars.")
    except Exception as e:
        logger.warning(f"Could not load Nifty 50: {e}")
        
    return stock_dfs, industry_map, nifty_df


def backtest_nifty500(
    stock_dfs: Dict[str, pd.DataFrame],
    industry_map: Dict[str, str],
    nifty_df: Optional[pd.DataFrame],
    min_confluence: float = 80.0,
    min_roc: float = 4.0,
    target_1_pct: float = 0.028,
    target_2_pct: float = 0.080,
    max_stop_pct: float = 0.048,
    harvest_ratio: float = 0.80,
    cooldown_bars: int = 5,
    max_holding_bars: int = 15
) -> Dict[str, Any]:
    # Precompute Nifty 50 moving averages
    if nifty_df is not None and not nifty_df.empty:
        nifty_df = nifty_df.copy()
        n_c = nifty_df["Close"].astype(float).ffill()
        nifty_df["EMA20"] = n_c.ewm(span=20, adjust=False).mean()
        nifty_df["SMA50"] = n_c.rolling(50, min_periods=20).mean()

    all_trades = []
    per_stock = {}
    
    for sym, raw_df in stock_dfs.items():
        if raw_df.empty or len(raw_df) < 60:
            continue
            
        df = raw_df.copy()
        df.columns = [str(c).capitalize() for c in df.columns]
        closes = df["Close"].astype(float).ffill()
        highs = df["High"].astype(float).ffill()
        lows = df["Low"].astype(float).ffill()
        opens = df["Open"].astype(float).ffill()
        volumes = df["Volume"].astype(float).fillna(0.0)
        
        # 1. Moving Averages
        sma50 = closes.rolling(50, min_periods=20).mean()
        sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
        ema20 = closes.ewm(span=20, adjust=False).mean()
        ema9 = closes.ewm(span=9, adjust=False).mean()
        
        # 2. Supertrend (10, 3)
        st_val, st_dir, atr = calculate_supertrend(df, 10, 3.0)
        
        # 3. Bollinger Bands (20, 2)
        sma20_bb = closes.rolling(20, min_periods=10).mean()
        std20_bb = closes.rolling(20, min_periods=10).std().fillna(0.0)
        bb_upper = sma20_bb + (std20_bb * 2.0)
        bb_lower = sma20_bb - (std20_bb * 2.0)
        bb_range = (bb_upper - bb_lower).replace(0, 1.0)
        bb_pct_b = (closes - bb_lower) / bb_range
        bb_width = (bb_range / sma20_bb.replace(0, 1.0)) * 100.0
        
        # 4. RSI (14) & MACD (12, 26, 9)
        rsi = calculate_rsi(closes, 14)
        fast_ema = closes.ewm(span=12, adjust=False).mean()
        slow_ema = closes.ewm(span=26, adjust=False).mean()
        macd = fast_ema - slow_ema
        macd_sig = macd.ewm(span=9, adjust=False).mean()
        
        # 5. Volume & VWAP
        vol_sma20 = volumes.rolling(20, min_periods=5).mean()
        typical_p = (highs + lows + closes) / 3.0
        cum_vp = (typical_p * volumes).cumsum()
        cum_v = volumes.cumsum().replace(0, np.nan)
        vwap = (cum_vp / cum_v).ffill()
        
        in_trade = False
        entry_price = 0.0
        entry_date = None
        stop_loss = 0.0
        target_1 = 0.0
        target_2 = 0.0
        t1_hit = False
        entry_bar = 0
        last_exit_bar = -99
        stock_trades = []
        
        for i in range(50, len(df)):
            c_price = float(closes.iloc[i])
            c_high = float(highs.iloc[i])
            c_low = float(lows.iloc[i])
            c_open = float(opens.iloc[i])
            c_vol = float(volumes.iloc[i])
            c_date = df.index[i]
            
            p_high = float(highs.iloc[i-1])
            p_close = float(closes.iloc[i-1])
            p_low = float(lows.iloc[i-1])
            p_vol = float(volumes.iloc[i-1])
            
            d50 = float(sma50.iloc[i])
            d50_prev = float(sma50.iloc[i-5]) if i >= 55 else d50
            d200 = float(sma200.iloc[i])
            e20 = float(ema20.iloc[i])
            e9 = float(ema9.iloc[i])
            c_rsi = float(rsi.iloc[i])
            c_macd = float(macd.iloc[i])
            c_sig = float(macd_sig.iloc[i])
            c_vwap = float(vwap.iloc[i])
            st_d = int(st_dir[i])
            st_t = float(st_val[i])
            c_atr = float(atr[i])
            v_ma = float(vol_sma20.iloc[i]) if float(vol_sma20.iloc[i]) > 0 else 1.0
            c_pct_b = float(bb_pct_b.iloc[i])
            
            # CPR
            cpr_pivot = (p_high + p_low + p_close) / 3.0
            cpr_bc = (p_high + p_low) / 2.0
            cpr_tc = (2.0 * cpr_pivot) - cpr_bc
            cpr_bot = min(cpr_tc, cpr_bc)
            cpr_r1 = (2.0 * cpr_pivot) - p_low
            
            # 12 FX Confluence Scoring
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
                "candle": (c_price >= c_open and (c_price - c_low) / max(0.01, c_high - c_low) >= 0.50, 10)
            }
            
            total_weight = sum(w for _, w in checks.values())
            earned_weight = sum(w for ok, w in checks.values() if ok)
            confluence_score = (earned_weight / total_weight) * 100.0
            
            # Exhaustion Check
            is_exhausted = (c_rsi > 68.0) or ((c_price - e20) > 2.2 * c_atr)
            
            # Mandatory Institutional Stage 2 Gate + Relative Strength Leader
            roc60 = float((closes.iloc[i] / closes.iloc[i-60] - 1.0) * 100.0) if i >= 60 else 0.0
            stage2_mandatory = (c_price >= d50) and (d50 >= d200 * 0.99) and (d50 >= d50_prev * 0.998) and (roc60 >= min_roc)
            
            # Pullback Support Test: Tested 20 EMA or VWAP in last 3 sessions
            recent_lows_3d = float(lows.iloc[max(0, i-2):i+1].min())
            tested_support = (recent_lows_3d <= e20 * 1.025) or (recent_lows_3d <= c_vwap * 1.015)
            
            # Reversal Confirmation Bar
            bar_range = max(0.01, c_high - c_low)
            close_loc = (c_price - c_low) / bar_range
            reversal_confirmed = (c_price >= c_open) and (close_loc >= 0.52) and (c_high >= p_high) and (c_price > p_close)
            
            # Cooldown
            cooldown_ok = (i - last_exit_bar) >= cooldown_bars
            
            # Nifty Market Shield
            market_ok = True
            if nifty_df is not None and c_date in nifty_df.index:
                try:
                    n_val = nifty_df.loc[c_date]
                    n_close = float(n_val["Close"].iloc[0] if isinstance(n_val["Close"], pd.Series) else n_val["Close"])
                    n_e20 = float(n_val["EMA20"].iloc[0] if isinstance(n_val["EMA20"], pd.Series) else n_val["EMA20"])
                    market_ok = (n_close >= n_e20 * 0.995)
                except Exception:
                    market_ok = True
                    
            if not in_trade:
                if (confluence_score >= min_confluence) and stage2_mandatory and tested_support and reversal_confirmed and cooldown_ok and market_ok and not is_exhausted:
                    in_trade = True
                    entry_price = c_price
                    entry_date = c_date
                    entry_bar = i
                    t1_hit = False
                    
                    # Stop loss with 0.5x ATR buffer (capped 4.0% - 5.0%)
                    sw_low = float(lows.iloc[max(0, i-4):i+1].min())
                    calc_stop = sw_low - (0.5 * c_atr)
                    calc_stop = min(calc_stop, entry_price * 0.962)
                    stop_loss = round(max(calc_stop, entry_price * (1.0 - max_stop_pct)), 2)
                    if stop_loss >= entry_price:
                        stop_loss = round(entry_price * 0.955, 2)
                        
                    # Target 1 and Target 2
                    target_1 = round(max(cpr_r1, entry_price * (1.0 + target_1_pct)), 2)
                    if target_1 > entry_price * 1.05:
                        target_1 = round(entry_price * (1.0 + target_1_pct), 2)
                    target_2 = round(entry_price * (1.0 + target_2_pct), 2)
            else:
                bars_held = i - entry_bar
                exit_trade = False
                exit_reason = ""
                pnl_pct = 0.0
                
                # 1. Target 1 Reached: Lock 80% profit, move runner stop to Breakeven (+0.3%)
                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)
                    
                # 2. Target 2 Reached: Full exit
                if c_high >= target_2:
                    exit_trade = True
                    exit_reason = "TARGET_2_FULL"
                    t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                    t2_pnl = (target_2 - entry_price) / entry_price * 100.0
                    pnl_pct = round((t1_pnl * harvest_ratio) + (t2_pnl * (1.0 - harvest_ratio)), 2)
                    
                # 3. Stop Loss Triggered
                elif c_low <= stop_loss:
                    exit_trade = True
                    if t1_hit:
                        exit_reason = "BREAKEVEN_STOP_AFTER_T1"
                        t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                        pnl_pct = round(t1_pnl * harvest_ratio, 2)
                    else:
                        exit_reason = "INITIAL_STOP"
                        pnl_pct = round((stop_loss - entry_price) / entry_price * 100.0, 2)
                        
                # 4. Supertrend Flipped Red
                elif st_d == -1 and c_price < e20:
                    exit_trade = True
                    exit_reason = "SUPERTREND_RED"
                    exit_pnl = (c_price - entry_price) / entry_price * 100.0
                    if t1_hit:
                        t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                        pnl_pct = round((t1_pnl * harvest_ratio) + (exit_pnl * (1.0 - harvest_ratio)), 2)
                    else:
                        pnl_pct = round(exit_pnl, 2)
                        
                # 5. Time Stall
                elif bars_held >= max_holding_bars:
                    exit_trade = True
                    exit_reason = "TIME_STALL"
                    exit_pnl = (c_price - entry_price) / entry_price * 100.0
                    if t1_hit:
                        t1_pnl = (target_1 - entry_price) / entry_price * 100.0
                        pnl_pct = round((t1_pnl * harvest_ratio) + (exit_pnl * (1.0 - harvest_ratio)), 2)
                    else:
                        pnl_pct = round(exit_pnl, 2)
                        
                if exit_trade:
                    td = {
                        "symbol": sym,
                        "industry": industry_map.get(sym, "General"),
                        "entry_date": entry_date.strftime("%Y-%m-%d") if hasattr(entry_date, "strftime") else str(entry_date),
                        "exit_date": c_date.strftime("%Y-%m-%d") if hasattr(c_date, "strftime") else str(c_date),
                        "entry_price": round(entry_price, 2),
                        "pnl_pct": pnl_pct,
                        "is_win": pnl_pct > 0.0,
                        "t1_hit": t1_hit,
                        "bars_held": bars_held,
                        "exit_reason": exit_reason,
                        "confluence": round(confluence_score, 1)
                    }
                    stock_trades.append(td)
                    all_trades.append(td)
                    in_trade = False
                    last_exit_bar = i
                    
        if stock_trades:
            per_stock[sym] = stock_trades
            
    total = len(all_trades)
    if total == 0:
        return {"total": 0, "win_rate": 0.0, "profit_factor": 0.0, "all_trades": [], "per_stock": {}}
        
    wins = [t for t in all_trades if t["is_win"]]
    losses = [t for t in all_trades if not t["is_win"]]
    win_rate = round(len(wins) / total * 100.0, 1)
    
    tot_win_gain = sum(t["pnl_pct"] for t in wins)
    tot_loss_pct = abs(sum(t["pnl_pct"] for t in losses))
    pf = round(tot_win_gain / max(0.01, tot_loss_pct), 2)
    avg_win = round(tot_win_gain / len(wins), 2) if wins else 0.0
    avg_loss = round(sum(t["pnl_pct"] for t in losses) / len(losses), 2) if losses else 0.0
    
    # Sector breakdown
    sector_stats = {}
    for t in all_trades:
        ind = t["industry"]
        if ind not in sector_stats:
            sector_stats[ind] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}
        sector_stats[ind]["trades"] += 1
        if t["is_win"]:
            sector_stats[ind]["wins"] += 1
        else:
            sector_stats[ind]["losses"] += 1
        sector_stats[ind]["pnl"] += t["pnl_pct"]
        
    for ind, s in sector_stats.items():
        s["win_rate"] = round(s["wins"] / s["trades"] * 100.0, 1)
        s["pnl"] = round(s["pnl"], 2)
        
    return {
        "total": total,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "profit_factor": pf,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "avg_holding_days": round(float(np.mean([t["bars_held"] for t in all_trades])), 1) if all_trades else 0.0,
        "all_trades": all_trades,
        "per_stock": per_stock,
        "sector_stats": sector_stats
    }


if __name__ == "__main__":
    stock_dfs, industry_map, nifty_df = load_nifty500_data()
    
    print("\n" + "="*85)
    print("      NIFTY 500 INSTITUTIONAL 12 FX SWING STRATEGY BACKTEST")
    print("="*85)
    
    res = backtest_nifty500(
        stock_dfs,
        industry_map,
        nifty_df,
        min_confluence=80.0,
        min_roc=4.0,
        target_1_pct=0.028,
        harvest_ratio=0.80
    )
    
    # Mode 2: Sniper Precision Confluence across Nifty 500 (Conf >= 85%, ROC >= 8%)
    res_sniper = backtest_nifty500(
        stock_dfs,
        industry_map,
        nifty_df,
        min_confluence=85.0,
        min_roc=8.0,
        target_1_pct=0.028,
        harvest_ratio=0.80
    )

    print(f"Total Nifty 500 Equities Analyzed: {len(stock_dfs)}")
    print(f"Historical Window:                 1 Year (Daily Bars)")
    print(f"--- [MODE 1: BROAD NIFTY 500 (CONF >= 80%)] ---")
    print(f"Total Trades Executed:             {res['total']}")
    print(f"Winning Trades:                    {res['wins']} ({res['win_rate']}%)")
    print(f"Losing Trades:                     {res['losses']}")
    print(f"GLOBAL WIN RATE:                   {res['win_rate']}%")
    print(f"PROFIT FACTOR:                     {res['profit_factor']}")
    print(f"AVERAGE WIN:                       +{res['avg_win']}%")
    print(f"AVERAGE LOSS:                      {res['avg_loss']}%")
    print(f"AVERAGE HOLDING PERIOD:            {res['avg_holding_days']} Days")
    print(f"REALIZED REWARD:RISK:              {round(res['avg_win']/abs(res['avg_loss']), 2)} : 1")
    print(f"--- [MODE 2: INSTITUTIONAL SNIPER (CONF >= 85%, ROC60 >= 8%)] ---")
    print(f"Total Trades Executed:             {res_sniper['total']}")
    print(f"Winning Trades:                    {res_sniper['wins']} ({res_sniper['win_rate']}%)")
    print(f"Losing Trades:                     {res_sniper['losses']}")
    print(f"GLOBAL WIN RATE:                   {res_sniper['win_rate']}%")
    print(f"PROFIT FACTOR:                     {res_sniper['profit_factor']}")
    print(f"AVERAGE WIN:                       +{res_sniper['avg_win']}%")
    print(f"AVERAGE LOSS:                      {res_sniper['avg_loss']}%")
    print(f"AVERAGE HOLDING PERIOD:            {res_sniper['avg_holding_days']} Days")
    print(f"REALIZED REWARD:RISK:              {round(res_sniper['avg_win']/abs(res_sniper['avg_loss']), 2)} : 1")
    print("="*85)
    
    # Sector Breakdown Table
    print("\n" + "-"*85)
    print("SECTOR & INDUSTRY PERFORMANCE ACROSS NIFTY 500:")
    print("-"*85)
    print(f"{'INDUSTRY / SECTOR':<28} | {'TRADES':<7} | {'WINS':<5} | {'LOSSES':<6} | {'WIN RATE':<9} | {'NET PNL':<9}")
    print("-"*85)
    sorted_sectors = sorted(res["sector_stats"].items(), key=lambda x: x[1]["trades"], reverse=True)
    for ind, s in sorted_sectors[:15]:
        print(f"{ind:<28} | {s['trades']:<7} | {s['wins']:<5} | {s['losses']:<6} | {s['win_rate']:>7.1f}% | {s['pnl']:>+7.2f}%")
        
    # Top 20 Best Performing Stocks in Nifty 500
    print("\n" + "-"*85)
    print("TOP 20 BEST PERFORMING EQUITIES IN NIFTY 500:")
    print("-"*85)
    print(f"{'SYMBOL':<14} | {'TRADES':<6} | {'WINS':<4} | {'LOSSES':<6} | {'WIN RATE':<9} | {'NET PNL':<9} | {'PF':<6}")
    print("-"*85)
    stock_summaries = []
    for sym, trades in res["per_stock"].items():
        w = len([t for t in trades if t["is_win"]])
        l = len([t for t in trades if not t["is_win"]])
        wr = round(w / len(trades) * 100.0, 1)
        net = round(sum(t["pnl_pct"] for t in trades), 2)
        pos = sum(t["pnl_pct"] for t in trades if t["is_win"])
        neg = abs(sum(t["pnl_pct"] for t in trades if not t["is_win"]))
        pf = round(pos / max(0.01, neg), 2)
        stock_summaries.append((sym, len(trades), w, l, wr, net, pf))
        
    stock_summaries.sort(key=lambda x: (x[4], x[5]), reverse=True)
    for s in stock_summaries[:20]:
        print(f"{s[0]:<14} | {s[1]:<6} | {s[2]:<4} | {s[3]:<6} | {s[4]:>7.1f}% | {s[5]:>+7.2f}% | {s[6]:>6.2f}")
    print("="*85)
    
    # Save results to json for auditing
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "nifty500_fx_swing_backtest.json")
    with open(output_path, "w") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "universe_size": len(stock_dfs),
            "total_trades": res["total"],
            "wins": res["wins"],
            "losses": res["losses"],
            "win_rate": res["win_rate"],
            "profit_factor": res["profit_factor"],
            "avg_win": res["avg_win"],
            "avg_loss": res["avg_loss"],
            "avg_holding_days": res["avg_holding_days"],
            "sector_stats": res["sector_stats"],
            "sample_trades": res["all_trades"][:50]
        }, f, indent=2)
    print(f"\n[Audit Report Saved to data/nifty500_fx_swing_backtest.json]")
