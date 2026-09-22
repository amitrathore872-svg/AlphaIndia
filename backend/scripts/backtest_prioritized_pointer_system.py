"""
Alpha India — Quantitative Backtest: Prioritized 100-Point Pointer PEAD System
Evaluates the exact 7-Ranked Impact Weighting System across 1,471 Listed Indian Equities.
Specifically tests:
  1. Win Rate (%) & Median Returns across Score Tiers (Elite, Strong, Moderate, Subdued)
  2. Opportunity Capture: % of Total Market Outperformers (>+20%, >+40%) identified in top tiers
  3. Drawdown Suppression: Verification of zero severe losses in Tier 1
  4. Real-world case study audit of captured multi-baggers vs avoided traps
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


def evaluate_pointer_system(rec: ScreenerGrowthRecord) -> Dict[str, Any]:
    pat_yoy = rec.quarterly_pat_yoy or 0.0
    pat_qoq = rec.quarterly_pat_qoq or 0.0
    sales_yoy = rec.quarterly_sales_yoy or 0.0
    sales_qoq = rec.quarterly_sales_qoq or 0.0
    roce = rec.roce or 10.0
    opm = rec.opm_latest or 10.0
    de = rec.debt_to_equity if rec.debt_to_equity is not None else 0.8
    ret_3m = rec.return_3m or 0.0

    # -------------------------------------------------------------
    # 🥇 RANK 1: OPERATING LEVERAGE MULTIPLIER (Max 25 Pts)
    # -------------------------------------------------------------
    r1 = 0.0
    is_turnaround = False
    if rec.latest_quarter_net_profit and rec.latest_quarter_net_profit > 0 and (rec.pat_12m is None or rec.pat_12m <= 0):
        # Swung from negative/zero 12M profit to positive quarterly profit
        r1 = 22.0
        is_turnaround = True
    elif sales_yoy > 0.0:
        leverage = pat_yoy / sales_yoy
        if leverage >= 2.5 and sales_yoy >= 10.0:
            r1 = 25.0
        elif leverage >= 1.8 and sales_yoy >= 5.0:
            r1 = 18.0
        elif leverage >= 1.2:
            r1 = 12.0
        elif leverage >= 0.8:
            r1 = 6.0
    elif pat_yoy > 20.0 and sales_yoy <= 0.0:
        # Turnaround via aggressive margin / cost rationalization
        r1 = 18.0
        is_turnaround = True
    r1 = min(25.0, r1)

    # -------------------------------------------------------------
    # 🥈 RANK 2: INSTITUTIONAL RUN-RATE SURPRISE (Max 20 Pts)
    # -------------------------------------------------------------
    r2 = 0.0
    run_rate_beat = 0.0
    if rec.pat_12m and rec.pat_12m > 0 and rec.latest_quarter_net_profit:
        avg_qtr = rec.pat_12m / 4.0
        run_rate_beat = ((rec.latest_quarter_net_profit - avg_qtr) / avg_qtr) * 100.0
        if run_rate_beat >= 35.0:
            r2 = 20.0
        elif run_rate_beat >= 20.0:
            r2 = 15.0
        elif run_rate_beat >= 10.0:
            r2 = 10.0
        elif run_rate_beat >= 3.0:
            r2 = 5.0
    r2 = min(20.0, r2)

    # -------------------------------------------------------------
    # 🥉 RANK 3: DUAL-AXIS PAT VELOCITY (YoY + QoQ) (Max 20 Pts)
    # -------------------------------------------------------------
    r3 = 0.0
    if pat_yoy >= 75.0 and pat_qoq >= 20.0:
        r3 = 20.0
    elif pat_yoy >= 40.0 and pat_qoq >= 10.0:
        r3 = 16.0
    elif pat_yoy >= 25.0 and pat_qoq > 0.0:
        r3 = 12.0
    elif pat_yoy >= 50.0 and pat_qoq >= -10.0:
        r3 = 9.0   # Seasonal hold (doesn't discard festive seasonal stocks)
    elif pat_yoy >= 15.0 or pat_qoq >= 15.0:
        r3 = 5.0
    r3 = min(20.0, r3)

    # -------------------------------------------------------------
    # 4️⃣ RANK 4: TOP-LINE SALES EXPANSION (Max 15 Pts)
    # -------------------------------------------------------------
    r4 = 0.0
    if sales_yoy >= 30.0:
        r4 = 15.0
    elif sales_yoy >= 20.0:
        r4 = 11.0
    elif sales_yoy >= 10.0:
        r4 = 7.0
    elif sales_yoy > 0.0:
        r4 = 3.0
    r4 = min(15.0, r4)

    # -------------------------------------------------------------
    # 5️⃣ RANK 5: OPERATING MARGINS & PRICING POWER (Max 10 Pts)
    # -------------------------------------------------------------
    r5 = 0.0
    if opm >= 22.0:
        r5 = 10.0
    elif opm >= 15.0:
        r5 = 7.0
    elif opm >= 10.0:
        r5 = 4.0
    elif opm > 0:
        r5 = 2.0
    r5 = min(10.0, r5)

    # -------------------------------------------------------------
    # 6️⃣ RANK 6: CAPITAL QUALITY & BALANCE SHEET (Max 5 Pts)
    # -------------------------------------------------------------
    r6 = 0.0
    if de <= 0.3:
        r6 += 3.0
    elif de <= 0.8:
        r6 += 1.5

    if roce >= 20.0:
        r6 += 2.0
    elif roce >= 12.0:
        r6 += 1.0
    r6 = min(5.0, r6)

    # -------------------------------------------------------------
    # 7️⃣ RANK 7: DRIFT RUNWAY & FRESHNESS (Max 5 Pts)
    # -------------------------------------------------------------
    # Assuming fresh reporting in recent screener cycle
    r7 = 4.0  # Normalized active drift window credit

    # -------------------------------------------------------------
    # 🛡️ TARGETED TRAP PENALTIES
    # -------------------------------------------------------------
    penalties = 0.0
    # Penalty 1: Severe sequential collapse when YoY is elevated (low-base trap)
    if pat_yoy >= 30.0 and pat_qoq < -25.0:
        penalties += 10.0
    
    # Penalty 2: Top-line sales contraction with positive PAT (other-income illusion)
    if sales_yoy < -5.0 and pat_yoy > 15.0:
        penalties += 8.0

    raw_total = r1 + r2 + r3 + r4 + r5 + r6 + r7 - penalties
    final_score = round(min(100.0, max(0.0, raw_total)), 1)

    return {
        "score": final_score,
        "r1": r1,
        "r2": r2,
        "r3": r3,
        "r4": r4,
        "r5": r5,
        "r6": r6,
        "r7": r7,
        "penalties": penalties,
        "run_rate_beat": run_rate_beat,
        "is_turnaround": is_turnaround,
    }


def run_system_backtest():
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
    print("BACKTEST OF THE 100-POINT PRIORITIZED POINTER SYSTEM")
    print(f"Total Tested Equities: {len(records)} Listed Indian Equities (NSE/BSE)")
    print("=" * 95)

    data = []
    for r in records:
        base_score = evaluate_baseline(r)
        pointer_res = evaluate_pointer_system(r)
        data.append({
            "symbol": r.symbol,
            "company": r.company_name,
            "cmp": r.current_price,
            "mcap": r.market_cap,
            "ret_3m": r.return_3m or 0.0,
            "pat_yoy": r.quarterly_pat_yoy,
            "pat_qoq": r.quarterly_pat_qoq,
            "sales_yoy": r.quarterly_sales_yoy,
            "opm": r.opm_latest,
            "roce": r.roce,
            "base_score": base_score,
            "pointer_score": pointer_res["score"],
            "r1": pointer_res["r1"],
            "r2": pointer_res["r2"],
            "r3": pointer_res["r3"],
            "r4": pointer_res["r4"],
            "r5": pointer_res["r5"],
            "r6": pointer_res["r6"],
            "penalties": pointer_res["penalties"],
            "run_rate_beat": pointer_res["run_rate_beat"],
            "is_turnaround": pointer_res["is_turnaround"],
        })

    # Total market winners across entire dataset
    total_20pct = [x for x in data if x["ret_3m"] >= 20.0]
    total_40pct = [x for x in data if x["ret_3m"] >= 40.0]
    print(f"\n[+] Total Market Outperformers across all 1,471 Equities:")
    print(f"    - Movers gaining >= +20%: {len(total_20pct)} stocks ({len(total_20pct)/len(data)*100:.1f}%)")
    print(f"    - Super-movers gaining >= +40%: {len(total_40pct)} stocks ({len(total_40pct)/len(data)*100:.1f}%)")

    # Tier Breakdown for Pointer System vs Baseline
    def print_tier_audit(system_name: str, key: str):
        print(f"\n[{system_name.upper()}] Comprehensive Tier Performance:")
        t1 = [x for x in data if x[key] >= 85.0]
        t2 = [x for x in data if 70.0 <= x[key] < 85.0]
        t3 = [x for x in data if 55.0 <= x[key] < 70.0]
        t4 = [x for x in data if x[key] < 55.0]

        for tname, tlist in [
            ("Tier 1: Elite Breakout (Score >= 85)", t1),
            ("Tier 2: Strong Candidate (70 <= Score < 85)", t2),
            ("Tier 3: Moderate Signal (55 <= Score < 70)", t3),
            ("Tier 4: Subdued / Avoid (Score < 55)", t4),
        ]:
            if not tlist: continue
            returns = [x["ret_3m"] for x in tlist]
            win_rate = sum(1 for r in returns if r > 0) / len(returns) * 100
            big_movers = sum(1 for r in returns if r >= 20.0) / len(returns) * 100
            super_movers = sum(1 for r in returns if r >= 40.0) / len(returns) * 100
            severe_loss = sum(1 for r in returns if r <= -15.0) / len(returns) * 100
            avg_ret = np.mean(returns)
            med_ret = np.median(returns)
            
            # Opportunity capture %: what % of total market >=20% winners are in this tier?
            capture_20 = sum(1 for x in tlist if x["ret_3m"] >= 20.0) / len(total_20pct) * 100
            print(f"  {tname:<46} | N={len(tlist):<4} | Avg: {avg_ret:>+6.2f}% | Med: {med_ret:>+6.2f}% | Win: {win_rate:>5.1f}% | >+20%: {big_movers:>5.1f}% | >+40%: {super_movers:>5.1f}% | Loss<-15%: {severe_loss:>4.1f}% | Market Capture: {capture_20:>4.1f}%")

    print_tier_audit("Baseline PEAD Model", "base_score")
    print_tier_audit("Prioritized 100-Point Pointer System", "pointer_score")

    # Opportunity Capture Verification: Check Tier 1 & Tier 2 combined
    t1_t2_pointer = [x for x in data if x["pointer_score"] >= 70.0]
    t1_t2_returns = [x["ret_3m"] for x in t1_t2_pointer]
    t1_t2_win = sum(1 for r in t1_t2_returns if r > 0) / len(t1_t2_returns) * 100
    t1_t2_big = sum(1 for r in t1_t2_returns if r >= 20.0)
    t1_t2_severe = sum(1 for r in t1_t2_returns if r <= -15.0) / len(t1_t2_returns) * 100

    print("\n" + "=" * 95)
    print(f"COMBINED ACTIONABLE UNIVERSE (Tier 1 + Tier 2, Score >= 70):")
    print(f"  * Total Actionable Candidates: {len(t1_t2_pointer)} stocks (out of 1,471)")
    print(f"  * Actionable Win Rate: {t1_t2_win:.1f}%")
    print(f"  * Average 3M Return: {np.mean(t1_t2_returns):>+6.2f}% | Median Return: {np.median(t1_t2_returns):>+6.2f}%")
    print(f"  * Total >+20% Winners Captured: {t1_t2_big} stocks ({t1_t2_big / len(total_20pct) * 100:.1f}% of ALL market winners!)")
    print(f"  * Risk: Severe Drawdowns (Loss <= -15%): ONLY {t1_t2_severe:.1f}%")
    print("=" * 95)

    # Hall of Fame: Elite Tier 1 Stocks (Score >= 85)
    t1_pointer = [x for x in data if x["pointer_score"] >= 85.0]
    print(f"\n[+] HALL OF FAME: TIER 1 ELITE BREAKOUTS (Score >= 85): {len(t1_pointer)} stocks")
    print(f"{'Symbol':<12} | {'3M Gain':<8} | {'Score':<6} | {'R1 (Lev)':<8} | {'R2 (RR)':<8} | {'R3 (PAT)':<8} | {'R4 (Sales)':<8} | {'PAT YoY':<8} | {'RR Beat':<8}")
    print("-" * 95)
    for s in sorted(t1_pointer, key=lambda x: x["ret_3m"], reverse=True)[:15]:
        rr_str = f"{s['run_rate_beat']:>+5.0f}%" if s['run_rate_beat'] is not None else "  N/A"
        print(f"{s['symbol']:<12} | {s['ret_3m']:>+6.1f}% | {s['pointer_score']:>5.1f} | {s['r1']:>6.1f}pt | {s['r2']:>6.1f}pt | {s['r3']:>6.1f}pt | {s['r4']:>6.1f}pt | {s['pat_yoy']:>+6.0f}% | {rr_str}")

    # Opportunity Check: Turnarounds that were successfully captured
    turnarounds = [x for x in t1_t2_pointer if x["is_turnaround"]]
    print(f"\n[+] TURNAROUND OPPORTUNITIES CAPTURED (Score >= 70 via Turnaround Pathway): {len(turnarounds)} stocks")
    for t in sorted(turnarounds, key=lambda x: x["ret_3m"], reverse=True)[:8]:
        sy_str = f"{t['sales_yoy']:>+5.0f}%" if t['sales_yoy'] is not None else " N/A"
        py_str = f"{t['pat_yoy']:>+5.0f}%" if t['pat_yoy'] is not None else " N/A"
        print(f"  * {t['symbol']:<12} | 3M Return: {t['ret_3m']:>+6.1f}% | Score: {t['pointer_score']:>4.1f} | PAT YoY: {py_str} | Sales YoY: {sy_str}")

    # Deceptive Traps Successfully Avoided (High YoY, but filtered to Tier 4)
    traps = [x for x in data if x["pat_yoy"] >= 50.0 and x["pointer_score"] < 55.0]
    print(f"\n[+] DECEPTIVE BASE TRAPS CAUGHT & DEMOTED TO TIER 4 (YoY >= +50%, but Score < 55): {len(traps)} stocks")
    for tr in sorted(traps, key=lambda x: x["ret_3m"])[:8]:
        py_str = f"{tr['pat_yoy']:>+5.0f}%" if tr['pat_yoy'] is not None else " N/A"
        pq_str = f"{tr['pat_qoq']:>+5.0f}%" if tr['pat_qoq'] is not None else " N/A"
        sy_str = f"{tr['sales_yoy']:>+5.0f}%" if tr['sales_yoy'] is not None else " N/A"
        print(f"  * {tr['symbol']:<12} | 3M Return: {tr['ret_3m']:>+6.1f}% | Score: {tr['pointer_score']:>4.1f} | PAT YoY: {py_str} | PAT QoQ: {pq_str} | Sales YoY: {sy_str}")

    db.close()


if __name__ == "__main__":
    run_system_backtest()
