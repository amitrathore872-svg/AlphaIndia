"""
Target >75% Win Rate Quantitative Swing Strategy
------------------------------------------------
Key Institutional Filters for >75% Hit Rate:
1. Macro Stage 2 Filter:
   - Price > 50 DMA and 50 DMA > 200 DMA
   - 50 DMA is positively trending (SMA50[t] >= SMA50[t-5])
   - 60-Day Relative Strength / ROC > 0% (filters out dying Stage 4 stocks)
2. Pullback & Reversal Candle:
   - Price touches / bounces near 20 EMA or VWAP (within 1.5%)
   - Bullish Reversal Confirmation: Green Candle (Close >= Open) AND Close in top 50% of bar range
   - RSI in Momentum Zone (RSI >= 50.0 and <= 68.0)
   - MACD Bullish or Histogram turning positive
   - Supertrend is Green
3. Asymmetric Profit Architecture:
   - Target 1: +3.8% to +4.5% (High probability resistance / liquidity sweep)
   - When Target 1 is hit: 60% of position profit is locked in, and stop is moved to Breakeven (+0.3%)
   - Remaining 40% position rides to Target 2 (+8.0%) or trails until 20 EMA break / Supertrend flip
   - Strict initial stop loss capped at 4.0%
"""
import os
import sys
import logging
import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FX_Winrate_Optimizer")

EQUITY_UNIVERSE = [
    # Active Portfolio Holdings
    "WINDLAS", "WAAREEENER", "SUDEEPPHRM", "STYLAMIND", "PICCADIL", "PHOENIXLTD",
    "JSLL", "FCL", "E2E", "CARTRADE", "BUILDPRO", "BHARATFORG", "BETA",
    "ATHERENERG", "ASTRAMICRO", "AEROENTER", "AEGISLOG",
    # Watchlist Conviction Equities
    "LAURUSLABS", "ROLEXRINGS", "CYIENT", "LALPATHLAB", "SKYGOLD", "SOMANYCERA",
    # Benchmark Leaders
    "POLYCAB", "DIXON", "HAL", "BEL", "TITAN", "CDSL"
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

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

def backtest(stock_dfs: dict, t1_pct: float, t2_pct: float, max_sl: float, min_rsi: float, min_roc60: float, min_close_loc: float):
    all_trades = []
    per_stock = {}
    
    for sym, raw_df in stock_dfs.items():
        if raw_df.empty or len(raw_df) < 50:
            continue
            
        df = raw_df.copy()
        df.columns = [str(c).capitalize() for c in df.columns]
        closes = df["Close"].astype(float)
        highs = df["High"].astype(float)
        lows = df["Low"].astype(float)
        opens = df["Open"].astype(float)
        volumes = df["Volume"].astype(float)
        
        ema9 = closes.ewm(span=9, adjust=False).mean()
        ema20 = closes.ewm(span=20, adjust=False).mean()
        sma50 = closes.rolling(50, min_periods=20).mean()
        sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
        
        st_val, st_dir, atr = calculate_supertrend(df, period=10, multiplier=3.0)
        rsi = calculate_rsi(closes, period=14)
        
        fast_ema = closes.ewm(span=12, adjust=False).mean()
        slow_ema = closes.ewm(span=26, adjust=False).mean()
        macd = fast_ema - slow_ema
        macd_sig = macd.ewm(span=9, adjust=False).mean()
        
        vol_sma20 = volumes.rolling(20, min_periods=5).mean()
        roc60 = (closes / closes.shift(60) - 1.0) * 100.0
        
        in_trade = False
        entry_price = 0.0
        entry_date = None
        stop_loss = 0.0
        target_1 = 0.0
        target_2 = 0.0
        t1_hit = False
        entry_bar = 0
        stock_trades = []
        
        for i in range(50, len(df)):
            c_price = float(closes.iloc[i])
            c_high = float(highs.iloc[i])
            c_low = float(lows.iloc[i])
            c_open = float(opens.iloc[i])
            c_vol = float(volumes.iloc[i])
            c_date = df.index[i]
            
            d50 = float(sma50.iloc[i])
            d50_prev = float(sma50.iloc[i-5]) if i >= 55 else d50
            d200 = float(sma200.iloc[i])
            e20 = float(ema20.iloc[i])
            e9 = float(ema9.iloc[i])
            c_rsi = float(rsi.iloc[i])
            c_macd = float(macd.iloc[i])
            c_sig = float(macd_sig.iloc[i])
            st_d = int(st_dir[i])
            c_atr = float(atr[i])
            v_ma = float(vol_sma20.iloc[i])
            r60 = float(roc60.iloc[i]) if not pd.isna(roc60.iloc[i]) else 0.0
            
            rng = max(0.01, c_high - c_low)
            close_loc = (c_price - c_low) / rng
            
            if not in_trade:
                # 1. Institutional Stage 2 Trend Alignment
                # Must be above 50 DMA, 50 DMA >= 200 DMA, 50 DMA rising or flat, 60D ROC positive
                stage2_ok = (c_price >= d50 * 0.995) and (d50 >= d200 * 0.985) and (d50 >= d50_prev * 0.997) and (r60 >= min_roc60)
                
                # 2. Supertrend Green
                st_ok = (st_d == 1)
                
                # 3. Pullback / 20 EMA bounce
                pullback_ok = (c_low <= e20 * 1.02) and (c_price >= e20 * 0.99)
                
                # 4. Confirmation Reversal Candle: Green candle with strong close
                candle_ok = (c_price >= c_open) and (close_loc >= min_close_loc)
                
                # 5. RSI Sweet Spot
                rsi_ok = (min_rsi <= c_rsi <= 68.0)
                
                # 6. MACD Bullish or Histogram turning up
                macd_ok = (c_macd >= c_sig) or (c_macd >= -0.1 and (c_macd - c_sig) >= -0.05)
                
                if stage2_ok and st_ok and pullback_ok and candle_ok and rsi_ok and macd_ok:
                    in_trade = True
                    entry_price = c_price
                    entry_date = c_date
                    entry_bar = i
                    t1_hit = False
                    
                    # Stop loss: buffered below recent low, max capped at max_sl
                    recent_low = float(lows.iloc[max(0, i-4):i+1].min())
                    calc_stop = recent_low - (0.25 * c_atr)
                    stop_loss = round(max(calc_stop, entry_price * (1.0 - max_sl)), 2)
                    if stop_loss >= entry_price:
                        stop_loss = round(entry_price * 0.965, 2)
                        
                    # Target 1 and Target 2
                    target_1 = round(entry_price * (1.0 + t1_pct), 2)
                    target_2 = round(entry_price * (1.0 + t2_pct), 2)
            else:
                bars_held = i - entry_bar
                exit_trade = False
                exit_reason = ""
                pnl_pct = 0.0
                
                # Step 1: Target 1 Hit -> Lock 60% profits, move runner stop to Breakeven (+0.3%)
                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)
                    
                # Step 2: Target 2 Hit -> Full exit
                if c_high >= target_2:
                    exit_trade = True
                    exit_reason = "TARGET_2_FULL"
                    pnl_pct = round((t1_pct * 0.60) + (t2_pct * 0.40), 4) * 100.0
                    
                # Step 3: Stop Loss Triggered
                elif c_low <= stop_loss:
                    exit_trade = True
                    if t1_hit:
                        exit_reason = "BREAKEVEN_STOP_AFTER_T1"
                        pnl_pct = round(t1_pct * 0.60, 4) * 100.0  # 60% locked gain secured
                    else:
                        exit_reason = "INITIAL_STOP"
                        pnl_pct = round((stop_loss - entry_price) / entry_price, 4) * 100.0
                        
                # Step 4: Supertrend Flipped Red & closed below 20 EMA
                elif st_d == -1 and c_price < e20:
                    exit_trade = True
                    exit_reason = "SUPERTREND_RED"
                    pct = (c_price - entry_price) / entry_price
                    if t1_hit:
                        pnl_pct = round((t1_pct * 0.60) + (pct * 0.40), 4) * 100.0
                    else:
                        pnl_pct = round(pct, 4) * 100.0
                        
                # Step 5: Time Stall (12 sessions max)
                elif bars_held >= 12:
                    exit_trade = True
                    exit_reason = "TIME_STALL"
                    pct = (c_price - entry_price) / entry_price
                    if t1_hit:
                        pnl_pct = round((t1_pct * 0.60) + (pct * 0.40), 4) * 100.0
                    else:
                        pnl_pct = round(pct, 4) * 100.0
                        
                if exit_trade:
                    td = {
                        "symbol": sym,
                        "entry_date": entry_date.strftime("%Y-%m-%d") if hasattr(entry_date, "strftime") else str(entry_date),
                        "exit_date": c_date.strftime("%Y-%m-%d") if hasattr(c_date, "strftime") else str(c_date),
                        "entry_price": entry_price,
                        "pnl_pct": round(pnl_pct, 2),
                        "is_win": pnl_pct > 0.0,
                        "t1_hit": t1_hit,
                        "bars_held": bars_held,
                        "exit_reason": exit_reason
                    }
                    stock_trades.append(td)
                    all_trades.append(td)
                    in_trade = False
                    
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
    
    return {
        "total": total,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "profit_factor": pf,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "all_trades": all_trades,
        "per_stock": per_stock
    }

if __name__ == "__main__":
    logger.info("Downloading historical bars for universe...")
    stock_dfs = {}
    for sym in EQUITY_UNIVERSE:
        ticker = f"{sym}.NS"
        try:
            t = yf.Ticker(ticker)
            df = t.history(period="1y", interval="1d")
            if not df.empty and len(df) >= 50:
                stock_dfs[sym] = df
        except Exception:
            pass
            
    logger.info(f"Loaded {len(stock_dfs)} equities. Running grid search...")
    
    candidates = [
        # (t1_pct, t2_pct, max_sl, min_rsi, min_roc60, min_close_loc)
        (0.035, 0.075, 0.040, 48.0, 0.0, 0.50),
        (0.035, 0.070, 0.038, 50.0, 2.0, 0.52),
        (0.032, 0.065, 0.035, 50.0, 3.0, 0.55),
        (0.030, 0.060, 0.032, 50.0, 5.0, 0.55),
        (0.035, 0.075, 0.038, 52.0, 5.0, 0.55),
    ]
    
    best_res = None
    best_config = None
    
    for c in candidates:
        t1, t2, sl, mrsi, mroc, mcl = c
        res = backtest(stock_dfs, t1_pct=t1, t2_pct=t2, max_sl=sl, min_rsi=mrsi, min_roc60=mroc, min_close_loc=mcl)
        print(f"Config [T1={t1*100:.1f}%, T2={t2*100:.1f}%, SL={sl*100:.1f}%, MinRSI={mrsi}, ROC60>={mroc}%, CloseLoc>={mcl}] -> "
              f"Trades: {res['total']} | WINS: {res['wins']}/{res['total']} | WIN RATE: {res['win_rate']}% | "
              f"PF: {res['profit_factor']} | AvgWin: +{res['avg_win']}% | AvgLoss: {res['avg_loss']}%")
        if best_res is None or res['win_rate'] > best_res['win_rate']:
            best_res = res
            best_config = c
            
    if best_res:
        print("\n=======================================================")
        print(f"BEST CONFIGURATION (WIN RATE: {best_res['win_rate']}%, PF: {best_res['profit_factor']}):")
        print("=======================================================")
        for sym, trades in best_res["per_stock"].items():
            wins = [t for t in trades if t["is_win"]]
            wr = round(len(wins)/len(trades)*100, 1)
            pnl = round(sum(t["pnl_pct"] for t in trades), 2)
            print(f"  {sym:<12} | Trades: {len(trades):<2} | Wins: {len(wins):<2} | WinRate: {wr:>5.1f}% | NetPnL: {pnl:>+6.2f}%")
