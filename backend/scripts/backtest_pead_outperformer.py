"""
Alpha India — Empirical Backtest Runner: Apex Outperformer Formula vs Baseline
Evaluates the predictive efficacy of PEAD scoring on post-earnings stock price drift.
Tests:
  1. Forward 3-Month Returns across Score Deciles & Tiers
  2. Win Rate (% Positive Drift) & Multi-Bagger Capture Rate (>20%, >50% gainers)
  3. Deceptive Base Trap Detection (High YoY + Negative QoQ)
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from typing import Dict, Any, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.pead_engine import PEADEngine


def evaluate_baseline(rec: ScreenerGrowthRecord) -> float:
    """Current PEAD formula."""
    res = PEADEngine.evaluate(
        revenue_growth_yoy=rec.quarterly_sales_yoy,
        pat_growth_yoy=rec.quarterly_pat_yoy,
        roce=rec.roce,
        opm=rec.opm_latest,
        current_price=rec.current_price,
        dma_50=rec.dma_50,
        debt_to_equity=rec.debt_to_equity,
        revenue_growth_qoq=rec.quarterly_sales_qoq,
        pat_growth_qoq=rec.quarterly_pat_qoq,
        eps=rec.latest_quarter_eps,
        symbol=rec.symbol,
    )
    return res["pead_score"]


def evaluate_apex_outperformer(rec: ScreenerGrowthRecord) -> Dict[str, Any]:
    """
    Apex Outperformer Institutional Formula (V3.0).
    Features:
      - Dual-Axis YoY + QoQ Acceleration
      - Growth Rate Acceleration Bonus
      - Operating Leverage Multiplier
      - OPM Margin Floor
      - Low-Base / Sequential Deceleration Penalties
    """
    pat_yoy = rec.quarterly_pat_yoy or 0.0
    pat_qoq = rec.quarterly_pat_qoq or 0.0
    sales_yoy = rec.quarterly_sales_yoy or 0.0
    sales_qoq = rec.quarterly_sales_qoq or 0.0
    roce = rec.roce or 10.0
    opm = rec.opm_latest or 10.0
    de = rec.debt_to_equity if rec.debt_to_equity is not None else 0.8
    dma50 = rec.dma_50
    dma200 = rec.dma_200
    price = rec.current_price
    ret_3m = rec.return_3m or 0.0

    # -------------------------------------------------------------
    # Engine 1: Growth Velocity & Acceleration (Max 35 Pts)
    # -------------------------------------------------------------
    e1_score = 0.0

    # PAT Dual Velocity (Max 20 pts)
    if pat_yoy >= 50.0 and pat_qoq >= 25.0:
        e1_score += 20.0  # Blowout double-acceleration
    elif pat_yoy >= 35.0 and pat_qoq >= 15.0:
        e1_score += 16.0
    elif pat_yoy >= 25.0 and pat_qoq > 0.0:
        e1_score += 12.0
    elif pat_yoy >= 50.0 and pat_qoq <= 0.0:
        e1_score += 7.0   # YoY high but QoQ flat/negative (discounted)
    elif pat_yoy >= 15.0:
        e1_score += 5.0
    elif pat_yoy > 0.0:
        e1_score += 2.0

    # Sales Dual Velocity (Max 10 pts)
    if sales_yoy >= 25.0 and sales_qoq >= 10.0:
        e1_score += 10.0
    elif sales_yoy >= 15.0 and sales_qoq >= 5.0:
        e1_score += 7.0
    elif sales_yoy >= 10.0:
        e1_score += 4.0
    elif sales_yoy > 0.0:
        e1_score += 2.0

    # Momentum Acceleration bonus (Max 5 pts)
    if pat_qoq >= 20.0 and sales_qoq >= 8.0:
        e1_score += 5.0
    elif pat_qoq > 10.0:
        e1_score += 2.5

    e1_score = min(35.0, e1_score)

    # -------------------------------------------------------------
    # Engine 2: Operating Leverage & Margins (Max 25 Pts)
    # -------------------------------------------------------------
    e2_score = 0.0
    leverage_ratio = 1.0
    if sales_yoy > 0.0:
        leverage_ratio = pat_yoy / sales_yoy
    elif pat_yoy > 0.0 and sales_yoy <= 0.0:
        leverage_ratio = 2.5

    # Leverage Multiplier (Max 12 pts)
    if leverage_ratio >= 2.5 and sales_yoy >= 10.0:
        e2_score += 12.0
    elif leverage_ratio >= 1.8 and sales_yoy >= 5.0:
        e2_score += 9.0
    elif leverage_ratio >= 1.2:
        e2_score += 5.0

    # Absolute OPM Floor & Tier (Max 13 pts)
    if opm >= 22.0:
        e2_score += 13.0
    elif opm >= 16.0:
        e2_score += 9.0
    elif opm >= 10.0:
        e2_score += 5.0
    elif opm > 0:
        e2_score += 2.0

    e2_score = min(25.0, e2_score)

    # -------------------------------------------------------------
    # Engine 3: Capital Efficiency & Quality (Max 20 Pts)
    # -------------------------------------------------------------
    e3_score = 0.0
    if roce >= 25.0:
        e3_score += 12.0
    elif roce >= 18.0:
        e3_score += 9.0
    elif roce >= 12.0:
        e3_score += 5.0
    elif roce > 0:
        e3_score += 2.0

    if de <= 0.15:
        e3_score += 8.0
    elif de <= 0.60:
        e3_score += 5.0
    elif de <= 1.00:
        e3_score += 2.0

    e3_score = min(20.0, e3_score)

    # -------------------------------------------------------------
    # Engine 4: Technical Trend & Sponsorship (Max 20 Pts)
    # -------------------------------------------------------------
    e4_score = 0.0
    if price and dma50 and dma200:
        if price >= dma50 >= dma200:
            e4_score += 12.0  # Stage-2 Golden Alignment
        elif price >= dma50:
            e4_score += 8.0
        else:
            e4_score += 2.0
    elif price and dma50:
        if price >= dma50:
            e4_score += 8.0
        else:
            e4_score += 2.0
    else:
        e4_score += 6.0

    # 3-Month Price Momentum into results
    if ret_3m >= 20.0:
        e4_score += 8.0
    elif ret_3m >= 10.0:
        e4_score += 5.0
    elif ret_3m > 0:
        e4_score += 2.0

    e4_score = min(20.0, e4_score)

    # -------------------------------------------------------------
    # Penalties: Low-Base Fakeouts & Sequential Collapse
    # -------------------------------------------------------------
    penalties = 0.0
    is_fakeout = False

    # Penalty 1: Negative QoQ when YoY is positive (Fakeout)
    if pat_yoy >= 25.0 and pat_qoq < -15.0:
        penalties += 15.0
        is_fakeout = True
    elif pat_qoq < -25.0:
        penalties += 12.0

    # Penalty 2: Sales Sequential Contraction
    if sales_qoq < -10.0:
        penalties += 8.0

    raw_total = e1_score + e2_score + e3_score + e4_score - penalties
    apex_score = round(min(100.0, max(0.0, raw_total)), 1)

    return {
        "score": apex_score,
        "is_fakeout": is_fakeout,
        "e1": e1_score,
        "e2": e2_score,
        "e3": e3_score,
        "e4": e4_score,
        "penalties": penalties,
    }


def run_empirical_backtest():
    db: Session = SessionLocal()
    print("=" * 85)
    print("ALPHA INDIA — QUANTITATIVE PEAD BACKTEST ENGINE")
    print("Dataset: Last Reported Indian Equities Quarterly Earnings & Post-Earnings 3M Drift")
    print("=" * 85)

    # Fetch companies that reported results and have market price returns
    records: List[ScreenerGrowthRecord] = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_qoq.isnot(None),
            ScreenerGrowthRecord.return_3m.isnot(None),
            ScreenerGrowthRecord.current_price > 10.0,  # Eliminate penny stocks < ₹10
            ScreenerGrowthRecord.market_cap > 100.0,    # Minimum ₹100 Cr market cap
        )
        .all()
    )

    print(f"\n[+] Total Validated Equities in Backtest: {len(records)} companies")

    data = []
    for r in records:
        base_score = evaluate_baseline(r)
        apex_eval = evaluate_apex_outperformer(r)
        data.append({
            "symbol": r.symbol,
            "company": r.company_name,
            "market_cap": r.market_cap,
            "cmp": r.current_price,
            "pat_yoy": r.quarterly_pat_yoy,
            "pat_qoq": r.quarterly_pat_qoq,
            "sales_yoy": r.quarterly_sales_yoy,
            "sales_qoq": r.quarterly_sales_qoq,
            "opm": r.opm_latest,
            "roce": r.roce,
            "ret_3m": r.return_3m,
            "baseline_score": base_score,
            "apex_score": apex_eval["score"],
            "is_fakeout": apex_eval["is_fakeout"],
            "penalties": apex_eval["penalties"],
        })

    # Group into Tiers
    tiers = {
        "Tier 1: Apex Outperformers (85 - 100)": lambda x: x["apex_score"] >= 85.0,
        "Tier 2: High Outperformers (70 - 84.9)": lambda x: 70.0 <= x["apex_score"] < 85.0,
        "Tier 3: Moderate Compounders (55 - 69.9)": lambda x: 55.0 <= x["apex_score"] < 70.0,
        "Tier 4: Neutral / Decelerating (< 55)": lambda x: x["apex_score"] < 55.0,
    }

    base_tiers = {
        "Tier 1: Baseline High (85 - 100)": lambda x: x["baseline_score"] >= 85.0,
        "Tier 2: Baseline Moderate (70 - 84.9)": lambda x: 70.0 <= x["baseline_score"] < 85.0,
        "Tier 3: Baseline Average (55 - 69.9)": lambda x: 55.0 <= x["baseline_score"] < 70.0,
        "Tier 4: Baseline Low (< 55)": lambda x: x["baseline_score"] < 55.0,
    }

    print("\n" + "=" * 85)
    print("COMPARATIVE PERFORMANCE: APEX OUTPERFORMER (V3) vs BASELINE FORMULA")
    print("=" * 85)

    def print_tier_stats(tier_name, items):
        if not items:
            print(f"\n{tier_name}: 0 companies")
            return
        returns = [x["ret_3m"] for x in items]
        avg_ret = np.mean(returns)
        med_ret = np.median(returns)
        win_rate = (len([r for r in returns if r > 0]) / len(returns)) * 100
        gain_20 = (len([r for r in returns if r >= 20.0]) / len(returns)) * 100
        gain_50 = (len([r for r in returns if r >= 50.0]) / len(returns)) * 100
        loss_15 = (len([r for r in returns if r <= -15.0]) / len(returns)) * 100

        print(f"\n{tier_name} (Count: {len(items):,})")
        print(f"  • Average 3M Return:        {avg_ret:+.2f}%")
        print(f"  • Median 3M Return:         {med_ret:+.2f}%")
        print(f"  • Win Rate (> 0%):          {win_rate:.1f}%")
        print(f"  • Big Movers (>= +20%):     {gain_20:.1f}% of stocks")
        print(f"  • Multi-Baggers (>= +50%):  {gain_50:.1f}% of stocks")
        print(f"  • Severe Drawdowns (<= -15%): {loss_15:.1f}% of stocks")

    print("\n>>> 1. APEX OUTPERFORMER V3 TIERS:")
    for t_name, predicate in tiers.items():
        subset = [x for x in data if predicate(x)]
        print_tier_stats(t_name, subset)

    print("\n" + "-" * 85)
    print(">>> 2. BASELINE PEAD TIERS (FOR COMPARISON):")
    for t_name, predicate in base_tiers.items():
        subset = [x for x in data if predicate(x)]
        print_tier_stats(t_name, subset)

    # -------------------------------------------------------------
    # 3. Best Movers in Market Analysis
    # -------------------------------------------------------------
    print("\n" + "=" * 85)
    print("TOP 15 BEST MARKET MOVERS (ACTUAL 3M GAINERS) & THEIR FORMULA SCORES")
    print("=" * 85)

    top_gainers = sorted(data, key=lambda x: x["ret_3m"], reverse=True)[:15]
    print(f"{'Symbol':<12} {'Company':<22} {'3M Gain':<10} {'PAT YoY':<10} {'PAT QoQ':<10} {'Apex Score':<12} {'Base Score':<10}")
    print("-" * 85)
    for g in top_gainers:
        print(f"{g['symbol']:<12} {g['company'][:20]:<22} {g['ret_3m']:+6.1f}%    {g['pat_yoy']:+6.1f}%    {g['pat_qoq']:+6.1f}%    {g['apex_score']:5.1f}/100    {g['baseline_score']:5.1f}/100")

    # -------------------------------------------------------------
    # 4. Deceptive Base "Fakeout" Case Studies
    # -------------------------------------------------------------
    print("\n" + "=" * 85)
    print("DECEPTIVE BASE TRAP ANALYSIS (High YoY Growth but Negative QoQ)")
    print("=" * 85)
    fakeouts = [x for x in data if x["is_fakeout"]]
    print(f"Detected {len(fakeouts)} companies with misleading high YoY but collapsing QoQ.")
    if fakeouts:
        fakeout_returns = [x["ret_3m"] for x in fakeouts]
        print(f"Average 3M Return of Fakeout Stocks: {np.mean(fakeout_returns):+.2f}%")
        print(f"Percentage of Fakeout Stocks in Loss: {(len([r for r in fakeout_returns if r < 0])/len(fakeout_returns))*100:.1f}%\n")
        print(f"{'Symbol':<12} {'Company':<22} {'PAT YoY':<10} {'PAT QoQ':<10} {'Base Score':<12} {'Apex Score':<12} {'3M Return':<10}")
        print("-" * 85)
        for f in sorted(fakeouts, key=lambda x: x["ret_3m"])[:8]:
            print(f"{f['symbol']:<12} {f['company'][:20]:<22} {f['pat_yoy']:+6.1f}%    {f['pat_qoq']:+6.1f}%    {f['baseline_score']:5.1f} (High)   {f['apex_score']:5.1f} (Down)   {f['ret_3m']:+6.1f}%")

    db.close()

if __name__ == "__main__":
    run_empirical_backtest()
