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
        Executes the Rebalanced 200-Point Business Shock evaluation (75% Earnings Shock, 25% Growth Quality).
        - Part A: Pure Earnings Shock (150 pts / 75%)
          1. Profit Velocity & Inflection (PAT/EPS Acceleration) (Max 60 pts)
          2. Top-Line Sales Shock & Demand Surge (Max 50 pts)
          3. Operating Leverage & Margin Expansion (Max 40 pts)
        - Part B: Growth Quality & Execution Validation (50 pts / 25%)
          4. Cash Flow Conversion (Max 15 pts)
          5. Capital Efficiency & ROCE Trajectory (Max 12 pts)
          6. Balance Sheet Deleveraging & Solvency (Max 12 pts)
          7. Order Book & Revenue Visibility (Max 6 pts)
          8. Working Capital Momentum (Max 5 pts)
        Total: 200 Points -> Normalized to 0 - 100 for institutional display.
        """
        rev_yoy = state.revenue_growth_yoy
        rev_qoq = state.revenue_growth_qoq
        pat_yoy = state.pat_growth_yoy
        pat_qoq = state.pat_growth_qoq
        eps_yoy = state.eps_growth_yoy
        margin_bps = state.ebitda_margin_change_bps
        opm = state.ebitda_margin_pct_q0

        # =============================================================
        # PART A: PURE EARNINGS SHOCK & ACCELERATION (150 Points / 75%)
        # =============================================================

        # -------------------------------------------------------------
        # 1. Profit Velocity & Inflection (PAT / EPS Acceleration) (Max 60 pts)
        # -------------------------------------------------------------
        pat_pts = 0.0
        # YoY Component (Max 38 pts)
        if pat_yoy >= 150.0:
            pat_pts += 38.0
        elif pat_yoy >= 100.0:
            pat_pts += 32.0
        elif pat_yoy >= 60.0:
            pat_pts += 26.0
        elif pat_yoy >= 35.0:
            pat_pts += 18.0
        elif pat_yoy >= 20.0:
            pat_pts += 10.0
        elif pat_yoy >= 5.0:
            pat_pts += 4.0

        # QoQ Momentum Component (Max 14 pts)
        if pat_qoq >= 25.0:
            pat_pts += 14.0
        elif pat_qoq >= 12.0:
            pat_pts += 9.0
        elif pat_qoq >= 4.0:
            pat_pts += 4.0

        # Multi-Quarter Profit ATH / Inflection Breakout (Max 8 pts)
        if len(state.pat_history_8q) >= 2 and state.pat_q0 > max(state.pat_history_8q[:2]):
            pat_pts += 8.0
        elif pat_qoq >= 0.0 and pat_yoy >= 15.0:
            pat_pts += 4.0
        pat_pts = min(60.0, max(0.0, pat_pts))

        # -------------------------------------------------------------
        # 2. Top-Line Sales Shock & Demand Surge (Max 50 pts)
        # -------------------------------------------------------------
        rev_pts = 0.0
        # YoY Component (Max 30 pts)
        if rev_yoy >= 80.0:
            rev_pts += 30.0
        elif rev_yoy >= 50.0:
            rev_pts += 24.0
        elif rev_yoy >= 30.0:
            rev_pts += 18.0
        elif rev_yoy >= 18.0:
            rev_pts += 12.0
        elif rev_yoy >= 8.0:
            rev_pts += 6.0

        # QoQ Momentum Component (Max 12 pts)
        if rev_qoq >= 15.0:
            rev_pts += 12.0
        elif rev_qoq >= 8.0:
            rev_pts += 8.0
        elif rev_qoq >= 3.0:
            rev_pts += 4.0

        # Multi-quarter trend breakout (Max 8 pts)
        if len(state.revenue_history_8q) >= 3 and state.revenue_q0 > max(state.revenue_history_8q[:3]):
            rev_pts += 8.0
        elif rev_qoq >= 0.0 or rev_yoy >= 20.0:
            rev_pts += 4.0
        rev_pts = min(50.0, max(0.0, rev_pts))

        # -------------------------------------------------------------
        # 3. Operating Leverage & EBITDA Margin Expansion (Max 40 pts)
        # -------------------------------------------------------------
        margin_pts = 0.0
        # Basis point expansion YoY (Max 25 pts)
        if margin_bps >= 500:
            margin_pts += 25.0
        elif margin_bps >= 300:
            margin_pts += 20.0
        elif margin_bps >= 150:
            margin_pts += 14.0
        elif margin_bps >= 50:
            margin_pts += 8.0

        # Absolute OPM Leverage Tier (Max 15 pts)
        if opm >= 22.0 and pat_yoy >= 15.0:
            margin_pts += 15.0
        elif opm >= 22.0:
            margin_pts += 10.0
        elif opm >= 14.0:
            margin_pts += 8.0
        elif opm >= 8.0:
            margin_pts += 4.0
        margin_pts = min(40.0, max(0.0, margin_pts))

        # =============================================================
        # PART B: GROWTH QUALITY & EXECUTION VALIDATION (50 Points / 25%)
        # =============================================================

        # -------------------------------------------------------------
        # 4. Cash Flow Conversion (Max 15 pts)
        # -------------------------------------------------------------
        cfo_pts = 0.0
        annualized_pat = max(state.pat_q0 * 4, 1.0)
        cfo_ratio = state.cfo_latest / annualized_pat if annualized_pat > 0 else 0.0

        if cfo_ratio >= 0.8:  # 80%+ cash conversion
            cfo_pts += 10.0
        elif cfo_ratio >= 0.5:
            cfo_pts += 6.0

        if state.fcf_latest > 0:
            cfo_pts += 5.0
        elif state.cfo_latest > 0:
            cfo_pts += 2.0
        cfo_pts = min(15.0, max(0.0, cfo_pts))

        # -------------------------------------------------------------
        # 5. Capital Efficiency & ROCE Trajectory (Max 12 pts)
        # -------------------------------------------------------------
        roce_pts = 0.0
        roce = state.roce_baseline
        if roce >= 25.0:
            roce_pts += 12.0
        elif roce >= 18.0:
            roce_pts += 9.0
        elif roce >= 12.0:
            roce_pts += 6.0
        else:
            roce_pts += 2.0
        roce_pts = min(12.0, max(0.0, roce_pts))

        # -------------------------------------------------------------
        # 6. Balance Sheet Deleveraging & Solvency (Max 12 pts)
        # -------------------------------------------------------------
        debt_pts = 0.0
        dte = state.debt_to_equity
        if dte <= 0.2:  # Clean Balance Sheet to fund growth
            debt_pts += 12.0
        elif dte <= 0.5:
            debt_pts += 8.0
        elif dte <= 1.0:
            debt_pts += 4.0
        debt_pts = min(12.0, max(0.0, debt_pts))

        # -------------------------------------------------------------
        # 7. Order Book & Revenue Visibility (Max 6 pts)
        # -------------------------------------------------------------
        order_pts = 1.0
        if rev_yoy >= 30.0 and rev_qoq >= 5.0:
            order_pts += 5.0
        elif rev_yoy >= 15.0:
            order_pts += 2.0
        order_pts = min(6.0, max(0.0, order_pts))

        # -------------------------------------------------------------
        # 8. Working Capital Momentum (Max 5 pts)
        # -------------------------------------------------------------
        wc_pts = 1.0
        ccc = state.cash_conversion_cycle
        if ccc <= 60:
            wc_pts += 4.0
        elif ccc <= 90:
            wc_pts += 2.0
        wc_pts = min(5.0, max(0.0, wc_pts))

        # -------------------------------------------------------------
        # Aggregate 200-Pt Score & Normalization
        # -------------------------------------------------------------
        total_200 = round(
            pat_pts + rev_pts + margin_pts + cfo_pts + roce_pts + debt_pts + order_pts + wc_pts,
            1,
        )
        normalized_100 = round((total_200 / 200.0) * 100.0, 1)

        # Determine Shock Tier & Priority SLA
        if normalized_100 >= 80.0:
            shock_tier = "CRITICAL"
            priority = "AAA+"
            action = "CRITICAL_OPPORTUNITY"
        elif normalized_100 >= 68.0:
            shock_tier = "HIGH"
            priority = "AAA"
            action = "HIGH_PRIORITY"
        elif normalized_100 >= 52.0:
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
        if pat_qoq >= 20.0:
            drivers.append(f"QoQ Inflection (+{pat_qoq:+.1f}%)")

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
                "earnings_power_pat": {"score": pat_pts, "max": 60.0},
                "revenue_acceleration": {"score": rev_pts, "max": 50.0},
                "ebitda_margin_expansion": {"score": margin_pts, "max": 40.0},
                "cash_flow_conversion": {"score": cfo_pts, "max": 15.0},
                "capital_efficiency_roce": {"score": roce_pts, "max": 12.0},
                "balance_sheet_deleveraging": {"score": debt_pts, "max": 12.0},
                "order_book_visibility": {"score": order_pts, "max": 6.0},
                "working_capital_momentum": {"score": wc_pts, "max": 5.0},
            },
        }
