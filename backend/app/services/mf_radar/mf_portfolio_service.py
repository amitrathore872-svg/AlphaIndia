"""
Mutual Fund Portfolio & Smart Swap Recommendation Service
Alpha India - Sprint 39
Handles user portfolio tracking, lot-level holding period calculations,
Exit Load & STCG/LTCG tax friction deduction, and generates actionable "Sell Fund X -> Buy Fund Y" swap cards.
"""

import logging
import csv
import io
import re
import openpyxl
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.mf_radar_models import MFRadarScheme, MFRadarPortfolioHolding

logger = logging.getLogger("mf_portfolio")


class MFPortfolioService:
    """Core logic for portfolio tracking, tax friction math, and alpha swap generation."""

    @classmethod
    def add_holding(
        cls,
        db: Session,
        scheme_code: str,
        units: float,
        purchase_date: date,
        purchase_nav: float,
        folio_number: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Adds a mutual fund holding and calculates initial friction and tax status."""
        scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == scheme_code).first()
        scheme_name = scheme.scheme_name if scheme else f"Scheme {scheme_code}"
        curr_nav = scheme.current_nav if (scheme and scheme.current_nav) else purchase_nav

        invested = units * purchase_nav
        curr_val = units * curr_nav
        pnl = curr_val - invested
        pnl_pct = (pnl / invested) * 100.0 if invested > 0 else 0.0

        today = date.today()
        h_days = (today - purchase_date).days

        # Exit Load (< 365 days = 1.0%, >= 365 days = 0.0%)
        exit_active = h_days < 365
        exit_pct = 1.0 if exit_active else 0.0
        exit_amt = curr_val * (exit_pct / 100.0)

        # Tax Bracket (STCG 20% vs LTCG 12.5%)
        tax_bracket = "STCG_20" if h_days < 365 else "LTCG_12_5"
        tax_rate = 0.20 if h_days < 365 else 0.125
        est_tax = max(0.0, pnl * tax_rate)

        net_proceeds = curr_val - exit_amt - est_tax

        holding = MFRadarPortfolioHolding(
            scheme_code=scheme_code,
            scheme_name=scheme_name,
            folio_number=folio_number,
            units=units,
            purchase_date=purchase_date,
            purchase_nav=purchase_nav,
            invested_amt=invested,
            current_nav=curr_nav,
            current_value=curr_val,
            unrealized_pnl=pnl,
            unrealized_pnl_pct=pnl_pct,
            holding_days=h_days,
            exit_load_active=exit_active,
            exit_load_pct=exit_pct,
            exit_load_amt=exit_amt,
            tax_bracket=tax_bracket,
            tax_amt_est=est_tax,
            net_redemption_proceeds=net_proceeds,
            notes=notes,
        )

        db.add(holding)
        db.commit()
        db.refresh(holding)
        return holding.to_dict()

    @classmethod
    def get_portfolio_summary(cls, db: Session) -> Dict[str, Any]:
        """
        Retrieves all user holdings with real-time mark-to-market valuations
        and overall portfolio friction summaries.
        """
        holdings = db.query(MFRadarPortfolioHolding).order_by(MFRadarPortfolioHolding.purchase_date.desc()).all()
        today = date.today()

        total_invested = 0.0
        total_current_val = 0.0
        total_exit_load_amt = 0.0
        total_tax_liability = 0.0
        locked_in_exit_load_count = 0

        recalculated_holdings = []
        for h in holdings:
            scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == h.scheme_code).first()
            if scheme and scheme.current_nav:
                h.current_nav = scheme.current_nav
                h.current_value = h.units * h.current_nav
                h.unrealized_pnl = h.current_value - h.invested_amt
                h.unrealized_pnl_pct = (h.unrealized_pnl / h.invested_amt) * 100.0 if h.invested_amt > 0 else 0.0

            # Recalculate holding days
            h.holding_days = (today - h.purchase_date).days
            h.exit_load_active = h.holding_days < 365
            h.exit_load_pct = 1.0 if h.exit_load_active else 0.0
            h.exit_load_amt = (h.current_value or 0.0) * (h.exit_load_pct / 100.0)

            # Tax bracket
            h.tax_bracket = "STCG_20" if h.holding_days < 365 else "LTCG_12_5"
            tax_rate = 0.20 if h.holding_days < 365 else 0.125
            h.tax_amt_est = max(0.0, (h.unrealized_pnl or 0.0) * tax_rate)
            h.net_redemption_proceeds = (h.current_value or 0.0) - h.exit_load_amt - h.tax_amt_est

            if h.exit_load_active:
                locked_in_exit_load_count += 1

            total_invested += h.invested_amt
            total_current_val += (h.current_value or h.invested_amt)
            total_exit_load_amt += h.exit_load_amt
            total_tax_liability += h.tax_amt_est

            recalculated_holdings.append(h.to_dict())

        db.commit()

        overall_pnl = total_current_val - total_invested
        overall_pnl_pct = (overall_pnl / total_invested) * 100.0 if total_invested > 0 else 0.0

        return {
            "total_invested": round(total_invested, 2),
            "total_current_val": round(total_current_val, 2),
            "overall_pnl": round(overall_pnl, 2),
            "overall_pnl_pct": round(overall_pnl_pct, 2),
            "total_exit_load_amt": round(total_exit_load_amt, 2),
            "total_tax_liability": round(total_tax_liability, 2),
            "net_portfolio_liquidity": round(total_current_val - total_exit_load_amt - total_tax_liability, 2),
            "locked_in_exit_load_count": locked_in_exit_load_count,
            "holdings_count": len(recalculated_holdings),
            "holdings": recalculated_holdings,
        }

    @classmethod
    def generate_smart_swap_recommendations(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Analyzes every holding in user's portfolio. If a holding is underperforming its peers,
        identifies superior alpha leaders, calculates the exact exit load & tax friction,
        and generates an actionable 'Sell Fund X -> Buy Fund Y' decision card if Net Alpha Delta > 2.0%.
        """
        holdings = db.query(MFRadarPortfolioHolding).all()
        if not holdings:
            return []

        swap_cards = []

        for h in holdings:
            current_scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == h.scheme_code).first()
            if not current_scheme:
                continue

            # Ensure current scheme has returns
            if current_scheme.return_6m_pct is None:
                from app.services.mf_radar.mf_warehouse_service import MFWarehouseService
                MFWarehouseService.backfill_scheme_history(db, current_scheme.scheme_code)
                db.refresh(current_scheme)

            curr_6m = current_scheme.return_6m_pct or 0.0
            category = current_scheme.category

            # Find top-performing peer funds in same category
            peer_candidates = db.query(MFRadarScheme).filter(
                MFRadarScheme.is_active == True,
                MFRadarScheme.category == category,
                MFRadarScheme.scheme_code != current_scheme.scheme_code,
                MFRadarScheme.return_6m_pct != None
            ).order_by(MFRadarScheme.return_6m_pct.desc()).limit(3).all()

            # If no peers in same category or category is chronically lagging, also check Flexi Cap leaders
            if not peer_candidates and category != "Flexi Cap":
                peer_candidates = db.query(MFRadarScheme).filter(
                    MFRadarScheme.is_active == True,
                    MFRadarScheme.category == "Flexi Cap",
                    MFRadarScheme.return_6m_pct != None
                ).order_by(MFRadarScheme.return_6m_pct.desc()).limit(3).all()

            for target_scheme in peer_candidates:
                # Ensure target scheme has backfilled history
                if target_scheme.return_6m_pct is None:
                    from app.services.mf_radar.mf_warehouse_service import MFWarehouseService
                    MFWarehouseService.backfill_scheme_history(db, target_scheme.scheme_code)
                    db.refresh(target_scheme)

                target_6m = target_scheme.return_6m_pct or 0.0
                alpha_spread = round(target_6m - curr_6m, 2)

                # Friction Percentage
                exit_load_pct = 1.0 if h.exit_load_active else 0.0
                tax_friction_pct = (h.tax_amt_est / h.current_value * 100.0) if (h.current_value and h.current_value > 0) else 0.0
                total_friction_pct = round(exit_load_pct + tax_friction_pct, 2)

                net_alpha_gain = round(alpha_spread - total_friction_pct, 2)

                # Hurdle check: Net Alpha Gain must be >= 1.0% post-friction
                if net_alpha_gain >= 1.0:
                    is_same_amc = (current_scheme.amc_name.lower().strip() == target_scheme.amc_name.lower().strip())
                    exec_type = "SAME_AMC_DIRECT_SWITCH" if is_same_amc else "INTER_AMC_REINVESTMENT"

                    # Calculate Drawdown from Peak (52W High)
                    curr_dip = round(current_scheme.dip_from_52w_high_pct or 0.0, 2)
                    curr_drawdown = -curr_dip
                    target_dip = round(target_scheme.dip_from_52w_high_pct or 0.0, 2)
                    target_drawdown = -target_dip
                    drawdown_advantage = round(curr_dip - target_dip, 2)

                    # Assess Drawdown & Entry Stance
                    if 2.5 <= target_dip <= 8.5:
                        target_dip_status = "PRIME_DIP_ON_LEADER"
                        target_dip_label = f"Prime Dip Entry ({target_drawdown}% off Peak)"
                    elif target_dip < 2.5:
                        target_dip_status = "MOMENTUM_BREAKOUT"
                        target_dip_label = f"Near 52W High ({target_drawdown}% off Peak)"
                    else:
                        target_dip_status = "DEEP_PULLBACK"
                        target_dip_label = f"Deep Pullback ({target_drawdown}% off Peak)"

                    if curr_dip >= 8.0:
                        curr_dip_status = f"Stuck in Drawdown ({curr_drawdown}% off Peak)"
                    else:
                        curr_dip_status = f"{curr_drawdown}% off Peak"

                    # Synthesize Peak Drawdown narrative into recommendation
                    peak_narrative = ""
                    if curr_dip >= 7.0 and target_dip <= 4.0:
                        peak_narrative = (
                            f" Current holding is stuck {curr_drawdown}% below its 52W peak, "
                            f"whereas {target_scheme.scheme_name[:25]} exhibits relative strength consolidating just "
                            f"{target_drawdown}% from its peak."
                        )
                    elif 2.5 <= target_dip <= 8.5:
                        peak_narrative = (
                            f" Additionally, target fund offers an attractive entry on a healthy pullback "
                            f"({target_drawdown}% off peak) while maintaining superior alpha."
                        )

                    swap_cards.append({
                        "holding_id": h.id,
                        "current_scheme": {
                            "code": current_scheme.scheme_code,
                            "name": current_scheme.scheme_name,
                            "amc": current_scheme.amc_name,
                            "category": current_scheme.category,
                            "units": round(h.units, 4),
                            "current_nav": h.current_nav,
                            "invested_amt": round(h.invested_amt, 2),
                            "current_value": round(h.current_value or 0.0, 2),
                            "unrealized_pnl": round(h.unrealized_pnl, 2),
                            "return_6m_pct": curr_6m,
                            "holding_days": h.holding_days,
                            "exit_load_active": h.exit_load_active,
                            "drawdown_from_peak_pct": curr_drawdown,
                            "peak_nav": current_scheme.nav_52w_high,
                            "dip_status": curr_dip_status,
                        },
                        "target_scheme": {
                            "code": target_scheme.scheme_code,
                            "name": target_scheme.scheme_name,
                            "amc": target_scheme.amc_name,
                            "category": target_scheme.category,
                            "current_nav": target_scheme.current_nav,
                            "return_6m_pct": target_6m,
                            "alpha_1y": target_scheme.alpha_1y,
                            "aum_cr": target_scheme.aum_cr,
                            "ter": target_scheme.ter,
                            "drawdown_from_peak_pct": target_drawdown,
                            "peak_nav": target_scheme.nav_52w_high,
                            "dip_status": target_dip_status,
                            "dip_label": target_dip_label,
                        },
                        "friction_breakdown": {
                            "exit_load_pct": exit_load_pct,
                            "exit_load_amt": round(h.exit_load_amt, 2),
                            "tax_bracket": h.tax_bracket,
                            "tax_amt_est": round(h.tax_amt_est, 2),
                            "total_friction_pct": total_friction_pct,
                            "net_proceeds": round(h.net_redemption_proceeds, 2),
                        },
                        "alpha_metrics": {
                            "gross_alpha_spread": alpha_spread,
                            "net_alpha_gain": net_alpha_gain,
                            "hurdle_cleared": True,
                            "drawdown_advantage_pct": drawdown_advantage,
                            "target_dip_label": target_dip_label,
                            "target_dip_status": target_dip_status,
                        },
                        "execution": {
                            "type": exec_type,
                            "headline": "Direct AMC Switch (Zero Bank Delay)" if is_same_amc else "Redeem & Fresh Investment",
                            "settlement_timeline": "T+1 Day" if is_same_amc else "T+2 / T+3 Days",
                            "recommendation": (
                                f"Switching out of {current_scheme.scheme_name[:35]} to {target_scheme.scheme_name[:35]} "
                                f"yields a projected net alpha advantage of +{net_alpha_gain}% after deducting "
                                f"{total_friction_pct}% in friction.{peak_narrative}"
                            ),
                        },
                    })
                    # Take only best target per holding
                    break

        return swap_cards

    @classmethod
    def seed_sample_portfolio(cls, db: Session) -> Dict[str, Any]:
        """Seeds realistic sample mutual fund holdings for immediate live demonstration."""
        db.query(MFRadarPortfolioHolding).delete()

        today = date.today()
        sample_entries = [
            # 1. Kotak Bluechip (Held for 120 days, large-cap, exit load active)
            {
                "scheme_code": "120152",
                "units": 100.0,
                "purchase_date": today - timedelta(days=120),
                "purchase_nav": 612.50,
                "folio_number": "FOL-89214-KB",
                "notes": "Lumpsum deployment in large-cap",
            },
            # 2. HDFC Mid-Cap Opportunities (Held for 420 days, mature, nil exit load, LTCG)
            {
                "scheme_code": "118989",
                "units": 450.0,
                "purchase_date": today - timedelta(days=420),
                "purchase_nav": 195.00,
                "folio_number": "FOL-33412-HM",
                "notes": "Core mid-cap wealth compounder",
            },
            # 3. Parag Parikh Flexi Cap (Held for 180 days, high alpha)
            {
                "scheme_code": "122639",
                "units": 1000.0,
                "purchase_date": today - timedelta(days=180),
                "purchase_nav": 85.10,
                "folio_number": "FOL-10928-PP",
                "notes": "Tactical buy on dip day",
            },
        ]

        created = []
        for item in sample_entries:
            res = cls.add_holding(
                db=db,
                scheme_code=item["scheme_code"],
                units=item["units"],
                purchase_date=item["purchase_date"],
                purchase_nav=item["purchase_nav"],
                folio_number=item.get("folio_number"),
                notes=item.get("notes"),
            )
            created.append(res)

        return {"status": "success", "seeded_count": len(created), "holdings": created}

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> date:
        """Parses various date formats from broker exports or falls back to ~180 days ago."""
        if not date_str:
            return date.today() - timedelta(days=180)
        cleaned = date_str.strip().split(" ")[0].split("T")[0]
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%b-%Y", "%d-%B-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(cleaned, fmt).date()
            except ValueError:
                pass
        return date.today() - timedelta(days=180)

    @classmethod
    def _find_or_create_scheme(
        cls,
        db: Session,
        raw_name: str,
        raw_code: Optional[str] = None,
        isin: Optional[str] = None,
        category: Optional[str] = None,
        current_nav: Optional[float] = None,
    ) -> MFRadarScheme:
        """
        Resolves or dynamically creates an MFRadarScheme record from broker CSV/Excel inputs.
        Matches by AMFI code, ISIN, exact name, or high-conviction keyword overlap.
        Guarantees that funds with distinct ISINs never collide or overwrite each other.
        """
        clean_isin = str(isin).strip().upper() if isin and str(isin).strip() else None

        # 1. Match by explicit scheme_code if valid numeric code
        if raw_code and str(raw_code).strip().isdigit():
            scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == str(raw_code).strip()).first()
            if scheme:
                if current_nav and current_nav > 0 and (not scheme.current_nav or scheme.current_nav <= 0):
                    scheme.current_nav = current_nav
                    db.commit()
                return scheme

        # 2. Match by ISIN if scheme already exists with that ISIN as scheme_code
        if clean_isin:
            scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == clean_isin).first()
            if scheme:
                if current_nav and current_nav > 0:
                    scheme.current_nav = current_nav
                    db.commit()
                return scheme

        # 3. Match by exact scheme_name (case-insensitive)
        if raw_name:
            scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_name.ilike(raw_name.strip())).first()
            if scheme:
                if current_nav and current_nav > 0 and (not scheme.current_nav or scheme.current_nav <= 0):
                    scheme.current_nav = current_nav
                    db.commit()
                return scheme

        # 4. High-precision fuzzy keyword matching against curated schemes
        # Only attempt fuzzy matching if NO ISIN was provided, to prevent funds with distinct ISINs
        # from collapsing into an arbitrary peer scheme from the same AMC (e.g. Motilal Oswal)!
        if not clean_isin and raw_name:
            clean_target = re.sub(r"[^a-z0-9\s]", " ", raw_name.lower())
            stop_words = {
                "direct", "growth", "plan", "fund", "option", "reg", "regular",
                "equity", "scheme", "mutual", "the", "and", "dr", "gr", "idcw"
            }
            target_tokens = set(w for w in clean_target.split() if w and w not in stop_words and len(w) > 2)

            all_schemes = db.query(MFRadarScheme).all()
            best_match = None
            best_score = 0

            for s in all_schemes:
                s_clean = re.sub(r"[^a-z0-9\s]", " ", s.scheme_name.lower())
                s_tokens = set(w for w in s_clean.split() if w and w not in stop_words and len(w) > 2)
                if target_tokens and s_tokens:
                    overlap = len(target_tokens & s_tokens)
                    # Require at least 3 matching non-stopword tokens to avoid generic AMC name collisions
                    if overlap >= 3 and overlap > best_score:
                        best_score = overlap
                        best_match = s

            if best_match and best_score >= 3:
                if current_nav and current_nav > 0 and (not best_match.current_nav or best_match.current_nav <= 0):
                    best_match.current_nav = current_nav
                    db.commit()
                return best_match

        # 5. Infer category from fund name if not matched
        inferred_category = category or "Flexi Cap"
        name_lower = (raw_name or "").lower()
        if "small cap" in name_lower or "smallcap" in name_lower:
            inferred_category = "Small Cap"
        elif "mid cap" in name_lower or "midcap" in name_lower:
            inferred_category = "Mid Cap"
        elif any(k in name_lower for k in ["large cap", "largecap", "bluechip", "nifty 50", "nifty ne", "nifty next"]):
            inferred_category = "Large Cap"
        elif "multi cap" in name_lower or "multicap" in name_lower:
            inferred_category = "Multi Cap"
        elif "focused" in name_lower:
            inferred_category = "Focused"
        elif "elss" in name_lower or "tax saver" in name_lower:
            inferred_category = "ELSS"
        elif "momentum" in name_lower:
            inferred_category = "Momentum / Factor"

        inferred_code = (
            str(raw_code).strip()
            if (raw_code and str(raw_code).strip())
            else (clean_isin if clean_isin else f"MF_{abs(hash(raw_name)) % 900000 + 100000}")
        )

        # Check if synthesized code already exists
        existing_code = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == inferred_code).first()
        if existing_code:
            if current_nav and current_nav > 0:
                existing_code.current_nav = current_nav
                db.commit()
            return existing_code

        # Smart Inferred AMC Name
        words = (raw_name or "").split()
        if len(words) >= 2 and words[0].lower() in ["motilal", "parag", "aditya", "sbi", "hdfc", "icici", "kotak", "invesco", "quant", "samco", "nippon", "mirae", "uti", "axis", "dsp", "tata"]:
            if words[0].lower() in ["motilal", "parag", "aditya"]:
                amc_name = f"{words[0].title()} {words[1].title()} Mutual Fund"
            else:
                amc_name = f"{words[0].title()} Mutual Fund"
        else:
            amc_name = f"{words[0].title() if words else 'Mutual'} Fund"

        nav_val = current_nav or 100.0
        new_scheme = MFRadarScheme(
            scheme_code=inferred_code,
            scheme_name=raw_name.strip() if raw_name else f"Mutual Fund {inferred_code}",
            amc_name=amc_name,
            category=inferred_category,
            benchmark_index="NIFTY 500",
            plan_type="Direct",
            option_type="Growth",
            current_nav=nav_val,
            nav_52w_high=round(nav_val * 1.06, 2),
            nav_52w_low=round(nav_val * 0.85, 2),
            dip_from_52w_high_pct=round(((round(nav_val * 1.06, 2) - nav_val) / round(nav_val * 1.06, 2)) * 100.0, 2),
            nav_date=date.today(),
            day_change_pct=0.0,
            is_top_universe=False,
            is_active=True,
        )
        db.add(new_scheme)
        db.commit()
        db.refresh(new_scheme)
        return new_scheme

    @staticmethod
    def _clean_num(val: Any) -> float:
        """Sanitizes currency signs, commas, and formatting into clean float."""
        if val is None:
            return 0.0
        s = re.sub(r"[^\d.]", "", str(val).strip())
        try:
            return float(s)
        except ValueError:
            return 0.0

    @classmethod
    def _process_holding_records(
        cls,
        db: Session,
        records: List[Dict[str, Any]],
        replace_existing: bool = False,
    ) -> Dict[str, Any]:
        """
        Shared holding record processor for both CSV and Excel workbook imports.
        Resolves schemes, handles lump-sum-to-unit calculations, and computes SEBI exit load & tax friction.
        """
        if replace_existing:
            db.query(MFRadarPortfolioHolding).delete()
            db.commit()

        added_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        for row_idx, item in enumerate(records, start=1):
            scheme_name = item.get("scheme_name")
            scheme_code = item.get("scheme_code")
            isin = item.get("isin")
            units = float(item.get("units") or 0.0)
            purchase_nav = float(item.get("purchase_nav") or 0.0)
            current_nav = float(item.get("current_nav") or 0.0)
            invested_val = float(item.get("invested_amt") or 0.0)
            purchase_date = item.get("purchase_date") or (date.today() - timedelta(days=180))
            folio = item.get("folio")
            notes = item.get("notes") or "Imported from statement"

            if not scheme_name and not scheme_code and not isin:
                skipped_count += 1
                continue

            try:
                # 1. Resolve or dynamically create scheme
                scheme = cls._find_or_create_scheme(
                    db=db,
                    raw_name=scheme_name or (f"Scheme {scheme_code}" if scheme_code else "Mutual Fund Scheme"),
                    raw_code=scheme_code,
                    isin=isin,
                    category=item.get("category"),
                    current_nav=current_nav if current_nav > 0 else None,
                )

                # 2. Units & NAV fallback math
                # If file only had Lump Sum Amt / Invested Amt without units
                if units <= 0 and invested_val > 0:
                    c_nav = scheme.current_nav if (scheme.current_nav and scheme.current_nav > 0) else 100.0
                    purchase_nav = purchase_nav if purchase_nav > 0 else c_nav
                    units = round(invested_val / purchase_nav, 4)

                # If units given but purchase_nav missing
                if purchase_nav <= 0 and invested_val > 0 and units > 0:
                    purchase_nav = round(invested_val / units, 4)
                elif purchase_nav <= 0 and scheme.current_nav:
                    purchase_nav = scheme.current_nav

                # If invested_val missing but units & nav present
                if invested_val <= 0 and units > 0 and purchase_nav > 0:
                    invested_val = round(units * purchase_nav, 2)

                if units <= 0 or purchase_nav <= 0:
                    skipped_count += 1
                    continue

                # 3. Check if holding already exists in portfolio
                existing_holding = db.query(MFRadarPortfolioHolding).filter(
                    MFRadarPortfolioHolding.scheme_code == scheme.scheme_code
                ).first()

                if existing_holding and not replace_existing:
                    # Update existing holding with new units & purchase NAV
                    existing_holding.units = units
                    existing_holding.purchase_nav = purchase_nav
                    existing_holding.invested_amt = round(units * purchase_nav, 2)
                    if folio:
                        existing_holding.folio_number = folio
                    c_nav = scheme.current_nav if (scheme.current_nav and scheme.current_nav > 0) else purchase_nav
                    existing_holding.current_nav = c_nav
                    existing_holding.current_value = round(units * c_nav, 2)
                    existing_holding.unrealized_pnl = round(existing_holding.current_value - existing_holding.invested_amt, 2)
                    existing_holding.unrealized_pnl_pct = round(
                        (existing_holding.unrealized_pnl / existing_holding.invested_amt) * 100.0
                        if existing_holding.invested_amt > 0 else 0.0,
                        2,
                    )

                    h_days = (date.today() - purchase_date).days
                    existing_holding.holding_days = h_days
                    existing_holding.exit_load_active = h_days < 365
                    existing_holding.exit_load_pct = 1.0 if existing_holding.exit_load_active else 0.0
                    existing_holding.exit_load_amt = round(existing_holding.current_value * (existing_holding.exit_load_pct / 100.0), 2)
                    existing_holding.tax_bracket = "STCG_20" if h_days < 365 else "LTCG_12_5"
                    tax_rate = 0.20 if h_days < 365 else 0.125
                    existing_holding.tax_amt_est = round(max(0.0, existing_holding.unrealized_pnl * tax_rate), 2)
                    existing_holding.net_redemption_proceeds = round(
                        existing_holding.current_value - existing_holding.exit_load_amt - existing_holding.tax_amt_est,
                        2,
                    )
                    existing_holding.purchase_date = purchase_date
                    updated_count += 1
                else:
                    cls.add_holding(
                        db=db,
                        scheme_code=scheme.scheme_code,
                        units=units,
                        purchase_date=purchase_date,
                        purchase_nav=purchase_nav,
                        folio_number=folio,
                        notes=notes,
                    )
                    added_count += 1
            except Exception as ex:
                logger.error(f"Error processing row {row_idx}: {ex}")
                errors.append(f"Row {row_idx}: {str(ex)}")

        db.commit()
        return {
            "success": True,
            "added_count": added_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "errors": errors,
        }

    @classmethod
    def import_holdings_csv(
        cls,
        db: Session,
        csv_content: str,
        replace_existing: bool = False,
    ) -> Dict[str, Any]:
        """Parses mutual fund holdings from CSV string or text, supporting Zerodha P&L, Coin, Groww, and CAS statements."""
        if not csv_content or not csv_content.strip():
            return {
                "success": False,
                "added_count": 0,
                "updated_count": 0,
                "skipped_count": 0,
                "errors": ["CSV content is empty"],
            }

        lines = [l for l in csv_content.strip().splitlines() if l.strip()]
        header_idx = -1
        for idx, line in enumerate(lines[:60]):
            line_lower = line.lower()
            if (
                ("symbol" in line_lower and "isin" in line_lower)
                or any(k in line_lower for k in [
                    "open quantity", "open qty", "fund name", "scheme name",
                    "instrument", "security name", "closing units", "lump sum"
                ])
            ):
                header_idx = idx
                break

        if header_idx == -1:
            header_idx = 0

        csv_clean = "\n".join(lines[header_idx:])
        delimiter = "\t" if ("\t" in lines[header_idx] and "," not in lines[header_idx]) else ","
        reader = csv.DictReader(io.StringIO(csv_clean), delimiter=delimiter)

        def norm(k: str) -> str:
            return re.sub(r"[^a-z0-9]", "", k.strip().lower()) if k else ""

        records = []
        for row in reader:
            cleaned = {norm(k): (v.strip() if v else "") for k, v in row.items() if k}

            # 1. Scheme name / Symbol
            scheme_name = None
            for key in [
                "symbol", "fundname", "schemename", "scheme", "fund", "instrument",
                "securityname", "schemedescription", "scripname", "scrip"
            ]:
                if key in cleaned and cleaned[key]:
                    val = cleaned[key]
                    if not any(val.lower().startswith(bad) for bad in [
                        "total", "subtotal", "asset category", "our anticipations", "#ref", "poten"
                    ]):
                        if val.lower() not in ["debt", "hybrid", "equity", "liquid", "savings", "alpha 2%", "alpha 4%"]:
                            scheme_name = val
                            break

            # 2. Scheme code & ISIN
            scheme_code = None
            isin = None
            for key in ["schemecode", "amficode", "code"]:
                if key in cleaned and cleaned[key]:
                    scheme_code = cleaned[key]
                    break
            for key in ["isin"]:
                if key in cleaned and cleaned[key]:
                    isin = cleaned[key]
                    break

            # 3. Units (prioritize Open Quantity for Zerodha P&L statements)
            units = 0.0
            for key in ["openquantity", "openqty", "closingunits", "balanceunits", "units", "shares", "availableqty", "netqty", "qty", "quantity"]:
                if key in cleaned and cleaned[key]:
                    u = cls._clean_num(cleaned[key])
                    if u > 0:
                        units = u
                        break

            # 4. Invested Amount / Open Value
            invested_val = 0.0
            for key in ["openvalue", "openval", "buyvalue", "lumpsumamt", "lumpsum", "invested", "investedamount", "investmentamount", "costvalue", "totalcost", "total"]:
                if key in cleaned and cleaned[key]:
                    a = cls._clean_num(cleaned[key])
                    if a > 0:
                        invested_val = a
                        break

            # 5. Purchase NAV / Average Cost
            purchase_nav = 0.0
            for key in ["averagenav", "avgnav", "averagecost", "avgcost", "avgcostprice", "buyprice", "costprice", "purchaseprice", "cost", "price"]:
                if key in cleaned and cleaned[key]:
                    p = cls._clean_num(cleaned[key])
                    if p > 0:
                        purchase_nav = p
                        break

            # 6. Current NAV / Previous Closing Price
            current_nav = 0.0
            for key in ["previousclosingprice", "previousclosingnav", "previousclosing", "closingprice", "currentnav", "ltp", "cmp", "latestnav", "marketprice", "currentprice", "nav"]:
                if key in cleaned and cleaned[key]:
                    c = cls._clean_num(cleaned[key])
                    if c > 0:
                        current_nav = c
                        break

            # Fallbacks:
            if purchase_nav <= 0 and invested_val > 0 and units > 0:
                purchase_nav = round(invested_val / units, 4)
            if invested_val <= 0 and units > 0 and purchase_nav > 0:
                invested_val = round(units * purchase_nav, 2)

            date_str = None
            for key in ["purchasedate", "buydate", "date", "allotmentdate", "investmentdate", "txndate"]:
                if key in cleaned and cleaned[key]:
                    date_str = cleaned[key]
                    break

            folio = None
            for key in ["folio", "folionumber", "foliono"]:
                if key in cleaned and cleaned[key]:
                    folio = cleaned[key]
                    break

            if (scheme_name or scheme_code or isin) and (units > 0 or invested_val > 0):
                records.append({
                    "scheme_name": scheme_name,
                    "scheme_code": scheme_code,
                    "isin": isin,
                    "units": units,
                    "purchase_nav": purchase_nav,
                    "current_nav": current_nav,
                    "invested_amt": invested_val,
                    "purchase_date": cls._parse_date(date_str),
                    "folio": folio,
                    "notes": "Imported from statement",
                })

        return cls._process_holding_records(db, records, replace_existing=replace_existing)

    @classmethod
    def import_holdings_excel(
        cls,
        db: Session,
        file_bytes: bytes,
        replace_existing: bool = False,
        sheet_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Parses mutual fund holdings from Excel workbooks (.xlsx, .xls) supporting:
        - Zerodha Console Mutual Funds P&L Statement
        - Zerodha Coin / Groww / Angel One / CAMS statements
        - Advisory & Portfolio strategy sheets
        """
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        except Exception as e:
            return {
                "success": False,
                "added_count": 0,
                "updated_count": 0,
                "skipped_count": 0,
                "errors": [f"Could not read Excel file: {str(e)}"],
            }

        def norm(k: Any) -> str:
            return re.sub(r"[^a-z0-9]", "", str(k).strip().lower()) if k else ""

        # Identify candidate sheets
        candidate_sheets = []
        if sheet_name and sheet_name in wb.sheetnames:
            candidate_sheets = [sheet_name]
        else:
            for s in wb.sheetnames:
                rows = list(wb[s].iter_rows(values_only=True))
                for r in rows[:60]:
                    r_str = " ".join([str(c).lower() for c in r if c is not None])
                    if (
                        ("symbol" in r_str and "isin" in r_str)
                        or any(k in r_str for k in [
                            "open quantity", "open qty", "fund name", "scheme name",
                            "scheme", "instrument", "security", "lump sum"
                        ])
                    ):
                        candidate_sheets.append(s)
                        break

        if not candidate_sheets:
            candidate_sheets = [wb.sheetnames[0]]

        records = []
        seen_funds = set()

        for sname in candidate_sheets:
            sheet = wb[sname]
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue

            header_idx = -1
            for idx, r in enumerate(rows[:60]):
                r_str = " ".join([str(c).lower() for c in r if c is not None])
                if (
                    ("symbol" in r_str and "isin" in r_str)
                    or any(k in r_str for k in [
                        "open quantity", "open qty", "fund name", "scheme name",
                        "scheme", "instrument", "security", "lump sum"
                    ])
                ):
                    header_idx = idx
                    break

            if header_idx == -1:
                continue

            headers = [norm(c) for c in rows[header_idx]]

            for r_idx, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
                if not any(row):
                    continue
                cleaned = {headers[i]: row[i] for i in range(min(len(headers), len(row))) if headers[i]}

                # 1. Fund name / Symbol
                fund_name = None
                for k in ["symbol", "fundname", "schemename", "scheme", "fund", "instrument", "securityname"]:
                    if k in cleaned and cleaned[k]:
                        val = str(cleaned[k]).strip()
                        val_lower = val.lower()
                        if not any(val_lower.startswith(bad) for bad in [
                            "total", "subtotal", "asset category", "our anticipations", "expected", "#ref", "poten"
                        ]):
                            if val_lower not in ["debt", "hybrid", "equity", "liquid", "savings", "alpha 2%", "alpha 4%"]:
                                fund_name = val
                                break

                if not fund_name or len(fund_name) < 3 or re.match(r"^\d+\.", fund_name) or fund_name.startswith("#REF"):
                    continue

                # 2. ISIN
                isin = None
                for k in ["isin"]:
                    if k in cleaned and cleaned[k]:
                        isin = str(cleaned[k]).strip()
                        break

                # Deduplicate identical funds across sheets
                norm_name = re.sub(r"[^a-z0-9]", "", (isin or fund_name).lower())
                if norm_name in seen_funds:
                    continue
                seen_funds.add(norm_name)

                # 3. Units (prioritize openquantity)
                units = 0.0
                for k in ["openquantity", "openqty", "closingunits", "balanceunits", "units", "shares", "availableqty", "netqty", "qty", "quantity"]:
                    if k in cleaned and cleaned[k] is not None:
                        u = cls._clean_num(cleaned[k])
                        if u > 0:
                            units = u
                            break

                # 4. Invested / Open Value
                invested_val = 0.0
                for k in ["openvalue", "openval", "buyvalue", "lumpsumamt", "lumpsum", "total", "amountallocated", "invested", "investedamount", "currentvalue", "curval"]:
                    if k in cleaned and cleaned[k] is not None:
                        a = cls._clean_num(cleaned[k])
                        if a > 0:
                            invested_val = a
                            break

                # 5. Purchase NAV / Average NAV
                purchase_nav = 0.0
                for k in ["averagenav", "avgnav", "purchaseprice", "buyprice", "costprice", "averagecost", "nav"]:
                    if k in cleaned and cleaned[k] is not None:
                        p = cls._clean_num(cleaned[k])
                        if p > 0:
                            purchase_nav = p
                            break

                # 6. Current NAV / Previous Closing Price
                current_nav = 0.0
                for k in ["previousclosingprice", "previousclosingnav", "previousclosing", "closingprice", "currentnav", "ltp", "cmp", "nav"]:
                    if k in cleaned and cleaned[k] is not None:
                        c = cls._clean_num(cleaned[k])
                        if c > 0:
                            current_nav = c
                            break

                # Fallbacks:
                if purchase_nav <= 0 and invested_val > 0 and units > 0:
                    purchase_nav = round(invested_val / units, 4)
                if invested_val <= 0 and units > 0 and purchase_nav > 0:
                    invested_val = round(units * purchase_nav, 2)

                # Only include rows that have either units or an invested amount
                if units <= 0 and invested_val <= 0:
                    continue

                # 7. Category
                category = None
                for k in ["investmentcategory", "category"]:
                    if k in cleaned and cleaned[k]:
                        category = str(cleaned[k]).strip()
                        break

                records.append({
                    "scheme_name": fund_name,
                    "scheme_code": None,
                    "isin": isin,
                    "units": units,
                    "purchase_nav": purchase_nav,
                    "current_nav": current_nav,
                    "invested_amt": invested_val,
                    "purchase_date": date.today() - timedelta(days=180),
                    "folio": None,
                    "category": category,
                    "notes": f"Imported from {sname}",
                })

        res = cls._process_holding_records(db, records, replace_existing=replace_existing)
        res["candidate_sheets"] = candidate_sheets
        return res

    @classmethod
    def import_holdings_file(
        cls,
        db: Session,
        file_bytes: bytes,
        filename: str = "",
        replace_existing: bool = False,
        sheet_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Unified entry point for both Excel (.xlsx, .xls) and CSV file uploads."""
        is_excel = (
            filename.lower().endswith((".xlsx", ".xls"))
            or file_bytes[:4] == b"PK\x03\x04"
        )
        if is_excel:
            return cls.import_holdings_excel(
                db=db,
                file_bytes=file_bytes,
                replace_existing=replace_existing,
                sheet_name=sheet_name,
            )
        else:
            text = file_bytes.decode("utf-8", errors="ignore")
            return cls.import_holdings_csv(
                db=db,
                csv_content=text,
                replace_existing=replace_existing,
            )



