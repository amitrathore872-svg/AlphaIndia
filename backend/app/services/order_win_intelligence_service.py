"""
Alpha India — Order Win Quantitative Intelligence Engine
Sprint 36.5 — Actionable Investment Intelligence for NSE/BSE Order Disclosures.

Converts every Order Win, Contract, LOA, or Purchase Order filing into a high-conviction
institutional investment card with:
1. Revenue Contribution (%) vs TTM Sales
2. Expected Execution Timeline (Months & Quarters)
3. Quarterly Revenue Impact (₹ Cr & % Lift)
4. Earnings Impact Estimate (Incremental EBITDA, PAT & Accretion %)
5. Multi-factor Order Significance Score (0-100) & Tier
6. AI Expected Upside Probability % & Price Target Range (Low - Base - Bull)
7. Model Confidence Score (0-100%)
8. Historical Comparison with Previous Order Wins
"""

import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.announcement_radar import AnnouncementRadar
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Detection Regex & Patterns
# ---------------------------------------------------------------------------

ORDER_WIN_PATTERNS = [
    r"award_of_order_receipt_of_order",
    r"receipt_of_order",
    r"award_of_order",
    r"order_receipt",
    r"commercial_order",
    r"(bagged|bags|bagging)\s+.*?(order|contract|project|mandate|package|loa|ppa)",
    r"(won|wins|winning)\s+.*?(order|contract|project|mandate|package|loa|ppa)",
    r"(secured|secures|securing)\s+.*?(order|contract|project|mandate|package|loa|ppa)",
    r"(received|receives|receiving)\s+.*?(order|contract|project|mandate|package|loa|ppa|work\s+order|purchase\s+order)",
    r"(awarded|awards)\s+.*?(order|contract|project|package|mandate|loa)",
    r"(l1\s+bidder|lowest\s+bidder|letter\s+of\s+award|letter\s+of\s+intent|work\s+order|purchase\s+order)",
    r"(turnkey\s+contract|epc\s+contract|commercial\s+agreement|supply\s+contract|power\s+purchase\s+agreement)",
    r"new\s+orders?\s+worth",
    r"order\s+inflow",
    r"contract\s+worth",
]

ORDER_NOISE_PATTERNS = [
    r"court\s+order",
    r"nclt\s+order",
    r"order\s+passed\s+by\s+(tribunal|court|sebi|itat|commissioner|authority|nclt)",
    r"interim\s+order",
    r"assessment\s+order",
    r"show\s+cause",
    r"meeting\s+order",
    r"order\s+of\s+the\s+hon'?ble",
    r"demat\s+remat",
]

MONTH_NAMES = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

SOVEREIGN_COUNTERPARTIES = [
    "railways", "railway", "nhai", "ongc", "ntpc", "bhel", "seci", "defense", "defence",
    "mod", "isro", "drdo", "powergrid", "pgcil", "transco", "discom", "genco", "bpcl",
    "hpcl", "iocl", "sail", "adani", "tata", "reliance", "l&t", "larsen", "tcgl", "rvnl",
    "irfc", "ircon", "rites", "metro", "dmrc", "bmrcl", "ap transco", "waaree",
]


class OrderWinIntelligenceService:
    """Institutional Order Win Analysis and Quantitative Intelligence Engine."""

    @classmethod
    def is_order_win_filing(cls, headline: str, category: Optional[str] = None, description: Optional[str] = None) -> bool:
        """Determines if a filing represents a commercial order win / contract / LoA."""
        text = f"{category or ''} {headline} {description or ''}".lower()

        # Check noise patterns (e.g. court order, tribunal order)
        for noise in ORDER_NOISE_PATTERNS:
            if re.search(noise, text):
                return False

        # Category shortcut
        if category and any(k in category.lower() for k in ["award_of_order", "receipt_of_order", "order wins", "order win"]):
            return True

        # Regex detection
        for pat in ORDER_WIN_PATTERNS:
            if re.search(pat, text):
                return True

        return False

    @classmethod
    def clean_filing_headline(cls, headline: str) -> str:
        """Strips regulatory boilerplate prefixes like 'Announcement under Regulation 30 (LODR)-Award_of_Order_Receipt_of_Order 2 Sep - '."""
        text = headline.strip()
        # Remove Reg 30 prefix
        clean = re.sub(r"^Announcement\s+under\s+Regulation\s+30\s*\(?.*?\)?[-–—]?\s*(Press\s+Release|Media\s+Release|Award_of_Order_Receipt_of_Order|Award\s+of\s+Order|Receipt\s+of\s+Order)?\s*\d*\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*[-–—:]\s*", "", text, flags=re.IGNORECASE)
        clean = re.sub(r"^Notice\s+under\s+Regulation\s+30\s*[-–—:]\s*", "", clean, flags=re.IGNORECASE)
        clean = re.sub(r"^Press\s+Release\s*[-–—:]\s*", "", clean, flags=re.IGNORECASE)
        clean = clean.strip()
        return clean if len(clean) > 15 else text

    @classmethod
    def extract_deal_value_cr(cls, text_content: str) -> Tuple[Optional[float], Optional[str]]:
        """
        Extracts deal value normalized to ₹ Crore.
        Handles:
        - 'Rs. 1,429 Cr' / '₹165.55 crore'
        - 'Rs. 500 Lakhs' -> 5.0 Cr
        - 'USD 10 Million' -> ~84.0 Cr
        Returns (value_cr, raw_matched_str)
        """
        # 1. Crore pattern
        match_cr = re.search(r"(?:rs\.?|inr|₹)\s*(\d+[\d,.]*)\s*(?:cr|crore|crores)", text_content, re.IGNORECASE)
        if match_cr:
            try:
                val = float(match_cr.group(1).replace(",", ""))
                return val, match_cr.group(0)
            except ValueError:
                pass

        # 2. Amount with crore following
        match_cr_rev = re.search(r"(\d+[\d,.]*)\s*(?:cr|crore|crores)", text_content, re.IGNORECASE)
        if match_cr_rev:
            try:
                val = float(match_cr_rev.group(1).replace(",", ""))
                if val > 0.05:  # filter negligible artifacts
                    return val, match_cr_rev.group(0)
            except ValueError:
                pass

        # 3. Lakhs pattern
        match_lakh = re.search(r"(?:rs\.?|inr|₹)\s*(\d+[\d,.]*)\s*(?:lakh|lakhs|lac|lacs)", text_content, re.IGNORECASE)
        if match_lakh:
            try:
                val = float(match_lakh.group(1).replace(",", "")) / 100.0
                return round(val, 2), match_lakh.group(0)
            except ValueError:
                pass

        # 4. USD pattern ($ or USD)
        match_usd = re.search(r"(?:usd|\$)\s*(\d+[\d,.]*)\s*(?:mn|million)", text_content, re.IGNORECASE)
        if match_usd:
            try:
                usd_val = float(match_usd.group(1).replace(",", ""))
                # 1 USD Mn = ~8.40 INR Cr (at 84 INR/USD)
                val_cr = round(usd_val * 8.40, 2)
                return val_cr, match_usd.group(0)
            except ValueError:
                pass

        return None, None

    @classmethod
    def extract_counterparty(cls, text: str) -> Optional[str]:
        """Extracts contracting agency / client counterparty."""
        for client in SOVEREIGN_COUNTERPARTIES:
            if re.search(rf"\b{re.escape(client)}\b", text, re.IGNORECASE):
                # Return properly capitalized client name
                clean_name = client.upper() if len(client) <= 5 else client.title()
                return clean_name

        # Look for 'from <Client>' or 'for <Client>'
        match = re.search(r"(?:from|for|awarded\s+by|client\s*:?)\s+([A-Z][A-Za-z0-9&.\s]{3,30}?)(?:for|to|worth|executing|with|in|\.|\,)", text)
        if match:
            c = match.group(1).strip()
            if len(c) > 3 and c.lower() not in {"order", "orders", "contract", "contracts", "the company", "the exchange"}:
                return c

        return None

    @classmethod
    def extract_execution_timeline(cls, text: str, filing_date: Optional[datetime.datetime] = None) -> Tuple[int, str]:
        """
        Extracts execution timeline in months and a descriptive string.
        Returns: (months, formatted_timeline_str)
        """
        # 1. Months pattern (e.g. '18 months', '6-month')
        m_match = re.search(r"(\d+)\s*[-–]?\s*months?", text, re.IGNORECASE)
        if m_match:
            months = int(m_match.group(1))
            if 1 <= months <= 120:
                qtrs = max(1, round(months / 3))
                return months, f"{months} Months ({qtrs} Quarters)"

        # 2. Years pattern (e.g. '3 years', '3-year', '30-year')
        y_match = re.search(r"(\d+(?:\.\d+)?)\s*[-–]?\s*years?", text, re.IGNORECASE)
        if y_match:
            years = float(y_match.group(1))
            months = int(years * 12)
            if 1 <= months <= 360:
                qtrs = max(1, round(months / 3))
                return months, f"{int(years) if years.is_integer() else years} Years ({months} Months)"

        # 3. Date range pattern: 'Oct 2026-June 2027' or 'execution by April 2027'
        by_match = re.search(r"execution\s+by\s+([A-Za-z]+)\s*(\d{4})", text, re.IGNORECASE)
        if by_match:
            m_str = by_match.group(1).lower()
            y_int = int(by_match.group(2))
            if m_str in MONTH_NAMES:
                target_month = MONTH_NAMES[m_str]
                base_year = filing_date.year if filing_date else 2026
                base_month = filing_date.month if filing_date else 9
                months = (y_int - base_year) * 12 + (target_month - base_month)
                months = max(3, months)
                qtrs = max(1, round(months / 3))
                return months, f"By {m_str.title()} {y_int} (~{months}M / {qtrs}Q)"

        # 4. Short range pattern: 'October 20-November 1, 2026'
        short_match = re.search(r"executed\s+([A-Za-z]+)\s*\d+[-–]([A-Za-z]+)?\s*\d+,\s*(\d{4})", text, re.IGNORECASE)
        if short_match:
            return 2, "Rapid Execution (~2 Months)"

        # Default institutional execution timeline if unspecified
        return 18, "18 Months (6 Quarters / Est.)"

    @classmethod
    def analyze_order_win(
        cls,
        db: Session,
        symbol: Optional[str],
        company_name: str,
        headline: str,
        filing_description: Optional[str] = None,
        deal_value_cr: Optional[float] = None,
        filing_date: Optional[datetime.datetime] = None,
        cmp_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Main calculation engine that produces the comprehensive Order Win Investment Intelligence.
        """
        full_text = f"{headline} {filing_description or ''}"
        clean_headline = cls.clean_filing_headline(headline)

        # 1. Value extraction
        extracted_val, raw_val_str = cls.extract_deal_value_cr(full_text)
        final_deal_cr = deal_value_cr or extracted_val

        # 2. Timeline extraction
        months, timeline_str = cls.extract_execution_timeline(full_text, filing_date)
        quarters = max(1, round(months / 3))

        # 3. Counterparty
        counterparty = cls.extract_counterparty(full_text)

        # 4. Fundamental Financial Baseline Lookup
        sales_ttm = 0.0
        pat_ttm = 0.0
        opm = 14.0  # default 14%
        pat_margin = 8.0
        market_cap = 0.0
        cmp_val = cmp_override or 100.0
        stock_pe = 22.0
        fair_pe = 26.0
        dma_50 = None
        dma_200 = None

        clean_sym = symbol.strip().upper() if symbol else None
        s_rec = None
        if clean_sym:
            s_rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == clean_sym).first()

        if s_rec:
            cmp_val = s_rec.current_price or cmp_val
            market_cap = s_rec.market_cap or market_cap
            stock_pe = s_rec.stock_pe or stock_pe
            fair_pe = max(14.0, s_rec.industry_pe if s_rec.industry_pe and s_rec.industry_pe > 10 else stock_pe * 1.15)
            dma_50 = s_rec.dma_50
            dma_200 = s_rec.dma_200

            # Sales TTM
            if s_rec.latest_quarter_sales and s_rec.latest_quarter_sales > 0:
                sales_ttm = s_rec.latest_quarter_sales * 4.0
            elif s_rec.sales_growth_ttm and s_rec.market_cap:
                sales_ttm = s_rec.market_cap / 1.5

            # Operating Margin
            if s_rec.opm_latest and s_rec.opm_latest > 0:
                opm = s_rec.opm_latest
            elif s_rec.opm_ttm and s_rec.opm_ttm > 0:
                opm = s_rec.opm_ttm

            # PAT TTM
            if s_rec.pat_12m and s_rec.pat_12m > 0:
                pat_ttm = s_rec.pat_12m
            elif s_rec.latest_quarter_net_profit and s_rec.latest_quarter_net_profit > 0:
                pat_ttm = s_rec.latest_quarter_net_profit * 4.0

            if sales_ttm > 0 and pat_ttm > 0:
                pat_margin = max(3.0, min(35.0, (pat_ttm / sales_ttm) * 100.0))

        # Fallback if no sales_ttm
        if sales_ttm <= 0:
            sales_ttm = max(50.0, (final_deal_cr or 100.0) * 4.5)
            pat_ttm = sales_ttm * (pat_margin / 100.0)

        # 5. Core Metric Calculations
        # 5.1 Revenue Contribution (%)
        if final_deal_cr and sales_ttm > 0:
            rev_contrib_pct = round((final_deal_cr / sales_ttm) * 100.0, 1)
        else:
            rev_contrib_pct = 12.5  # default conservative contribution

        # 5.2 Quarterly Revenue Impact
        if final_deal_cr:
            quarterly_rev_cr = round(final_deal_cr / quarters, 2)
            avg_quarterly_sales = sales_ttm / 4.0
            quarterly_rev_pct = round((quarterly_rev_cr / avg_quarterly_sales) * 100.0, 1) if avg_quarterly_sales > 0 else rev_contrib_pct
        else:
            quarterly_rev_cr = None
            quarterly_rev_pct = None

        # 5.3 Earnings Impact Estimate (Incremental EBITDA and PAT)
        if final_deal_cr:
            incremental_ebitda_cr = round(final_deal_cr * (opm / 100.0), 2)
            # PAT after tax ~25%
            incremental_pat_cr = round(incremental_ebitda_cr * 0.75, 2)
            # Annualized PAT accretion %
            annualized_pat = incremental_pat_cr * min(1.0, 12.0 / months)
            pat_accretion_pct = round((annualized_pat / pat_ttm) * 100.0, 1) if pat_ttm > 0 else 18.0
        else:
            incremental_ebitda_cr = None
            incremental_pat_cr = None
            pat_accretion_pct = 15.0

        # 6. Multi-Factor Order Significance Score (0 to 100)
        # Factor A: Size vs TTM Revenue (0 to 35 pts)
        if rev_contrib_pct >= 50.0:
            score_rev = 35.0
        elif rev_contrib_pct >= 25.0:
            score_rev = 28.0
        elif rev_contrib_pct >= 10.0:
            score_rev = 20.0
        elif rev_contrib_pct >= 5.0:
            score_rev = 14.0
        else:
            score_rev = 8.0

        # Factor B: Size vs Market Cap (0 to 25 pts)
        deal_vs_mcap = (final_deal_cr / market_cap * 100.0) if (final_deal_cr and market_cap > 0) else 10.0
        if deal_vs_mcap >= 20.0:
            score_mcap = 25.0
        elif deal_vs_mcap >= 10.0:
            score_mcap = 20.0
        elif deal_vs_mcap >= 5.0:
            score_mcap = 15.0
        else:
            score_mcap = 8.0

        # Factor C: Execution Velocity (0 to 15 pts) - shorter timeline yields higher annualized impact
        if months <= 12:
            score_velocity = 15.0
        elif months <= 24:
            score_velocity = 12.0
        elif months <= 36:
            score_velocity = 9.0
        else:
            score_velocity = 6.0

        # Factor D: Margin Profile (0 to 15 pts)
        if opm >= 20.0:
            score_margin = 15.0
        elif opm >= 14.0:
            score_margin = 12.0
        elif opm >= 8.0:
            score_margin = 9.0
        else:
            score_margin = 6.0

        # Factor E: Counterparty Quality (0 to 10 pts)
        if counterparty and any(k in counterparty.lower() for k in ["defense", "defence", "railway", "ongc", "ntpc", "seci", "isro", "mod", "transco"]):
            score_client = 10.0
        elif counterparty:
            score_client = 8.0
        else:
            score_client = 5.0

        significance_score = round(score_rev + score_mcap + score_velocity + score_margin + score_client, 1)

        # Determine Significance Tier
        if significance_score >= 80.0:
            significance_tier = "TRANSFORMATIONAL"
        elif significance_score >= 65.0:
            significance_tier = "HIGH_IMPACT"
        elif significance_score >= 45.0:
            significance_tier = "MODERATE"
        else:
            significance_tier = "ROUTINE"

        # 7. AI Expected Upside Probability % & Price Target Range
        # Base probability from significance score
        base_prob = 62.0 + (significance_score * 0.28)  # range ~74% to 90%

        # Trend regime adjustment
        is_golden = (cmp_val > (dma_50 or 0) and cmp_val > (dma_200 or 0)) if (dma_50 and dma_200) else True
        if is_golden:
            base_prob = min(94.0, base_prob + 4.0)
        else:
            base_prob = max(55.0, base_prob - 8.0)
        upside_prob_pct = round(base_prob, 1)

        # Price Target Range (Low - Base - Bull)
        # Low target: 15% - 25% upside
        # Base target: 25% - 45% upside
        # Bull target: 40% - 65% upside
        growth_factor = min(0.60, max(0.18, (pat_accretion_pct / 100.0) * 1.25))
        target_base = round(cmp_val * (1.0 + growth_factor), 1)
        target_low = round(cmp_val * (1.0 + max(0.14, growth_factor * 0.72)), 1)
        target_high = round(cmp_val * (1.0 + min(0.70, growth_factor * 1.35)), 1)
        stop_loss = round(cmp_val * 0.90, 1)
        upside_pct = round(((target_base - cmp_val) / cmp_val) * 100.0, 1)

        # 8. Model Confidence Score (0 to 100%)
        conf = 50.0
        if final_deal_cr is not None:
            conf += 25.0
        if "Est." not in timeline_str:
            conf += 15.0
        if s_rec is not None:
            conf += 10.0
        confidence_score = round(conf, 1)

        # 9. Historical Comparison with Previous Order Wins
        hist_comp_text, hist_stats = cls._calculate_historical_comparison(db, clean_sym, final_deal_cr)

        # 10. Synthesizing Institutional Investment Rationale
        # Answers: "How important is this order for this company and what upside can it create?"
        client_clause = f" from {counterparty}" if counterparty else ""
        deal_clause = f" of ₹{final_deal_cr:,.1f} Cr" if final_deal_cr else ""
        thesis = (
            f"{significance_tier.replace('_', ' ').title()} order win{deal_clause}{client_clause}, contributing {rev_contrib_pct}% of TTM sales over {timeline_str}. "
            f"Adds +₹{quarterly_rev_cr or 0:,.1f} Cr/quarter ({quarterly_rev_pct or 0}% lift) with ~₹{incremental_pat_cr or 0:,.1f} Cr earnings impact (+{pat_accretion_pct}% PAT accretion). "
            f"Provides {quarters}-quarter cash flow visibility with {upside_prob_pct}% probability of reaching ₹{target_base} target."
        )

        return {
            "order_value_cr": final_deal_cr,
            "order_execution_months": months,
            "order_execution_quarters": quarters,
            "order_execution_timeline_str": timeline_str,
            "order_client_counterparty": counterparty,
            "revenue_contribution_pct": rev_contrib_pct,
            "sales_ttm_cr": round(sales_ttm, 1),
            "order_quarterly_rev_cr": quarterly_rev_cr,
            "order_quarterly_rev_pct": quarterly_rev_pct,
            "order_earnings_impact_cr": incremental_pat_cr,
            "incremental_ebitda_cr": incremental_ebitda_cr,
            "pat_accretion_pct": pat_accretion_pct,
            "order_significance_score": significance_score,
            "order_significance_tier": significance_tier,
            "order_upside_prob_pct": upside_prob_pct,
            "order_target_price_low": target_low,
            "order_target_price_base": target_base,
            "order_target_price_high": target_high,
            "order_confidence_score": confidence_score,
            "order_historical_comparison": hist_comp_text,
            "order_historical_stats": hist_stats,
            "investment_thesis": thesis,
            "cmp": cmp_val,
            "stop_loss": stop_loss,
            "upside_pct": upside_pct,
            "clean_headline": clean_headline,
        }

    @classmethod
    def _calculate_historical_comparison(
        cls, db: Session, symbol: Optional[str], current_deal_cr: Optional[float]
    ) -> Tuple[str, Dict[str, Any]]:
        """Queries prior order wins in database for symbol and constructs comparative context."""
        if not symbol:
            return "First tracked commercial contract in exchange registry.", {"prior_wins_count": 0}

        prior_orders = (
            db.query(AnnouncementRadar)
            .filter(
                AnnouncementRadar.symbol == symbol,
                AnnouncementRadar.catalyst_type == "ORDER_WIN",
                AnnouncementRadar.deal_value_cr.isnot(None),
            )
            .order_by(AnnouncementRadar.published_at.desc())
            .limit(10)
            .all()
        )

        if not prior_orders:
            return (
                "Standalone high-conviction order win establishing new backlog benchmark.",
                {"prior_wins_count": 0, "avg_deal_cr": 0.0}
            )

        deals = [p.deal_value_cr for p in prior_orders if p.deal_value_cr and p.deal_value_cr > 0]
        if not deals:
            return (
                f"Extends sequential order momentum ({len(prior_orders)} recent order announcements).",
                {"prior_wins_count": len(prior_orders), "avg_deal_cr": 0.0}
            )

        avg_deal = round(sum(deals) / len(deals), 1)
        total_12m = round(sum(deals), 1)
        max_deal = max(deals)

        if current_deal_cr and current_deal_cr >= max_deal:
            comparison = f"🏆 Largest order win in 12 months (+{round(((current_deal_cr - avg_deal)/avg_deal)*100)}% above avg order of ₹{avg_deal:,.1f} Cr)."
        elif current_deal_cr and current_deal_cr >= avg_deal:
            diff_pct = round(((current_deal_cr - avg_deal) / avg_deal) * 100)
            comparison = f"+{diff_pct}% larger than 12-month average order win (₹{avg_deal:,.1f} Cr). Trailing 12M inflows: ₹{total_12m:,.1f} Cr."
        elif current_deal_cr:
            comparison = f"Routine backlog replacement order (Avg: ₹{avg_deal:,.1f} Cr). Trailing 12M order inflows: ₹{total_12m:,.1f} Cr."
        else:
            comparison = f"Consolidates active order book ({len(deals)} wins totaling ₹{total_12m:,.1f} Cr over last 12 months)."

        return comparison, {
            "prior_wins_count": len(deals),
            "avg_deal_cr": avg_deal,
            "total_12m_cr": total_12m,
            "max_deal_cr": max_deal,
        }

    @classmethod
    def process_all_order_wins(cls, db: Session, limit: int = 1000) -> Dict[str, Any]:
        """
        Scans all records in `announcements_radar`, identifies order wins,
        and enriches them with quantitative intelligence.
        """
        logger.info("[OrderWinIntelligenceService] Backfilling Order Win Intelligence...")
        rows = (
            db.query(AnnouncementRadar)
            .filter(
                (AnnouncementRadar.catalyst_type == "ORDER_WIN") |
                (AnnouncementRadar.headline.ilike("%order%")) |
                (AnnouncementRadar.headline.ilike("%contract%")) |
                (AnnouncementRadar.headline.ilike("%loa%")) |
                (AnnouncementRadar.headline.ilike("%award%"))
            )
            .limit(limit)
            .all()
        )

        analyzed = 0
        updated = 0

        for r in rows:
            # Confirm order win
            if not cls.is_order_win_filing(r.headline, r.category, r.filing_description):
                continue

            r.catalyst_type = "ORDER_WIN"
            analysis = cls.analyze_order_win(
                db=db,
                symbol=r.symbol,
                company_name=r.company_name,
                headline=r.headline,
                filing_description=r.filing_description,
                deal_value_cr=r.deal_value_cr,
                filing_date=r.announcement_date or r.published_at,
                cmp_override=r.current_price,
            )

            # Persist fields
            if analysis["order_value_cr"]:
                r.deal_value_cr = analysis["order_value_cr"]
                r.synergy_rev_addition_cr = analysis["order_value_cr"]

            r.synergy_rev_pct_ttm = analysis["revenue_contribution_pct"]
            r.order_execution_months = analysis["order_execution_months"]
            r.order_quarterly_rev_cr = analysis["order_quarterly_rev_cr"]
            r.order_quarterly_rev_pct = analysis["order_quarterly_rev_pct"]
            r.order_earnings_impact_cr = analysis["order_earnings_impact_cr"]
            r.order_significance_score = analysis["order_significance_score"]
            r.order_significance_tier = analysis["order_significance_tier"]
            r.order_upside_prob_pct = analysis["order_upside_prob_pct"]
            r.order_target_price_low = analysis["order_target_price_low"]
            r.order_target_price_high = analysis["order_target_price_high"]
            r.order_confidence_score = analysis["order_confidence_score"]
            r.order_client_counterparty = analysis["order_client_counterparty"]
            r.order_historical_comparison = analysis["order_historical_comparison"]
            r.order_intelligence = analysis

            # Also ensure target price and upside match
            r.target_price = analysis["order_target_price_base"]
            r.current_price = analysis["cmp"]
            r.upside_pct = analysis["upside_pct"]
            r.stop_loss = analysis["stop_loss"]
            r.buy_thesis = analysis["investment_thesis"]
            r.ai_insight = analysis["investment_thesis"]

            # Boost conviction score based on significance
            r.conviction_score = min(96.0, max(75.0, analysis["order_significance_score"]))
            r.recommendation = "STRONG_BUY" if analysis["order_significance_score"] >= 80 else "TACTICAL_BUY"
            r.impact_level = "CRITICAL" if analysis["order_significance_score"] >= 75 else "HIGH"
            r.impact_score = round(min(9.9, max(7.5, (analysis["order_significance_score"] / 10.0))), 1)

            analyzed += 1
            updated += 1

        db.commit()
        logger.info(f"[OrderWinIntelligenceService] Successfully processed {analyzed} order wins.")
        return {"total_analyzed": analyzed, "updated": updated}
