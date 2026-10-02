"""
Alpha India — Institutional Research:
Post-Earnings 10 Trading Sessions Analysis (Stocks moving >= +20%)
Factor Attribution & Behavioral Blueprint
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from datetime import datetime, timedelta
from typing import Dict, Any, List
import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry
from app.models.screener_growth_record import ScreenerGrowthRecord


def run_10d_study():
    db: Session = SessionLocal()
    
    # Get filings with valid announcement dates
    filings = (
        db.query(FilingRegistry, ScreenerGrowthRecord)
        .join(ScreenerGrowthRecord, FilingRegistry.symbol == ScreenerGrowthRecord.symbol)
        .filter(
            (FilingRegistry.filing_type.ilike('%financial result%')) | 
            (FilingRegistry.filing_type.ilike('%outcome of board meeting%')),
            FilingRegistry.announcement_date.isnot(None),
            ScreenerGrowthRecord.current_price > 10.0,
            ScreenerGrowthRecord.market_cap > 100.0,
        )
        .order_by(FilingRegistry.announcement_date.desc())
        .all()
    )

    # Deduplicate by symbol keeping most recent announcement
    seen = set()
    sample = []
    for f, s in filings:
        if f.symbol not in seen and f.announcement_date:
            seen.add(f.symbol)
            sample.append((f, s))

    print("=" * 95)
    print("ALPHA INDIA INSTITUTIONAL STUDY: 10-DAY POST-EARNINGS SURGES (>= +20%)")
    print(f"Universe: {len(sample)} Indian Listed Equities with Verified Exchange Filings")
    print("=" * 95)

    # Batch download daily price data via yfinance
    symbols = [f.symbol for f, s in sample]
    yf_symbols = [f"{sym}.NS" for sym in symbols]

    # Map back
    sym_map = {f"{sym}.NS": (f, s) for sym, (f, s) in zip(symbols, sample)}

    print(f"[*] Downloading market daily bars for {len(yf_symbols)} symbols...")
    try:
        data = yf.download(yf_symbols, period="1y", interval="1d", group_by="ticker", auto_adjust=True, progress=False)
    except Exception as e:
        print(f"Error downloading batch data: {e}")
        return

    analyzed = []
    for yf_sym in yf_symbols:
        f, s = sym_map[yf_sym]
        try:
            df = data[yf_sym] if len(yf_symbols) > 1 else data
            if df.empty or "Close" not in df.columns:
                continue
            df = df.dropna(subset=["Close"])
            if len(df) < 20:
                continue

            # Announcement date
            ann_date = f.announcement_date
            if hasattr(ann_date, "date"):
                ann_date = ann_date.date()

            # Find day 0 (the trading day of or immediately preceding announcement)
            df.index = pd.to_datetime(df.index).date
            prior_dates = [d for d in df.index if d <= ann_date]
            if not prior_dates:
                continue
            day_0 = prior_dates[-1]
            day_0_idx = list(df.index).index(day_0)

            # Need at least 10 subsequent trading sessions
            post_bars = df.iloc[day_0_idx + 1 : day_0_idx + 11]
            if len(post_bars) < 7:  # At least 7 sessions
                continue

            c0 = df.iloc[day_0_idx]["Close"]
            max_high = post_bars["High"].max()
            final_c10 = post_bars.iloc[-1]["Close"]
            first_day_close = post_bars.iloc[0]["Close"]

            day_1_move_pct = ((first_day_close - c0) / c0) * 100.0
            max_surge_pct = ((max_high - c0) / c0) * 100.0
            final_10d_pct = ((final_c10 - c0) / c0) * 100.0

            # Volume surge on Day 1 vs 20-day pre-earnings avg volume
            pre_bars = df.iloc[max(0, day_0_idx - 20) : day_0_idx]
            avg_pre_vol = pre_bars["Volume"].mean() if len(pre_bars) > 0 else 1.0
            day_1_vol = post_bars.iloc[0]["Volume"]
            vol_expansion = (day_1_vol / avg_pre_vol) if avg_pre_vol > 0 else 1.0

            # Pre-earnings technical positioning (distance from 50 DMA)
            close_to_dma50 = None
            if s.dma_50 and s.dma_50 > 0:
                close_to_dma50 = ((c0 - s.dma_50) / s.dma_50) * 100.0

            # Fundamental metrics
            pat_yoy = s.quarterly_pat_yoy
            pat_qoq = s.quarterly_pat_qoq
            sales_yoy = s.quarterly_sales_yoy
            sales_qoq = s.quarterly_sales_qoq
            opm = s.opm_latest
            roce = s.roce
            de = s.debt_to_equity

            # Run rate beat
            rr_beat = None
            if s.pat_12m and s.pat_12m > 0 and s.latest_quarter_net_profit:
                avg_qtr = s.pat_12m / 4.0
                rr_beat = ((s.latest_quarter_net_profit - avg_qtr) / avg_qtr) * 100.0

            # Operating leverage
            lev = None
            if sales_yoy and sales_yoy > 0 and pat_yoy:
                lev = pat_yoy / sales_yoy

            analyzed.append({
                "symbol": f.symbol,
                "company_name": s.company_name,
                "market_cap": s.market_cap,
                "ann_date": ann_date,
                "c0": c0,
                "day_1_move_pct": day_1_move_pct,
                "max_surge_pct": max_surge_pct,
                "final_10d_pct": final_10d_pct,
                "is_blaster": max_surge_pct >= 20.0,
                "vol_expansion": vol_expansion,
                "close_to_dma50": close_to_dma50,
                "pat_yoy": pat_yoy,
                "pat_qoq": pat_qoq,
                "sales_yoy": sales_yoy,
                "sales_qoq": sales_qoq,
                "opm": opm,
                "roce": roce,
                "de": de,
                "run_rate_beat": rr_beat,
                "operating_leverage": lev,
            })
        except Exception:
            continue

    print(f"\n[+] Successfully analyzed {len(analyzed)} equities with validated post-earnings price bars.")

    blasters = [x for x in analyzed if x["is_blaster"]]
    others = [x for x in analyzed if not x["is_blaster"]]

    print(f"[+] Total Blasters (Surge >= +20% within 10 Sessions): {len(blasters)} ({len(blasters)/len(analyzed)*100:.1f}%)")
    print(f"[+] Control Group (Move < +20%): {len(others)} ({len(others)/len(analyzed)*100:.1f}%)")

    print("\n" + "=" * 95)
    print("HALL OF FAME: TOP POST-RESULTS BLASTERS (>= +20% SURGE IN 10 TRADING SESSIONS)")
    print("=" * 95)
    print(f"{'Symbol':<12} | {'Max Surge':<10} | {'10D Close':<10} | {'Day 1 Gap':<10} | {'PAT YoY':<9} | {'PAT QoQ':<9} | {'Sales YoY':<10} | {'RR Beat':<8} | {'Vol Mult':<8}")
    print("-" * 95)
    for b in sorted(blasters, key=lambda x: x["max_surge_pct"], reverse=True):
        py_str = f"{b['pat_yoy']:>+6.1f}%" if b['pat_yoy'] is not None else "  N/A"
        pq_str = f"{b['pat_qoq']:>+6.1f}%" if b['pat_qoq'] is not None else "  N/A"
        sy_str = f"{b['sales_yoy']:>+6.1f}%" if b['sales_yoy'] is not None else "  N/A"
        rr_str = f"{b['run_rate_beat']:>+5.0f}%" if b['run_rate_beat'] is not None else "  N/A"
        print(f"{b['symbol']:<12} | {b['max_surge_pct']:>+8.1f}% | {b['final_10d_pct']:>+8.1f}% | {b['day_1_move_pct']:>+8.1f}% | {py_str} | {pq_str} | {sy_str} | {rr_str} | {b['vol_expansion']:>5.1f}x")

    # Statistical Attribution Table
    print("\n" + "=" * 95)
    print("EXPERT FINANCIAL DEEP-DIVE: FACTOR ATTRIBUTION ANALYSIS")
    print("Comparing Blasters (>= +20% 10D Surge) vs Control Group (< +20%)")
    print("=" * 95)

    def stats(arr, key):
        v = [x[key] for x in arr if x.get(key) is not None]
        return (np.median(v), np.mean(v)) if v else (0.0, 0.0)

    factors = [
        ("PAT Growth YoY %", "pat_yoy"),
        ("PAT Growth QoQ %", "pat_qoq"),
        ("Sales Growth YoY %", "sales_yoy"),
        ("Sales Growth QoQ %", "sales_qoq"),
        ("Run-Rate Beat % vs 4Q Run-Rate", "run_rate_beat"),
        ("Operating Leverage (PAT/Sales)", "operating_leverage"),
        ("Operating Profit Margin (OPM %)", "opm"),
        ("RoCE %", "roce"),
        ("Debt to Equity", "de"),
        ("Day 1 Volume Expansion Multiplier", "vol_expansion"),
        ("Distance from 50 DMA % before results", "close_to_dma50"),
        ("Day 1 Price Reaction %", "day_1_move_pct"),
    ]

    print(f"{'Factor / Metric':<38} | {'Blasters (>= +20%)':<22} | {'Control (< +20%)':<22} | {'Alpha Variance'}")
    print("-" * 95)
    for fname, fkey in factors:
        b_med, b_avg = stats(blasters, fkey)
        c_med, c_avg = stats(others, fkey)
        diff = b_med - c_med
        print(f"{fname:<38} | Med: {b_med:>6.1f} (Avg: {b_avg:>5.1f}) | Med: {c_med:>6.1f} (Avg: {c_avg:>5.1f}) | Diff: {diff:>+6.1f}")

    db.close()


if __name__ == "__main__":
    run_10d_study()
