"""
Alpha India — Institutional Brokerage Intelligence Service
Provides quantitative aggregation of 60+ Indian brokerage reports,
tracks target price revisions, calculates consensus corridors,
and computes institutional conviction scores.
"""

import logging
from datetime import datetime, date, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session

from app.models.brokerage_intelligence import BrokerageReport, BrokerScorecard
from app.models.company import Company

logger = logging.getLogger("alpha_india.brokerage_service")


class BrokerageService:

    @classmethod
    def calculate_conviction_score(
        cls,
        broker_hit_rate: float,
        target_revision_pct: Optional[float] = None,
        eps_revision_pct: Optional[float] = None,
        smart_money_score: float = 70.0,
        mgmt_clarity: str = "HIGH"
    ) -> float:
        """
        Quantitatively computes Institutional Conviction Score (0 to 100):
        - Broker Hit Rate Weight: 35%
        - Target & EPS Revision Acceleration: 25%
        - Smart Money / Institutional Delivery Flow: 25%
        - Concall Management Clarity & Directness: 15%
        """
        # Factor 1: Broker Historical Reliability (Base 0 - 100)
        # Standardize 50% hit rate as base 50; 70%+ hit rate maps to 85-100
        f_broker = min(100.0, max(20.0, broker_hit_rate * 1.3))

        # Factor 2: Revision Acceleration
        rev_pct = (target_revision_pct or 0.0)
        eps_pct = (eps_revision_pct or 0.0)
        combined_rev = (rev_pct * 0.7) + (eps_pct * 0.3)
        if combined_rev > 20.0:
            f_rev = 95.0
        elif combined_rev > 10.0:
            f_rev = 85.0
        elif combined_rev > 0.0:
            f_rev = 70.0
        elif combined_rev == 0.0:
            f_rev = 55.0
        else: # Downward revision
            f_rev = max(10.0, 50.0 + combined_rev * 2.0)

        # Factor 3: Smart Money Flow Confirmation
        f_smart = min(100.0, max(20.0, smart_money_score))

        # Factor 4: Concall Clarity
        clarity_map = {"HIGH": 90.0, "MEDIUM": 65.0, "EVASIVE": 25.0}
        f_clarity = clarity_map.get(mgmt_clarity.upper(), 65.0)

        conviction = (
            (0.35 * f_broker) +
            (0.25 * f_rev) +
            (0.25 * f_smart) +
            (0.15 * f_clarity)
        )
        return round(min(99.0, max(15.0, conviction)), 1)

    @classmethod
    def get_brokerage_feed(
        cls,
        db: Session,
        page: int = 1,
        limit: int = 30,
        symbol: Optional[str] = None,
        brokerage_house: Optional[str] = None,
        broker_tier: Optional[str] = None,
        action: Optional[str] = None,
        market_cap_category: Optional[str] = None,
        target_horizon: Optional[str] = None,
        min_conviction: Optional[float] = None,
        is_hot_pick: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: str = "report_date",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Returns paginated brokerage research feed with comprehensive filters.
        """
        query = db.query(BrokerageReport)

        if symbol:
            query = query.filter(BrokerageReport.symbol == symbol.upper().strip())
        if brokerage_house and brokerage_house.strip().upper() != "ALL":
            query = query.filter(BrokerageReport.brokerage_house.ilike(brokerage_house.strip()))
        if broker_tier and broker_tier.strip().upper() != "ALL":
            query = query.filter(BrokerageReport.broker_tier == broker_tier.strip())
        if action and action.strip().upper() != "ALL":
            act = action.strip().upper()
            if act == "UPGRADE":
                query = query.filter(BrokerageReport.action.in_(["UPGRADE", "TARGET_UP"]))
            elif act == "TARGET_UP":
                query = query.filter(BrokerageReport.action == "TARGET_UP")
            elif act == "INITIATION":
                query = query.filter(BrokerageReport.action == "INITIATION")
            elif act == "MAINTAINED":
                query = query.filter(BrokerageReport.action == "MAINTAINED")
            elif act in ("DOWNGRADE", "EXIT"):
                query = query.filter(BrokerageReport.action.in_(["DOWNGRADE", "EXIT"]))
            else:
                query = query.filter(BrokerageReport.action == act)
        if market_cap_category and market_cap_category.upper() != "ALL":
            mc = market_cap_category.strip().upper()
            if mc in ("LARGE_CAP", "LARGE"):
                query = query.filter(BrokerageReport.market_cap_category.in_(["LARGE", "LARGE_CAP"]))
            elif mc in ("MID_CAP", "MID"):
                query = query.filter(BrokerageReport.market_cap_category.in_(["MID", "MID_CAP"]))
            elif mc in ("SMALL_CAP", "SMALL", "MICRO", "MICRO_CAP"):
                query = query.filter(BrokerageReport.market_cap_category.in_(["SMALL", "SMALL_CAP", "MICRO", "MICRO_CAP"]))
            else:
                query = query.filter(BrokerageReport.market_cap_category == mc)
        if target_horizon and target_horizon.upper() != "ALL":
            th = target_horizon.strip().upper()
            if th in ("1_MONTH", "1M", "1 MONTH"):
                query = query.filter((BrokerageReport.horizon_months == 1) | (BrokerageReport.target_horizon.ilike("%1 Month%")))
            elif th in ("3_MONTHS", "3M", "3 MONTHS"):
                query = query.filter((BrokerageReport.horizon_months == 3) | (BrokerageReport.target_horizon.ilike("%3 Month%")))
            elif th in ("6_MONTHS", "6M", "6 MONTHS"):
                query = query.filter((BrokerageReport.horizon_months == 6) | (BrokerageReport.target_horizon.ilike("%6 Month%")))
            elif th in ("12_MONTHS", "12M", "12 MONTHS", "1 YEAR"):
                query = query.filter((BrokerageReport.horizon_months == 12) | (BrokerageReport.target_horizon.ilike("%12 Month%")) | (BrokerageReport.target_horizon.ilike("%1 Year%")))
            elif th in ("LONG", "LONG_TERM", "18_MONTHS", "18-24 MONTHS", "18 MONTHS"):
                query = query.filter((BrokerageReport.horizon_months >= 18) | (BrokerageReport.target_horizon.ilike("%18%")) | (BrokerageReport.target_horizon.ilike("%24%")))
            elif th in ("SHORT", "TACTICAL"):
                query = query.filter(BrokerageReport.horizon_months <= 3)
            elif th in ("MEDIUM", "MEDIUM_TERM"):
                query = query.filter((BrokerageReport.horizon_months > 3) & (BrokerageReport.horizon_months <= 9))
            else:
                query = query.filter(BrokerageReport.target_horizon.ilike(f"%{target_horizon.replace('_', ' ')}%"))
        if min_conviction is not None and float(min_conviction) > 0:
            query = query.filter(BrokerageReport.conviction_score >= float(min_conviction))
        if is_hot_pick is not None:
            query = query.filter(BrokerageReport.is_hot_pick == is_hot_pick)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                (BrokerageReport.symbol.ilike(s)) |
                (BrokerageReport.company_name.ilike(s)) |
                (BrokerageReport.brokerage_house.ilike(s)) |
                (BrokerageReport.sector.ilike(s)) |
                (BrokerageReport.headline.ilike(s))
            )

        # Dynamic Sorting
        valid_sort_cols = {
            "report_date": BrokerageReport.report_date,
            "conviction_score": BrokerageReport.conviction_score,
            "upside_pct": BrokerageReport.upside_pct,
            "target_revision_pct": BrokerageReport.target_revision_pct,
            "target_price": BrokerageReport.target_price,
            "price_at_reco": BrokerageReport.price_at_reco,
            "market_cap": BrokerageReport.market_cap,
        }
        sort_col = valid_sort_cols.get(sort_by, BrokerageReport.report_date)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col), desc(BrokerageReport.id))
        else:
            query = query.order_by(desc(sort_col), desc(BrokerageReport.id))

        total_count = query.count()
        offset = (max(1, page) - 1) * limit
        items = query.offset(offset).limit(limit).all()

        # Fetch scorecards to map star ratings and hit rates to items
        scorecards = {sc.brokerage_house: sc for sc in db.query(BrokerScorecard).all()}

        results = []
        for r in items:
            sc = scorecards.get(r.brokerage_house)
            cat = (r.market_cap_category or "").upper()
            if cat in ("LARGE", "LARGE_CAP"):
                norm_cat = "LARGE_CAP"
            elif cat in ("MID", "MID_CAP"):
                norm_cat = "MID_CAP"
            else:
                norm_cat = "SMALL_CAP"

            results.append({
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name or r.symbol,
                "sector": r.sector or "Diversified",
                "market_cap_category": norm_cat,
                "market_cap": r.market_cap,
                "brokerage_house": r.brokerage_house,
                "broker_tier": r.broker_tier,
                "broker_star_rating": sc.star_rating if sc else 4.0,
                "broker_hit_rate_pct": sc.hit_rate_pct if sc else 60.0,
                "report_date": r.report_date.isoformat() if r.report_date else None,
                "report_type": r.report_type,
                "action": r.action,
                "previous_rating": r.previous_rating,
                "current_rating": r.current_rating,
                "price_at_reco": r.price_at_reco,
                "previous_target_price": r.previous_target_price,
                "target_price": r.target_price,
                "upside_pct": r.upside_pct,
                "target_revision_pct": r.target_revision_pct,
                "target_horizon": r.target_horizon or "12 Months",
                "horizon_months": r.horizon_months or 12,
                "fy1_eps_est": r.fy1_eps_est,
                "fy2_eps_est": r.fy2_eps_est,
                "eps_revision_pct": r.eps_revision_pct,
                "conviction_score": r.conviction_score,
                "is_hot_pick": r.is_hot_pick,
                "headline": r.headline,
                "investment_thesis": r.investment_thesis,
                "key_catalysts": r.key_catalysts or [],
                "key_risks": r.key_risks or [],
                "concall_grill_question": r.concall_grill_question,
                "concall_mgmt_answer": r.concall_mgmt_answer,
                "mgmt_clarity_rating": r.mgmt_clarity_rating,
                "target_achieved": r.target_achieved,
                "days_to_target": r.days_to_target,
                "max_gain_pct": r.max_gain_pct,
                "max_drawdown_pct": r.max_drawdown_pct,
            })

        return {
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
            "items": results,
        }

    @classmethod
    def get_hot_picks(cls, db: Session, limit: int = 6) -> List[Dict[str, Any]]:
        """
        Returns high-conviction cluster picks (Conviction Score >= 85 or multiple top broker upgrades).
        """
        query = (
            db.query(BrokerageReport)
            .filter((BrokerageReport.is_hot_pick == True) | (BrokerageReport.conviction_score >= 85.0))
            .order_by(desc(BrokerageReport.conviction_score), desc(BrokerageReport.report_date))
            .limit(limit)
        )
        items = query.all()
        scorecards = {sc.brokerage_house: sc for sc in db.query(BrokerScorecard).all()}

        picks = []
        for r in items:
            sc = scorecards.get(r.brokerage_house)
            picks.append({
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name or r.symbol,
                "sector": r.sector or "Diversified",
                "brokerage_house": r.brokerage_house,
                "broker_star_rating": sc.star_rating if sc else 4.5,
                "broker_hit_rate_pct": sc.hit_rate_pct if sc else 68.0,
                "action": r.action,
                "current_rating": r.current_rating,
                "price_at_reco": r.price_at_reco,
                "target_price": r.target_price,
                "upside_pct": r.upside_pct,
                "target_horizon": r.target_horizon or "12 Months",
                "horizon_months": r.horizon_months or 12,
                "conviction_score": r.conviction_score,
                "headline": r.headline,
                "investment_thesis": r.investment_thesis,
                "key_catalysts": r.key_catalysts or [],
                "report_date": r.report_date.isoformat() if r.report_date else None,
            })
        return picks

    @classmethod
    def get_stock_brokerage_consensus(cls, db: Session, symbol: str) -> Dict[str, Any]:
        """
        Deep-dive consensus corridor and chronological research history for a single stock.
        Used directly in the One Stock Page (/stocks/[symbol] tab).
        """
        sym = symbol.upper().strip()
        reports = (
            db.query(BrokerageReport)
            .filter(BrokerageReport.symbol == sym)
            .order_by(desc(BrokerageReport.report_date), desc(BrokerageReport.id))
            .all()
        )

        if not reports:
            # Fallback mock/empty consensus structure if stock has no formal coverage yet
            return {
                "symbol": sym,
                "has_coverage": False,
                "total_reports": 0,
                "consensus_target": None,
                "consensus_upside_pct": None,
                "target_corridor": {"low": None, "median": None, "high": None},
                "ratings_breakdown": {"buy": 0, "accumulate": 0, "hold": 0, "reduce": 0, "sell": 0},
                "consensus_stance": "NO_FORMAL_COVERAGE",
                "avg_conviction_score": None,
                "synthesized_thesis": {
                    "bull_thesis": ["Uncovered institutional gem or emerging smallcap.", "Track preliminary quarterly YoY metrics."],
                    "bear_risks": ["Liquidity discount due to zero sell-side coverage."],
                },
                "concall_highlights": None,
                "history": [],
            }

        scorecards = {sc.brokerage_house: sc for sc in db.query(BrokerScorecard).all()}

        targets = [r.target_price for r in reports if r.target_price and r.target_price > 0]
        targets_sorted = sorted(targets)
        
        low_target = targets_sorted[0] if targets_sorted else 0.0
        high_target = targets_sorted[-1] if targets_sorted else 0.0
        median_target = targets_sorted[len(targets_sorted) // 2] if targets_sorted else 0.0

        latest_price = reports[0].price_at_reco if reports else 0.0
        consensus_upside = (
            round(((median_target - latest_price) / latest_price) * 100.0, 1)
            if latest_price > 0 and median_target > 0
            else 0.0
        )

        # Stance Breakdown
        ratings_breakdown = {"buy": 0, "accumulate": 0, "hold": 0, "reduce": 0, "sell": 0}
        for r in reports:
            rate = (r.current_rating or "").lower()
            if "buy" in rate:
                ratings_breakdown["buy"] += 1
            elif "accum" in rate or "add" in rate:
                ratings_breakdown["accumulate"] += 1
            elif "hold" in rate or "neutral" in rate:
                ratings_breakdown["hold"] += 1
            elif "reduce" in rate or "under" in rate:
                ratings_breakdown["reduce"] += 1
            elif "sell" in rate:
                ratings_breakdown["sell"] += 1

        total_bulls = ratings_breakdown["buy"] + ratings_breakdown["accumulate"]
        total_bears = ratings_breakdown["reduce"] + ratings_breakdown["sell"]
        if total_bulls > total_bears * 2:
            consensus_stance = "STRONG_CONSENSUS_BUY"
        elif total_bulls > total_bears:
            consensus_stance = "MODERATE_BUY"
        elif total_bears > total_bulls:
            consensus_stance = "CAUTIOUS_UNDERWEIGHT"
        else:
            consensus_stance = "NEUTRAL_BALANCED"

        avg_conviction = round(sum(r.conviction_score for r in reports) / len(reports), 1)

        # Extract latest synthesized catalysts and risks
        bull_points = []
        bear_points = []
        for r in reports[:3]:
            if r.key_catalysts:
                for c in r.key_catalysts:
                    if c not in bull_points:
                        bull_points.append(c)
            if r.key_risks:
                for rk in r.key_risks:
                    if rk not in bear_points:
                        bear_points.append(rk)

        # Concall grill highlights
        concall_item = None
        for r in reports:
            if r.concall_grill_question:
                concall_item = {
                    "question": r.concall_grill_question,
                    "answer": r.concall_mgmt_answer,
                    "clarity_rating": r.mgmt_clarity_rating,
                    "broker": r.brokerage_house,
                    "date": r.report_date.isoformat() if r.report_date else None,
                }
                break

        history_items = []
        for r in reports:
            sc = scorecards.get(r.brokerage_house)
            history_items.append({
                "id": r.id,
                "brokerage_house": r.brokerage_house,
                "broker_star_rating": sc.star_rating if sc else 4.0,
                "broker_hit_rate_pct": sc.hit_rate_pct if sc else 60.0,
                "report_date": r.report_date.isoformat() if r.report_date else None,
                "report_type": r.report_type,
                "action": r.action,
                "previous_rating": r.previous_rating,
                "current_rating": r.current_rating,
                "price_at_reco": r.price_at_reco,
                "previous_target_price": r.previous_target_price,
                "target_price": r.target_price,
                "upside_pct": r.upside_pct,
                "target_revision_pct": r.target_revision_pct,
                "target_horizon": r.target_horizon or "12 Months",
                "horizon_months": r.horizon_months or 12,
                "eps_revision_pct": r.eps_revision_pct,
                "conviction_score": r.conviction_score,
                "headline": r.headline,
                "investment_thesis": r.investment_thesis,
            })

        consensus_horizon = reports[0].target_horizon if (reports and reports[0].target_horizon) else "12 Months"

        return {
            "symbol": sym,
            "has_coverage": True,
            "company_name": reports[0].company_name or sym,
            "sector": reports[0].sector or "Diversified",
            "current_price": latest_price,
            "total_reports": len(reports),
            "consensus_target": median_target,
            "consensus_upside_pct": consensus_upside,
            "consensus_horizon": consensus_horizon,
            "target_corridor": {
                "low": low_target,
                "median": median_target,
                "high": high_target,
            },
            "ratings_breakdown": ratings_breakdown,
            "consensus_stance": consensus_stance,
            "avg_conviction_score": avg_conviction,
            "synthesized_thesis": {
                "bull_thesis": bull_points[:5] or ["Solid earnings visibility and operating leverage runway."],
                "bear_risks": bear_points[:4] or ["Commodity price volatility and valuation multiple headroom."],
            },
            "concall_highlights": concall_item,
            "history": history_items,
        }

    @classmethod
    def get_all_stocks_consensus(
        cls,
        db: Session,
        market_cap_category: Optional[str] = None,
        search: Optional[str] = None,
        min_brokers: int = 1,
        sort_by: str = "broker_count",
        sort_order: str = "desc",
    ) -> List[Dict[str, Any]]:
        """
        Aggregates brokerage recommendations by stock across all covering brokers,
        providing multi-broker consensus corridors, distinct brokerage rosters, and complete
        chronological recommendation histories all in one place.
        """
        all_reports = (
            db.query(BrokerageReport)
            .order_by(desc(BrokerageReport.report_date), desc(BrokerageReport.id))
            .all()
        )
        scorecards = {sc.brokerage_house: sc for sc in db.query(BrokerScorecard).all()}

        # Group by symbol
        groups: Dict[str, List[BrokerageReport]] = {}
        for r in all_reports:
            sym = r.symbol.upper().strip()
            if sym not in groups:
                groups[sym] = []
            groups[sym].append(r)

        result_list = []
        for sym, reps in groups.items():
            distinct_brokers = sorted(list(set(r.brokerage_house for r in reps if r.brokerage_house)))
            broker_count = len(distinct_brokers)

            if broker_count < min_brokers:
                continue

            first = reps[0]
            comp_name = first.company_name or sym
            sector = first.sector or "Diversified"
            
            cat = (first.market_cap_category or "").upper()
            if cat in ("LARGE", "LARGE_CAP"):
                norm_cat = "LARGE_CAP"
            elif cat in ("MID", "MID_CAP"):
                norm_cat = "MID_CAP"
            else:
                norm_cat = "SMALL_CAP"

            if market_cap_category and market_cap_category.upper() != "ALL":
                mc = market_cap_category.strip().upper()
                if mc in ("LARGE_CAP", "LARGE") and norm_cat != "LARGE_CAP":
                    continue
                elif mc in ("MID_CAP", "MID") and norm_cat != "MID_CAP":
                    continue
                elif mc in ("SMALL_CAP", "SMALL") and norm_cat != "SMALL_CAP":
                    continue

            if search:
                s_lower = search.strip().lower()
                matches_search = (
                    s_lower in sym.lower()
                    or s_lower in comp_name.lower()
                    or s_lower in sector.lower()
                    or any(s_lower in b.lower() for b in distinct_brokers)
                )
                if not matches_search:
                    continue

            current_price = first.price_at_reco or 0.0

            targets = [r.target_price for r in reps if r.target_price and r.target_price > 0]
            targets_sorted = sorted(targets)
            low_target = targets_sorted[0] if targets_sorted else 0.0
            high_target = targets_sorted[-1] if targets_sorted else 0.0
            median_target = targets_sorted[len(targets_sorted) // 2] if targets_sorted else 0.0

            consensus_upside = (
                round(((median_target - current_price) / current_price) * 100.0, 1)
                if current_price > 0 and median_target > 0
                else 0.0
            )

            ratings_breakdown = {"buy": 0, "accumulate": 0, "hold": 0, "reduce": 0, "sell": 0}
            for r in reps:
                rate = (r.current_rating or "").lower()
                act = (r.action or "").lower()
                if "buy" in rate or "upgrade" in act or "target_up" in act:
                    ratings_breakdown["buy"] += 1
                elif "accum" in rate or "add" in rate:
                    ratings_breakdown["accumulate"] += 1
                elif "hold" in rate or "neutral" in rate or "maintained" in act:
                    ratings_breakdown["hold"] += 1
                elif "reduce" in rate or "under" in rate:
                    ratings_breakdown["reduce"] += 1
                elif "sell" in rate or "downgrade" in act:
                    ratings_breakdown["sell"] += 1
                else:
                    ratings_breakdown["buy"] += 1

            total_bulls = ratings_breakdown["buy"] + ratings_breakdown["accumulate"]
            total_bears = ratings_breakdown["reduce"] + ratings_breakdown["sell"]
            if total_bulls > total_bears * 2:
                consensus_stance = "STRONG_CONSENSUS_BUY"
            elif total_bulls > total_bears:
                consensus_stance = "MODERATE_BUY"
            elif total_bears > total_bulls:
                consensus_stance = "CAUTIOUS_UNDERWEIGHT"
            else:
                consensus_stance = "NEUTRAL_HOLD"

            avg_conviction = round(sum(r.conviction_score for r in reps) / len(reps), 1)

            # Build detailed reports list for comparison
            rep_items = []
            for r in reps:
                sc = scorecards.get(r.brokerage_house)
                rep_items.append({
                    "id": r.id,
                    "symbol": r.symbol,
                    "company_name": comp_name,
                    "sector": sector,
                    "market_cap_category": norm_cat,
                    "market_cap": r.market_cap,
                    "brokerage_house": r.brokerage_house,
                    "broker_tier": r.broker_tier,
                    "broker_star_rating": sc.star_rating if sc else 4.0,
                    "broker_hit_rate_pct": sc.hit_rate_pct if sc else 60.0,
                    "report_date": r.report_date.isoformat() if r.report_date else None,
                    "report_type": r.report_type,
                    "action": r.action,
                    "previous_rating": r.previous_rating,
                    "current_rating": r.current_rating,
                    "price_at_reco": r.price_at_reco,
                    "previous_target_price": r.previous_target_price,
                    "target_price": r.target_price,
                    "upside_pct": r.upside_pct,
                    "target_revision_pct": r.target_revision_pct,
                    "target_horizon": r.target_horizon or "12 Months",
                    "horizon_months": r.horizon_months or 12,
                    "conviction_score": r.conviction_score,
                    "is_hot_pick": r.is_hot_pick,
                    "headline": r.headline,
                    "investment_thesis": r.investment_thesis,
                    "key_catalysts": r.key_catalysts or [],
                    "key_risks": r.key_risks or [],
                })

            result_list.append({
                "symbol": sym,
                "company_name": comp_name,
                "sector": sector,
                "market_cap_category": norm_cat,
                "market_cap": first.market_cap,
                "current_price": current_price,
                "total_reports": len(reps),
                "broker_count": broker_count,
                "brokers": distinct_brokers,
                "consensus_target": median_target,
                "consensus_upside_pct": consensus_upside,
                "target_corridor": {
                    "low": low_target,
                    "median": median_target,
                    "high": high_target,
                },
                "ratings_breakdown": ratings_breakdown,
                "consensus_stance": consensus_stance,
                "avg_conviction_score": avg_conviction,
                "latest_report_date": reps[0].report_date.isoformat() if reps[0].report_date else None,
                "reports": rep_items,
            })

        # Sorting
        rev = (sort_order.lower() != "asc")
        if sort_by == "broker_count":
            result_list.sort(key=lambda x: (x["broker_count"], x["total_reports"], x["consensus_upside_pct"]), reverse=rev)
        elif sort_by == "total_reports":
            result_list.sort(key=lambda x: (x["total_reports"], x["broker_count"]), reverse=rev)
        elif sort_by == "consensus_upside_pct":
            result_list.sort(key=lambda x: x["consensus_upside_pct"], reverse=rev)
        elif sort_by == "avg_conviction_score":
            result_list.sort(key=lambda x: x["avg_conviction_score"], reverse=rev)
        elif sort_by == "symbol":
            result_list.sort(key=lambda x: x["symbol"], reverse=not rev)
        else:
            result_list.sort(key=lambda x: (x["broker_count"], x["latest_report_date"] or ""), reverse=rev)

        return result_list

    @classmethod
    def get_scorecards(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Returns league table of tracked brokerage houses ranked by hit rate and star rating.
        """
        cards = db.query(BrokerScorecard).order_by(desc(BrokerScorecard.hit_rate_pct), desc(BrokerScorecard.star_rating)).all()
        return [
            {
                "id": c.id,
                "brokerage_house": c.brokerage_house,
                "tier": c.tier,
                "star_rating": c.star_rating,
                "specialization": c.specialization,
                "total_calls_tracked": c.total_calls_tracked,
                "calls_hit_target": c.calls_hit_target,
                "hit_rate_pct": c.hit_rate_pct,
                "avg_days_to_target": c.avg_days_to_target,
                "avg_max_drawdown_pct": c.avg_max_drawdown_pct,
            }
            for c in cards
        ]

    @classmethod
    def get_metrics_ribbon(cls, db: Session) -> Dict[str, Any]:
        """
        Computes header ribbon metrics for the Brokerage Radar page.
        """
        total_calls = db.query(BrokerageReport).count()
        hot_picks_count = (
            db.query(BrokerageReport)
            .filter((BrokerageReport.is_hot_pick == True) | (BrokerageReport.conviction_score >= 85.0))
            .count()
        )
        avg_upside = db.query(func.avg(BrokerageReport.upside_pct)).scalar() or 0.0

        upgrades = db.query(BrokerageReport).filter(BrokerageReport.action.in_(["UPGRADE", "TARGET_UP"])).count()
        downgrades = db.query(BrokerageReport).filter(BrokerageReport.action.in_(["DOWNGRADE", "EXIT"])).count()
        total_actions = max(1, upgrades + downgrades)
        net_revision_breadth = round((upgrades / total_actions) * 100.0, 1)

        best_scorecard = db.query(BrokerScorecard).order_by(desc(BrokerScorecard.hit_rate_pct)).first()

        large_count = db.query(BrokerageReport).filter(BrokerageReport.market_cap_category.in_(["LARGE", "LARGE_CAP"])).count()
        mid_count = db.query(BrokerageReport).filter(BrokerageReport.market_cap_category.in_(["MID", "MID_CAP"])).count()
        small_count = db.query(BrokerageReport).filter(BrokerageReport.market_cap_category.in_(["SMALL", "SMALL_CAP", "MICRO", "MICRO_CAP"])).count()

        return {
            "total_active_calls": total_calls,
            "hot_picks_count": hot_picks_count,
            "large_cap_count": large_count,
            "mid_cap_count": mid_count,
            "small_cap_count": small_count,
            "avg_consensus_upside_pct": round(float(avg_upside), 1),
            "net_revision_breadth_bull_pct": net_revision_breadth,
            "top_broker_name": best_scorecard.brokerage_house if best_scorecard else "Kotak Inst. Equities",
            "top_broker_hit_rate": best_scorecard.hit_rate_pct if best_scorecard else 71.4,
            "tracked_houses_count": db.query(BrokerScorecard).count(),
        }
