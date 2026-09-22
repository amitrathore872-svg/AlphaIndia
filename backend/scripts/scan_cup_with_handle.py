import os
import sys
import numpy as np
import pandas as pd
import yfinance as yf

from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def detect_cup_with_handle(df):
    if len(df) < 50:
        return None
    closes = df['Close'].values
    highs = df['High'].values
    lows = df['Low'].values
    volumes = df['Volume'].values
    dates = df.index
    n = len(df)
    cmp = closes[-1]
    best_pattern = None
    
    for left_idx in range(max(0, n - 130), n - 18):
        left_high = highs[left_idx]
        window = 5
        if left_high != max(highs[max(0, left_idx - window):min(n, left_idx + window + 1)]):
            continue
            
        pre_idx = max(0, left_idx - 35)
        if pre_idx < left_idx:
            pre_low = min(lows[pre_idx:left_idx])
            prior_run = (left_high - pre_low) / max(0.01, pre_low) * 100
            if prior_run < 12.0:
                continue
        else:
            prior_run = 20.0
            
        cup_window_end = n - 5
        if cup_window_end <= left_idx + 10:
            continue
            
        bottom_idx = left_idx + int(np.argmin(lows[left_idx:cup_window_end]))
        bottom_low = lows[bottom_idx]
        cup_depth_pct = (left_high - bottom_low) / left_high * 100
        
        if not (8.0 <= cup_depth_pct <= 42.0):
            continue
            
        right_rim_window_start = bottom_idx + 4
        right_rim_window_end = n - 2
        if right_rim_window_end <= right_rim_window_start:
            continue
            
        right_idx = right_rim_window_start + int(np.argmax(highs[right_rim_window_start:right_rim_window_end]))
        right_high = highs[right_idx]
        
        if abs(right_high - left_high) / left_high > 0.14:
            continue
            
        handle_len = (n - 1) - right_idx
        if not (3 <= handle_len <= 35):
            continue
            
        handle_low = min(lows[right_idx:])
        handle_low_idx = right_idx + int(np.argmin(lows[right_idx:]))
        handle_depth_pct = (right_high - handle_low) / right_high * 100
        cup_midpoint = bottom_low + (left_high - bottom_low) * 0.5
        
        if handle_low < cup_midpoint:
            continue
            
        if not (2.0 <= handle_depth_pct <= 18.0):
            continue
            
        vol_50d_avg = np.mean(volumes[-50:]) if len(volumes) >= 50 else np.mean(volumes)
        handle_avg_vol = np.mean(volumes[right_idx:])
        vdu_ratio = handle_avg_vol / max(1, vol_50d_avg)
        
        score = 80.0
        if vdu_ratio < 0.90:
            score += 10.0
        if handle_depth_pct <= 8.0:
            score += 5.0
        if prior_run >= 25.0:
            score += 5.0
            
        pattern = {
            'left_date': str(dates[left_idx])[:10],
            'bottom_date': str(dates[bottom_idx])[:10],
            'right_date': str(dates[right_idx])[:10],
            'handle_low_date': str(dates[handle_low_idx])[:10],
            'left_high': round(float(left_high), 2),
            'bottom_low': round(float(bottom_low), 2),
            'cup_depth_pct': round(float(cup_depth_pct), 1),
            'cup_bars': int(right_idx - left_idx),
            'right_high': round(float(right_high), 2),
            'handle_low': round(float(handle_low), 2),
            'handle_depth_pct': round(float(handle_depth_pct), 1),
            'handle_bars': int(handle_len),
            'pivot_price': round(float(right_high), 2),
            'vdu_ratio': round(float(vdu_ratio), 2),
            'cmp': round(float(cmp), 2),
            'distance_to_pivot_pct': round(float((right_high - cmp) / right_high * 100), 2),
            'quality_score': round(float(score), 1)
        }
        if best_pattern is None or pattern['quality_score'] > best_pattern['quality_score']:
            best_pattern = pattern
            
    return best_pattern

def main():
    db = SessionLocal()
    symbols = ['PIRAMALFIN', 'LOTUSDEV', 'SWANDEF', 'SOMANYCERA', 'REDINGTON', 'APLAPOLLO']

    for sym in symbols:
        rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol.ilike(sym)).first()
        t = yf.Ticker(f"{sym}.NS")
        df = t.history(period="6mo")
        if df.empty or len(df) < 40:
            t = yf.Ticker(f"{sym}.BO")
            df = t.history(period="6mo")
        if df.empty:
            continue
        pat = detect_cup_with_handle(df)
        if not pat:
            continue
            
        cname = rec.company_name if rec and rec.company_name else sym
        sec = rec.sector if rec and rec.sector else "Diversified"
        mcap = rec.market_cap if rec and rec.market_cap else 0.0
        
        stop_loss = round(pat['handle_low'] * 0.985, 2)
        risk_pct = round(((pat['pivot_price'] - stop_loss) / pat['pivot_price']) * 100, 2)
        cup_depth_abs = pat['right_high'] - pat['bottom_low']
        target_1 = round(pat['pivot_price'] + (cup_depth_abs * 0.618), 2)
        target_2 = round(pat['pivot_price'] + cup_depth_abs, 2)
        gain_1 = round(((target_1 - pat['pivot_price']) / pat['pivot_price']) * 100, 1)
        gain_2 = round(((target_2 - pat['pivot_price']) / pat['pivot_price']) * 100, 1)
        rr = f"1:{round((target_1 - pat['pivot_price']) / max(0.1, pat['pivot_price'] - stop_loss), 1)}"
        
        print("=" * 70)
        print(f"SAMPLE RESULT: {sym} ({cname})")
        print(f"Sector: {sec} | Market Cap: Rs {mcap:,.1f} Cr | Score: {pat['quality_score']}/100")
        print(f"Price Action: CMP = Rs {pat['cmp']} | Breakout Pivot = Rs {pat['pivot_price']} | Distance = {pat['distance_to_pivot_pct']}%")
        print(f"Cup Phase: Left Rim Rs {pat['left_high']} ({pat['left_date']}) -> Bottom Rs {pat['bottom_low']} ({pat['bottom_date']}) -> Right Rim Rs {pat['right_high']} ({pat['right_date']})")
        print(f"           Depth: -{pat['cup_depth_pct']}% over {pat['cup_bars']} sessions")
        print(f"Handle Phase: Right Rim Rs {pat['right_high']} -> Handle Low Rs {pat['handle_low']} ({pat['handle_low_date']})")
        print(f"              Depth: -{pat['handle_depth_pct']}% over {pat['handle_bars']} sessions | VDU Volume: {pat['vdu_ratio']}x of 50-DMA")
        print(f"Execution Plan: Entry Zone = Rs {round(pat['pivot_price']*0.998, 1)}-{round(pat['pivot_price']*1.015, 1)} | Stop Loss = Rs {stop_loss} (-{risk_pct}%)")
        print(f"                Target 1 = Rs {target_1} (+{gain_1}%) | Target 2 = Rs {target_2} (+{gain_2}%) | Reward-to-Risk = {rr}")
        if rec:
            print(f"Fundamentals: Sales YoY: {rec.quarterly_sales_yoy or rec.sales_growth_ttm}% | PAT YoY: {rec.quarterly_pat_yoy or rec.profit_growth_ttm}% | ROCE: {rec.roce}% | Health: {rec.health_score}/100")

    db.close()

if __name__ == "__main__":
    main()
