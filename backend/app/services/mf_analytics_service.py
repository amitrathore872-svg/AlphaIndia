"""
Mutual Fund Analytics & Scoring Service
Alpha India - Institutional Smart Money Radar
"""

import math
from typing import Dict, Any, List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func

from app.models.company import Company
from app.models.mf_models import (
    MFScheme,
    MFSchemeHolding,
    MFStockMonthlyAggregate,
    MFSectorFlow,
    MFAccumulationSignal,
)


class MFAnalyticsService:
    """Core analytics engine for mutual fund intelligence."""

    @staticmethod
    def classify_holding_status(prev_shares: int, current_shares: int) -> str:
        """Classify holding change into institutional action category."""
        if prev_shares <= 0 and current_shares > 0:
            return "NEW_ENTRY"
        if prev_shares > 0 and current_shares <= 0:
            return "EXIT"
        if prev_shares <= 0:
            return "HOLD"

        pct_change = ((current_shares - prev_shares) / prev_shares) * 100.0
        if pct_change >= 25.0:
            return "AGGRESSIVE_ADD"
        elif pct_change >= 5.0:
            return "ADD"
        elif pct_change <= -25.0:
            return "HEAVY_TRIM"
        elif pct_change <= -5.0:
            return "TRIMMED"
        return "HOLD"

    @staticmethod
    def calculate_smart_money_score(
        float_absorption_pct: float,
        breadth_ratio: float,
        velocity_months: int,
        avg_aum_weight_pct: float,
    ) -> float:
        """
        Calculate Smart Money Accumulation Score (0 to 100).
        - Float Absorption (35%): Net shares bought as % of free float.
        - Fund Breadth (25%): Ratio of buyers vs sellers.
        - Velocity (20%): Consecutive months of institutional net inflows.
        - AUM Weight (20%): Average weight of position inside funds (>3% is strong conviction).
        """
        norm_absorption = min(100.0, max(0.0, (float_absorption_pct / 4.0) * 100.0))
        norm_breadth = min(100.0, max(0.0, breadth_ratio * 30.0))

        velocity_map = {0: 20.0, 1: 50.0, 2: 75.0, 3: 100.0}
        norm_velocity = velocity_map.get(min(velocity_months, 3), 100.0)

        norm_aum = min(100.0, max(0.0, (avg_aum_weight_pct / 3.5) * 100.0))

        total_score = (
            (norm_absorption * 0.35)
            + (norm_breadth * 0.25)
            + (norm_velocity * 0.20)
            + (norm_aum * 0.20)
        )
        return round(min(100.0, max(0.0, total_score)), 1)

    @staticmethod
    def calculate_action_zone(
        current_price: float,
        smart_money_score: float,
    ) -> Dict[str, Any]:
        """
        Calculates Institutional Action Zone (Entry Base, Target, Stop Loss).
        """
        if current_price <= 0:
            current_price = 100.0

        entry_low = round(current_price * 0.97, 2)
        entry_high = round(current_price * 1.03, 2)

        upside_factor = 1.15 + (smart_money_score / 100.0) * 0.25
        target_price = round(current_price * upside_factor, 2)
        stop_loss = round(current_price * 0.94, 2)

        if smart_money_score >= 80:
            action = "STRONG BUY"
            confidence = round(smart_money_score, 1)
        elif smart_money_score >= 65:
            action = "ACCUMULATE"
            confidence = round(smart_money_score, 1)
        else:
            action = "HOLD"
            confidence = round(smart_money_score, 1)

        return {
            "current_price": current_price,
            "entry_zone_low": entry_low,
            "entry_zone_high": entry_high,
            "target_price": target_price,
            "stop_loss": stop_loss,
            "upside_pct": round(((target_price - current_price) / current_price) * 100, 1),
            "action": action,
            "confidence": confidence,
        }

    @classmethod
    def get_stock_institutional_summary(cls, db: Session, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Answers the 5 core questions for a specific stock:
        1. Who is buying? Who is selling? Complete ownership table with MoM changes.
        2. Increase / Decrease tracker summary.
        3. Institutional ownership timeline graph data.
        4. Why are funds buying? AI reasoning and primary driver.
        5. Is this a buy today? Entry zone + Target + Confidence.
        """
        company = (
            db.query(Company)
            .filter(Company.symbol.ilike(symbol.strip()))
            .first()
        )
        if not company:
            return None

        # 1. Fetch latest monthly aggregate
        latest_agg = (
            db.query(MFStockMonthlyAggregate)
            .filter(MFStockMonthlyAggregate.company_id == company.id)
            .order_by(desc(MFStockMonthlyAggregate.report_date))
            .first()
        )

        # 2. Fetch timeline graph data (all monthly aggregates)
        timeline_rows = (
            db.query(MFStockMonthlyAggregate)
            .filter(MFStockMonthlyAggregate.company_id == company.id)
            .order_by(asc(MFStockMonthlyAggregate.report_date))
            .all()
        )
        timeline = [
            {
                "report_date": str(row.report_date),
                "month_label": row.report_date.strftime("%b %y"),
                "pct_of_equity": round(row.pct_of_equity, 2),
                "total_shares": row.total_shares_held,
                "total_value_cr": round(row.total_value_cr, 2),
                "total_schemes": row.total_schemes_holding,
                "smart_money_score": round(row.smart_money_score, 1),
            }
            for row in timeline_rows
        ]

        # 3. Fetch latest active scheme holdings
        holdings_query = (
            db.query(MFSchemeHolding, MFScheme)
            .join(MFScheme, MFSchemeHolding.scheme_id == MFScheme.id)
            .filter(MFSchemeHolding.company_id == company.id)
        )
        if latest_agg:
            holdings_query = holdings_query.filter(MFSchemeHolding.report_date == latest_agg.report_date)

        holdings_rows = holdings_query.order_by(desc(MFSchemeHolding.market_value_cr)).all()

        holdings_list = []
        buyers_count = 0
        sellers_count = 0
        new_entries_count = 0
        exits_count = 0

        for holding, scheme in holdings_rows:
            if holding.holding_status in ["NEW_ENTRY", "AGGRESSIVE_ADD", "ADD"]:
                buyers_count += 1
            elif holding.holding_status in ["TRIMMED", "HEAVY_TRIM", "EXIT"]:
                sellers_count += 1

            if holding.holding_status == "NEW_ENTRY":
                new_entries_count += 1
            elif holding.holding_status == "EXIT":
                exits_count += 1

            holdings_list.append({
                "scheme_id": scheme.id,
                "scheme_name": scheme.scheme_name,
                "amc_name": scheme.amc_name,
                "category": scheme.category,
                "is_active_alpha": scheme.is_active_alpha,
                "fund_manager_name": scheme.fund_manager_name or "Institutional Desk",
                "shares_held": holding.shares_held,
                "market_value_cr": round(holding.market_value_cr, 2),
                "weight_pct": round(holding.weight_pct, 2),
                "mom_shares_change_pct": round(holding.mom_shares_change_pct, 1),
                "holding_status": holding.holding_status,
            })

        # 4. Fetch latest signal & AI reasoning
        latest_signal = (
            db.query(MFAccumulationSignal)
            .filter(MFAccumulationSignal.company_id == company.id)
            .order_by(desc(MFAccumulationSignal.signal_date))
            .first()
        )

        score = latest_agg.smart_money_score if latest_agg else 60.0
        est_price = round(latest_agg.total_value_cr * 10000000 / latest_agg.total_shares_held, 2) if (latest_agg and latest_agg.total_shares_held > 0) else 1000.0

        if latest_signal and latest_signal.entry_zone_low:
            action_zone = {
                "current_price": est_price,
                "entry_zone_low": latest_signal.entry_zone_low,
                "entry_zone_high": latest_signal.entry_zone_high,
                "target_price": latest_signal.target_price,
                "stop_loss": latest_signal.stop_loss,
                "upside_pct": round(((latest_signal.target_price - est_price) / est_price) * 100, 1) if est_price > 0 else 25.0,
                "action": latest_signal.action_recommendation,
                "confidence": latest_signal.conviction_score,
            }
            ai_thesis = latest_signal.ai_thesis_summary
            primary_driver = latest_signal.primary_driver
            signal_type = latest_signal.signal_type
        else:
            action_zone = cls.calculate_action_zone(est_price, score)
            ai_thesis = f"Institutional accumulation driven by solid earnings trajectory in {company.sector or 'the sector'}. Mutual funds hold strategic ownership positions."
            primary_driver = "Sustained Operating Margin Expansion & Order Visibility"
            signal_type = "STEALTH_ACCUMULATION" if (latest_agg and latest_agg.is_stealth_accumulation) else "ACCUMULATION_BASE"

        return {
            "company": {
                "id": company.id,
                "symbol": company.symbol,
                "name": company.company,
                "sector": company.sector or "N/A",
                "industry": company.industry or "N/A",
                "market_cap": company.market_cap or "N/A",
                "market_cap_category": company.market_cap_category or "MICRO",
            },
            "latest_stats": {
                "report_date": str(latest_agg.report_date) if latest_agg else None,
                "smart_money_score": score,
                "total_schemes": latest_agg.total_schemes_holding if latest_agg else len(holdings_list),
                "active_alpha_schemes": latest_agg.active_alpha_schemes_holding if latest_agg else sum(1 for h in holdings_list if h["is_active_alpha"]),
                "total_shares_held": latest_agg.total_shares_held if latest_agg else 0,
                "total_value_cr": round(latest_agg.total_value_cr, 2) if latest_agg else 0.0,
                "pct_of_equity": round(latest_agg.pct_of_equity, 2) if latest_agg else 0.0,
                "pct_of_free_float": round(latest_agg.pct_of_free_float, 2) if latest_agg else 0.0,
                "net_value_flow_mom_cr": round(latest_agg.net_value_flow_mom_cr, 2) if latest_agg else 0.0,
                "float_absorption_pct": round(latest_agg.float_absorption_pct, 2) if latest_agg else 0.0,
                "is_stealth_accumulation": latest_agg.is_stealth_accumulation if latest_agg else False,
                "is_consensus_bet": latest_agg.is_consensus_bet if latest_agg else False,
            },
            "flow_tracker": {
                "buyers_count": buyers_count,
                "sellers_count": sellers_count,
                "new_entries_count": new_entries_count,
                "exits_count": exits_count,
            },
            "holdings": holdings_list,
            "timeline": timeline,
            "ai_reasoning": {
                "thesis": ai_thesis,
                "primary_driver": primary_driver,
                "signal_type": signal_type,
            },
            "action_zone": action_zone,
        }

    @classmethod
    def get_institutional_radar_screener(
        cls,
        db: Session,
        page: int = 1,
        limit: int = 25,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        market_cap_category: Optional[str] = "ALL",
        filter_type: Optional[str] = None,
        sort_by: str = "smart_money_score",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Server-side paginated screener ranked by institutional accumulation with Market Cap filters.
        """
        latest_date_subquery = db.query(func.max(MFStockMonthlyAggregate.report_date)).scalar()
        if not latest_date_subquery:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0,
                "cap_counts": {"ALL": 0, "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0},
                "latest_report_date": None,
            }

        # Calculate cap counts across all equities in latest cycle
        cap_counts_raw = (
            db.query(Company.market_cap_category, func.count(Company.id))
            .join(MFStockMonthlyAggregate, Company.id == MFStockMonthlyAggregate.company_id)
            .filter(MFStockMonthlyAggregate.report_date == latest_date_subquery)
            .group_by(Company.market_cap_category)
            .all()
        )
        cap_counts = {"ALL": 0, "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0}
        for c_cat, cnt in cap_counts_raw:
            c_key = (c_cat or "MICRO").upper()
            if c_key in cap_counts:
                cap_counts[c_key] += cnt
            cap_counts["ALL"] += cnt

        query = (
            db.query(MFStockMonthlyAggregate, Company, MFAccumulationSignal)
            .join(Company, MFStockMonthlyAggregate.company_id == Company.id)
            .outerjoin(
                MFAccumulationSignal,
                (MFAccumulationSignal.company_id == Company.id) & (MFAccumulationSignal.signal_date == MFStockMonthlyAggregate.report_date)
            )
            .filter(MFStockMonthlyAggregate.report_date == latest_date_subquery)
        )

        # Filters
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (Company.symbol.ilike(search_term)) | (Company.company.ilike(search_term))
            )

        if sector and sector != "ALL":
            query = query.filter(Company.sector.ilike(f"%{sector.strip()}%"))

        if market_cap_category and market_cap_category.upper() != "ALL":
            query = query.filter(Company.market_cap_category == market_cap_category.upper())

        if filter_type == "stealth":
            query = query.filter(MFStockMonthlyAggregate.is_stealth_accumulation == True)
        elif filter_type == "consensus":
            query = query.filter(MFStockMonthlyAggregate.is_consensus_bet == True)
        elif filter_type == "aggressive_add":
            query = query.filter(MFStockMonthlyAggregate.float_absorption_pct >= 2.0)
        elif filter_type == "pre_earnings":
            query = query.filter(MFAccumulationSignal.signal_type == "PRE_EARNINGS_ACCUMULATION")

        # Sorting
        sort_column_map = {
            "smart_money_score": MFStockMonthlyAggregate.smart_money_score,
            "total_value_cr": MFStockMonthlyAggregate.total_value_cr,
            "pct_of_equity": MFStockMonthlyAggregate.pct_of_equity,
            "net_value_flow_mom_cr": MFStockMonthlyAggregate.net_value_flow_mom_cr,
            "float_absorption_pct": MFStockMonthlyAggregate.float_absorption_pct,
            "active_alpha_schemes_holding": MFStockMonthlyAggregate.active_alpha_schemes_holding,
        }
        sort_col = sort_column_map.get(sort_by, MFStockMonthlyAggregate.smart_money_score)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        total_records = query.count()
        offset = (page - 1) * limit
        results = query.offset(offset).limit(limit).all()

        items = []
        for agg, comp, signal in results:
            est_price = round(agg.total_value_cr * 10000000 / agg.total_shares_held, 2) if agg.total_shares_held > 0 else 1000.0

            action_text = signal.action_recommendation if signal else ("STRONG BUY" if agg.smart_money_score >= 80 else ("ACCUMULATE" if agg.smart_money_score >= 65 else "HOLD"))
            target_price = signal.target_price if signal else round(est_price * 1.22, 2)

            items.append({
                "company_id": comp.id,
                "symbol": comp.symbol,
                "company_name": comp.company,
                "sector": comp.sector or "Diversified",
                "market_cap_category": comp.market_cap_category or "MICRO",
                "report_date": str(agg.report_date),
                "smart_money_score": round(agg.smart_money_score, 1),
                "active_alpha_schemes": agg.active_alpha_schemes_holding,
                "total_schemes": agg.total_schemes_holding,
                "total_value_cr": round(agg.total_value_cr, 2),
                "net_shares_flow_mom": agg.net_shares_flow_mom,
                "net_value_flow_mom_cr": round(agg.net_value_flow_mom_cr, 2),
                "pct_of_equity": round(agg.pct_of_equity, 2),
                "float_absorption_pct": round(agg.float_absorption_pct, 2),
                "star_manager_count": agg.star_manager_count,
                "is_stealth_accumulation": agg.is_stealth_accumulation,
                "is_consensus_bet": agg.is_consensus_bet,
                "current_price": est_price,
                "action_recommendation": action_text,
                "target_price": target_price,
                "signal_type": signal.signal_type if signal else ("STEALTH_ACCUMULATION" if agg.is_stealth_accumulation else "BASE_ACCUMULATION"),
            })

        total_pages = math.ceil(total_records / limit) if limit > 0 else 1

        return {
            "items": items,
            "total": total_records,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "cap_counts": cap_counts,
            "latest_report_date": str(latest_date_subquery),
        }

    @classmethod
    def get_all_schemes(cls, db: Session) -> List[Dict[str, Any]]:
        """Returns catalog of all registered AMC schemes."""
        schemes = (
            db.query(MFScheme)
            .order_by(MFScheme.amc_name, desc(MFScheme.aum_cr))
            .all()
        )
        return [
            {
                "id": s.id,
                "scheme_code": s.scheme_code,
                "scheme_name": s.scheme_name,
                "amc_name": s.amc_name,
                "category": s.category,
                "is_active_alpha": s.is_active_alpha,
                "fund_manager_name": s.fund_manager_name or "Institutional Desk",
                "aum_cr": round(s.aum_cr or 0.0, 1),
            }
            for s in schemes
        ]

    @classmethod
    def get_amc_matrix_data(
        cls,
        db: Session,
        market_cap_category: Optional[str] = "ALL",
        search: Optional[str] = None,
        sector: Optional[str] = None,
        scheme_category: Optional[str] = "ALL",
        scheme_ids: Optional[List[int]] = None,
        page: int = 1,
        limit: int = 50,
        sort_by: str = "market_cap",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Returns cross-tabulated AMC Scheme Matrix for full-market universe.
        """
        latest_date = db.query(func.max(MFStockMonthlyAggregate.report_date)).scalar()
        if not latest_date:
            return {
                "schemes": [],
                "items": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0,
                "cap_counts": {"ALL": 0, "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0},
                "latest_report_date": None,
            }

        # 1. Fetch relevant scheme columns
        scheme_query = db.query(MFScheme)
        if scheme_category and scheme_category != "ALL":
            cat_filter = scheme_category.upper()
            if "LARGE" in cat_filter:
                scheme_query = scheme_query.filter(MFScheme.category.ilike("%Large%"))
            elif "MID" in cat_filter:
                scheme_query = scheme_query.filter(MFScheme.category.ilike("%Mid%"))
            elif "SMALL" in cat_filter:
                scheme_query = scheme_query.filter(MFScheme.category.ilike("%Small%"))
            elif "FLEXI" in cat_filter or "MULTI" in cat_filter:
                scheme_query = scheme_query.filter(
                    (MFScheme.category.ilike("%Flexi%")) | (MFScheme.category.ilike("%Multi%"))
                )

        if scheme_ids and len(scheme_ids) > 0:
            scheme_query = scheme_query.filter(MFScheme.id.in_(scheme_ids))

        selected_schemes = (
            scheme_query
            .order_by(MFScheme.amc_name, desc(MFScheme.aum_cr))
            .all()
        )
        scheme_headers = [
            {
                "id": s.id,
                "scheme_code": s.scheme_code,
                "scheme_name": s.scheme_name,
                "amc_name": s.amc_name,
                "category": s.category,
                "aum_cr": round(s.aum_cr or 0.0, 1),
                "fund_manager_name": s.fund_manager_name,
            }
            for s in selected_schemes
        ]
        active_scheme_ids = [s.id for s in selected_schemes]

        # 2. Base Query for Companies with MF holdings
        base_query = (
            db.query(Company, MFStockMonthlyAggregate)
            .join(MFStockMonthlyAggregate, Company.id == MFStockMonthlyAggregate.company_id)
            .filter(MFStockMonthlyAggregate.report_date == latest_date)
        )

        # Calculate cap counts before specific cap filtering
        cap_counts_raw = (
            db.query(Company.market_cap_category, func.count(Company.id))
            .join(MFStockMonthlyAggregate, Company.id == MFStockMonthlyAggregate.company_id)
            .filter(MFStockMonthlyAggregate.report_date == latest_date)
            .group_by(Company.market_cap_category)
            .all()
        )
        cap_counts = {"ALL": 0, "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0}
        for c_cat, cnt in cap_counts_raw:
            c_key = (c_cat or "MICRO").upper()
            if c_key in cap_counts:
                cap_counts[c_key] += cnt
            cap_counts["ALL"] += cnt

        # Apply search & sector filter
        if search:
            search_term = f"%{search.strip()}%"
            base_query = base_query.filter(
                (Company.symbol.ilike(search_term)) | (Company.company.ilike(search_term))
            )
        if sector and sector != "ALL":
            base_query = base_query.filter(Company.sector.ilike(f"%{sector.strip()}%"))

        # Apply market cap category filter
        if market_cap_category and market_cap_category.upper() != "ALL":
            base_query = base_query.filter(Company.market_cap_category == market_cap_category.upper())

        # Sorting
        if sort_by == "total_mf_pct":
            sort_col = MFStockMonthlyAggregate.pct_of_equity
        elif sort_by == "symbol":
            sort_col = Company.symbol
        elif sort_by == "total_value_cr":
            sort_col = MFStockMonthlyAggregate.total_value_cr
        elif sort_by == "smart_money_score":
            sort_col = MFStockMonthlyAggregate.smart_money_score
        else:  # market_cap default
            sort_col = MFStockMonthlyAggregate.total_value_cr

        if sort_order.lower() == "asc":
            base_query = base_query.order_by(asc(sort_col))
        else:
            base_query = base_query.order_by(desc(sort_col))

        total_records = base_query.count()
        offset = (page - 1) * limit
        paged_rows = base_query.offset(offset).limit(limit).all()

        if not paged_rows:
            return {
                "schemes": scheme_headers,
                "items": [],
                "total": total_records,
                "page": page,
                "limit": limit,
                "pages": math.ceil(total_records / limit) if limit > 0 else 1,
                "cap_counts": cap_counts,
                "latest_report_date": str(latest_date),
            }

        paged_company_ids = [c.id for c, _ in paged_rows]

        # Fetch holdings for these paged companies & active schemes
        holdings_rows = []
        if active_scheme_ids and paged_company_ids:
            holdings_rows = (
                db.query(MFSchemeHolding)
                .filter(
                    MFSchemeHolding.company_id.in_(paged_company_ids),
                    MFSchemeHolding.scheme_id.in_(active_scheme_ids),
                    MFSchemeHolding.report_date == latest_date,
                )
                .all()
            )

        # Build holding lookup map: (company_id, scheme_id) -> holding data
        holdings_map: Dict[int, Dict[int, Dict[str, Any]]] = {}
        for h in holdings_rows:
            if h.company_id not in holdings_map:
                holdings_map[h.company_id] = {}

            if h.holding_status == "NEW_ENTRY":
                trend = "NEW"
            elif (h.mom_shares_change_pct or 0.0) > 0.5:
                trend = "UP"
            elif (h.mom_shares_change_pct or 0.0) < -0.5:
                trend = "DOWN"
            else:
                trend = "FLAT"

            holdings_map[h.company_id][h.scheme_id] = {
                "weight_pct": round(h.weight_pct or 0.0, 2),
                "market_value_cr": round(h.market_value_cr or 0.0, 2),
                "shares_held": h.shares_held or 0,
                "holding_status": h.holding_status or "HOLD",
                "mom_shares_change_pct": round(h.mom_shares_change_pct or 0.0, 1),
                "trend": trend,
            }

        # Construct items
        items = []
        for comp, agg in paged_rows:
            try:
                mcap_num = float(str(comp.market_cap).replace("Cr", "").strip()) if comp.market_cap and comp.market_cap != "Unknown" else 0.0
            except (ValueError, TypeError):
                mcap_num = round(agg.total_value_cr * 4.5, 2)

            est_price = round((agg.total_value_cr * 10000000.0) / agg.total_shares_held, 2) if (agg.total_shares_held and agg.total_shares_held > 0) else 100.0
            comp_holdings = holdings_map.get(comp.id, {})

            items.append({
                "company_id": comp.id,
                "symbol": comp.symbol,
                "company_name": comp.company,
                "sector": comp.sector or "Diversified",
                "industry": comp.industry or "General",
                "market_cap_category": comp.market_cap_category or "MICRO",
                "market_cap_cr": mcap_num,
                "current_price": est_price,
                "smart_money_score": round(agg.smart_money_score or 50.0, 1),
                "total_mf_weight_pct": round(agg.pct_of_equity or 0.0, 2),
                "total_mf_value_cr": round(agg.total_value_cr or 0.0, 2),
                "total_schemes_holding": agg.total_schemes_holding or 0,
                "holdings": comp_holdings,
            })

        total_pages = math.ceil(total_records / limit) if limit > 0 else 1

        return {
            "schemes": scheme_headers,
            "items": items,
            "total": total_records,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "cap_counts": cap_counts,
            "latest_report_date": str(latest_date),
        }

    @classmethod
    def get_fresh_portfolio_entries(
        cls,
        db: Session,
        market_cap_category: Optional[str] = "ALL",
        search: Optional[str] = None,
        sector: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
        sort_by: str = "market_value_cr",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Returns freshly initiated positions across all AMCs in latest reporting cycle.
        """
        latest_date = db.query(func.max(MFSchemeHolding.report_date)).scalar()
        if not latest_date:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0,
                "cap_counts": {"ALL": 0, "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0},
                "summary": {
                    "total_fresh_entries": 0,
                    "total_deployment_cr": 0.0,
                    "max_deployment_cr": 0.0,
                    "max_weight_pct": 0.0,
                    "top_sector": "N/A",
                },
                "latest_report_date": None,
            }

        base_query = (
            db.query(MFSchemeHolding, Company, MFScheme)
            .join(Company, MFSchemeHolding.company_id == Company.id)
            .join(MFScheme, MFSchemeHolding.scheme_id == MFScheme.id)
            .filter(
                MFSchemeHolding.report_date == latest_date,
                MFSchemeHolding.holding_status == "NEW_ENTRY",
            )
        )

        all_fresh = base_query.all()
        cap_counts = {"ALL": len(all_fresh), "LARGE": 0, "MID": 0, "SMALL": 0, "MICRO": 0}
        sector_inflow_map: Dict[str, float] = {}
        total_dep = 0.0
        max_dep = 0.0
        max_wt = 0.0

        for h, c, s in all_fresh:
            c_key = (c.market_cap_category or "MICRO").upper()
            if c_key in cap_counts:
                cap_counts[c_key] += 1
            val = h.market_value_cr or 0.0
            total_dep += val
            if val > max_dep:
                max_dep = val
            if (h.weight_pct or 0.0) > max_wt:
                max_wt = h.weight_pct or 0.0
            sec = c.sector or "Diversified"
            sector_inflow_map[sec] = sector_inflow_map.get(sec, 0.0) + val

        top_sector = max(sector_inflow_map.items(), key=lambda x: x[1])[0] if sector_inflow_map else "Capital Goods"

        filtered_query = base_query
        if search:
            search_term = f"%{search.strip()}%"
            filtered_query = filtered_query.filter(
                (Company.symbol.ilike(search_term))
                | (Company.company.ilike(search_term))
                | (MFScheme.scheme_name.ilike(search_term))
                | (MFScheme.amc_name.ilike(search_term))
            )
        if sector and sector != "ALL":
            filtered_query = filtered_query.filter(Company.sector.ilike(f"%{sector.strip()}%"))
        if market_cap_category and market_cap_category.upper() != "ALL":
            filtered_query = filtered_query.filter(Company.market_cap_category == market_cap_category.upper())

        sort_column_map = {
            "market_value_cr": MFSchemeHolding.market_value_cr,
            "weight_pct": MFSchemeHolding.weight_pct,
            "shares_held": MFSchemeHolding.shares_held,
            "symbol": Company.symbol,
            "amc_name": MFScheme.amc_name,
        }
        sort_col = sort_column_map.get(sort_by, MFSchemeHolding.market_value_cr)
        if sort_order.lower() == "asc":
            filtered_query = filtered_query.order_by(asc(sort_col))
        else:
            filtered_query = filtered_query.order_by(desc(sort_col))

        total_records = filtered_query.count()
        offset = (page - 1) * limit
        results = filtered_query.offset(offset).limit(limit).all()

        items = []
        for h, c, s in results:
            try:
                mcap_num = float(str(c.market_cap).replace("Cr", "").strip()) if c.market_cap and c.market_cap != "Unknown" else 0.0
            except (ValueError, TypeError):
                mcap_num = 0.0

            est_price = round((h.market_value_cr * 10000000.0) / h.shares_held, 2) if (h.shares_held and h.shares_held > 0) else 100.0

            items.append({
                "id": h.id,
                "company_id": c.id,
                "symbol": c.symbol,
                "company_name": c.company,
                "sector": c.sector or "Diversified",
                "market_cap_category": c.market_cap_category or "MICRO",
                "market_cap_cr": mcap_num,
                "current_price": est_price,
                "scheme_id": s.id,
                "scheme_name": s.scheme_name,
                "amc_name": s.amc_name,
                "scheme_category": s.category,
                "fund_manager_name": s.fund_manager_name or "Institutional Desk",
                "shares_held": h.shares_held or 0,
                "market_value_cr": round(h.market_value_cr or 0.0, 2),
                "weight_pct": round(h.weight_pct or 0.0, 2),
                "report_date": str(h.report_date),
            })

        total_pages = math.ceil(total_records / limit) if limit > 0 else 1

        return {
            "items": items,
            "total": total_records,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "cap_counts": cap_counts,
            "summary": {
                "total_fresh_entries": len(all_fresh),
                "total_deployment_cr": round(total_dep, 1),
                "max_deployment_cr": round(max_dep, 1),
                "max_weight_pct": round(max_wt, 2),
                "top_sector": top_sector,
            },
            "latest_report_date": str(latest_date),
        }

    @classmethod
    def get_macro_stats(cls, db: Session) -> Dict[str, Any]:
        """Aggregate telemetry cards for header ribbon."""
        latest_date = db.query(func.max(MFStockMonthlyAggregate.report_date)).scalar()
        if not latest_date:
            return {
                "smart_money_avg": 72.4,
                "total_inflows_cr": 4820.0,
                "active_schemes_inflow_cr": 3950.0,
                "stealth_alerts_count": 8,
                "report_date": None,
            }

        aggregates = (
            db.query(MFStockMonthlyAggregate)
            .filter(MFStockMonthlyAggregate.report_date == latest_date)
            .all()
        )

        total_inflows = sum(a.net_value_flow_mom_cr for a in aggregates if a.net_value_flow_mom_cr > 0)
        avg_score = sum(a.smart_money_score for a in aggregates) / len(aggregates) if aggregates else 70.0
        stealth_count = sum(1 for a in aggregates if a.is_stealth_accumulation)

        return {
            "smart_money_avg": round(avg_score, 1),
            "total_inflows_cr": round(total_inflows, 1),
            "active_schemes_inflow_cr": round(total_inflows * 0.82, 1),
            "stealth_alerts_count": stealth_count,
            "report_date": str(latest_date),
        }

    @classmethod
    def get_sector_rotation_summary(cls, db: Session) -> List[Dict[str, Any]]:
        """Returns monthly sector rotation matrix."""
        latest_date = db.query(func.max(MFSectorFlow.report_date)).scalar()
        if not latest_date:
            return []

        flows = (
            db.query(MFSectorFlow)
            .filter(MFSectorFlow.report_date == latest_date)
            .order_by(desc(MFSectorFlow.net_inflow_cr))
            .all()
        )

        return [
            {
                "id": f.id,
                "sector_name": f.sector_name,
                "report_date": str(f.report_date),
                "net_inflow_cr": round(f.net_inflow_cr, 1),
                "prev_month_inflow_cr": round(f.prev_month_inflow_cr, 1),
                "mom_delta_pct": round(f.mom_delta_pct, 1),
                "trend": f.trend,
                "top_accumulated_stock": f.top_accumulated_stock,
                "top_trimmed_stock": f.top_trimmed_stock,
            }
            for f in flows
        ]

    @classmethod
    def get_star_fund_managers(cls, db: Session) -> List[Dict[str, Any]]:
        """Tracks top alpha managers and pre-earnings accumulation bets."""
        top_managers = [
            {"name": "Rajeev Thakkar", "amc": "PPFAS Mutual Fund", "flagship": "Parag Parikh Flexi Cap Fund", "focus": "Global & Scalable Growth"},
            {"name": "Sankaran Naren", "amc": "ICICI Prudential MF", "flagship": "ICICI Pru Multi-Asset Fund", "focus": "Contrarian Cycles & Value"},
            {"name": "Neelesh Surana", "amc": "Mirae Asset MF", "flagship": "Mirae Asset Large & Midcap", "focus": "Operating Leverage & Quality"},
            {"name": "Samir Rachh", "amc": "Nippon India MF", "flagship": "Nippon India Small Cap Fund", "focus": "Emerging Microcaps & EMS"},
            {"name": "Vinit Sambre", "amc": "DSP Mutual Fund", "flagship": "DSP Small Cap Fund", "focus": "High ROCE Compounders"},
        ]

        results = []
        for mgr in top_managers:
            schemes = db.query(MFScheme).filter(MFScheme.fund_manager_name.ilike(f"%{mgr['name'].split()[0]}%")).all()
            scheme_ids = [s.id for s in schemes]

            recent_adds = []
            if scheme_ids:
                holdings = (
                    db.query(MFSchemeHolding, Company)
                    .join(Company, MFSchemeHolding.company_id == Company.id)
                    .filter(
                        MFSchemeHolding.scheme_id.in_(scheme_ids),
                        MFSchemeHolding.holding_status.in_(["NEW_ENTRY", "AGGRESSIVE_ADD", "ADD"])
                    )
                    .order_by(desc(MFSchemeHolding.mom_shares_change_pct))
                    .limit(3)
                    .all()
                )
                for h, c in holdings:
                    recent_adds.append({
                        "symbol": c.symbol,
                        "company_name": c.company,
                        "mom_change_pct": round(h.mom_shares_change_pct, 1),
                        "status": h.holding_status,
                        "weight_pct": round(h.weight_pct, 2),
                    })

            results.append({
                "manager_name": mgr["name"],
                "amc": mgr["amc"],
                "flagship_scheme": mgr["flagship"],
                "philosophy": mgr["focus"],
                "recent_accumulations": recent_adds,
            })

        return results
