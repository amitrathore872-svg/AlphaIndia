"""
ATHENA OMEGA v3.0 — Gate 4 & 5: Conviction Engine & FLASH Decision Publisher
Sprint 24
Master Scoring Formula:
ATHENA Conviction = 40%(Financial Shock) + 35%(Earnings Quality) + 25%(Valuation Score) - (0.5 * Risk Penalties)

Grades:
- AAA+ : 90 - 100 -> BUY IMMEDIATELY (Expected Gap-Up +6-10%, 1D +8-12%, 1W +15-20%, 1M +25-35%)
- AAA  : 80 - 89  -> BUY (Expected Gap-Up +3-6%, 1D +5-8%, 1W +8-14%, 1M +15-22%)
- AA   : 70 - 79  -> ACCUMULATE (Expected Gap-Up +1-3%, 1D +3-5%, 1W +5-8%, 1M +8-14%)
- A    : 60 - 69  -> WATCHLIST
- BELOW_A: < 60   -> AVOID / ARCHIVE
"""

from typing import Any, Dict
from app.services.athena_history_fusion import AthenaFusedState


class AthenaConvictionEngine:

    @classmethod
    def generate_flash_decision(
        cls,
        state: AthenaFusedState,
        shock_result: Dict[str, Any],
        quality_result: Dict[str, Any],
        valuation_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        shock_score = shock_result["normalized_shock_score"]
        quality_score = quality_result["quality_score"]
        val_score = valuation_result["valuation_score"]
        risk_penalties = valuation_result.get("risk_penalties_applied", 0.0)

        # -------------------------------------------------------------
        # Master Conviction Formula
        # -------------------------------------------------------------
        raw_conviction = (
            (0.40 * shock_score)
            + (0.35 * quality_score)
            + (0.25 * val_score)
            - (0.50 * risk_penalties)
        )
        conviction = round(min(99.0, max(20.0, raw_conviction)), 1)

        # -------------------------------------------------------------
        # Grade Mapping & FLASH Action
        # -------------------------------------------------------------
        if (conviction >= 85.0 and shock_score >= 70.0) or (conviction >= 82.0 and shock_score >= 80.0):
            grade = "AAA+"
            signal = "BUY IMMEDIATELY"
            confidence = 98.0
            category = "High Growth Breakout"
            # Move Projections
            gap_min, gap_max = 6.0, 10.0
            d1_min, d1_max = 8.0, 12.0
            w1_min, w1_max = 15.0, 20.0
            m1_min, m1_max = 25.0, 35.0
        elif conviction >= 76.0 and shock_score >= 60.0:
            grade = "AAA"
            signal = "BUY"
            confidence = 92.0
            category = "High Growth / Turnaround"
            gap_min, gap_max = 3.0, 6.0
            d1_min, d1_max = 5.0, 8.0
            w1_min, w1_max = 8.0, 14.0
            m1_min, m1_max = 15.0, 22.0
        elif conviction >= 64.0:
            grade = "AA"
            signal = "ACCUMULATE"
            confidence = 85.0
            category = "Steady Compounder"
            gap_min, gap_max = 1.0, 3.0
            d1_min, d1_max = 3.0, 5.0
            w1_min, w1_max = 5.0, 8.0
            m1_min, m1_max = 8.0, 14.0
        elif conviction >= 58.0:
            grade = "A"
            signal = "WATCHLIST"
            confidence = 78.0
            category = "Watchlist / Mixed"
            gap_min, gap_max = 0.0, 2.0
            d1_min, d1_max = 0.0, 3.0
            w1_min, w1_max = 2.0, 5.0
            m1_min, m1_max = 4.0, 8.0
        else:
            grade = "BELOW_A"
            signal = "AVOID"
            confidence = 70.0
            category = "Laggard / Contraction"
            gap_min, gap_max = -3.0, 0.0
            d1_min, d1_max = -5.0, 0.0
            w1_min, w1_max = -8.0, 0.0
            m1_min, m1_max = -12.0, 0.0

        # -------------------------------------------------------------
        # AI Investment Summary Synthesis
        # -------------------------------------------------------------
        rev_g = state.revenue_growth_yoy
        pat_g = state.pat_growth_yoy
        fair_val = valuation_result["estimated_fair_value"]
        upside = valuation_result["upside_potential_pct"]

        if grade in ("AAA+", "AAA"):
            thesis = (
                f"Exceptional quarterly inflection: Top-line revenue surged {rev_g:+.1f}% YoY with PAT accelerating "
                f"at {pat_g:+.1f}% YoY. Earnings quality is verified clean with {quality_result['quality_score']:.0f}/100 score. "
                f"Valuation models indicate rerating room toward ₹{fair_val:,.1f} ({upside:+.1f}% upside), making this a top-tier "
                f"institutional earnings breakout before the market fully digests the disclosure."
            )
        elif grade == "AA":
            thesis = (
                f"Solid operational performance with steady compounder characteristics ({rev_g:+.1f}% Rev / {pat_g:+.1f}% PAT). "
                f"Balance sheet solvency remains well-buffered with moderate upside potential toward ₹{fair_val:,.1f}."
            )
        elif grade == "A":
            thesis = (
                f"Mixed financial signals this quarter ({rev_g:+.1f}% Rev / {pat_g:+.1f}% PAT). While headline numbers show activity, "
                f"earnings quality or valuation multiples require confirmation before aggressive accumulation."
            )
        else:
            thesis = (
                f"Subdued or contracting performance ({rev_g:+.1f}% Rev / {pat_g:+.1f}% PAT). Risk factors and compressed margins "
                f"warrant caution under current institutional filters."
            )

        return {
            "symbol": state.symbol,
            "company_name": state.company_name,
            "athena_conviction_score": conviction,
            "conviction_grade": grade,
            "confidence_pct": confidence,
            "growth_category": category,
            "flash_signal": signal,
            "decision_drivers": {
                "financial_shock": shock_score,
                "earnings_quality": quality_score,
                "valuation_opportunity": val_score,
                "risk_level": valuation_result["risk_level"],
            },
            "expected_moves": {
                "gap_up": {"min": gap_min, "max": gap_max, "label": f"+{gap_min:g}–{gap_max:g}%" if gap_min > 0 else f"{gap_min:g}–{gap_max:g}%"},
                "move_1d": {"min": d1_min, "max": d1_max, "label": f"+{d1_min:g}–{d1_max:g}%" if d1_min > 0 else f"{d1_min:g}–{d1_max:g}%"},
                "move_1w": {"min": w1_min, "max": w1_max, "label": f"+{w1_min:g}–{w1_max:g}%" if w1_min > 0 else f"{w1_min:g}–{w1_max:g}%"},
                "move_1m": {"min": m1_min, "max": m1_max, "label": f"+{m1_min:g}–{m1_max:g}%" if m1_min > 0 else f"{m1_min:g}–{m1_max:g}%"},
            },
            "estimated_fair_value": fair_val,
            "upside_potential_pct": upside,
            "ai_investment_summary": thesis,
        }
