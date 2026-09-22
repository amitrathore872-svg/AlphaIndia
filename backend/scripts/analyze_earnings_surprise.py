"""
Alpha India — Quantitative Research: Earnings Surprise Impact Analysis
Empirical testing on Indian Equities to measure if incorporating Earnings Surprise
into the Hybrid (YoY + QoQ) PEAD model enhances winner discovery and return alpha.
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from typing import Dict, Any, List
import numpy as np
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord


def run_surprise_research():
    db: Session = SessionLocal()
    records: List[ScreenerGrowthRecord] = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_qoq.isnot(None),
            ScreenerGrowthRecord.return_3m.isnot(None),
            ScreenerGrowthRecord.current_price > 10.0,
            ScreenerGrowthRecord.market_cap > 100.0,
            ScreenerGrowthRecord.pat_12m.isnot(None),
            ScreenerGrowthRecord.latest_quarter_net_profit.isnot(None),
        )
        .all()
    )

    print("=" * 90)
    print(f"QUANTITATIVE RESEARCH: EARNINGS SURPRISE IMPACT ON POST-EARNINGS DRIFT")
    print(f"Sample Size: {len(records)} Listed Indian Equities (NSE/BSE)")
    print("=" * 90)

    rows = []
    for r in records:
        ret_3m = r.return_3m or 0.0
        pat_yoy = r.quarterly_pat_yoy or 0.0
        pat_qoq = r.quarterly_pat_qoq or 0.0
        sales_yoy = r.quarterly_sales_yoy or 0.0
        sales_qoq = r.quarterly_sales_qoq or 0.0
        
        # 1. Run-Rate Beat %: Is current quarter significantly beating the 4Q quarterly average?
        # Quarterly average = pat_12m / 4. If current is 50 Cr and avg was 35 Cr -> (50 - 35)/35 = +42.8% beat
        avg_qtr_pat = r.pat_12m / 4.0 if r.pat_12m and r.pat_12m > 0 else None
        run_rate_surprise_pct = None
        if avg_qtr_pat and avg_qtr_pat > 0 and r.latest_quarter_net_profit:
            run_rate_surprise_pct = ((r.latest_quarter_net_profit - avg_qtr_pat) / avg_qtr_pat) * 100.0

        # 2. Growth Acceleration Surprise: Quarterly YoY growth vs Trailing 12M growth
        # e.g., TTM was 15%, but this quarter reported +60% YoY -> Acceleration = +45%
        growth_accel_surprise = None
        if r.profit_growth_ttm is not None:
            growth_accel_surprise = pat_yoy - r.profit_growth_ttm

        # 3. Margin Expansion Surprise (Delta OPM): Latest OPM vs TTM OPM in basis points
        margin_surprise_bps = None
        if r.opm_latest is not None and r.opm_ttm is not None:
            margin_surprise_bps = (r.opm_latest - r.opm_ttm) * 100.0  # 1% = 100 bps

        rows.append({
            "symbol": r.symbol,
            "company": r.company_name,
            "ret_3m": ret_3m,
            "pat_yoy": pat_yoy,
            "pat_qoq": pat_qoq,
            "sales_yoy": sales_yoy,
            "sales_qoq": sales_qoq,
            "roce": r.roce or 10.0,
            "opm": r.opm_latest or 10.0,
            "de": r.debt_to_equity if r.debt_to_equity is not None else 0.8,
            "run_rate_surprise": run_rate_surprise_pct,
            "growth_accel_surprise": growth_accel_surprise,
            "margin_surprise_bps": margin_surprise_bps,
        })

    # -------------------------------------------------------------
    # Experiment 1: Isolated Impact of Run-Rate Surprise
    # -------------------------------------------------------------
    print("\n--- EXPERIMENT 1: RUN-RATE SURPRISE (Current Quarter PAT vs Trailing 4Q Avg) ---")
    valid_rr = [x for x in rows if x["run_rate_surprise"] is not None]
    
    tier_high_rr = [x["ret_3m"] for x in valid_rr if x["run_rate_surprise"] >= 30.0]
    tier_mid_rr = [x["ret_3m"] for x in valid_rr if 10.0 <= x["run_rate_surprise"] < 30.0]
    tier_flat_rr = [x["ret_3m"] for x in valid_rr if -10.0 <= x["run_rate_surprise"] < 10.0]
    tier_miss_rr = [x["ret_3m"] for x in valid_rr if x["run_rate_surprise"] < -10.0]

    for label, arr in [
        ("Massive Beat (>= +30% above avg pace)", tier_high_rr),
        ("Solid Beat (+10% to +30% above avg)", tier_mid_rr),
        ("In-Line (-10% to +10%)", tier_flat_rr),
        ("Earnings Miss (< -10% below avg pace)", tier_miss_rr),
    ]:
        win_rate = (sum(1 for r in arr if r > 0) / len(arr) * 100) if arr else 0
        big_movers = (sum(1 for r in arr if r >= 20.0) / len(arr) * 100) if arr else 0
        avg_ret = np.mean(arr) if arr else 0
        med_ret = np.median(arr) if arr else 0
        print(f"{label:<40} | N={len(arr):<4} | Avg Ret: {avg_ret:>+6.2f}% | Med Ret: {med_ret:>+6.2f}% | Win Rate: {win_rate:>5.1f}% | >+20% Movers: {big_movers:>5.1f}%")

    # -------------------------------------------------------------
    # Experiment 2: Growth Acceleration Surprise (YoY Growth vs TTM Growth)
    # -------------------------------------------------------------
    print("\n--- EXPERIMENT 2: GROWTH ACCELERATION SURPRISE (Quarterly PAT YoY - TTM PAT YoY) ---")
    valid_accel = [x for x in rows if x["growth_accel_surprise"] is not None]

    tier_high_acc = [x["ret_3m"] for x in valid_accel if x["growth_accel_surprise"] >= 25.0]
    tier_mid_acc = [x["ret_3m"] for x in valid_accel if 5.0 <= x["growth_accel_surprise"] < 25.0]
    tier_flat_acc = [x["ret_3m"] for x in valid_accel if -10.0 <= x["growth_accel_surprise"] < 5.0]
    tier_decel = [x["ret_3m"] for x in valid_accel if x["growth_accel_surprise"] < -10.0]

    for label, arr in [
        ("Hyper-Acceleration (>= +25% Delta)", tier_high_acc),
        ("Moderate Acceleration (+5% to +25%)", tier_mid_acc),
        ("Trend Continuity (-10% to +5%)", tier_flat_acc),
        ("Severe Deceleration (< -10% Delta)", tier_decel),
    ]:
        win_rate = (sum(1 for r in arr if r > 0) / len(arr) * 100) if arr else 0
        big_movers = (sum(1 for r in arr if r >= 20.0) / len(arr) * 100) if arr else 0
        avg_ret = np.mean(arr) if arr else 0
        med_ret = np.median(arr) if arr else 0
        print(f"{label:<40} | N={len(arr):<4} | Avg Ret: {avg_ret:>+6.2f}% | Med Ret: {med_ret:>+6.2f}% | Win Rate: {win_rate:>5.1f}% | >+20% Movers: {big_movers:>5.1f}%")

    # -------------------------------------------------------------
    # Experiment 3: Margin Expansion Surprise (Latest OPM vs TTM OPM)
    # -------------------------------------------------------------
    print("\n--- EXPERIMENT 3: MARGIN EXPANSION SURPRISE (Delta OPM in Basis Points) ---")
    valid_opm = [x for x in rows if x["margin_surprise_bps"] is not None]

    tier_super_opm = [x["ret_3m"] for x in valid_opm if x["margin_surprise_bps"] >= 300.0]  # +300 bps
    tier_mod_opm = [x["ret_3m"] for x in valid_opm if 100.0 <= x["margin_surprise_bps"] < 300.0]
    tier_flat_opm = [x["ret_3m"] for x in valid_opm if -100.0 <= x["margin_surprise_bps"] < 100.0]
    tier_margin_comp = [x["ret_3m"] for x in valid_opm if x["margin_surprise_bps"] < -100.0]

    for label, arr in [
        ("Massive Margin Blowout (>= +300 bps)", tier_super_opm),
        ("Solid Expansion (+100 to +300 bps)", tier_mod_opm),
        ("Stable Margins (-100 to +100 bps)", tier_flat_opm),
        ("Margin Compression (< -100 bps)", tier_margin_comp),
    ]:
        win_rate = (sum(1 for r in arr if r > 0) / len(arr) * 100) if arr else 0
        big_movers = (sum(1 for r in arr if r >= 20.0) / len(arr) * 100) if arr else 0
        avg_ret = np.mean(arr) if arr else 0
        med_ret = np.median(arr) if arr else 0
        print(f"{label:<40} | N={len(arr):<4} | Avg Ret: {avg_ret:>+6.2f}% | Med Ret: {med_ret:>+6.2f}% | Win Rate: {win_rate:>5.1f}% | >+20% Movers: {big_movers:>5.1f}%")

    # -------------------------------------------------------------
    # Experiment 4: Hybrid WITHOUT Surprise vs Hybrid WITH Surprise Weight
    # -------------------------------------------------------------
    print("\n" + "=" * 90)
    print("EXPERIMENT 4: HEAD-TO-HEAD COMPARISON")
    print("Model A: Hybrid Dual-Axis (YoY + QoQ) WITHOUT Surprise Factor")
    print("Model B: Apex Hybrid + Institutional Surprise Engine (Run-Rate + Acceleration + Margin Beat)")
    print("=" * 90)

    # Let's test Model A (No surprise)
    def score_model_a(x):
        # Dual axis YoY + QoQ
        score = 0.0
        py, pq = x["pat_yoy"], x["pat_qoq"]
        sy, sq = x["sales_yoy"], x["sales_qoq"]

        # PAT velocity
        if py >= 50 and pq >= 25: score += 30.0
        elif py >= 35 and pq >= 15: score += 24.0
        elif py >= 25 and pq > 0: score += 18.0
        elif py >= 50 and pq <= 0: score += 10.0
        elif py >= 15: score += 8.0
        elif py > 0: score += 4.0

        # Sales velocity
        if sy >= 25 and sq >= 10: score += 20.0
        elif sy >= 15 and sq >= 5: score += 14.0
        elif sy >= 10: score += 8.0
        elif sy > 0: score += 4.0

        # Operating leverage
        lev = (py / sy) if sy > 0 else 1.0
        if lev >= 2.0 and py >= 25: score += 18.0
        elif lev >= 1.4: score += 12.0
        elif lev >= 1.0: score += 6.0

        # Quality
        if x["roce"] >= 20: score += 14.0
        elif x["roce"] >= 14: score += 9.0
        if x["de"] <= 0.3: score += 10.0
        elif x["de"] <= 0.8: score += 6.0

        # Margin
        if x["opm"] >= 20: score += 8.0
        elif x["opm"] >= 12: score += 4.0

        # Penalties
        if py >= 25 and pq < -15: score -= 15.0
        if sq < -10: score -= 8.0

        return max(0.0, min(100.0, score))

    # Model B: Includes Institutional Surprise Multiplier (Max 20 Pts)
    def score_model_b(x):
        score = 0.0
        py, pq = x["pat_yoy"], x["pat_qoq"]
        sy, sq = x["sales_yoy"], x["sales_qoq"]

        # Core Dual Velocity (Max 35 Pts)
        if py >= 50 and pq >= 25: score += 24.0
        elif py >= 35 and pq >= 15: score += 19.0
        elif py >= 25 and pq > 0: score += 14.0
        elif py >= 50 and pq <= 0: score += 8.0
        elif py >= 15: score += 6.0
        elif py > 0: score += 3.0

        if sy >= 25 and sq >= 10: score += 11.0
        elif sy >= 15 and sq >= 5: score += 8.0
        elif sy >= 10: score += 5.0
        elif sy > 0: score += 2.0

        # Operating Leverage (Max 15 Pts)
        lev = (py / sy) if sy > 0 else 1.0
        if lev >= 2.0 and py >= 25: score += 15.0
        elif lev >= 1.4: score += 10.0
        elif lev >= 1.0: score += 5.0

        # Quality & Balance Sheet (Max 15 Pts)
        if x["roce"] >= 20: score += 9.0
        elif x["roce"] >= 14: score += 6.0
        if x["de"] <= 0.3: score += 6.0
        elif x["de"] <= 0.8: score += 3.0

        # Margin Tier (Max 10 Pts)
        if x["opm"] >= 20: score += 10.0
        elif x["opm"] >= 12: score += 6.0
        elif x["opm"] > 0: score += 3.0

        # --- SURPRISE ENGINE (Max 25 Pts) ---
        surprise_pts = 0.0
        
        # Sub-factor 1: Run-Rate Surprise (Quarterly PAT vs 4Q Run-Rate Avg) (Max 10 Pts)
        rr = x["run_rate_surprise"]
        if rr is not None:
            if rr >= 35.0: surprise_pts += 10.0      # Blowout run-rate beat
            elif rr >= 20.0: surprise_pts += 7.0
            elif rr >= 10.0: surprise_pts += 4.0
            elif rr < -15.0: score -= 5.0            # Meaningful run-rate miss penalty

        # Sub-factor 2: Growth Acceleration Surprise (YoY PAT growth - TTM PAT growth) (Max 8 Pts)
        ga = x["growth_accel_surprise"]
        if ga is not None:
            if ga >= 30.0: surprise_pts += 8.0       # Massive inflection / acceleration
            elif ga >= 15.0: surprise_pts += 5.0
            elif ga >= 5.0: surprise_pts += 3.0
            elif ga < -20.0: score -= 4.0            # Deceleration penalty

        # Sub-factor 3: Margin Expansion Surprise (Delta OPM bps) (Max 7 Pts)
        ms = x["margin_surprise_bps"]
        if ms is not None:
            if ms >= 300.0: surprise_pts += 7.0      # >= +300 bps expansion
            elif ms >= 150.0: surprise_pts += 4.5
            elif ms >= 50.0: surprise_pts += 2.5
            elif ms < -150.0: score -= 3.0           # Severe margin contraction penalty

        score += min(25.0, surprise_pts)

        # Trap Penalties
        if py >= 25 and pq < -15: score -= 15.0
        if sq < -10: score -= 8.0

        return max(0.0, min(100.0, score))

    for x in rows:
        x["score_a"] = score_model_a(x)
        x["score_b"] = score_model_b(x)

    # Let's inspect performance across tiers for Model A vs Model B
    for model_name, key in [("Model A: Hybrid Dual-Axis (NO Surprise)", "score_a"), ("Model B: Hybrid + Institutional Surprise Engine", "score_b")]:
        print(f"\n[{model_name.upper()}] Performance Breakdown:")
        t1 = [x["ret_3m"] for x in rows if x[key] >= 85.0]
        t2 = [x["ret_3m"] for x in rows if 70.0 <= x[key] < 85.0]
        t3 = [x["ret_3m"] for x in rows if 55.0 <= x[key] < 70.0]
        t4 = [x["ret_3m"] for x in rows if x[key] < 55.0]

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
            drawdowns = sum(1 for r in tarr if r <= -15.0) / len(tarr) * 100
            avg_r = np.mean(tarr)
            med_r = np.median(tarr)
            print(f"  {tname:<46} | N={len(tarr):<4} | Avg: {avg_r:>+6.2f}% | Med: {med_r:>+6.2f}% | Win: {win_rate:>5.1f}% | >+20%: {big_movers:>5.1f}% | >+40%: {super_movers:>5.1f}% | Loss<-15%: {drawdowns:>4.1f}%")

    # Let's look at specific real-world stocks boosted by Surprise vs penalized by Surprise
    print("\n" + "=" * 90)
    print("TOP STOCKS PROMOTED BY SURPRISE FACTOR (Highest Score Boost in Model B):")
    boosted = sorted([x for x in rows if x["score_b"] - x["score_a"] >= 8.0], key=lambda x: x["ret_3m"], reverse=True)
    for s in boosted[:8]:
        rr_str = f"{s['run_rate_surprise']:>+5.1f}%" if s['run_rate_surprise'] is not None else "  N/A"
        acc_str = f"{s['growth_accel_surprise']:>+5.1f}%" if s['growth_accel_surprise'] is not None else "  N/A"
        print(f"  * {s['symbol']:<12} | CMP 3M Return: {s['ret_3m']:>+6.1f}% | Model A: {s['score_a']:>4.1f} -> Model B: {s['score_b']:>4.1f} (+{s['score_b']-s['score_a']:>4.1f} pts) | RR Beat: {rr_str} | Accel: {acc_str}")

    print("\nSTOCKS DEMOTED BY SURPRISE FACTOR (Missed Run-Rate / Deceleration):")
    demoted = sorted([x for x in rows if x["score_a"] - x["score_b"] >= 8.0], key=lambda x: x["ret_3m"])
    for s in demoted[:8]:
        rr_str = f"{s['run_rate_surprise']:>+5.1f}%" if s['run_rate_surprise'] is not None else "  N/A"
        acc_str = f"{s['growth_accel_surprise']:>+5.1f}%" if s['growth_accel_surprise'] is not None else "  N/A"
        print(f"  * {s['symbol']:<12} | CMP 3M Return: {s['ret_3m']:>+6.1f}% | Model A: {s['score_a']:>4.1f} -> Model B: {s['score_b']:>4.1f} (-{s['score_a']-s['score_b']:>4.1f} pts) | RR Beat: {rr_str} | Accel: {acc_str}")

    db.close()

if __name__ == "__main__":
    run_surprise_research()
