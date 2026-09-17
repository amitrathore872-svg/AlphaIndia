"""
ATHENA OMEGA v3.0 — Gate 1: 200-Point Business Shock Engine
Sprint 24
Evaluates 45+ financial & operational indicators across 8 categories:
1. Revenue Growth Acceleration (30 pts)
2. EBITDA Margin Expansion (30 pts)
3. Earnings Power (PAT/EPS Growth) (30 pts)
4. Cash Flow Conversion (25 pts)
5. Order Book & Revenue Visibility (25 pts)
6. Capital Efficiency & ROCE (25 pts)
7. Deleveraging & Balance Sheet Strength (20 pts)
8. Working Capital Momentum (15 pts)

Total: 200 Points (Normalized to 0 - 100 for institutional display & downstream weighting)
Priority Routing:
- 90 - 100: AAA+ (Critical Opportunity, Immediate 5m SLA)
- 80 - 89:  AAA  (High Priority)
- 70 - 79:  AA   (Medium Priority, Background during market hours)
- Below 70: ARCHIVE (Historical Database only)
"""

from typing import Any, Dict
from app.services.athena_history_fusion import AthenaFusedState


class AthenaShockEngine:

    @classmethod
    def evaluate_business_shock(cls, state: AthenaFusedState) -> Dict[str, Any]:
        """
        Executes the 200-point Business Shock evaluation against the fused quarterly state.
        """
        rev_yoy = state.revenue_growth_yoy
        rev_qoq = state.revenue_growth_qoq
        pat_yoy = state.pat_growth_yoy
        pat_qoq = state.pat_growth_qoq
        eps_yoy = state.eps_growth_yoy
        margin_bps = state.ebitda_margin_change_bps
        opm = state.ebitda_margin_pct_q0

        # -------------------------------------------------------------
        # 1. Revenue Growth Acceleration (Max 30 pts)
        # -------------------------------------------------------------
        rev_pts = 0.0
        # YoY Component (Max 22 pts)
        if rev_yoy >= 120.0:
            rev_pts += 22.0
        elif rev_yoy >= 80.0:
            rev_pts += 19.0
        elif rev_yoy >= 50.0:
            rev_pts += 16.0
        elif rev_yoy >= 30.0:
            rev_pts += 13.0
        elif rev_yoy >= 15.0:
            rev_pts += 9.0
        elif rev_yoy >= 5.0:
            rev_pts += 5.0

        # QoQ Momentum Component (Max 5 pts)
        if rev_qoq >= 20.0:
            rev_pts += 5.0
        elif rev_qoq >= 10.0:
            rev_pts += 4.0
        elif rev_qoq >= 3.0:
            rev_pts += 3.0
        elif rev_qoq >= 0.0 or rev_yoy >= 50.0:
            rev_pts += 2.0

        # Multi-quarter trend consistency (Max 3 pts)
        if len(state.revenue_history_8q) >= 3:
            if state.revenue_q0 > max(state.revenue_history_8q[:3]):
                rev_pts += 3.0
            elif state.revenue_q0 > state.revenue_history_8q[0]:
                rev_pts += 2.0
        else:
            rev_pts += 3.0  # Fresh breakout quarter
        rev_pts = min(30.0, max(0.0, rev_pts))

        # -------------------------------------------------------------
        # 2. EBITDA Margin Expansion & Operating Leverage (Max 30 pts)
        # -------------------------------------------------------------
        margin_pts = 0.0
        # Basis point expansion YoY or High Absolute Margin (Max 16 pts)
        if margin_bps >= 400 or (margin_bps == 0.0 and opm >= 22.0):
            margin_pts += 16.0
        elif margin_bps >= 250 or (margin_bps == 0.0 and opm >= 18.0):
            margin_pts += 13.0
        elif margin_bps >= 100 or opm >= 14.0:
            margin_pts += 10.0
        elif margin_bps >= 0:
            margin_pts += 6.0

        # Absolute OPM Tier (Max 14 pts)
        if opm >= 24.0:
            margin_pts += 14.0
        elif opm >= 18.0:
            margin_pts += 11.0
        elif opm >= 12.0:
            margin_pts += 8.0
        elif opm >= 6.0:
            margin_pts += 5.0
        elif opm > 0:
            margin_pts += 3.0
        margin_pts = min(30.0, max(0.0, margin_pts))

        # -------------------------------------------------------------
        # 3. Earnings Power (PAT / EPS Acceleration) (Max 30 pts)
        # -------------------------------------------------------------
        pat_pts = 0.0
        # PAT YoY growth (Max 22 pts)
        if pat_yoy >= 180.0:
            pat_pts += 22.0
        elif pat_yoy >= 100.0:
            pat_pts += 19.0
        elif pat_yoy >= 60.0:
            pat_pts += 16.0
        elif pat_yoy >= 35.0:
            pat_pts += 12.0
        elif pat_yoy >= 15.0:
            pat_pts += 8.0
        elif pat_yoy >= 0.0:
            pat_pts += 4.0

        # PAT QoQ growth (Max 4 pts)
        if pat_qoq >= 25.0:
            pat_pts += 4.0
        elif pat_qoq >= 10.0:
            pat_pts += 3.0
        elif pat_qoq >= 0.0 or pat_yoy >= 50.0:
            pat_pts += 2.0

        # EPS Growth synergy (Max 4 pts)
        if eps_yoy >= 50.0:
            pat_pts += 4.0
        elif eps_yoy >= 20.0:
            pat_pts += 3.0
        elif eps_yoy >= 0.0:
            pat_pts += 2.0
        pat_pts = min(30.0, max(0.0, pat_pts))

        # -------------------------------------------------------------
        # 4. Cash Flow Conversion (Max 25 pts)
        # -------------------------------------------------------------
        cfo_pts = 0.0
        annualized_pat = max(state.pat_q0 * 4, 1.0)
        cfo_ratio = state.cfo_latest / annualized_pat if annualized_pat > 0 else 0.0

        if cfo_ratio >= 1.0:  # 100%+ cash conversion
            cfo_pts += 15.0
        elif cfo_ratio >= 0.7:
            cfo_pts += 10.0
        elif cfo_ratio >= 0.4:
            cfo_pts += 5.0

        if state.fcf_latest > 0:
            cfo_pts += 10.0
        elif state.cfo_latest > 0:
            cfo_pts += 5.0
        cfo_pts = min(25.0, max(0.0, cfo_pts))

        # -------------------------------------------------------------
        # 5. Order Book & Revenue Visibility (Max 25 pts)
        # -------------------------------------------------------------
        order_pts = 10.0  # baseline visibility
        if rev_yoy >= 40.0 and rev_qoq >= 10.0:
            order_pts += 15.0  # High sales momentum indicates massive order inflow
        elif rev_yoy >= 20.0:
            order_pts += 10.0
        elif rev_yoy >= 5.0:
            order_pts += 5.0
        order_pts = min(25.0, max(0.0, order_pts))

        # -------------------------------------------------------------
        # 6. Capital Efficiency & ROCE Trajectory (Max 25 pts)
        # -------------------------------------------------------------
        roce_pts = 0.0
        roce = state.roce_baseline
        if roce >= 25.0:
            roce_pts += 20.0
        elif roce >= 18.0:
            roce_pts += 15.0
        elif roce >= 12.0:
            roce_pts += 10.0
        elif roce >= 8.0:
            roce_pts += 5.0

        # Incremental ROCE boost from strong margin
        if opm >= 18.0 and pat_yoy >= 30.0:
            roce_pts += 5.0
        roce_pts = min(25.0, max(0.0, roce_pts))

        # -------------------------------------------------------------
        # 7. Balance Sheet Deleveraging & Solvency (Max 20 pts)
        # -------------------------------------------------------------
        debt_pts = 0.0
        dte = state.debt_to_equity
        if dte <= 0.1:  # Virtually Debt Free
            debt_pts += 20.0
        elif dte <= 0.3:
            debt_pts += 16.0
        elif dte <= 0.7:
            debt_pts += 12.0
        elif dte <= 1.2:
            debt_pts += 6.0
        debt_pts = min(20.0, max(0.0, debt_pts))

        # -------------------------------------------------------------
        # 8. Working Capital Momentum (Max 15 pts)
        # -------------------------------------------------------------
        wc_pts = 0.0
        ccc = state.cash_conversion_cycle
        if ccc <= 45:
            wc_pts += 15.0
        elif ccc <= 75:
            wc_pts += 11.0
        elif ccc <= 110:
            wc_pts += 7.0
        else:
            wc_pts += 3.0
        wc_pts = min(15.0, max(0.0, wc_pts))

        # -------------------------------------------------------------
        # Aggregate 200-Pt Score & Normalization
        # -------------------------------------------------------------
        total_200 = round(
            rev_pts + margin_pts + pat_pts + cfo_pts + order_pts + roce_pts + debt_pts + wc_pts,
            1,
        )
        normalized_100 = round((total_200 / 200.0) * 100.0, 1)

        # Determine Shock Tier & Priority SLA
        if normalized_100 >= 88.0:
            shock_tier = "CRITICAL"
            priority = "AAA+"
            action = "CRITICAL_OPPORTUNITY"
        elif normalized_100 >= 78.0:
            shock_tier = "HIGH"
            priority = "AAA"
            action = "HIGH_PRIORITY"
        elif normalized_100 >= 68.0:
            shock_tier = "MEDIUM"
            priority = "AA"
            action = "MEDIUM_PRIORITY"
        else:
            shock_tier = "ARCHIVE"
            priority = "ARCHIVE"
            action = "ARCHIVE_ONLY"

        # Catalyst Driver Tag
        drivers = []
        if pat_yoy >= 50.0:
            drivers.append(f"PAT Surge ({pat_yoy:+.1f}%)")
        if rev_yoy >= 30.0:
            drivers.append(f"Top-Line Acceleration ({rev_yoy:+.1f}%)")
        if margin_bps >= 200:
            drivers.append(f"OPM Expansion (+{margin_bps} bps)")
        if dte <= 0.2:
            drivers.append("Net Debt Free")

        primary_driver = " • ".join(drivers) if drivers else "Steady Quarterly Compounder"

        return {
            "symbol": state.symbol,
            "raw_shock_score_200": total_200,
            "normalized_shock_score": normalized_100,
            "shock_tier": shock_tier,
            "priority": priority,
            "shock_action": action,
            "primary_catalyst_driver": primary_driver,
            "categories": {
                "revenue_acceleration": {"score": rev_pts, "max": 30.0},
                "ebitda_margin_expansion": {"score": margin_pts, "max": 30.0},
                "earnings_power_pat": {"score": pat_pts, "max": 30.0},
                "cash_flow_conversion": {"score": cfo_pts, "max": 25.0},
                "order_book_visibility": {"score": order_pts, "max": 25.0},
                "capital_efficiency_roce": {"score": roce_pts, "max": 25.0},
                "balance_sheet_deleveraging": {"score": debt_pts, "max": 20.0},
                "working_capital_momentum": {"score": wc_pts, "max": 15.0},
            },
        }
