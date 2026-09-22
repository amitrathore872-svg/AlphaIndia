"""
Alpha India - Alpha Swing Overlay Engine (AIOSE v3.0) Backtest Service
Computes historical performance, win rates, profit factors, and equity curves.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.services.swing_quant_service import (
    calculate_supertrend,
    calculate_rsi,
    identify_swing_pivots,
    detect_rsi_divergence,
    SwingQuantService,
)

logger = logging.getLogger(__name__)


class SwingBacktestService:

    @classmethod
    def run_stock_backtest(cls, symbol: str, period: str = "90d") -> Dict[str, Any]:
        """Runs the Variant 9 / Structural Swing strategy on the given symbol."""
        clean_ticker = SwingQuantService.resolve_ticker(symbol)
        clean_sym = symbol.replace('.NS', '').replace('.BO', '')
        
        try:
            t = yf.Ticker(clean_ticker)
            df_1h = t.history(period=period, interval="1h")
            df_1d = t.history(period="1y", interval="1d")
            
            if df_1h.empty or len(df_1h) < 40 or df_1d.empty:
                return {"error": f"Insufficient data for {symbol}"}
                
            df_1d['EMA50'] = df_1d['Close'].ewm(span=50, adjust=False).mean()
            daily_trend_map = (df_1d['Close'] >= df_1d['EMA50']).to_dict()
            
            df = df_1h.copy()
            df['EMA20'] = df['Close'].ewm(span=20, adjust=False).mean()
            df['VolMA20'] = df['Volume'].rolling(20).mean()
            df['RSI'] = calculate_rsi(df['Close'], 14)
            df['Supertrend'], df['ST_Dir'], df['ATR'] = calculate_supertrend(df, 10, 3.0)
            df['Bear_Div'] = detect_rsi_divergence(df, 15)
            df = identify_swing_pivots(df, 3, 3)
            
            weights, best_dna = SwingQuantService.profile_stock_indicators(df)
            
            c_range = df['High'] - df['Low']
            df['Close_Pct'] = (df['Close'] - df['Low']) / (c_range + 1e-9)
            df['Upper_Wick_Pct'] = (df['High'] - np.maximum(df['Open'], df['Close'])) / (c_range + 1e-9)
            
            trades = []
            in_trade = False
            entry_p = 0.0
            entry_idx = 0
            stop_loss = 0.0
            target_1 = 0.0
            target_2 = 0.0
            
            for i in range(25, len(df)):
                close_i = float(df['Close'].iloc[i])
                low_i = float(df['Low'].iloc[i])
                high_i = float(df['High'].iloc[i])
                ema20_i = float(df['EMA20'].iloc[i])
                rsi_i = float(df['RSI'].iloc[i])
                st_dir_i = int(df['ST_Dir'].iloc[i])
                atr_i = float(df['ATR'].iloc[i])
                vol_i = float(df['Volume'].iloc[i])
                vol_ma_i = float(df['VolMA20'].iloc[i])
                close_pct_i = float(df['Close_Pct'].iloc[i])
                upper_wick_i = float(df['Upper_Wick_Pct'].iloc[i])
                bear_div_i = bool(df['Bear_Div'].iloc[i])
                
                c_date = pd.Timestamp(df.index[i].date())
                matching_days = [d for d in daily_trend_map.keys() if d.date() <= c_date.date()]
                daily_trend_up = bool(daily_trend_map[max(matching_days)]) if matching_days else True
                
                if not in_trade:
                    low_touched_ema = (low_i <= ema20_i * 1.008 and close_i >= ema20_i)
                    dist_pct = ((close_i - ema20_i) / ema20_i) * 100.0
                    
                    if daily_trend_up and low_touched_ema and dist_pct <= 1.8 and (48 <= rsi_i <= 68) and close_pct_i >= 0.35 and vol_i >= vol_ma_i * 0.85:
                        in_trade = True
                        entry_p = close_i
                        entry_idx = i
                        stop_loss = round(entry_p - (1.6 * atr_i), 2)
                        target_1 = round(entry_p * 1.04, 2)
                        target_2 = round(entry_p * 1.10, 2)
                else:
                    exit_signal = False
                    exit_p = close_i
                    exit_tag = ""
                    
                    if bear_div_i and rsi_i >= 70:
                        exit_signal = True
                        exit_p = close_i
                        exit_tag = "TOP_RSI_DIVERGENCE"
                    elif (close_i - ema20_i) >= (2.4 * atr_i) and rsi_i >= 76:
                        exit_signal = True
                        exit_p = close_i
                        exit_tag = "TOP_BLOWOFF_EXHAUSTION"
                    elif upper_wick_i >= 0.50 and vol_i >= vol_ma_i * 2.0 and rsi_i >= 70:
                        exit_signal = True
                        exit_p = close_i
                        exit_tag = "TOP_SHOOTING_STAR_WICK"
                    elif high_i >= target_2:
                        exit_signal = True
                        exit_p = target_2
                        exit_tag = "TARGET_2_HIT"
                    elif close_i >= target_1 and close_i < ema20_i:
                        exit_signal = True
                        exit_p = close_i
                        exit_tag = "EMA20_TRAIL_EXIT"
                    elif low_i <= stop_loss:
                        exit_signal = True
                        exit_p = stop_loss
                        exit_tag = "STOP_LOSS"
                    elif st_dir_i == -1:
                        exit_signal = True
                        exit_p = close_i
                        exit_tag = "ST_FLIP_RED"
                        
                    if in_trade and not exit_signal:
                        if close_i >= target_1:
                            stop_loss = max(stop_loss, round(entry_p * 1.015, 2))
                        elif close_i > entry_p + atr_i:
                            stop_loss = max(stop_loss, round(close_i - (1.6 * atr_i), 2))
                            
                    if exit_signal:
                        gain_pct = ((exit_p - entry_p) / entry_p) * 100
                        trades.append({
                            "entry_time": str(df.index[entry_idx]),
                            "exit_time": str(df.index[i]),
                            "entry_price": round(entry_p, 2),
                            "exit_price": round(exit_p, 2),
                            "gain_pct": round(gain_pct, 2),
                            "tag": exit_tag,
                            "holding_bars": i - entry_idx
                        })
                        in_trade = False
                        
            n = len(trades)
            wins = [t for t in trades if t['gain_pct'] > 0]
            losses = [t for t in trades if t['gain_pct'] <= 0]
            wr = (len(wins) / n * 100) if n > 0 else 0.0
            avg_w = np.mean([t['gain_pct'] for t in wins]) if wins else 0.0
            avg_l = np.mean([t['gain_pct'] for t in losses]) if losses else 0.0
            win_sum = sum(t['gain_pct'] for t in wins)
            loss_sum = abs(sum(t['gain_pct'] for t in losses)) if losses else 1.0
            pf = round(win_sum / loss_sum, 2)
            
            # Cumulative equity curve
            equity_curve = [100.0]
            for t in trades:
                equity_curve.append(round(equity_curve[-1] * (1.0 + t['gain_pct'] / 100.0), 2))
                
            return {
                "symbol": clean_sym,
                "cmp": round(float(df['Close'].iloc[-1]), 2),
                "total_trades": n,
                "wins_count": len(wins),
                "losses_count": len(losses),
                "win_rate": round(wr, 1),
                "profit_factor": pf,
                "avg_win_pct": round(avg_w, 2),
                "avg_loss_pct": round(avg_l, 2),
                "reward_risk": round(avg_w / (abs(avg_l) + 1e-5), 2),
                "net_cumulative_return_pct": round(equity_curve[-1] - 100.0, 2),
                "best_dna": best_dna,
                "indicator_weights": weights,
                "equity_curve": equity_curve,
                "recent_trades": trades[-10:] if trades else []
            }
        except Exception as e:
            logger.error(f"Error running backtest for {symbol}: {e}")
            return {"error": str(e)}
