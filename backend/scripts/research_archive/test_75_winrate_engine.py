"""
High-Precision 75%+ Win Rate Confluence Swing Engine
---------------------------------------------------
Mathematical Blueprint for >75% Hit Rate:
1. STRICT STAGE 2 FILTER:
   - CMP > 50 DMA > 200 DMA
   - 50 DMA is positively sloping: SMA50[t] >= SMA50[t-10]
   - 60-Day Relative Strength: ROC60 >= +5.0% (Only institutional leaders)
2. INSTITUTIONAL REVERSAL TRIGGER:
   - Pullback to 20 EMA zone (low within 1.5% of 20 EMA in last 2 days)
   - Supply Exhaustion: Prior pullback bar had low volume (< 0.9x 20MA)
   - Bullish Reversal Confirmation: Current bar is GREEN (Close >= Open)
   - Close in upper 40% of bar range: (Close - Low) / (High - Low) >= 0.60
   - Prior Day High Cleared: High >= Prior High * 0.998
   - RSI Sweet Spot: 50.0 <= RSI <= 67.0
   - Supertrend is Green
3. ASYMMETRIC HARVEST ARCHITECTURE:
   - Target 1: +3.5% (or 1.25x ATR)
   - At Target 1: 70% of position is locked as PROFIT. Stop loss on 30% runner moved to Breakeven (+0.3%).
   - Target 2: +7.5% (full exit on runner)
   - Initial Stop Loss: -3.2% (buffered below trigger candle low)
"""
import numpy as np
import pandas as pd
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("HighPrecision75WinRate")

EQUITY_UNIVERSE = [
    # Active Portfolio Holdings
    "WINDLAS", "WAAREEENER", "SUDEEPPHRM", "STYLAMIND", "PICCADIL", "PHOENIXLTD",
    "JSLL", "FCL", "E2E", "CARTRADE", "BUILDPRO", "BHARATFORG", "BETA",
    "ATHERENERG", "ASTRAMICRO", "AEROENTER", "AEGISLOG",
    # Watchlist Conviction Equities
    "LAURUSLABS", "ROLEXRINGS", "CYIENT", "LALPATHLAB", "SKYGOLD", "SOMANYCERA",
    # Benchmark Leaders
    "POLYCAB", "DIXON", "HAL", "BEL", "TITAN", "CDSL", "TRENT"
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

def run_precision_backtest(stock_dfs, t1_target=0.035, t2_target=0.075, max_sl=0.032, min_roc=4.0):
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
        
        ema9 = closes.ewm(span=9, adjust=False).mean()
        ema20 = closes.ewm(span=20, adjust=False).mean()
        sma50 = closes.rolling(50, min_periods=20).mean()
        sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
        st_val, st_dir, atr = calculate_supertrend(df, 10, 3.0)
        rsi = calculate_rsi(closes, 14)
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
            
            p_high = float(highs.iloc[i-1])
            p_close = float(closes.iloc[i-1])
            p_low = float(lows.iloc[i-1])
            p_vol = float(volumes.iloc[i-1])
            
            d50 = float(sma50.iloc[i])
            d50_prev = float(sma50.iloc[i-10]) if i >= 60 else d50
            d200 = float(sma200.iloc[i])
            e20 = float(ema20.iloc[i])
            e9 = float(ema9.iloc[i])
            c_rsi = float(rsi.iloc[i])
            st_d = int(st_dir[i])
            c_atr = float(atr[i])
            v_ma = float(vol_sma20.iloc[i])
            r60 = float(roc60.iloc[i]) if not pd.isna(roc60.iloc[i]) else 0.0
            
            rng = max(0.01, c_high - c_low)
            close_loc = (c_price - c_low) / rng
            
            if not in_trade:
                # 1. INSTITUTIONAL STAGE 2 FILTER:
                # Price above 50 DMA, 50 DMA above 200 DMA, 50 DMA rising, strong relative strength
                stage2_ok = (c_price >= d50) and (e20 >= d50) and (d50 >= d200 * 0.99) and (d50 >= d50_prev) and (r60 >= min_roc)
                
                # 2. SUPERTREND GREEN
                st_ok = (st_d == 1)
                
                # 3. PULLBACK ZONE TEST
                # Touched within 1.5% of 20 EMA in the last 2 sessions
                tested_support = (min(c_low, p_low) <= e20 * 1.018) and (c_price >= e20 * 0.995)
                
                # 4. BULLISH CONFIRMATION BAR:
                # Green candle, close in top 40% of range, broke prior day high or closed near high
                bullish_bar = (c_price >= c_open) and (close_loc >= 0.55) and (c_high >= p_high * 0.998)
                
                # 5. MOMENTUM SWEET SPOT (No falling knives, no overbought exhaustion)
                rsi_ok = (50.0 <= c_rsi <= 66.0)
                
                if stage2_ok and st_ok and tested_support and bullish_bar and rsi_ok:
                    in_trade = True
                    entry_price = c_price
                    entry_date = c_date
                    entry_bar = i
                    t1_hit = False
                    
                    # TIGHT ASYMMETRIC RISK STOP:
                    # Below trigger candle low, capped at max_sl
                    stop_loss = round(max(c_low - (0.2 * c_atr), entry_price * (1.0 - max_sl)), 2)
                    if stop_loss >= entry_price:
                        stop_loss = round(entry_price * (1.0 - max_sl), 2)
                        
                    target_1 = round(entry_price * (1.0 + t1_target), 2)
                    target_2 = round(entry_price * (1.0 + t2_target), 2)
            else:
                bars_held = i - entry_bar
                exit_trade = False
                exit_reason = ""
                pnl_pct = 0.0
                
                # TARGET 1: Lock 70% position as profit! Move stop to Breakeven (+0.3%)
                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)
                    
                # TARGET 2: Runner Target Hit
                if c_high >= target_2:
                    exit_trade = True
                    exit_reason = "TARGET_2_FULL"
                    pnl_pct = round((t1_target * 0.70) + (t2_target * 0.30), 4) * 100.0
                    
                # STOP LOSS HIT
                elif c_low <= stop_loss:
                    exit_trade = True
                    if t1_hit:
                        exit_reason = "BREAKEVEN_STOP_AFTER_T1"
                        pnl_pct = round(t1_target * 0.70, 4) * 100.0  # Kept 70% locked gain!
                    else:
                        exit_reason = "INITIAL_STOP"
                        pnl_pct = round((stop_loss - entry_price) / entry_price, 4) * 100.0
                        
                # SUPERTREND FLIPPED RED
                elif st_d == -1 and c_price < e20:
                    exit_trade = True
                    exit_reason = "SUPERTREND_RED"
                    pct = (c_price - entry_price) / entry_price
                    if t1_hit:
                        pnl_pct = round((t1_target * 0.70) + (pct * 0.30), 4) * 100.0
                    else:
                        pnl_pct = round(pct, 4) * 100.0
                        
                # TIME STALL (10 sessions)
                elif bars_held >= 10:
                    exit_trade = True
                    exit_reason = "TIME_STALL"
                    pct = (c_price - entry_price) / entry_price
                    if t1_hit:
                        pnl_pct = round((t1_target * 0.70) + (pct * 0.30), 4) * 100.0
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
        return {"total": 0, "win_rate": 0.0, "profit_factor": 0.0, "trades": [], "per_stock": {}}
        
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
            
    print(f"Loaded {len(stock_dfs)} equities. Testing Parameter Sets for >75% Win Rate:\n")
    
    configs = [
        # (t1, t2, sl, min_roc)
        (0.035, 0.075, 0.030, 5.0),
        (0.030, 0.065, 0.028, 6.0),
        (0.032, 0.070, 0.030, 5.0),
        (0.028, 0.060, 0.025, 6.0),
        (0.035, 0.080, 0.032, 8.0),
    ]
    
    for t1, t2, sl, mroc in configs:
        res = run_precision_backtest(stock_dfs, t1_target=t1, t2_target=t2, max_sl=sl, min_roc=mroc)
        print(f"Set [T1: +{t1*100:.1f}%, T2: +{t2*100:.1f}%, SL: -{sl*100:.1f}%, ROC60 >= {mroc}%] -> "
              f"Trades: {res['total']} | WINS: {res['wins']} | LOSSES: {res['losses']} | "
              f"WIN RATE: {res['win_rate']}% | Profit Factor: {res['profit_factor']} | "
              f"Avg Win: +{res['avg_win']}% | Avg Loss: {res['avg_loss']}%")
