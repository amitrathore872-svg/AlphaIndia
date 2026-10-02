"""
Alpha India — Institutional Quantitative Research:
10-Day Post-Earnings Movers (>= +20% Surges) & Factor Attribution Analysis
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.filing_registry import FilingRegistry


def get_sample_symbols(db: Session, limit: int = 120) -> List[Dict[str, Any]]:
    # Get liquid stocks with market cap > 300 Cr, covering high-growth and diverse sectors
    records = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.current_price > 15.0,
            ScreenerGrowthRecord.market_cap > 300.0,
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_qoq.isnot(None),
        )
        .order_by(ScreenerGrowthRecord.quarterly_pat_yoy.desc())
        .limit(limit)
        .all()
    )
    res = []
    for r in records:
        res.append({
            "symbol": r.symbol,
            "company_name": r.company_name,
            "market_cap": r.market_cap,
            "cmp": r.current_price,
            "pat_yoy": r.quarterly_pat_yoy,
            "pat_qoq": r.quarterly_pat_qoq,
            "sales_yoy": r.quarterly_sales_yoy,
            "sales_qoq": r.quarterly_sales_qoq,
            "opm": r.opm_latest,
            "roce": r.roce,
            "de": r.debt_to_equity,
            "fii": r.fii_holding,
            "dii": r.dii_holding,
            "pat_12m": r.pat_12m,
            "latest_qtr_net_profit": r.latest_quarter_net_profit,
            "profit_growth_ttm": r.profit_growth_ttm,
            "dma_50": r.dma_50,
            "dma_200": r.dma_200,
        })
    return res


def analyze_post_earnings_10d():
    db: Session = SessionLocal()
    candidates = get_sample_symbols(db, limit=100)
    print("=" * 95)
    print("INSTITUTIONAL QUANTITATIVE RESEARCH: POST-EARNINGS 10-DAY BLASTERS (>= +20% SURGE)")
    print(f"Sample: Evaluating {len(candidates)} high-activity Indian equities across NSE")
    print("=" * 95)

    results = []
    checked = 0

    for c in candidates:
        symbol = c["symbol"]
        yf_symbol = f"{symbol}.NS"
        checked += 1
        
        try:
            ticker = yf.Ticker(yf_symbol)
            # Try to get earnings dates
            ed_df = ticker.get_earnings_dates(limit=6)
            if ed_df is None or ed_df.empty:
                continue

            # Find the most recent reported earnings date (where Reported EPS or date is past)
            # Convert index to UTC naive date
            valid_dates = []
            now = pd.Timestamp.now(tz=ed_df.index.tz) if ed_df.index.tz else pd.Timestamp.now()
            for idx in ed_df.index:
                if idx < now - pd.Timedelta(days=12): # at least 12 days ago so 10 trading sessions exist
                    valid_dates.append(idx)

            if not valid_dates:
                continue

            recent_ed = valid_dates[0]
            ed_date = recent_ed.date()

            # Download 40 trading days of price history around the earnings date
            start_date = ed_date - timedelta(days=20)
            end_date = ed_date + timedelta(days=30)

            hist = ticker.history(start=start_date.strftime("%Y-%m-%d"), end=end_date.strftime("%Y-%m-%d"))
            if hist.empty or len(hist) < 15:
                continue

            # Localize hist index date
            hist.index = hist.index.date

            # Find day 0 (on or immediately prior to ed_date)
            prior_dates = [d for d in hist.index if d <= ed_date]
            if not prior_dates:
                continue
            day_0_date = prior_dates[-1]
            day_0_idx = list(hist.index).index(day_0_date)

            # Look at next 10 trading sessions: indices day_0_idx + 1 to day_0_idx + 10
            post_window = hist.iloc[day_0_idx + 1 : day_0_idx + 11]
            if len(post_window) < 5:
                continue

            base_close = hist.iloc[day_0_idx]["Close"]
            max_high_10d = post_window["High"].max()
            final_close_10d = post_window.iloc[-1]["Close"]

            max_surge_10d_pct = ((max_high_10d - base_close) / base_close) * 100.0
            net_return_10d_pct = ((final_close_10d - base_close) / base_close) * 100.0

            # Technical regime prior to results: was it above 50 DMA?
            pre_5d = hist.iloc[max(0, day_0_idx - 5) : day_0_idx]
            pre_drift = ((base_close - pre_5d.iloc[0]["Close"]) / pre_5d.iloc[0]["Close"] * 100.0) if len(pre_5d) > 0 else 0.0

            # Compute Run-Rate Beat
            rr_beat = None
            if c["pat_12m"] and c["pat_12m"] > 0 and c["latest_qtr_net_profit"]:
                avg_qtr = c["pat_12m"] / 4.0
                rr_beat = ((c["latest_qtr_net_profit"] - avg_qtr) / avg_qtr) * 100.0

            # Growth acceleration
            accel = None
            if c["profit_growth_ttm"] is not None and c["pat_yoy"] is not None:
                accel = c["pat_yoy"] - c["profit_growth_ttm"]

            # Leverage
            lev = None
            if c["sales_yoy"] and c["sales_yoy"] > 0 and c["pat_yoy"]:
                lev = c["pat_yoy"] / c["sales_yoy"]

            results.append({
                "symbol": symbol,
                "company_name": c["company_name"],
                "market_cap": c["market_cap"],
                "earnings_date": ed_date,
                "base_close": base_close,
                "max_surge_10d_pct": max_surge_10d_pct,
                "net_return_10d_pct": net_return_10d_pct,
                "is_super_mover": max_surge_10d_pct >= 20.0,
                "pat_yoy": c["pat_yoy"],
                "pat_qoq": c["pat_qoq"],
                "sales_yoy": c["sales_yoy"],
                "sales_qoq": c["sales_qoq"],
                "opm": c["opm"],
                "roce": c["roce"],
                "de": c["de"],
                "fii": c["fii"],
                "dii": c["dii"],
                "run_rate_beat": rr_beat,
                "growth_accel": accel,
                "operating_leverage": lev,
                "pre_drift_5d": pre_drift,
            })
            print(f"[{checked:02d}] {symbol:<12} | Results: {ed_date} | 10D Max Surge: {max_surge_10d_pct:>+5.1f}% | Net 10D: {net_return_10d_pct:>+5.1f}% | YoY: {c['pat_yoy']:>+5.0f}% | QoQ: {c['pat_qoq']:>+5.0f}%")

        except Exception as e:
            continue

    print("\n" + "=" * 95)
    print(f"SAMPLE EXTRACTION COMPLETE: {len(results)} Equities with Verified 10-Day Windows")
    print("=" * 95)

    super_movers = [r for r in results if r["is_super_mover"]]
    control_group = [r for r in results if not r["is_super_mover"]]

    print(f"\n[+] Total Blasters (Surge >= +20% in 10 Days): {len(super_movers)} stocks ({len(super_movers)/len(results)*100:.1f}%)")
    print(f"[+] Rest of Market (< +20% in 10 Days): {len(control_group)} stocks")

    print("\n--- HALL OF FAME: TOP 10-DAY POST-EARNINGS EXPLODERS (>= +20%) ---")
    print(f"{'Symbol':<12} | {'Max Surge':<10} | {'10D Net':<8} | {'PAT YoY':<8} | {'PAT QoQ':<8} | {'Sales YoY':<10} | {'RR Beat':<8} | {'OPM %':<6} | {'Op Lev':<6}")
    print("-" * 95)
    for sm in sorted(super_movers, key=lambda x: x["max_surge_10d_pct"], reverse=True):
        rr_str = f"{sm['run_rate_beat']:>+5.0f}%" if sm['run_rate_beat'] is not None else " N/A"
        lev_str = f"{sm['operating_leverage']:>4.1f}x" if sm['operating_leverage'] is not None else " N/A"
        print(f"{sm['symbol']:<12} | {sm['max_surge_10d_pct']:>+8.1f}% | {sm['net_return_10d_pct']:>+6.1f}% | {sm['pat_yoy']:>+6.0f}% | {sm['pat_qoq']:>+6.0f}% | {sm['sales_yoy']:>+8.0f}% | {rr_str} | {sm['opm']:>5.1f}% | {lev_str}")

    # Factor Attribution Comparison
    print("\n" + "=" * 95)
    print("QUANTITATIVE FACTOR ATTRIBUTION: WHAT CAUSES THE 10-DAY +20% POST-EARNINGS SURGE?")
    print("=" * 95)

    def mean_val(arr, key):
        vals = [x[key] for x in arr if x[key] is not None]
        return np.mean(vals) if vals else 0.0

    def median_val(arr, key):
        vals = [x[key] for x in arr if x[key] is not None]
        return np.median(vals) if vals else 0.0

    factors = [
        ("PAT Growth YoY %", "pat_yoy"),
        ("PAT Growth QoQ %", "pat_qoq"),
        ("Sales Growth YoY %", "sales_yoy"),
        ("Sales Growth QoQ %", "sales_qoq"),
        ("Run-Rate Beat % vs 4Q Avg", "run_rate_beat"),
        ("Growth Acceleration Delta %", "growth_accel"),
        ("Operating Leverage (PAT/Sales)", "operating_leverage"),
        ("Operating Profit Margin (OPM %)", "opm"),
        ("RoCE %", "roce"),
        ("Debt to Equity", "de"),
        ("Pre-Earnings 5D Run-up %", "pre_drift_5d"),
        ("Market Cap (₹ Cr)", "market_cap"),
    ]

    print(f"{'Factor / Metric':<35} | {'Super Movers (>=+20%)':<22} | {'Control Group (<+20%)':<22} | {'Variance / Divergence'}")
    print("-" * 95)
    for fname, fkey in factors:
        sm_med = median_val(super_movers, fkey)
        sm_avg = mean_val(super_movers, fkey)
        cg_med = median_val(control_group, fkey)
        cg_avg = mean_val(control_group, fkey)
        
        diff = sm_med - cg_med
        if abs(cg_med) > 0.001:
            diff_ratio = (diff / abs(cg_med)) * 100.0
            diff_str = f"{diff:>+6.1f} ({diff_ratio:>+5.0f}%)"
        else:
            diff_str = f"{diff:>+6.1f}"

        print(f"{fname:<35} | Med: {sm_med:>7.1f} (Avg: {sm_avg:>6.1f}) | Med: {cg_med:>7.1f} (Avg: {cg_avg:>6.1f}) | {diff_str}")

    db.close()


if __name__ == "__main__":
    analyze_post_earnings_10d()
