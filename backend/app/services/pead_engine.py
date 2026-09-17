"""
Alpha India — Institutional PEAD (Post-Earnings Announcement Drift) Engine
Sprint 34 Production Engine

Calculates 100-Point PEAD Score, candidate tier, operating leverage ratio,
estimated drift runway, and institutional catalyst thesis for exchange quarterly results.
"""

from typing import Any, Dict, Optional


class PEADEngine:
    """
    Evaluates exchange quarterly financial results across 4 quantitative pillars:
    1. Earnings Power & Acceleration (Max 40 pts)
    2. Operating Leverage Multiplier (Max 25 pts)
    3. Capital Efficiency & Structural Quality (Max 20 pts)
    4. Technical Trend & Drift Horizon (Max 15 pts)
    Total: 100 Points
    """

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
        symbol: str = "",
        quarter: str = "",
    ) -> Dict[str, Any]:
        
        rev_yoy = revenue_growth_yoy or 0.0
        pat_yoy = pat_growth_yoy or 0.0
        roce_val = roce or 12.0
        opm_val = opm or 10.0

        # -------------------------------------------------------------
        # Pillar 1: Earnings Power & Acceleration (Max 40 pts)
        # -------------------------------------------------------------
        p1_score = 0.0

        # PAT Growth YoY (Max 25 pts)
        if pat_yoy >= 75.0:
            p1_score += 25.0
        elif pat_yoy >= 50.0:
            p1_score += 22.0
        elif pat_yoy >= 30.0:
            p1_score += 18.0
        elif pat_yoy >= 15.0:
            p1_score += 12.0
        elif pat_yoy > 0.0:
            p1_score += 6.0

        # Sales Growth YoY (Max 15 pts)
        if rev_yoy >= 40.0:
            p1_score += 15.0
        elif rev_yoy >= 25.0:
            p1_score += 12.0
        elif rev_yoy >= 15.0:
            p1_score += 8.0
        elif rev_yoy >= 5.0:
            p1_score += 4.0

        # -------------------------------------------------------------
        # Pillar 2: Operating Leverage Multiplier (Max 25 pts)
        # -------------------------------------------------------------
        p2_score = 0.0
        leverage_ratio = 1.0
        if rev_yoy > 0.0:
            leverage_ratio = round(pat_yoy / rev_yoy, 2)
        elif pat_yoy > 0.0 and rev_yoy <= 0.0:
            leverage_ratio = 2.5  # Cost rationalization turnaround

        # Operating leverage bonus (Max 15 pts)
        if leverage_ratio >= 2.0 and pat_yoy >= 25.0:
            p2_score += 15.0
        elif leverage_ratio >= 1.4 and pat_yoy >= 15.0:
            p2_score += 11.0
        elif leverage_ratio > 1.0 and pat_yoy > 0.0:
            p2_score += 7.0

        # EBITDA / OPM margin tier (Max 10 pts)
        if opm_val >= 22.0:
            p2_score += 10.0
        elif opm_val >= 16.0:
            p2_score += 7.5
        elif opm_val >= 10.0:
            p2_score += 5.0
        elif opm_val > 0:
            p2_score += 2.0

        # -------------------------------------------------------------
        # Pillar 3: Capital Efficiency & Quality (Max 20 pts)
        # -------------------------------------------------------------
        p3_score = 0.0

        # RoCE (Max 12 pts)
        if roce_val >= 25.0:
            p3_score += 12.0
        elif roce_val >= 18.0:
            p3_score += 9.0
        elif roce_val >= 12.0:
            p3_score += 6.0
        elif roce_val > 0.0:
            p3_score += 3.0

        # Balance sheet leverage / Low Debt (Max 8 pts)
        de = debt_to_equity if debt_to_equity is not None else 0.5
        if de <= 0.2:
            p3_score += 8.0
        elif de <= 0.7:
            p3_score += 5.0
        elif de <= 1.2:
            p3_score += 3.0

        # -------------------------------------------------------------
        # Pillar 4: Technical Trend & Drift Runway (Max 15 pts)
        # -------------------------------------------------------------
        p4_score = 0.0

        # Price above 50-DMA (Golden regime)
        if current_price and dma_50:
            if current_price >= dma_50 * 1.02:
                p4_score += 10.0
            elif current_price >= dma_50:
                p4_score += 7.0
            else:
                p4_score += 2.0
        else:
            # Neutral assumption for newly listed / missing technicals
            p4_score += 7.0

        # Fresh announcement drift window runway
        p4_score += 5.0

        # Total PEAD Score
        raw_total = p1_score + p2_score + p3_score + p4_score
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
        if pat_yoy >= 30.0:
            thesis_parts.append(f"PAT accelerated +{pat_yoy:.1f}% YoY")
        if rev_yoy >= 20.0:
            thesis_parts.append(f"Sales expanded +{rev_yoy:.1f}%")
        if leverage_ratio >= 1.3:
            thesis_parts.append(f"Operating leverage at {leverage_ratio}x")
        if roce_val >= 18.0:
            thesis_parts.append(f"High-quality {roce_val:.1f}% RoCE")

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
            "is_pead_candidate": pead_score >= 70.0,
            "is_elite_pead": pead_score >= 85.0,
            "thesis": thesis,
            "pillar_breakdown": {
                "earnings_power": round(p1_score, 1),
                "operating_leverage": round(p2_score, 1),
                "capital_efficiency": round(p3_score, 1),
                "trend_drift": round(p4_score, 1),
            }
        }
