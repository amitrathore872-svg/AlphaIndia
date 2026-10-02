"""
Alpha India — Unified Backtest: Apex Hybrid + Earnings Surprise Engine
Comprehensive backtest across 1,475 Indian Equities comparing:
  1. Old Baseline PEAD
  2. Apex Hybrid (Dual-Axis YoY + QoQ)
  3. Apex Hybrid + Earnings Surprise (Dual Velocity + Run-Rate Beat + Growth Accel)
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from typing import Dict, Any, List
import numpy as np
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.pead_engine import PEADEngine


def evaluate_baseline(rec: ScreenerGrowthRecord) -> float:
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


def evaluate_apex_hybrid_surprise(rec: ScreenerGrowthRecord) -> Dict[str, Any]:
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
    # 1. Core Growth Velocity (Max 30 Pts)
    # -------------------------------------------------------------
    p1 = 0.0
    if pat_yoy >= 50.0 and pat_qoq >= 25.0:
        p1 += 20.0
    elif pat_yoy >= 35.0 and pat_qoq >= 15.0:
        p1 += 16.0
    elif pat_yoy >= 25.0 and pat_qoq > 0.0:
        p1 += 12.0
    elif pat_yoy >= 50.0 and pat_qoq <= 0.0:
        p1 += 6.0   # Deceptive base penalty
    elif pat_yoy >= 15.0:
        p1 += 5.0
    elif pat_yoy > 0.0:
        p1 += 2.0

    if sales_yoy >= 25.0 and sales_qoq >= 10.0:
        p1 += 10.0
    elif sales_yoy >= 15.0 and sales_qoq >= 5.0:
        p1 += 7.0
    elif sales_yoy >= 10.0:
        p1 += 4.0
    elif sales_yoy > 0.0:
        p1 += 2.0
    p1 = min(30.0, p1)

    # -------------------------------------------------------------
    # 2. Earnings Surprise & Acceleration Multiplier (Max 25 Pts)
    # -------------------------------------------------------------
    p2 = 0.0

    # Run-rate surprise vs trailing 4Q pace
    # Quarterly average = pat_12m / 4
    run_rate_beat_pct = 0.0
    if rec.pat_12m and rec.pat_12m > 0 and rec.latest_quarter_net_profit:
        avg_qtr = rec.pat_12m / 4.0
        run_rate_beat_pct = ((rec.latest_quarter_net_profit - avg_qtr) / avg_qtr) * 100.0
        if run_rate_beat_pct >= 35.0:
            p2 += 12.0  # Massive street-beating run-rate
        elif run_rate_beat_pct >= 20.0:
            p2 += 8.5
        elif run_rate_beat_pct >= 10.0:
            p2 += 5.0
        elif run_rate_beat_pct < -15.0:
            p2 -= 5.0   # Serious run-rate deficit

    # Growth acceleration surprise (PAT YoY - TTM Profit Growth)
    growth_accel_pct = 0.0
    if rec.profit_growth_ttm is not None:
        growth_accel_pct = pat_yoy - rec.profit_growth_ttm
        if growth_accel_pct >= 30.0:
            p2 += 8.0   # Sudden inflection
        elif growth_accel_pct >= 15.0:
            p2 += 5.5
        elif growth_accel_pct >= 5.0:
            p2 += 3.0
        elif growth_accel_pct < -20.0:
            p2 -= 4.0   # Sharp growth deceleration

    # EPS Surprise (Quarterly EPS vs TTM EPS / 4)
    if rec.latest_quarter_eps and rec.eps_12m and rec.eps_12m > 0:
        avg_eps = rec.eps_12m / 4.0
        eps_beat = ((rec.latest_quarter_eps - avg_eps) / avg_eps) * 100.0
        if eps_beat >= 25.0:
            p2 += 5.0
        elif eps_beat >= 10.0:
            p2 += 2.5
    
    p2 = min(25.0, max(0.0, p2))

    # -------------------------------------------------------------
    # 3. Operating Leverage & Margins (Max 20 Pts)
    # -------------------------------------------------------------
    p3 = 0.0
    leverage = (pat_yoy / sales_yoy) if sales_yoy > 0 else (2.5 if pat_yoy > 0 else 1.0)
    if leverage >= 2.5 and sales_yoy >= 10.0:
        p3 += 10.0
    elif leverage >= 1.8 and sales_yoy >= 5.0:
        p3 += 7.0
    elif leverage >= 1.2:
        p3 += 4.0

    if opm >= 22.0:
        p3 += 10.0
    elif opm >= 16.0:
        p3 += 7.0
    elif opm >= 10.0:
        p3 += 4.0
    elif opm > 0:
        p3 += 1.5
    p3 = min(20.0, p3)

    # -------------------------------------------------------------
    # 4. Capital Efficiency & Balance Sheet (Max 15 Pts)
    # -------------------------------------------------------------
    p4 = 0.0
    if roce >= 25.0:
        p4 += 9.0
    elif roce >= 18.0:
        p4 += 6.5
    elif roce >= 12.0:
        p4 += 4.0
    elif roce > 0:
        p4 += 1.5

    if de <= 0.15:
        p4 += 6.0
    elif de <= 0.60:
        p4 += 4.0
    elif de <= 1.00:
        p4 += 2.0
    p4 = min(15.0, p4)

    # -------------------------------------------------------------
    # 5. Technical Trend Alignment (Max 10 Pts)
    # -------------------------------------------------------------
    p5 = 0.0
    if price and dma50 and dma200:
        if price >= dma50 >= dma200:
            p5 += 10.0
        elif price >= dma50:
            p5 += 6.5
        else:
            p5 += 2.0
    elif price and dma50:
        if price >= dma50:
            p5 += 6.5
        else:
            p5 += 2.0
    else:
        p5 += 5.0
    p5 = min(10.0, p5)

    # -------------------------------------------------------------
    # Penalties: Sequential Collapse & Low-Base Traps
    # -------------------------------------------------------------
    penalties = 0.0
    if pat_yoy >= 25.0 and pat_qoq < -15.0:
        penalties += 15.0
    elif pat_qoq < -25.0:
        penalties += 10.0

    if sales_qoq < -10.0:
        penalties += 7.0

    total = p1 + p2 + p3 + p4 + p5 - penalties
    score = round(min(100.0, max(0.0, total)), 1)

    return {
        "score": score,
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "p4": p4,
        "p5": p5,
        "penalties": penalties,
        "run_rate_beat": run_rate_beat_pct,
        "growth_accel": growth_accel_pct,
    }


def run_comparison():
    db: Session = SessionLocal()
    records: List[ScreenerGrowthRecord] = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_qoq.isnot(None),
            ScreenerGrowthRecord.return_3m.isnot(None),
            ScreenerGrowthRecord.current_price > 10.0,
            ScreenerGrowthRecord.market_cap > 100.0,
        )
        .all()
    )

    print("=" * 95)
    print(f"HEAD-TO-HEAD BACKTEST: BASELINE vs APEX HYBRID + SURPRISE ENGINE")
    print(f"Universe: {len(records)} Validated Equities across NSE & BSE")
    print("=" * 95)

    data = []
    for r in records:
        base = evaluate_baseline(r)
        apex = evaluate_apex_hybrid_surprise(r)
        data.append({
            "symbol": r.symbol,
            "company": r.company_name,
            "ret_3m": r.return_3m or 0.0,
            "base_score": base,
            "apex_score": apex["score"],
            "run_rate_beat": apex["run_rate_beat"],
            "growth_accel": apex["growth_accel"],
            "p2_surprise": apex["p2"],
        })

    def print_tier_stats(model_name: str, key: str):
        print(f"\n[{model_name.upper()}] Performance Breakdown:")
        t1 = [x["ret_3m"] for x in data if x[key] >= 85.0]
        t2 = [x["ret_3m"] for x in data if 70.0 <= x[key] < 85.0]
        t3 = [x["ret_3m"] for x in data if 55.0 <= x[key] < 70.0]
        t4 = [x["ret_3m"] for x in data if x[key] < 55.0]

        for tname, tarr in [
            ("Tier 1: Elite Breakout (Score >= 85)", t1),
            ("Tier 2: Strong Candidate (70 <= Score < 85)", t2),
            ("Tier 3: Moderate Signal (55 <= Score < 70)", t3),
            ("Tier 4: Subdued / Neutral (Score < 55)", t4),
        ]:
            if not tarr: continue
            win_rate = sum(1 for r in tarr if r > 0) / len(tarr) * 100
            big_movers = sum(1 for r in tarr if r >= 20.0) / len(tarr) * 100
            super_movers = sum(1 for r in tarr if r >= 40.0) / len(tarr) * 100
            severe_loss = sum(1 for r in tarr if r <= -15.0) / len(tarr) * 100
            avg_r = np.mean(tarr)
            med_r = np.median(tarr)
            print(f"  {tname:<46} | N={len(tarr):<4} | Avg: {avg_r:>+6.2f}% | Med: {med_r:>+6.2f}% | Win: {win_rate:>5.1f}% | >+20%: {big_movers:>5.1f}% | >+40%: {super_movers:>5.1f}% | Loss<-15%: {severe_loss:>4.1f}%")

    print_tier_stats("Baseline PEAD Model", "base_score")
    print_tier_stats("Apex Hybrid + Earnings Surprise Model (V3.1)", "apex_score")

    # High conviction movers captured in Tier 1
    t1_winners = [x for x in data if x["apex_score"] >= 85.0 and x["ret_3m"] >= 20.0]
    print(f"\n[+] Tier 1 Elite Outperformers Captured (Score >= 85 & 3M Gain >= +20%): {len(t1_winners)} stocks")
    for w in sorted(t1_winners, key=lambda x: x["ret_3m"], reverse=True)[:10]:
        print(f"  * {w['symbol']:<12} | CMP 3M: {w['ret_3m']:>+6.1f}% | Apex Score: {w['apex_score']:>4.1f} | RR Beat: {w['run_rate_beat']:>+5.1f}% | Accel: {w['growth_accel']:>+5.1f}% | Surprise Pts: {w['p2_surprise']:>4.1f}")

    db.close()


if __name__ == "__main__":
    run_comparison()
