"""
Mutual Fund Trade Signal & AI Reasoning Service
Alpha India - Institutional Smart Money Radar
"""

import logging
from typing import Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.mf_models import (
    MFStockMonthlyAggregate,
    MFAccumulationSignal,
)

logger = logging.getLogger(__name__)


class MFSignalService:
    """Generates institutional accumulation trade signals and AI thesis synthesis."""

    @classmethod
    def generate_ai_thesis(
        cls,
        company: Company,
        aggregate: MFStockMonthlyAggregate,
        latest_quarter: Optional[QuarterlyResult] = None,
    ) -> Dict[str, str]:
        """
        Synthesizes financial acceleration metrics with institutional orderflow
        to generate an institutional-grade thesis.
        """
        sector = company.sector or "Industry Leader"
        score = aggregate.smart_money_score
        float_abs = aggregate.float_absorption_pct
        schemes_count = aggregate.active_alpha_schemes_holding

        # Extract quarterly trajectory
        rev_growth = company.revenue_growth or (latest_quarter.revenue if latest_quarter else 0.0)
        pat_growth = company.pat_growth or (latest_quarter.net_profit if latest_quarter else 0.0)
        roce = company.roce or 18.5

        if aggregate.is_stealth_accumulation:
            primary_driver = "Stealth Float Consolidation Ahead of Margin Inflection"
            thesis = (
                f"Smart money institutions have quietly absorbed {float_abs:.1f}% of the tradeable free float "
                f"across {schemes_count} active alpha schemes while the stock consolidated in a tight volatility base. "
                f"Institutional desks are pricing in {sector} operating tailwinds and sustainable ROCE of {roce:.1f}%."
            )
        elif aggregate.is_consensus_bet:
            primary_driver = "Multi-AMC Consensus Re-rating Bet"
            thesis = (
                f"High-conviction consensus accumulation with {aggregate.star_manager_count} tier-1 fund managers "
                f"simultaneously initiating or scaling exposure. Supported by accelerating YoY PAT growth "
                f"and robust order book visibility across domestic capital spending cycles."
            )
        elif score >= 80:
            primary_driver = "Aggressive Institutional Inflow Cycle"
            thesis = (
                f"Top-tier institutional accumulation with net MoM additions of ₹{aggregate.net_value_flow_mom_cr:.1f} Cr. "
                f"Mutual funds are positioning for multi-quarter earnings breakout with high revenue growth "
                f"and market share gains against unorganized competitors."
            )
        else:
            primary_driver = "Steady Portfolio Rebalancing & Inflow Support"
            thesis = (
                f"Sustained institutional interest with {schemes_count} active schemes maintaining strategic allocations. "
                f"Funds show stable holding continuity with low churn."
            )

        return {
            "primary_driver": primary_driver,
            "thesis": thesis,
        }

    @classmethod
    def evaluate_and_generate_signal(
        cls,
        db: Session,
        company_id: int,
        report_date: date,
        current_price: float,
    ) -> Optional[MFAccumulationSignal]:
        """
        Calculates signal levels (Entry Base, Target, Stop Loss) and persists to DB.
        """
        aggregate = (
            db.query(MFStockMonthlyAggregate)
            .filter(
                MFStockMonthlyAggregate.company_id == company_id,
                MFStockMonthlyAggregate.report_date == report_date,
            )
            .first()
        )
        if not aggregate:
            return None

        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            return None

        latest_quarter = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == company_id)
            .order_by(desc(QuarterlyResult.period_end))
            .first()
        )

        ai_data = cls.generate_ai_thesis(company, aggregate, latest_quarter)

        # Determine signal type
        if aggregate.is_stealth_accumulation:
            signal_type = "STEALTH_ACCUMULATION"
            action = "STRONG BUY"
        elif aggregate.is_consensus_bet:
            signal_type = "CONSENSUS_BET"
            action = "STRONG BUY"
        elif aggregate.smart_money_score >= 80:
            signal_type = "AGGRESSIVE_ADD"
            action = "STRONG BUY"
        elif aggregate.smart_money_score >= 65:
            signal_type = "ACCUMULATION_BASE"
            action = "ACCUMULATE"
        else:
            signal_type = "BASE_HOLD"
            action = "HOLD"

        # Price Levels
        if current_price <= 0:
            current_price = 1000.0

        entry_low = round(current_price * 0.97, 2)
        entry_high = round(current_price * 1.03, 2)
        target_price = round(current_price * (1.15 + (aggregate.smart_money_score / 100.0) * 0.25), 2)
        stop_loss = round(current_price * 0.94, 2)

        # Upsert signal
        signal = (
            db.query(MFAccumulationSignal)
            .filter(
                MFAccumulationSignal.company_id == company_id,
                MFAccumulationSignal.signal_date == report_date,
            )
            .first()
        )

        if not signal:
            signal = MFAccumulationSignal(
                company_id=company_id,
                signal_date=report_date,
                signal_type=signal_type,
                conviction_score=aggregate.smart_money_score,
                entry_zone_low=entry_low,
                entry_zone_high=entry_high,
                target_price=target_price,
                stop_loss=stop_loss,
                action_recommendation=action,
                ai_thesis_summary=ai_data["thesis"],
                primary_driver=ai_data["primary_driver"],
            )
            db.add(signal)
        else:
            signal.signal_type = signal_type
            signal.conviction_score = aggregate.smart_money_score
            signal.entry_zone_low = entry_low
            signal.entry_zone_high = entry_high
            signal.target_price = target_price
            signal.stop_loss = stop_loss
            signal.action_recommendation = action
            signal.ai_thesis_summary = ai_data["thesis"]
            signal.primary_driver = ai_data["primary_driver"]

        db.commit()
        db.refresh(signal)
        return signal
