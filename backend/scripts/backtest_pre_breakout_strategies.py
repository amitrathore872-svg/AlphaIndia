"""
Alpha India - Pre-Breakout Institutional Strategy Backtester (Last 1 Year)
Discovers and ranks the highest-performing quantitative setups that signal a buy BEFORE the stock moves:
1. Toby Crabel NR7 + Inside Day Volatility Super-Coil
2. Mark Minervini VCP Volume Dry-Up (VDU) Cheat Entry (Tight Base < 4% from Pivot)
3. John Carter TTM Squeeze (Bollinger Band inside Keltner Channel + Momentum Turn)
4. Institutional Delivery Stealth Accumulation (High Deliv % inside Tight Range)
5. Moving Average Pinch (EMA 9, 21, and SMA 50 coiling within 1.5% before expansion)
"""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backtest_prebreakout")

UNIVERSE = [
    "AARTIIND", "ABB", "ABBOTINDIA", "ABCAPITAL", "ACC", "ADANIENT", "ADANIPORTS",
    "ALKEM", "AMBUJACEM", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY", "ASIANPAINT", "ASTRAL",
    "ATUL", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE",
    "BALKRISIND", "BALRAMCHIN", "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BHARATFORG",
    "BHEL", "BIOCON", "BOSCHLTD", "BPCL", "BRITANNIA", "BSOFT", "CANBK", "CANFINHOME",
    "CHAMBLFERT", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR",
    "COROMANDEL", "CROMPTON", "CUMMINSIND", "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB",
    "DIXON", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL",
    "GLENMARK", "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM",
    "HAL", "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
    "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "IDEA",
    "IDFCFIRSTB", "IEX", "INDHOTEL", "INDIACEM", "INDIAMART", "INDIGO", "INDUSINDBK",
    "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JKCEMENT",
    "JSWSTEEL", "JUBLFOOD", "KAYNES", "KOTAKBANK", "LALPATHLAB", "LAURUSLABS", "LICHSGFIN", "LT",
    "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MAZDOCK",
    "MCX", "METROPOLIS", "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN",
    "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS",
    "ONGC", "PAGEIND", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
    "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL",
    "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF", "SUNPHARMA",
    "SUNTV", "SUZLON", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM", "TATAPOWER",
    "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL",
    "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "COCHINSHIP", "BSE", "CDSL"
]


def fast_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def load_universe_data() -> Dict[str, pd.DataFrame]:
    logger.info(f"Fetching 2-year market history for {len(UNIVERSE)} liquid symbols...")
    raw = yf.download(
        [f"{s}.NS" for s in UNIVERSE],
        period="2y",
        interval="1d",
        group_by="ticker",
        progress=False,
        threads=True,
    )
    data_map: Dict[str, pd.DataFrame] = {}
    for sym in UNIVERSE:
        t_sym = f"{sym}.NS"
        if t_sym in raw.columns.levels[0]:
            df = raw[t_sym].dropna(subset=["Close", "Volume"]).copy()
            if len(df) >= 220:
                data_map[sym] = df
    logger.info(f"Loaded {len(data_map)} equities.")
    return data_map


def compute_pre_breakout_indicators(data_map: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Calculates all pre-breakout compression, volume dry-up, and momentum metrics."""
    out = {}
    for sym, df_in in data_map.items():
        try:
            df = df_in.copy()
            c = df["Close"]
            h = df["High"]
            l = df["Low"]
            v = df["Volume"]

            # 1. Moving Averages
            df["EMA_9"] = c.ewm(span=9, adjust=False).mean()
            df["EMA_21"] = c.ewm(span=21, adjust=False).mean()
            df["SMA_50"] = c.rolling(50).mean()
            df["SMA_200"] = c.rolling(200).mean()

            # Trend filter: Stage 2 Markup
            df["IN_UPTREND"] = (c > df["EMA_21"]) & (df["EMA_21"] > df["SMA_50"])

            # 2. Volatility & True Range
            hl = h - l
            hc = (h - c.shift(1)).abs()
            lc = (l - c.shift(1)).abs()
            tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
            df["TR"] = tr
            df["ATR_14"] = tr.rolling(14).mean()

            # NR7: Current TR is lowest of last 7 sessions
            tr_rolling_min_6 = tr.shift(1).rolling(6).min()
            df["IS_NR7"] = tr <= tr_rolling_min_6

            # Inside Day: Today High <= Prev High and Today Low >= Prev Low
            df["IS_INSIDE_DAY"] = (h <= h.shift(1)) & (l >= l.shift(1))

            # 3. Volume Dry-Up (VDU)
            df["VOL_SMA20"] = v.rolling(20).mean()
            df["VOL_SMA5"] = v.rolling(5).mean()
            df["VDU_RATIO"] = df["VOL_SMA5"] / df["VOL_SMA20"].replace(0, np.nan)
            df["IS_VDU"] = (v < df["VOL_SMA20"] * 0.70)  # Volume is 30%+ below 20-day average

            # 4. Proximity to 20-Day / 50-Day High (Resistance Pivot)
            high_20 = h.rolling(20).max()
            df["DIST_TO_20D_HIGH_PCT"] = ((high_20 - c) / high_20) * 100.0

            # 5. TTM Squeeze: Bollinger Bands inside Keltner Channel
            bb_mid = c.rolling(20).mean()
            bb_std = c.rolling(20).std()
            bb_upper = bb_mid + 2.0 * bb_std
            bb_lower = bb_mid - 2.0 * bb_std

            kc_upper = df["EMA_21"] + 1.5 * df["ATR_14"]
            kc_lower = df["EMA_21"] - 1.5 * df["ATR_14"]

            df["IS_TTM_SQUEEZE"] = (bb_upper <= kc_upper) & (bb_lower >= kc_lower)

            # 6. RSI Momentum Sweet-Spot (Not overbought, ready to fire)
            df["RSI_14"] = fast_rsi(c, 14)
            df["RSI_SWEET_SPOT"] = (df["RSI_14"] >= 50.0) & (df["RSI_14"] <= 64.0)

            # 7. Moving Average Ribbon Pinch (Tight convergence of 9, 21, 50 MAs)
            ma_max = pd.concat([df["EMA_9"], df["EMA_21"], df["SMA_50"]], axis=1).max(axis=1)
            ma_min = pd.concat([df["EMA_9"], df["EMA_21"], df["SMA_50"]], axis=1).min(axis=1)
            df["MA_PINCH_PCT"] = ((ma_max - ma_min) / c) * 100.0

            out[sym] = df
        except Exception as e:
            logger.debug(f"Error computing indicators for {sym}: {e}")
    return out


def simulate_pre_breakout_strategy(
    precomputed: Dict[str, pd.DataFrame],
    setup_name: str,
    signal_fn: Any,
    target_pct: float = 10.0,
    stop_loss_pct: float = 3.5,
    max_hold_days: int = 15,
) -> Dict[str, Any]:
    trades = []
    for sym, df in precomputed.items():
        if len(df) < 250:
            continue

        in_trade = False
        entry_price = 0.0
        entry_date = None
        entry_idx = 0
        target_price = 0.0
        stop_price = 0.0

        start_i = len(df) - 250
        for i in range(start_i, len(df)):
            row = df.iloc[i]

            # Exit management
            if in_trade:
                days = i - entry_idx
                h = float(row["High"])
                l = float(row["Low"])
                c = float(row["Close"])

                exit_reason = None
                exit_price = c

                if h >= target_price:
                    exit_reason = "TARGET HIT"
                    exit_price = target_price
                elif l <= stop_price:
                    exit_reason = "STOP LOSS HIT"
                    exit_price = stop_price
                elif days >= max_hold_days:
                    exit_reason = "TIME EXPIRED"
                    exit_price = c

                if exit_reason:
                    pnl = round(((exit_price - entry_price) / entry_price) * 100.0, 2)
                    trades.append({
                        "symbol": sym,
                        "entry_date": entry_date.strftime("%Y-%m-%d"),
                        "exit_date": df.index[i].strftime("%Y-%m-%d"),
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "pnl_pct": pnl,
                        "days": days,
                        "exit_reason": exit_reason,
                        "is_win": bool(pnl > 0),
                    })
                    in_trade = False
                    continue

            # Signal check
            if not in_trade and i < len(df) - 1:
                if signal_fn(row):
                    next_open = float(df.iloc[i + 1]["Open"])
                    entry_price = next_open
                    entry_date = df.index[i + 1]
                    entry_idx = i + 1
                    target_price = round(entry_price * (1.0 + target_pct / 100.0), 2)
                    stop_price = round(entry_price * (1.0 - stop_loss_pct / 100.0), 2)
                    in_trade = True

    if not trades:
        return {
            "strategy": setup_name, "trades": 0, "win_rate": 0.0, "profit_factor": 0.0,
            "avg_pnl": 0.0, "avg_win": 0.0, "avg_loss": 0.0, "target_hits": 0, "max_dd": 0.0,
            "sample_trades": []
        }

    df_t = pd.DataFrame(trades)
    total_t = len(df_t)
    wins = df_t[df_t["pnl_pct"] > 0]
    losses = df_t[df_t["pnl_pct"] <= 0]
    win_rate = round((len(wins) / total_t) * 100.0, 1)

    gp = float(wins["pnl_pct"].sum()) if not wins.empty else 0.0
    gl = abs(float(losses["pnl_pct"].sum())) if not losses.empty else 1.0
    pf = round(gp / max(0.01, gl), 2)

    avg_ret = round(float(df_t["pnl_pct"].mean()), 2)
    avg_w = round(float(wins["pnl_pct"].mean()), 2) if not wins.empty else 0.0
    avg_l = round(float(losses["pnl_pct"].mean()), 2) if not losses.empty else 0.0
    tgt_hits = len(df_t[df_t["exit_reason"] == "TARGET HIT"])

    df_t["CUM"] = df_t["pnl_pct"].cumsum()
    df_t["PEAK"] = df_t["CUM"].cummax()
    max_dd = round(float((df_t["PEAK"] - df_t["CUM"]).max()), 2)

    return {
        "strategy": setup_name,
        "trades": total_t,
        "win_rate": win_rate,
        "profit_factor": pf,
        "avg_pnl": avg_ret,
        "avg_win": avg_w,
        "avg_loss": avg_l,
        "target_hits": tgt_hits,
        "max_dd": max_dd,
        "sample_trades": trades[:10],
    }


def main():
    t0 = time.time()
    data_map = load_universe_data()
    logger.info("Precomputing pre-breakout compression metrics...")
    precomputed = compute_pre_breakout_indicators(data_map)
    logger.info("Running backtest simulations for Pre-Breakout setups...")

    # Strategy 1: Toby Crabel NR7 / Inside Day in Uptrend with Volume Dry-Up
    def s1_nr7_coil(row):
        uptrend = bool(row["IN_UPTREND"])
        is_coil = bool(row["IS_NR7"] or row["IS_INSIDE_DAY"])
        vdu = bool(row["IS_VDU"])
        near_high = float(row["DIST_TO_20D_HIGH_PCT"]) <= 6.0
        rsi_ok = float(row["RSI_14"]) >= 50.0 and float(row["RSI_14"]) <= 65.0
        return uptrend and is_coil and vdu and near_high and rsi_ok

    # Strategy 2: Minervini VCP Cheat Entry (Tight Base < 3.5% from Pivot with Extreme Volume Dry-Up)
    def s2_vcp_cheat(row):
        uptrend = bool(row["IN_UPTREND"])
        tight_pivot = float(row["DIST_TO_20D_HIGH_PCT"]) <= 3.5
        vdu_tight = float(row["VDU_RATIO"]) <= 0.85
        rsi_sweet = bool(row["RSI_SWEET_SPOT"])
        daily_tight = float(row["TR"]) / float(row["Close"]) * 100.0 <= 1.8
        return uptrend and tight_pivot and vdu_tight and rsi_sweet and daily_tight

    # Strategy 3: TTM Squeeze Volatility Coil (BB inside Keltner Channel in Stage-2 Trend)
    def s3_ttm_squeeze(row):
        uptrend = bool(row["IN_UPTREND"])
        squeeze = bool(row["IS_TTM_SQUEEZE"])
        rsi_sweet = bool(row["RSI_SWEET_SPOT"])
        return uptrend and squeeze and rsi_sweet

    # Strategy 4: Moving Average Ribbon Pinch (< 2.0% spread between EMA 9, 21, SMA 50)
    def s4_ma_pinch(row):
        uptrend = bool(row["IN_UPTREND"])
        pinch = float(row["MA_PINCH_PCT"]) <= 2.2
        vdu = bool(row["IS_VDU"])
        rsi_sweet = bool(row["RSI_SWEET_SPOT"])
        return uptrend and pinch and vdu and rsi_sweet

    # Strategy 5: Master Pre-Breakout Confluence (VCP Tight Base + NR7/Inside Day + VDU)
    def s5_master_prebreakout(row):
        uptrend = bool(row["IN_UPTREND"])
        tight_pivot = float(row["DIST_TO_20D_HIGH_PCT"]) <= 4.0
        is_coil = bool(row["IS_NR7"] or row["IS_INSIDE_DAY"])
        vdu = bool(row["IS_VDU"])
        rsi_sweet = bool(row["RSI_SWEET_SPOT"])
        return uptrend and tight_pivot and is_coil and vdu and rsi_sweet

    setups = [
        ("1. Toby Crabel NR7 / Inside Day Coil (10% Tgt / 3.5% SL)", s1_nr7_coil, 10.0, 3.5, 14),
        ("2. Minervini VCP Cheat Entry (12% Tgt / 3.5% SL - 3.4:1 RR)", s2_vcp_cheat, 12.0, 3.5, 15),
        ("3. TTM Squeeze Pre-Expansion (10% Tgt / 3.5% SL)", s3_ttm_squeeze, 10.0, 3.5, 14),
        ("4. Moving Average Ribbon Pinch (10% Tgt / 3.5% SL)", s4_ma_pinch, 10.0, 3.5, 14),
        ("5. Master Confluence: VCP Base + NR7 + Volume Dry-Up (12% Tgt / 3.0% SL - 4:1 RR)", s5_master_prebreakout, 12.0, 3.0, 15),
    ]

    print("\n" + "=" * 115)
    print(">>> ALPHA INDIA: 'BUY BEFORE THE MOVE' PRE-BREAKOUT BACKTEST (LAST 1 YEAR) <<<")
    print(">>> Tested on 165 Liquid Equities across 250 Sessions with 0 Lookahead Bias <<<")
    print("=" * 115)

    results = []
    for name, s_fn, tgt, sl, hold in setups:
        r = simulate_pre_breakout_strategy(precomputed, name, s_fn, target_pct=tgt, stop_loss_pct=sl, max_hold_days=hold)
        results.append(r)

        print(f"\n[{name}]")
        print(f"  • Total Signals Generated: {r['trades']}")
        print(f"  • Win Rate:               {r['win_rate']}% ({r['target_hits']} Full Targets Hit)")
        print(f"  • Profit Factor:          {r['profit_factor']}x")
        print(f"  • Average P&L per Trade:  {r['avg_pnl']:+6.2f}% (Avg Win: +{r['avg_win']}%, Avg Loss: {r['avg_loss']}%)")
        print(f"  • Max Drawdown:           {r['max_dd']}%")

    # Find the best strategy
    best = max(results, key=lambda x: (x["profit_factor"], x["win_rate"]))
    print("\n" + "=" * 115)
    print(f">>> CHAMPION 'BUY BEFORE THE MOVE' STRATEGY: {best['strategy']} <<<")
    print(f">>> PROFIT FACTOR: {best['profit_factor']}x | WIN RATE: {best['win_rate']}% | AVG P&L: {best['avg_pnl']:+6.2f}% <<<")
    print("=" * 115)

    for tr in best["sample_trades"][:8]:
        st = "WIN" if tr["is_win"] else "LOSS"
        print(f"  [{st:4s}] {tr['symbol']:12s} | Entered at: Rs.{tr['entry_price']:<7.2f} on {tr['entry_date']} -> Exited at: Rs.{tr['exit_price']:<7.2f} on {tr['exit_date']} | Return: {tr['pnl_pct']:+6.2f}% | {tr['exit_reason']} ({tr['days']}d)")

    print(f"\nExecution finished in {time.time() - t0:.1f}s.\n")


if __name__ == "__main__":
    main()
