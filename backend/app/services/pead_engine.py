"""
Alpha India — Institutional PEAD (Post-Earnings Announcement Drift) Engine
Sprint 36.4 Production Engine — Dual-Feed Intelligence Upgrade

Calculates:
  • 100-Point PEAD Score (post-results) with QoQ acceleration, EPS surprise, freshness decay
  • Pre-Beat Readiness Score (pre-announcement) via historical earnings quality
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class PEADEngine:
    """
    Evaluates exchange quarterly financial results across 4 quantitative pillars:
    1. Earnings Power & Acceleration (Max 40 pts)
    2. Operating Leverage Multiplier (Max 25 pts)
    3. Capital Efficiency & Structural Quality (Max 20 pts)
    4. Technical Trend & Drift Horizon (Max 15 pts)
    Total: 100 Points

    Also exposes evaluate_pre_announcement() for board-meeting-phase pre-beat probability scoring.
    """

    # -----------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------

    @classmethod
    def _freshness_bonus(cls, discovered_at: Optional[datetime]) -> float:
        """
        Returns a freshness bonus (0–5 pts) that decays linearly over 14 days.
        Full 5 pts if discovered within 24 hours; 0 pts after 14 days.
        """
        if not discovered_at:
            return 3.0  # neutral assumption for unknown date
        now = datetime.now(timezone.utc)
        if discovered_at.tzinfo is None:
            # Treat naïve datetimes as UTC
            discovered_at = discovered_at.replace(tzinfo=timezone.utc)
        age_days = max(0, (now - discovered_at).total_seconds() / 86_400)
        if age_days <= 1:
            return 5.0
        elif age_days <= 7:
            return round(5.0 - ((age_days - 1) / 6) * 3.0, 1)  # 5→2 over days 1-7
        elif age_days <= 14:
            return round(2.0 - ((age_days - 7) / 7) * 2.0, 1)  # 2→0 over days 7-14
        return 0.0

    # -----------------------------------------------------------------
    # Main post-results PEAD evaluation
    # -----------------------------------------------------------------

    @classmethod
    def evaluate(
        cls,
        revenue_growth_yoy: Optional[float] = None,
        pat_growth_yoy: Optional[float] = None,
        roce: Optional[float] = None,
        opm: Optional[float] = None,
        current_price: Optional[float] = None,
        dma_50: Optional[float] = None,
        debt_to_equity: Optional[float] = None,
        revenue_growth_qoq: Optional[float] = None,
        pat_growth_qoq: Optional[float] = None,
        eps: Optional[float] = None,
        trailing_eps: Optional[float] = None,
        discovered_at: Optional[datetime] = None,
        symbol: str = "",
        quarter: str = "",
        # Extended fields for Rank 1 & Rank 2
        latest_quarter_net_profit: Optional[float] = None,
        pat_12m: Optional[float] = None,
        profit_growth_ttm: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Prioritized 100-Point Institutional PEAD System.
        Ranked by empirical predictive impact:
          🥇 Rank 1: Operating Leverage Multiplier (Max 25 Pts) + Turnaround Inflection
          🥈 Rank 2: Institutional Run-Rate Surprise (Max 20 Pts)
          🥉 Rank 3: Dual-Axis PAT Velocity (YoY + QoQ) (Max 20 Pts)
          4️⃣ Rank 4: Top-Line Sales Expansion (Max 15 Pts)
          5️⃣ Rank 5: Operating Margins & Pricing Power (Max 10 Pts)
          6️⃣ Rank 6: Capital Quality & Balance Sheet (Max 5 Pts)
          7️⃣ Rank 7: Drift Runway & Freshness Window (Max 5 Pts)
          🛡️ Targeted Deceptive Trap Penalties (-10 / -8 Pts)
        """
        rev_yoy = revenue_growth_yoy or 0.0
        pat_yoy = pat_growth_yoy or 0.0
        rev_qoq = revenue_growth_qoq or 0.0
        pat_qoq = pat_growth_qoq or 0.0
        roce_val = roce or 10.0
        opm_val = opm or 10.0
        de_val = debt_to_equity if debt_to_equity is not None else 0.8

        # -------------------------------------------------------------
        # 🥇 RANK 1: OPERATING LEVERAGE MULTIPLIER (Max 25 Pts)
        # -------------------------------------------------------------
        r1_score = 0.0
        is_turnaround = False
        leverage_ratio = 1.0

        if latest_quarter_net_profit and latest_quarter_net_profit > 0 and (pat_12m is None or pat_12m <= 0):
            # Swung from negative/zero 12M profit to positive quarterly profit
            r1_score = 22.0
            is_turnaround = True
            leverage_ratio = 3.0
        elif rev_yoy > 0.0:
            leverage_ratio = round(pat_yoy / rev_yoy, 2)
            if leverage_ratio >= 2.5 and rev_yoy >= 10.0:
                r1_score = 25.0
            elif leverage_ratio >= 1.8 and rev_yoy >= 5.0:
                r1_score = 18.0
            elif leverage_ratio >= 1.2:
                r1_score = 12.0
            elif leverage_ratio >= 0.8:
                r1_score = 6.0
        elif pat_yoy > 20.0 and rev_yoy <= 0.0:
            # Turnaround via aggressive margin / cost rationalization
            r1_score = 18.0
            is_turnaround = True
            leverage_ratio = 2.5
        r1_score = min(25.0, r1_score)

        # -------------------------------------------------------------
        # 🥈 RANK 2: INSTITUTIONAL RUN-RATE SURPRISE (Max 20 Pts)
        # -------------------------------------------------------------
        r2_score = 0.0
        run_rate_beat_pct = 0.0
        if pat_12m and pat_12m > 0 and latest_quarter_net_profit:
            avg_qtr = pat_12m / 4.0
            run_rate_beat_pct = round(((latest_quarter_net_profit - avg_qtr) / avg_qtr) * 100.0, 1)
            if run_rate_beat_pct >= 35.0:
                r2_score = 20.0
            elif run_rate_beat_pct >= 20.0:
                r2_score = 15.0
            elif run_rate_beat_pct >= 10.0:
                r2_score = 10.0
            elif run_rate_beat_pct >= 3.0:
                r2_score = 5.0
        elif eps is not None and trailing_eps is not None and trailing_eps > 0:
            # Fallback EPS surprise if net profit not available
            eps_surprise = ((eps - trailing_eps) / trailing_eps) * 100.0
            run_rate_beat_pct = round(eps_surprise, 1)
            if eps_surprise >= 30.0:
                r2_score = 18.0
            elif eps_surprise >= 15.0:
                r2_score = 12.0
            elif eps_surprise >= 5.0:
                r2_score = 6.0
        r2_score = min(20.0, r2_score)

        # -------------------------------------------------------------
        # 🥉 RANK 3: DUAL-AXIS PAT VELOCITY (YoY + QoQ) (Max 20 Pts)
        # -------------------------------------------------------------
        r3_score = 0.0
        if pat_yoy >= 75.0 and pat_qoq >= 20.0:
            r3_score = 20.0  # Blowout double-acceleration
        elif pat_yoy >= 40.0 and pat_qoq >= 10.0:
            r3_score = 16.0
        elif pat_yoy >= 25.0 and pat_qoq > 0.0:
            r3_score = 12.0
        elif pat_yoy >= 50.0 and pat_qoq >= -10.0:
            r3_score = 9.0   # Seasonal hold pathway
        elif pat_yoy >= 15.0 or pat_qoq >= 15.0:
            r3_score = 5.0
        elif pat_yoy > 0.0:
            r3_score = 2.0
        r3_score = min(20.0, r3_score)

        # -------------------------------------------------------------
        # 4️⃣ RANK 4: TOP-LINE SALES EXPANSION (Max 15 Pts)
        # -------------------------------------------------------------
        r4_score = 0.0
        if rev_yoy >= 30.0:
            r4_score = 15.0
        elif rev_yoy >= 20.0:
            r4_score = 11.0
        elif rev_yoy >= 10.0:
            r4_score = 7.0
        elif rev_yoy > 0.0:
            r4_score = 3.0
        r4_score = min(15.0, r4_score)

        # -------------------------------------------------------------
        # 5️⃣ RANK 5: OPERATING MARGINS & PRICING POWER (Max 10 Pts)
        # -------------------------------------------------------------
        r5_score = 0.0
        if opm_val >= 22.0:
            r5_score = 10.0
        elif opm_val >= 15.0:
            r5_score = 7.0
        elif opm_val >= 10.0:
            r5_score = 4.0
        elif opm_val > 0.0:
            r5_score = 2.0
        r5_score = min(10.0, r5_score)

        # -------------------------------------------------------------
        # 6️⃣ RANK 6: CAPITAL QUALITY & BALANCE SHEET (Max 5 Pts)
        # -------------------------------------------------------------
        r6_score = 0.0
        if de_val <= 0.3:
            r6_score += 3.0
        elif de_val <= 0.8:
            r6_score += 1.5

        if roce_val >= 20.0:
            r6_score += 2.0
        elif roce_val >= 12.0:
            r6_score += 1.0
        r6_score = min(5.0, r6_score)

        # -------------------------------------------------------------
        # 7️⃣ RANK 7: DRIFT RUNWAY & FRESHNESS WINDOW (Max 5 Pts)
        # -------------------------------------------------------------
        r7_score = cls._freshness_bonus(discovered_at)

        # -------------------------------------------------------------
        # 🛡️ TARGETED DECEPTIVE TRAP PENALTIES
        # -------------------------------------------------------------
        penalties = 0.0
        # Trap 1: Low-base fakeout (YoY high but QoQ collapsing)
        if pat_yoy >= 30.0 and pat_qoq < -25.0:
            penalties += 10.0
        # Trap 2: Sales contraction with high PAT (one-off other income illusion)
        if rev_yoy < -5.0 and pat_yoy > 15.0:
            penalties += 8.0

        raw_total = r1_score + r2_score + r3_score + r4_score + r5_score + r6_score + r7_score - penalties
        pead_score = round(min(100.0, max(0.0, raw_total)), 1)

        # Classification Tier
        if pead_score >= 85.0:
            tier = "ELITE_PEAD"
            tier_label = "Elite PEAD Breakout"
            color = "emerald"
            drift_days = "20-45 Days"
        elif pead_score >= 70.0:
            tier = "STRONG_PEAD"
            tier_label = "Strong PEAD Candidate"
            color = "cyan"
            drift_days = "15-35 Days"
        elif pead_score >= 55.0:
            tier = "MODERATE_PEAD"
            tier_label = "Moderate PEAD"
            color = "amber"
            drift_days = "10-20 Days"
        else:
            tier = "NEUTRAL"
            tier_label = "Neutral / Watch"
            color = "slate"
            drift_days = "5-10 Days"

        # Construct Institutional Thesis
        thesis_parts = []
        if r1_score >= 18.0:
            if is_turnaround:
                thesis_parts.append("Major operational turnaround")
            else:
                thesis_parts.append(f"High operating leverage ({leverage_ratio:.1f}x)")
        if run_rate_beat_pct >= 20.0:
            thesis_parts.append(f"Run-rate beat +{run_rate_beat_pct:.1f}%")
        if pat_yoy >= 40.0:
            thesis_parts.append(f"PAT accelerated +{pat_yoy:.1f}% YoY")
        if pat_qoq >= 15.0:
            thesis_parts.append(f"+{pat_qoq:.1f}% QoQ expansion")
        if rev_yoy >= 20.0:
            thesis_parts.append(f"Sales expanded +{rev_yoy:.1f}%")
        if opm_val >= 18.0:
            thesis_parts.append(f"Robust {opm_val:.1f}% OPM")

        if not thesis_parts:
            if pat_yoy > 0:
                thesis = f"Moderate quarterly performance with +{pat_yoy:.1f}% PAT growth."
            else:
                thesis = "Subdued earnings growth; watching for sequential inflection."
        else:
            thesis = "High-velocity earnings surprise (PEAD). " + ", ".join(thesis_parts) + "."

        return {
            "pead_score": pead_score,
            "pead_tier": tier,
            "pead_tier_label": tier_label,
            "pead_color": color,
            "drift_days": drift_days,
            "operating_leverage_ratio": leverage_ratio,
            "run_rate_beat_pct": run_rate_beat_pct,
            "is_turnaround": is_turnaround,
            "is_pead_candidate": pead_score >= 70.0,
            "is_elite_pead": pead_score >= 85.0,
            "thesis": thesis,
            "pillar_breakdown": {
                "rank1_operating_leverage": round(r1_score, 1),
                "rank2_run_rate_surprise": round(r2_score, 1),
                "rank3_pat_velocity": round(r3_score, 1),
                "rank4_sales_expansion": round(r4_score, 1),
                "rank5_operating_margin": round(r5_score, 1),
                "rank6_capital_quality": round(r6_score, 1),
                "rank7_freshness_drift": round(r7_score, 1),
                "trap_penalties": round(penalties, 1),
            },
        }

    # -----------------------------------------------------------------
    # Pre-Announcement: Board Meeting Phase Pre-Beat Readiness
    # -----------------------------------------------------------------

    @classmethod
    def evaluate_pre_announcement(
        cls,
        # Historical trailing data (from quarterly_results / ScreenerGrowthRecord)
        avg_revenue_growth_trailing: Optional[float] = None,   # trailing 4Q average revenue YoY %
        avg_pat_growth_trailing: Optional[float] = None,        # trailing 4Q average PAT YoY %
        quarters_with_positive_pat: Optional[int] = None,       # out of last 4 quarters
        beat_count_of_4: Optional[int] = None,                  # how many of last 4 quarters had PAT > 25%
        roce: Optional[float] = None,
        debt_to_equity: Optional[float] = None,
        current_price: Optional[float] = None,
        dma_50: Optional[float] = None,
        discovered_at: Optional[datetime] = None,
        symbol: str = "",
        period: str = "",
    ) -> Dict[str, Any]:
        """
        Computes a Pre-Beat Readiness Score (0–100) for companies that have filed a
        board meeting notice but haven't yet reported results. Scores based on
        historical earnings quality and technical positioning.
        """

        avg_rev = avg_revenue_growth_trailing or 0.0
        avg_pat = avg_pat_growth_trailing or 0.0
        roce_val = roce or 12.0
        q_positive = quarters_with_positive_pat if quarters_with_positive_pat is not None else 2
        beat_count = beat_count_of_4 if beat_count_of_4 is not None else 0

        score = 0.0

        # -----------------------------------------------------------------
        # A. Historical PAT Growth Consistency (Max 30 pts)
        # -----------------------------------------------------------------
        # Beat track record — PAT > 25% in last 4 quarters
        if beat_count >= 4:
            score += 30.0
        elif beat_count == 3:
            score += 22.0
        elif beat_count == 2:
            score += 14.0
        elif beat_count == 1:
            score += 7.0

        # -----------------------------------------------------------------
        # B. Trailing Revenue Momentum (Max 20 pts)
        # -----------------------------------------------------------------
        if avg_rev >= 30.0:
            score += 20.0
        elif avg_rev >= 20.0:
            score += 15.0
        elif avg_rev >= 10.0:
            score += 10.0
        elif avg_rev >= 5.0:
            score += 5.0

        # -----------------------------------------------------------------
        # C. Positive Quarters Streak (Max 15 pts)
        # -----------------------------------------------------------------
        if q_positive == 4:
            score += 15.0
        elif q_positive == 3:
            score += 10.0
        elif q_positive == 2:
            score += 5.0

        # -----------------------------------------------------------------
        # D. Capital Quality (Max 20 pts)
        # -----------------------------------------------------------------
        # RoCE
        if roce_val >= 25.0:
            score += 12.0
        elif roce_val >= 18.0:
            score += 8.0
        elif roce_val >= 12.0:
            score += 4.0

        # Debt
        de = debt_to_equity if debt_to_equity is not None else 0.5
        if de <= 0.2:
            score += 8.0
        elif de <= 0.7:
            score += 5.0
        elif de <= 1.2:
            score += 2.0

        # -----------------------------------------------------------------
        # E. Technical Positioning (Max 15 pts)
        # -----------------------------------------------------------------
        if current_price and dma_50:
            if current_price >= dma_50 * 1.05:
                score += 10.0  # Stage-2 breakout above 50-DMA
            elif current_price >= dma_50:
                score += 7.0
            else:
                score += 2.0
        else:
            score += 5.0  # neutral assumption

        # Freshness bonus for recent filing (Max 5 pts)
        score = min(100.0, score + cls._freshness_bonus(discovered_at))

        pre_beat_score = round(min(100.0, max(0.0, score)), 1)

        # Tier
        if pre_beat_score >= 80.0:
            beat_tier = "HIGH_PROBABILITY"
            tier_label = "High Pre-Beat Probability"
            color = "emerald"
            velocity = "Imminent (1–3 Days)"
        elif pre_beat_score >= 60.0:
            beat_tier = "MODERATE_PROBABILITY"
            tier_label = "Moderate Pre-Beat"
            color = "cyan"
            velocity = "Upcoming (2–5 Days)"
        elif pre_beat_score >= 40.0:
            beat_tier = "WATCH"
            tier_label = "Watch List"
            color = "amber"
            velocity = "Monitor"
        else:
            beat_tier = "LOW_PROBABILITY"
            tier_label = "Low Signal"
            color = "slate"
            velocity = "—"

        # Thesis
        thesis_parts = []
        if beat_count >= 3:
            thesis_parts.append(f"Consistent beat in {beat_count}/4 trailing quarters (PAT >25%)")
        if avg_pat >= 20.0:
            thesis_parts.append(f"Trailing avg PAT growth {avg_pat:.1f}%")
        if avg_rev >= 15.0:
            thesis_parts.append(f"Revenue momentum at {avg_rev:.1f}% avg YoY")
        if roce_val >= 18.0:
            thesis_parts.append(f"Capital quality ROCE {roce_val:.1f}%")
        if current_price and dma_50 and current_price >= dma_50:
            thesis_parts.append("Stock in Stage-2 uptrend above 50-DMA")

        if thesis_parts:
            thesis = "Pre-announcement drift opportunity. " + ", ".join(thesis_parts) + "."
        else:
            thesis = "Board meeting scheduled. Historical earnings quality insufficient for strong conviction."

        return {
            "pre_beat_score": pre_beat_score,
            "beat_tier": beat_tier,
            "beat_tier_label": tier_label,
            "beat_color": color,
            "velocity": velocity,
            "beat_thesis": thesis,
            "beat_count_of_4": beat_count,
            "avg_pat_growth_trailing": round(avg_pat, 1),
            "avg_revenue_growth_trailing": round(avg_rev, 1),
        }
