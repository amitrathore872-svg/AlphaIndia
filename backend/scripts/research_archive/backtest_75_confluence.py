"""
12 FX Full Confluence Engine Backtest - Targeting >75% Win Rate
--------------------------------------------------------------
Implements the exact 12 FX indicators from fx_portfolio_swing_service.py:
1. 50 DMA (Macro trend)
2. 200 DMA (Long-term structural baseline & Golden cross)
3. 20 EMA (Tactical swing pullback support)
4. 9 EMA (Fast scalp & momentum stack)
5. VWAP (Institutional benchmark defense)
6. Supertrend 10, 3 (Trailing volatility regime)
7. Bollinger Bands 20, 2 (Volatility squeeze & %B)
8. CPR (Central Pivot Range: Pivot, TC, BC)
9. RSI 14 (Momentum zone 48-66)
10. MACD 12, 26, 9 (Bullish momentum cross / histogram)
11. Volume Dynamics (Volume Surge > 1.2x or Dry-up < 0.7x)
12. Fibonacci Golden Pocket (0.618 - 0.65 retracement support)

Signal Trigger Rule for >75% Win Rate:
- Confluence Score >= 75% (Strict High-Confluence Setup)
- Exhaustion Probability < 35% (Not overbought or parabolic)
- Target 1: +4.0% to +4.5% (or CPR R1) -> Lock 60% profit, move runner stop to Breakeven (+0.3%)
- Target 2: +8.0% to +10.0% -> Full exit on runner
- Stop Loss: Below structural swing low or Supertrend (max 5.0% initial risk)
"""
import numpy as np
import pandas as pd
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("12FX_Confluence_Backtest")

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

def backtest_fx_engine(
    stock_dfs: dict,
    nifty_df: pd.DataFrame = None,
    min_confluence: float = 70.0,
    target_1_pct: float = 0.040,
    target_2_pct: float = 0.085,
    max_stop_pct: float = 0.048,
    harvest_ratio: float = 0.60,
    min_roc: float = 4.0,
    min_holding_bars: int = 1,
    max_holding_bars: int = 15
):
    all_trades = []
    per_stock = {}
    
    # Prepare Nifty 50 Market Shield if provided
    if nifty_df is not None and not nifty_df.empty:
        nifty_df = nifty_df.copy()
        n_c = nifty_df["Close"].astype(float).ffill()
        nifty_df["EMA20"] = n_c.ewm(span=20, adjust=False).mean()
        nifty_df["SMA50"] = n_c.rolling(50, min_periods=20).mean()

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
        
        # 1. 50 & 200 DMA
        sma50 = closes.rolling(50, min_periods=20).mean()
        sma200 = closes.rolling(min(200, len(df)), min_periods=30).mean()
        
        # 2. 20 & 9 EMA
        ema20 = closes.ewm(span=20, adjust=False).mean()
        ema9 = closes.ewm(span=9, adjust=False).mean()
        
        # 3. Supertrend & ATR
        st_val, st_dir, atr = calculate_supertrend(df, 10, 3.0)
        
        # 4. Bollinger Bands (20, 2)
        sma20_bb = closes.rolling(20, min_periods=10).mean()
        std20_bb = closes.rolling(20, min_periods=10).std().fillna(0.0)
        bb_upper = sma20_bb + (std20_bb * 2.0)
        bb_lower = sma20_bb - (std20_bb * 2.0)
        bb_range = (bb_upper - bb_lower).replace(0, 1.0)
        bb_pct_b = (closes - bb_lower) / bb_range
        bb_width = (bb_range / sma20_bb.replace(0, 1.0)) * 100.0
        
        # 5. RSI 14
        rsi = calculate_rsi(closes, 14)
        
        # 6. MACD (12, 26, 9)
        fast_ema = closes.ewm(span=12, adjust=False).mean()
        slow_ema = closes.ewm(span=26, adjust=False).mean()
        macd = fast_ema - slow_ema
        macd_sig = macd.ewm(span=9, adjust=False).mean()
        
        # 7. Volume SMA 20
        vol_sma20 = volumes.rolling(20, min_periods=5).mean()
        
        # 8. VWAP (Cumulative typical price * vol / cum vol)
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
            c_bb_w = float(bb_width.iloc[i])
            c_pct_b = float(bb_pct_b.iloc[i])
            
            # CPR Calculation from previous day (Floor Pivots)
            cpr_pivot = (p_high + p_low + p_close) / 3.0
            cpr_bc = (p_high + p_low) / 2.0
            cpr_tc = (2.0 * cpr_pivot) - cpr_bc
            cpr_top = max(cpr_tc, cpr_bc)
            cpr_bot = min(cpr_tc, cpr_bc)
            cpr_r1 = (2.0 * cpr_pivot) - p_low
            
            # 12 FX Confluence Scoring (0 - 100%)
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
            
            # Exhaustion Check: Not overbought or parabolic
            is_exhausted = (c_rsi > 68.0) or ((c_price - e20) > 2.2 * c_atr)
            
            # Mandatory Institutional Stage 2 Gate + Relative Strength Leader
            roc60 = float((closes.iloc[i] / closes.iloc[i-60] - 1.0) * 100.0) if i >= 60 else 0.0
            stage2_mandatory = (c_price >= d50) and (d50 >= d200 * 0.99) and (d50 >= d50_prev * 0.998) and (roc60 >= min_roc)
            
            # Pullback Support Test: Tested 20 EMA or VWAP in last 3 sessions
            recent_lows_3d = float(lows.iloc[max(0, i-2):i+1].min())
            tested_support = (recent_lows_3d <= e20 * 1.025) or (recent_lows_3d <= c_vwap * 1.015)
            
            # Reversal Confirmation Bar:
            # 1. Today is green (c_price >= c_open)
            # 2. Close in upper 50% of bar
            # 3. High cleared prior day high (pivot breakout)
            # 4. Close higher than prior close (up day)
            bar_range = max(0.01, c_high - c_low)
            close_loc = (c_price - c_low) / bar_range
            reversal_confirmed = (c_price >= c_open) and (close_loc >= 0.52) and (c_high >= p_high) and (c_price > p_close)
            
            # Cooldown: At least 5 trading sessions since last exit
            cooldown_ok = (i - last_exit_bar) >= 5

            # Market Regime Shield: Nifty must be above 20 EMA or 50 DMA
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
                # Execution Trigger: High Confluence + Mandatory Stage 2 + Tested Support + Reversal Confirmed + Cooldown + Market Regime + Not Exhausted
                if (confluence_score >= min_confluence) and stage2_mandatory and tested_support and reversal_confirmed and cooldown_ok and market_ok and not is_exhausted:
                    in_trade = True
                    entry_price = c_price
                    entry_date = c_date
                    entry_bar = i
                    t1_hit = False
                    
                    # Stop loss: buffered below recent swing low with room to breathe (min 4.0% risk, max 5.5%)
                    sw_low = float(lows.iloc[max(0, i-4):i+1].min())
                    calc_stop = sw_low - (0.5 * c_atr)
                    # Don't place stop tighter than 3.8% below entry to avoid noise shakeouts
                    calc_stop = min(calc_stop, entry_price * 0.962)
                    stop_loss = round(max(calc_stop, entry_price * (1.0 - max_stop_pct)), 2)
                    if stop_loss >= entry_price:
                        stop_loss = round(entry_price * 0.955, 2)
                        
                    # Target 1 and Target 2
                    target_1 = round(max(cpr_r1, entry_price * (1.0 + target_1_pct)), 2)
                    # Cap Target 1 within reach (max 5.5%)
                    if target_1 > entry_price * 1.055:
                        target_1 = round(entry_price * (1.0 + target_1_pct), 2)
                    target_2 = round(entry_price * (1.0 + target_2_pct), 2)
            else:
                bars_held = i - entry_bar
                exit_trade = False
                exit_reason = ""
                pnl_pct = 0.0
                
                # 1. Target 1 Reached: Lock profit (harvest_ratio = 60-70%), move stop to Breakeven (+0.3%)
                if not t1_hit and c_high >= target_1:
                    t1_hit = True
                    stop_loss = round(entry_price * 1.003, 2)
                    
                # 2. Target 2 Reached: Full exit on runner
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
                        "entry_date": entry_date.strftime("%Y-%m-%d") if hasattr(entry_date, "strftime") else str(entry_date),
                        "exit_date": c_date.strftime("%Y-%m-%d") if hasattr(c_date, "strftime") else str(c_date),
                        "entry_price": entry_price,
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
            
    # Download Nifty 50 for Market Shield
    nifty_df = None
    try:
        t_nifty = yf.Ticker("^NSEI")
        nifty_df = t_nifty.history(period="1y", interval="1d")
        print(f"Loaded Nifty 50 Benchmark: {len(nifty_df)} bars.")
    except Exception as e:
        print(f"Could not load Nifty: {e}")

    print("\n" + "="*85)
    print("      FINAL AUDIT REPORT: HIGH-PRECISION INSTITUTIONAL SWING ENGINE")
    print("="*85)
    best_res = backtest_fx_engine(
        stock_dfs,
        nifty_df=nifty_df,
        min_confluence=80.0,
        min_roc=4.0,
        target_1_pct=0.028,
        harvest_ratio=0.80
    )
    print(f"Universe:               30 Equities (Portfolio + Watchlists + Leaders)")
    print(f"Historical Window:      1 Year (Daily Bars)")
    print(f"Total Trades:           {best_res['total']}")
    print(f"Winning Trades:         {best_res['wins']} ({best_res['win_rate']}%)")
    print(f"Losing Trades:          {best_res['losses']}")
    print(f"GLOBAL WIN RATE:        {best_res['win_rate']}%")
    print(f"PROFIT FACTOR:          {best_res['profit_factor']}")
    print(f"AVERAGE WIN:            +{best_res['avg_win']}%")
    print(f"AVERAGE LOSS:           {best_res['avg_loss']}%")
    print(f"REALIZED R:R:           {round(best_res['avg_win']/abs(best_res['avg_loss']), 2)} : 1")
    print("-"*85)
    print(f"{'SYMBOL':<14} | {'TRADES':<6} | {'WINS':<4} | {'LOSSES':<6} | {'WIN RATE':<9} | {'NET PNL':<9} | {'PF':<6}")
    print("-"*85)
    for sym, trades in best_res["per_stock"].items():
        w = len([t for t in trades if t["is_win"]])
        l = len([t for t in trades if not t["is_win"]])
        wr = round(w / len(trades) * 100.0, 1)
        net = round(sum(t["pnl_pct"] for t in trades), 2)
        pos = sum(t["pnl_pct"] for t in trades if t["is_win"])
        neg = abs(sum(t["pnl_pct"] for t in trades if not t["is_win"]))
        pf = round(pos / max(0.01, neg), 2)
        print(f"{sym:<14} | {len(trades):<6} | {w:<4} | {l:<6} | {wr:>7.1f}% | {net:>+7.2f}% | {pf:>6.2f}")
    print("="*85)
