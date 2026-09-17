"""
ATHENA OMEGA v3.0 — Gate 3: Valuation & Solvency Risk Engine
Sprint 24
Answers: "Even if results are excellent, is this stock still worth buying?"
Valuation Intelligence:
- Updates TTM EPS with fresh Q0 numbers
- PE vs Industry (Discount / Premium post-results)
- PEG Ratio (Growth-adjusted valuation)
- Multi-Stage Fair Value calculation (GARP + Cash Multiples)
Risk Intelligence:
- Debt burden risk penalty (Debt-to-Equity > 1.0)
- Hyper-valuation risk penalty (PE > 3x Industry PE)
- Cash-drag risk penalty (Negative CFO)

Outputs:
- Valuation Score (0 - 100)
- Risk Score (0 - 100, lower is safer)
- Estimated Fair Value (₹)
- Upside Potential (%)
- Risk Level (LOW, MODERATE, HIGH, EXTREME)
"""

from typing import Any, Dict
from app.services.athena_history_fusion import AthenaFusedState


class AthenaValuationEngine:

    @classmethod
    def evaluate_valuation_and_risk(
        cls,
        state: AthenaFusedState,
        shock_score: float,
        quality_score: float,
    ) -> Dict[str, Any]:
        """
        Computes Fair Value, Upside %, Valuation Score (0-100), and Solvency Risk penalty.
        """
        cmp = max(state.current_price, 1.0)
        eps_q0 = state.eps_q0

        # 1. Update Trailing 12-Month EPS (TTM)
        # Fresh Q0 EPS + prior 3 quarters if available, else annualized Q0
        if len(state.pat_history_8q) >= 3 and state.eps_q_minus_1 and state.eps_q_minus_4:
            # Conservative estimate using available EPS history
            ttm_eps = max(0.1, eps_q0 + (state.eps_q_minus_1 or eps_q0) * 3)
        else:
            ttm_eps = max(0.1, eps_q0 * 4)

        # 2. Post-Result P/E Multiple
        post_result_pe = round(cmp / ttm_eps, 2)
        ind_pe = max(state.industry_pe, 12.0)
        pe_discount = round(((ind_pe - post_result_pe) / ind_pe) * 100, 1)

        # 3. PEG Ratio
        profit_growth_rate = max(state.pat_growth_yoy, 5.0)
        peg = round(post_result_pe / profit_growth_rate, 2)

        # 4. Solvency & Market Risk Engine (0 - 100, Lower is safer)
        risk_score = 15.0  # baseline safe
        risk_penalties = 0.0

        # Debt Risk Penalty
        if state.debt_to_equity > 1.5:
            risk_score += 35.0
            risk_penalties += 15.0
        elif state.debt_to_equity > 0.8:
            risk_score += 18.0
            risk_penalties += 8.0

        # Multiple Overstretch Risk Penalty
        if post_result_pe > 80.0:
            risk_score += 30.0
            risk_penalties += 14.0
        elif post_result_pe > (ind_pe * 2.0):
            risk_score += 15.0
            risk_penalties += 7.0

        # Weak Cash Flow Penalty
        if state.cfo_latest <= 0:
            risk_score += 20.0
            risk_penalties += 10.0

        risk_score = min(100.0, max(5.0, round(risk_score, 1)))

        if risk_score <= 30.0:
            risk_level = "LOW"
        elif risk_score <= 55.0:
            risk_level = "MODERATE"
        elif risk_score <= 75.0:
            risk_level = "HIGH"
        else:
            risk_level = "EXTREME"

        # 5. Fair Value Model (GARP Rerating)
        # Quality-adjusted target PE multiple
        quality_multiplier = (quality_score / 100.0)  # 0.7 to 1.0
        growth_multiplier = min(1.5, max(0.8, 1.0 + (state.pat_growth_yoy / 200.0)))

        # Target PE based on Industry Benchmark + Growth Accretion
        target_pe = ind_pe * quality_multiplier * growth_multiplier
        # Ensure sensible bounds on target PE
        target_pe = min(max(target_pe, 15.0), 65.0)

        fair_value = round(ttm_eps * target_pe, 2)
        # Prevent irrational fair value extremes
        fair_value = max(cmp * 0.5, min(cmp * 2.5, fair_value))

        upside_pct = round(((fair_value - cmp) / cmp) * 100, 1)

        # 6. Valuation Score (0 - 100)
        # High score means attractive valuation with massive upside & low PEG
        val_score = 50.0
        if upside_pct >= 40.0:
            val_score += 25.0
        elif upside_pct >= 20.0:
            val_score += 15.0
        elif upside_pct >= 5.0:
            val_score += 5.0
        elif upside_pct < -10.0:
            val_score -= 20.0

        if peg <= 1.0:
            val_score += 15.0
        elif peg <= 1.8:
            val_score += 8.0
        elif peg > 3.0:
            val_score -= 12.0

        if pe_discount > 15.0:
            val_score += 10.0
        elif pe_discount < -30.0:
            val_score -= 10.0

        val_score = min(100.0, max(15.0, round(val_score, 1)))

        return {
            "symbol": state.symbol,
            "current_price": cmp,
            "ttm_eps": ttm_eps,
            "post_result_pe": post_result_pe,
            "industry_pe": ind_pe,
            "pe_discount_to_industry_pct": pe_discount,
            "peg_ratio": peg,
            "estimated_fair_value": fair_value,
            "upside_potential_pct": upside_pct,
            "valuation_score": val_score,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_penalties_applied": risk_penalties,
        }
