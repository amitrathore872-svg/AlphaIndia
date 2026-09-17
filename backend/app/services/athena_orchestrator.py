"""
ATHENA OMEGA v3.0 — Pipeline Orchestrator
Sprint 24
Executes the sub-5-minute 5-Gate pipeline:
1. Filing Ingestion & Timing (0-15s)
2. Local Historical Fusion (<10ms)
3. Gate 1: 200-Pt Business Shock Engine (60-120s)
4. Gate 2: Forensic Earnings Quality Engine (120-180s)
5. Gate 3: Valuation & Solvency Risk Engine (180-240s)
6. Gate 4 & 5: ATHENA Conviction Engine & FLASH Decision Card (240-300s)
7. Persistence & Distribution
"""

import time
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models.athena_models import (
    AthenaOmegaFiling,
    AthenaQuarterlyMetrics,
    AthenaShockAnalysis,
    AthenaQualityAnalysis,
    AthenaValuationRisk,
    AthenaConvictionFlash,
)
from app.models.company import Company
from app.services.athena_history_fusion import AthenaHistoryFusion, AthenaFusedState
from app.services.athena_shock_engine import AthenaShockEngine
from app.services.athena_quality_engine import AthenaQualityEngine
from app.services.athena_valuation_engine import AthenaValuationEngine
from app.services.athena_conviction_engine import AthenaConvictionEngine
from app.services.pead_engine import PEADEngine

logger = logging.getLogger(__name__)


class AthenaOrchestrator:

    @classmethod
    def process_filing(
        cls,
        db: Session,
        symbol: str,
        fresh_q0: Dict[str, Any],
        exchange: str = "NSE",
        filing_type: str = "Financial Results",
        pdf_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        sym = symbol.strip().upper()
        fiscal_period = fresh_q0.get("quarter", "Q1 FY26")

        # 1. Register / Retrieve Filing Record in DB
        filing = db.query(AthenaOmegaFiling).filter(
            AthenaOmegaFiling.symbol == sym,
            AthenaOmegaFiling.fiscal_period == fiscal_period,
        ).first()

        company = db.query(Company).filter(Company.symbol == sym).first()
        company_name = company.company if company else fresh_q0.get("company_name", sym)

        if not filing:
            filing = AthenaOmegaFiling(
                company_id=company.id if company else None,
                symbol=sym,
                company_name=company_name,
                exchange=exchange,
                filing_type=filing_type,
                fiscal_period=fiscal_period,
                pdf_url=pdf_url,
                status="PROCESSING",
                detected_at=datetime.utcnow(),
            )
            db.add(filing)
            db.flush()
        else:
            filing.status = "PROCESSING"
            filing.detected_at = datetime.utcnow()

        # 2. Local Historical Fusion (< 10ms)
        fused_state: AthenaFusedState = AthenaHistoryFusion.fuse(
            db=db,
            symbol=sym,
            fresh_q0=fresh_q0,
            exchange=exchange,
            filing_type=filing_type,
            pdf_url=pdf_url,
        )

        # 3. Gate 1: 200-Point Business Shock Engine
        shock_res = AthenaShockEngine.evaluate_business_shock(fused_state)
        filing.priority = shock_res["priority"]

        # 4. Gate 2: Forensic Earnings Quality Engine
        quality_res = AthenaQualityEngine.evaluate_earnings_quality(fused_state)

        # 5. Gate 3: Valuation & Solvency Risk Engine
        val_res = AthenaValuationEngine.evaluate_valuation_and_risk(
            state=fused_state,
            shock_score=shock_res["normalized_shock_score"],
            quality_score=quality_res["quality_score"],
        )

        # 5.5 Quantitative PEAD Drift Evaluation
        pead_res = PEADEngine.evaluate(
            revenue_growth_yoy=fused_state.revenue_growth_yoy,
            pat_growth_yoy=fused_state.pat_growth_yoy,
            roce=fused_state.roce_baseline,
            opm=fused_state.ebitda_margin_pct_q0,
            current_price=fused_state.current_price,
            dma_50=getattr(fused_state, "dma_50", None),
            debt_to_equity=fused_state.debt_to_equity,
            revenue_growth_qoq=fused_state.revenue_growth_qoq,
            pat_growth_qoq=fused_state.pat_growth_qoq,
            symbol=sym,
            quarter=fiscal_period,
        )

        # 6. Gate 4 & 5: ATHENA Conviction Engine & FLASH Decision
        flash_res = AthenaConvictionEngine.generate_flash_decision(
            state=fused_state,
            shock_result=shock_res,
            quality_result=quality_res,
            valuation_result=val_res,
        )

        # 7. Persistence into Database
        # A. Quarterly Metrics
        metrics = db.query(AthenaQuarterlyMetrics).filter(AthenaQuarterlyMetrics.filing_id == filing.id).first()
        if not metrics:
            metrics = AthenaQuarterlyMetrics(filing_id=filing.id, symbol=sym, fiscal_period=fiscal_period)
            db.add(metrics)

        metrics.revenue = fused_state.revenue_q0
        metrics.revenue_growth_yoy = fused_state.revenue_growth_yoy
        metrics.revenue_growth_qoq = fused_state.revenue_growth_qoq
        metrics.operating_profit = fused_state.operating_profit_q0
        metrics.ebitda_margin_pct = fused_state.ebitda_margin_pct_q0
        metrics.ebitda_margin_change_bps = fused_state.ebitda_margin_change_bps
        metrics.pat = fused_state.pat_q0
        metrics.pat_growth_yoy = fused_state.pat_growth_yoy
        metrics.pat_growth_qoq = fused_state.pat_growth_qoq
        metrics.eps = fused_state.eps_q0
        metrics.eps_growth_yoy = fused_state.eps_growth_yoy
        metrics.other_income = fused_state.other_income_q0
        metrics.total_debt = fused_state.total_debt
        metrics.total_equity = fused_state.total_equity
        metrics.debt_to_equity = fused_state.debt_to_equity
        metrics.operating_cash_flow = fused_state.cfo_latest
        metrics.free_cash_flow = fused_state.fcf_latest
        metrics.debtor_days = fused_state.debtor_days
        metrics.inventory_days = fused_state.inventory_days
        metrics.cash_conversion_cycle = fused_state.cash_conversion_cycle
        metrics.roce = fused_state.roce_baseline
        fresh_q0["pead"] = pead_res
        metrics.granular_metrics_json = fresh_q0

        # B. Shock Analysis
        shock = db.query(AthenaShockAnalysis).filter(AthenaShockAnalysis.filing_id == filing.id).first()
        if not shock:
            shock = AthenaShockAnalysis(filing_id=filing.id, symbol=sym)
            db.add(shock)

        shock.revenue_acceleration_pts = shock_res["categories"]["revenue_acceleration"]["score"]
        shock.ebitda_margin_expansion_pts = shock_res["categories"]["ebitda_margin_expansion"]["score"]
        shock.earnings_power_pat_pts = shock_res["categories"]["earnings_power_pat"]["score"]
        shock.cash_flow_conversion_pts = shock_res["categories"]["cash_flow_conversion"]["score"]
        shock.order_book_visibility_pts = shock_res["categories"]["order_book_visibility"]["score"]
        shock.capital_efficiency_roce_pts = shock_res["categories"]["capital_efficiency_roce"]["score"]
        shock.balance_sheet_deleveraging_pts = shock_res["categories"]["balance_sheet_deleveraging"]["score"]
        shock.working_capital_momentum_pts = shock_res["categories"]["working_capital_momentum"]["score"]
        shock.raw_shock_score_200 = shock_res["raw_shock_score_200"]
        shock.normalized_shock_score = shock_res["normalized_shock_score"]
        shock.shock_tier = shock_res["shock_tier"]
        shock.shock_action = shock_res["shock_action"]
        shock.primary_catalyst_driver = shock_res["primary_catalyst_driver"]
        shock.shock_details_json = shock_res["categories"]

        # C. Quality Analysis
        qual = db.query(AthenaQualityAnalysis).filter(AthenaQualityAnalysis.filing_id == filing.id).first()
        if not qual:
            qual = AthenaQualityAnalysis(filing_id=filing.id, symbol=sym)
            db.add(qual)

        qual.quality_score = quality_res["quality_score"]
        qual.quality_grade = quality_res["quality_grade"]
        qual.operating_vs_other_income_pass = quality_res["operating_vs_other_income_pass"]
        qual.other_income_pct_of_pbt = quality_res["other_income_ratio"]
        qual.cash_backed_earnings_pass = quality_res["cash_backed_earnings_pass"]
        qual.cfo_pat_variance_pct = quality_res["cfo_to_pat_ratio"]
        qual.tax_benefit_anomaly_detected = quality_res["tax_benefit_anomaly_detected"]
        qual.working_capital_stress_flag = quality_res["working_capital_stress_flag"]
        qual.piotroski_f_score = quality_res["piotroski_f_score"]
        qual.forensic_flags_count = quality_res["forensic_flags_count"]
        qual.forensic_details_json = quality_res["forensic_flags"]

        # D. Valuation Risk
        val = db.query(AthenaValuationRisk).filter(AthenaValuationRisk.filing_id == filing.id).first()
        if not val:
            val = AthenaValuationRisk(filing_id=filing.id, symbol=sym)
            db.add(val)

        val.current_price = val_res["current_price"]
        val.ttm_eps_post_result = val_res["ttm_eps"]
        val.post_result_pe = val_res["post_result_pe"]
        val.industry_pe = val_res["industry_pe"]
        val.pe_discount_to_industry_pct = val_res["pe_discount_to_industry_pct"]
        val.peg_ratio = val_res["peg_ratio"]
        val.estimated_fair_value = val_res["estimated_fair_value"]
        val.upside_potential_pct = val_res["upside_potential_pct"]
        val.valuation_score = val_res["valuation_score"]
        val.risk_score = val_res["risk_score"]
        val.risk_level = val_res["risk_level"]
        val.risk_penalties_applied = val_res["risk_penalties_applied"]

        # E. FLASH Conviction
        flash = db.query(AthenaConvictionFlash).filter(AthenaConvictionFlash.filing_id == filing.id).first()
        if not flash:
            flash = AthenaConvictionFlash(filing_id=filing.id, symbol=sym)
            db.add(flash)

        flash.company_name = company_name
        flash.athena_conviction_score = flash_res["athena_conviction_score"]
        flash.conviction_grade = flash_res["conviction_grade"]
        flash.confidence_pct = flash_res["confidence_pct"]
        flash.growth_category = flash_res["growth_category"]
        flash.flash_signal = flash_res["flash_signal"]
        flash.expected_gap_up_min = flash_res["expected_moves"]["gap_up"]["min"]
        flash.expected_gap_up_max = flash_res["expected_moves"]["gap_up"]["max"]
        flash.expected_1d_move_min = flash_res["expected_moves"]["move_1d"]["min"]
        flash.expected_1d_move_max = flash_res["expected_moves"]["move_1d"]["max"]
        flash.expected_1w_move_min = flash_res["expected_moves"]["move_1w"]["min"]
        flash.expected_1w_move_max = flash_res["expected_moves"]["move_1w"]["max"]
        flash.expected_1m_move_min = flash_res["expected_moves"]["move_1m"]["min"]
        flash.expected_1m_move_max = flash_res["expected_moves"]["move_1m"]["max"]
        flash.financial_shock_score = shock_res["normalized_shock_score"]
        flash.earnings_quality_score = quality_res["quality_score"]
        flash.valuation_opportunity_score = val_res["valuation_score"]
        flash.risk_level = val_res["risk_level"]
        flash.ai_investment_summary = flash_res["ai_investment_summary"]
        flash.key_drivers = {
            "primary_catalyst": shock_res["primary_catalyst_driver"],
            "pead": {
                "score": pead_res["pead_score"],
                "tier": pead_res["pead_tier"],
                "tier_label": pead_res["pead_tier_label"],
                "color": pead_res["pead_color"],
                "drift_days": pead_res["drift_days"],
                "operating_leverage": pead_res["operating_leverage_ratio"],
                "is_candidate": pead_res["is_pead_candidate"],
                "is_elite": pead_res["is_elite_pead"],
                "thesis": pead_res["thesis"],
                "pillar_breakdown": pead_res["pillar_breakdown"],
            },
        }
        flash.published_at = datetime.utcnow()

        t1 = time.perf_counter()
        elapsed_sec = round(t1 - t0, 3)

        filing.processing_time_sec = elapsed_sec
        filing.status = "FLASH_PUBLISHED"
        filing.sla_met = elapsed_sec <= 300.0  # < 5 minutes
        filing.published_at = datetime.utcnow()
        db.commit()

        return {
            "filing_id": filing.id,
            "symbol": sym,
            "company_name": company_name,
            "exchange": exchange,
            "fiscal_period": fiscal_period,
            "processing_time_sec": elapsed_sec,
            "sla_met": filing.sla_met,
            "priority": filing.priority,
            "shock_analysis": shock_res,
            "quality_analysis": quality_res,
            "valuation_risk": val_res,
            "flash_decision": flash_res,
            "pead_analysis": pead_res,
            "metrics": {
                "revenue": fused_state.revenue_q0,
                "revenue_growth_yoy": fused_state.revenue_growth_yoy,
                "revenue_growth_qoq": fused_state.revenue_growth_qoq,
                "pat": fused_state.pat_q0,
                "pat_growth_yoy": fused_state.pat_growth_yoy,
                "ebitda_margin_pct": fused_state.ebitda_margin_pct_q0,
                "eps": fused_state.eps_q0,
                "current_price": fused_state.current_price,
            },
        }
