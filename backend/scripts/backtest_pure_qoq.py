"""
Alpha India — Pure QoQ vs Pure YoY vs Hybrid Backtest Analysis
Compares the predictive efficacy of:
  1. Pure QoQ Model (Only sequential quarterly performance)
  2. Pure YoY Model (Only year-over-year annual comparative performance)
  3. Hybrid Model (Dual-Axis YoY + QoQ with Low-Base Penalties)
Across 1,475+ Indian Equities with forward 3-Month Market Returns.
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from typing import Dict, Any, List
import numpy as np
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord


def score_pure_qoq(rec: ScreenerGrowthRecord) -> float:
    """
    PURE QoQ MODEL (100 Points)
    Zero reliance on YoY numbers. Evaluates strictly current quarter vs immediately prior quarter.
    """
    pat_qoq = rec.quarterly_pat_qoq or 0.0
    sales_qoq = rec.quarterly_sales_qoq or 0.0
    opm = rec.opm_latest or 10.0
    price = rec.current_price
    dma50 = rec.dma_50

    score = 0.0

    # 1. Sequential PAT Growth (Max 45 Pts)
    if pat_qoq >= 50.0:
        score += 45.0
    elif pat_qoq >= 30.0:
        score += 36.0
    elif pat_qoq >= 20.0:
        score += 28.0
    elif pat_qoq >= 10.0:
        score += 18.0
    elif pat_qoq > 0.0:
        score += 8.0
    elif pat_qoq < -20.0:
        score -= 20.0  # Sequential collapse penalty
    elif pat_qoq < -10.0:
        score -= 10.0

    # 2. Sequential Sales / Revenue Growth (Max 25 Pts)
    if sales_qoq >= 20.0:
        score += 25.0
    elif sales_qoq >= 12.0:
        score += 20.0
    elif sales_qoq >= 7.0:
        score += 14.0
    elif sales_qoq > 0.0:
        score += 7.0
    elif sales_qoq < -10.0:
        score -= 10.0

    # 3. Sequential Operating Leverage (Max 15 Pts)
    if sales_qoq > 0.0 and pat_qoq > 0.0:
        ratio = pat_qoq / sales_qoq
        if ratio >= 2.0:
            score += 15.0
        elif ratio >= 1.4:
            score += 10.0
        elif ratio > 1.0:
            score += 5.0
    elif pat_qoq > 15.0 and sales_qoq <= 0.0:
        score += 12.0  # Turnaround efficiency

    # 4. Absolute OPM Floor (Max 10 Pts)
    if opm >= 20.0:
        score += 10.0
    elif opm >= 14.0:
        score += 6.0
    elif opm >= 8.0:
        score += 3.0

    # 5. Price Trend (Max 5 Pts)
    if price and dma50 and price >= dma50:
        score += 5.0

    return round(min(100.0, max(0.0, score)), 1)


def score_pure_yoy(rec: ScreenerGrowthRecord) -> float:
    """
    PURE YoY MODEL (100 Points)
    Zero reliance on QoQ numbers. Evaluates strictly current quarter vs same quarter last year.
    """
    pat_yoy = rec.quarterly_pat_yoy or 0.0
    sales_yoy = rec.quarterly_sales_yoy or 0.0
    opm = rec.opm_latest or 10.0
    price = rec.current_price
    dma50 = rec.dma_50

    score = 0.0

    # 1. YoY PAT Growth (Max 45 Pts)
    if pat_yoy >= 75.0:
        score += 45.0
    elif pat_yoy >= 45.0:
        score += 36.0
    elif pat_yoy >= 25.0:
        score += 26.0
    elif pat_yoy >= 15.0:
        score += 16.0
    elif pat_yoy > 0.0:
        score += 8.0
    elif pat_yoy < -20.0:
        score -= 15.0

    # 2. YoY Sales Growth (Max 25 Pts)
    if sales_yoy >= 30.0:
        score += 25.0
    elif sales_yoy >= 20.0:
        score += 20.0
    elif sales_yoy >= 10.0:
        score += 12.0
    elif sales_yoy > 0.0:
        score += 6.0

    # 3. YoY Operating Leverage (Max 15 Pts)
    if sales_yoy > 0.0 and pat_yoy > 0.0:
        ratio = pat_yoy / sales_yoy
        if ratio >= 2.0:
            score += 15.0
        elif ratio >= 1.4:
            score += 10.0
        elif ratio > 1.0:
            score += 5.0

    # 4. Absolute OPM Floor (Max 10 Pts)
    if opm >= 20.0:
        score += 10.0
    elif opm >= 14.0:
        score += 6.0
    elif opm >= 8.0:
        score += 3.0

    # 5. Price Trend (Max 5 Pts)
    if price and dma50 and price >= dma50:
        score += 5.0

    return round(min(100.0, max(0.0, score)), 1)


def score_hybrid_apex(rec: ScreenerGrowthRecord) -> float:
    """
    HYBRID MODEL (Dual-Axis YoY + QoQ + Low-Base Penalties)
    """
    pat_yoy = rec.quarterly_pat_yoy or 0.0
    pat_qoq = rec.quarterly_pat_qoq or 0.0
    sales_yoy = rec.quarterly_sales_yoy or 0.0
    sales_qoq = rec.quarterly_sales_qoq or 0.0
    opm = rec.opm_latest or 10.0
    price = rec.current_price
    dma50 = rec.dma_50

    score = 0.0

    # Dual PAT (Max 40 pts)
    if pat_yoy >= 40.0 and pat_qoq >= 20.0:
        score += 40.0  # Dual beat
    elif pat_yoy >= 25.0 and pat_qoq >= 10.0:
        score += 30.0
    elif pat_yoy >= 25.0 and pat_qoq > 0.0:
        score += 22.0
    elif pat_qoq >= 30.0:
        score += 25.0  # Heavy QoQ spike
    elif pat_yoy >= 25.0:
        score += 12.0
    elif pat_yoy > 0:
        score += 5.0

    # Dual Sales (Max 25 pts)
    if sales_yoy >= 20.0 and sales_qoq >= 8.0:
        score += 25.0
    elif sales_yoy >= 15.0 and sales_qoq > 0.0:
        score += 18.0
    elif sales_qoq >= 15.0:
        score += 18.0
    elif sales_yoy >= 10.0:
        score += 10.0

    # Leverage & Margins (Max 20 pts)
    if opm >= 20.0:
        score += 10.0
    elif opm >= 14.0:
        score += 6.0

    if sales_yoy > 0 and pat_yoy > sales_yoy * 1.5:
        score += 10.0
    elif sales_qoq > 0 and pat_qoq > sales_qoq * 1.5:
        score += 8.0

    # Trend (Max 15 pts)
    if price and dma50 and price >= dma50:
        score += 15.0

    # Deceleration Penalty
    if pat_yoy >= 25.0 and pat_qoq < -15.0:
        score -= 20.0  # Low-base trap penalty
    elif pat_qoq < -25.0:
        score -= 15.0

    return round(min(100.0, max(0.0, score)), 1)


def run_qoq_investigation():
    db: Session = SessionLocal()
    print("=" * 85)
    print("QUANTITATIVE COMPARISON: PURE QoQ vs PURE YoY vs HYBRID (YoY + QoQ)")
    print("=" * 85)

    records = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_qoq.isnot(None),
            ScreenerGrowthRecord.quarterly_sales_qoq.isnot(None),
            ScreenerGrowthRecord.return_3m.isnot(None),
            ScreenerGrowthRecord.current_price > 10.0,
            ScreenerGrowthRecord.market_cap > 100.0,
        )
        .all()
    )

    data = []
    for r in records:
        qoq_s = score_pure_qoq(r)
        yoy_s = score_pure_yoy(r)
        hyb_s = score_hybrid_apex(r)
        data.append({
            "symbol": r.symbol,
            "company": r.company_name,
            "pat_yoy": r.quarterly_pat_yoy,
            "pat_qoq": r.quarterly_pat_qoq,
            "sales_yoy": r.quarterly_sales_yoy,
            "sales_qoq": r.quarterly_sales_qoq,
            "ret_3m": r.return_3m,
            "score_qoq": qoq_s,
            "score_yoy": yoy_s,
            "score_hybrid": hyb_s,
        })

    def analyze_model(name, score_key):
        print(f"\n--- MODEL: {name.upper()} ---")
        tiers = [
            ("Tier 1: High Conviction (Score >= 80)", lambda x: x[score_key] >= 80.0),
            ("Tier 2: Moderate Momentum (65 <= Score < 80)", lambda x: 65.0 <= x[score_key] < 80.0),
            ("Tier 3: Average / Watch (50 <= Score < 65)", lambda x: 50.0 <= x[score_key] < 65.0),
            ("Tier 4: Decelerating / Poor (Score < 50)", lambda x: x[score_key] < 50.0),
        ]
        print(f"{'Tier':<40} {'Count':<7} {'Win Rate':<10} {'Avg 3M':<12} {'Med 3M':<10} {'>= +20%':<10} {'<= -15%':<10}")
        print("-" * 105)
        for t_label, pred in tiers:
            subset = [x for x in data if pred(x)]
            if not subset:
                print(f"{t_label:<40} {0:<7}")
                continue
            rets = [x["ret_3m"] for x in subset]
            win_rate = (len([r for r in rets if r > 0]) / len(rets)) * 100
            avg_r = np.mean(rets)
            med_r = np.median(rets)
            g20 = (len([r for r in rets if r >= 20.0]) / len(rets)) * 100
            l15 = (len([r for r in rets if r <= -15.0]) / len(rets)) * 100
            print(f"{t_label:<40} {len(subset):<7} {win_rate:5.1f}%     {avg_r:+6.2f}%     {med_r:+6.2f}%     {g20:5.1f}%      {l15:5.1f}%")

    analyze_model("Pure QoQ Model (Sequential Only)", "score_qoq")
    analyze_model("Pure YoY Model (Year-over-Year Only)", "score_yoy")
    analyze_model("Hybrid Apex Model (Dual-Axis YoY + QoQ)", "score_hybrid")

    # -----------------------------------------------------------------
    # Cross-Correlation Analysis: Where Does Pure QoQ Excel & Stumble?
    # -----------------------------------------------------------------
    print("\n" + "=" * 85)
    print("SEASONALITY & BASE EFFECTS: THE CRITICAL DIFFERENCES")
    print("=" * 85)

    # 1. Stocks where QoQ was EXPLOSIVE (>+50%) but YoY was NEGATIVE (Turnarounds / Inflections)
    qoq_inflections = [x for x in data if x["pat_qoq"] >= 50.0 and x["pat_yoy"] <= 0.0]
    print(f"\n1. QoQ Inflection Plays (Explosive QoQ >= +50%, but YoY <= 0%): Count = {len(qoq_inflections)}")
    if qoq_inflections:
        inf_rets = [x["ret_3m"] for x in qoq_inflections]
        print(f"   • Average 3M Return: {np.mean(inf_rets):+.2f}%")
        print(f"   • Win Rate:          {(len([r for r in inf_rets if r > 0])/len(inf_rets))*100:.1f}%")
        print(f"   • Notable examples:")
        for k in sorted(qoq_inflections, key=lambda x: x["ret_3m"], reverse=True)[:5]:
            print(f"     - {k['symbol']:<10} {k['company'][:20]:<22} PAT QoQ: {k['pat_qoq']:+6.1f}%, PAT YoY: {k['pat_yoy']:+6.1f}% -> 3M Return: {k['ret_3m']:+6.1f}%")

    # 2. Stocks where QoQ was high due to SEASONALITY (Seasonal spikes)
    seasonal_traps = [x for x in data if x["pat_qoq"] >= 50.0 and x["sales_qoq"] <= 0.0]
    print(f"\n2. Low-Quality QoQ Spikes (PAT QoQ >= +50%, but Sales QoQ <= 0% - non-operational): Count = {len(seasonal_traps)}")
    if seasonal_traps:
        trap_rets = [x["ret_3m"] for x in seasonal_traps]
        print(f"   • Average 3M Return: {np.mean(trap_rets):+.2f}%")
        print(f"   • Win Rate:          {(len([r for r in trap_rets if r > 0])/len(trap_rets))*100:.1f}%")

    db.close()


if __name__ == "__main__":
    run_qoq_investigation()
