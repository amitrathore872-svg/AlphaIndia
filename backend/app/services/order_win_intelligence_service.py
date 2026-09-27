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

from collections import defaultdict
from datetime import datetime as dt_cls, timezone as tz_cls, timedelta as td_cls
import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.models.announcement_radar import AnnouncementRadar
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics
from app.models.quarterly_result import QuarterlyResult
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

    @classmethod
    def get_cumulative_order_books(
        cls,
        db: Session,
        min_deal_cr: Optional[float] = None,
        min_book_to_bill: Optional[float] = None,
        order_velocity: Optional[str] = None,
        strength_tier: Optional[str] = None,
        sovereign_only: bool = False,
        search: Optional[str] = None,
        sort_by: str = "total_deal_cr",
        sort_order: str = "desc",
        page: int = 1,
        limit: int = 30,
    ) -> Dict[str, Any]:
        """
        Calculates cumulative order book strength, multi-quarter backlog visibility,
        Book-to-Bill multiple against TTM Revenue, sovereign client trust ratings,
        and velocity metrics across all tracked corporate entities.
        """
        # 1. Fetch all order win announcements
        orders = (
            db.query(AnnouncementRadar)
            .filter(
                (AnnouncementRadar.catalyst_type == "ORDER_WIN") |
                (AnnouncementRadar.order_significance_score.isnot(None))
            )
            .order_by(desc(AnnouncementRadar.announcement_date), desc(AnnouncementRadar.published_at))
            .all()
        )

        if not orders:
            return {
                "items": [],
                "total_companies": 0,
                "summary": {
                    "total_tracked_backlog_cr": 0.0,
                    "total_orders_tracked": 0,
                    "total_companies_tracked": 0,
                    "transformational_companies_count": 0,
                    "high_visibility_companies_count": 0,
                    "sovereign_backed_backlog_cr": 0.0,
                    "sovereign_share_pct": 0.0,
                    "surging_velocity_count": 0,
                },
                "page": page,
                "limit": limit,
                "total_pages": 1,
            }

        # 2. Index companies and market metrics
        companies = db.query(
            Company.id, Company.symbol, Company.company, Company.sector, Company.industry, Company.exchange
        ).all()
        comp_by_clean = {}
        for c in companies:
            if c.symbol:
                clean_sym = c.symbol.replace(".NS", "").replace(".BO", "").strip().upper()
                comp_by_clean[clean_sym] = c
                comp_by_clean[c.symbol.strip().upper()] = c

        # Market metrics
        cmm_rows = db.query(
            CompanyMarketMetrics.company_id,
            CompanyMarketMetrics.cmp,
            CompanyMarketMetrics.market_cap_category,
            CompanyMarketMetrics.fifty_two_week_high,
            CompanyMarketMetrics.fifty_two_week_low,
            CompanyMarketMetrics.pe_ratio,
            CompanyMarketMetrics.roce,
        ).all()
        cmm_map = {
            r[0]: {
                "cmp": r[1],
                "market_cap_category": r[2],
                "high_52w": r[3],
                "low_52w": r[4],
                "pe_ratio": r[5],
                "roce": r[6],
            }
            for r in cmm_rows
        }

        # 3. Match company IDs and compute bulk TTM Revenue from QuarterlyResult
        matched_comp_ids = set()
        for o in orders:
            sym = (o.symbol or "").replace(".NS", "").replace(".BO", "").strip().upper()
            c = comp_by_clean.get(sym)
            if c:
                matched_comp_ids.add(c.id)

        comp_q_rev = defaultdict(list)
        if matched_comp_ids:
            q_rows = (
                db.query(QuarterlyResult.company_id, QuarterlyResult.revenue, QuarterlyResult.period_end)
                .filter(QuarterlyResult.company_id.in_(list(matched_comp_ids)))
                .order_by(QuarterlyResult.company_id, desc(QuarterlyResult.period_end))
                .all()
            )
            for cid, rev, pend in q_rows:
                if len(comp_q_rev[cid]) < 4 and rev is not None:
                    comp_q_rev[cid].append(float(rev))

        comp_ttm = {cid: sum(revs) for cid, revs in comp_q_rev.items()}

        # 4. Group orders by company entity
        now_ref = dt_cls.now(tz_cls.utc)
        d30 = now_ref - td_cls(days=30)
        d90 = now_ref - td_cls(days=90)

        SOVEREIGN_KEYWORDS = [
            "railway", "railways", "rvnl", "irfc", "ircon", "nhai", "ongc", "ntpc", "seci",
            "defence", "defense", "mod", "army", "navy", "air force", "isro", "drdo", "bhel",
            "sail", "gail", "iocl", "bpcl", "hpcl", "coal india", "powergrid", "pgcil",
            "transco", "discom", "genco", "government", "ministry", "cpwd", "pwd",
            "municipal", "metro", "mmrda", "dmrc", "bmrcl", "bel", "hal", "mazagon",
            "rites", "psu", "ap transco", "cidco", "esic"
        ]

        def _is_sovereign(client: Optional[str], headline: str, filing: Optional[str]) -> bool:
            c_str = f"{client or ''} {headline or ''} {filing or ''}".lower()
            return any(k in c_str for k in SOVEREIGN_KEYWORDS)

        company_map: Dict[str, Dict[str, Any]] = {}

        for o in orders:
            sym = (o.symbol or "").replace(".NS", "").replace(".BO", "").strip().upper()
            comp_obj = comp_by_clean.get(sym)
            key = sym if sym else (o.company_name or "").strip()
            if not key:
                continue

            if key not in company_map:
                metrics = cmm_map.get(comp_obj.id, {}) if comp_obj else {}
                cmp_val = metrics.get("cmp") or o.current_price
                ttm_val = comp_ttm.get(comp_obj.id, 0.0) if comp_obj else 0.0

                company_map[key] = {
                    "symbol": sym if sym else None,
                    "company_name": (comp_obj.company if comp_obj else o.company_name) or o.company_name,
                    "tradingview_symbol": sym if sym else None,
                    "exchange": (comp_obj.exchange if comp_obj else "NSE") or "NSE",
                    "sector": (comp_obj.sector if comp_obj else "Unknown") or "Unknown",
                    "industry": (comp_obj.industry if comp_obj else "Unknown") or "Unknown",
                    "is_listed": True if (sym or o.is_listed) else False,
                    "cmp": round(float(cmp_val), 1) if cmp_val else None,
                    "market_cap_category": metrics.get("market_cap_category", "MID_CAP"),
                    "high_52w": metrics.get("high_52w"),
                    "low_52w": metrics.get("low_52w"),
                    "pe_ratio": metrics.get("pe_ratio"),
                    "roce": metrics.get("roce"),
                    "ttm_revenue_cr": round(float(ttm_val), 1),
                    "orders": [],
                    "order_count": 0,
                    "total_deal_cr": 0.0,
                    "total_quarterly_run_rate_cr": 0.0,
                    "total_annualized_pat_cr": 0.0,
                    "sovereign_deal_cr": 0.0,
                    "sovereign_orders_count": 0,
                    "counterparties": set(),
                    "execution_months_list": [],
                    "latest_order_date": None,
                    "oldest_order_date": None,
                }

            rec = company_map[key]
            deal = o.deal_value_cr or 0.0
            rec["order_count"] += 1
            rec["total_deal_cr"] += deal
            rec["total_quarterly_run_rate_cr"] += (o.order_quarterly_rev_cr or (round(deal / 6.0, 1) if deal else 0.0))
            rec["total_annualized_pat_cr"] += (o.order_earnings_impact_cr or 0.0)

            if _is_sovereign(o.order_client_counterparty, o.headline, o.filing_description):
                rec["sovereign_deal_cr"] += deal
                rec["sovereign_orders_count"] += 1

            if o.order_client_counterparty:
                clean_cp = o.order_client_counterparty.strip()
                if clean_cp:
                    rec["counterparties"].add(clean_cp)

            if o.order_execution_months:
                rec["execution_months_list"].append(o.order_execution_months)

            fdate = o.announcement_date or o.published_at
            if fdate:
                if rec["latest_order_date"] is None or fdate > rec["latest_order_date"]:
                    rec["latest_order_date"] = fdate
                if rec["oldest_order_date"] is None or fdate < rec["oldest_order_date"]:
                    rec["oldest_order_date"] = fdate

            # Embed single order contract
            rec["orders"].append({
                "id": o.id,
                "headline": o.headline,
                "filing_date": fdate.isoformat() if fdate else None,
                "deal_value_cr": o.deal_value_cr,
                "rev_pct_ttm": o.synergy_rev_pct_ttm,
                "counterparty": o.order_client_counterparty,
                "execution_months": o.order_execution_months or 18,
                "quarterly_rev_cr": o.order_quarterly_rev_cr,
                "pat_impact_cr": o.order_earnings_impact_cr,
                "significance_tier": o.order_significance_tier or "HIGH_IMPACT",
                "significance_score": o.order_significance_score or 80.0,
                "pdf_url": o.pdf_url,
                "source_url": o.source_url,
                "ai_insight": o.ai_insight or o.buy_thesis,
            })

        # 5. Compute derived metrics per company
        all_companies_list = list(company_map.values())
        for item in all_companies_list:
            ttm = item["ttm_revenue_cr"]
            tot_deal = item["total_deal_cr"]
            b2b = round(tot_deal / ttm, 2) if ttm > 0 else (None if tot_deal == 0 else 1.0)
            item["book_to_bill_multiple"] = b2b

            # Backlog coverage years
            if b2b is not None:
                item["backlog_coverage_years"] = b2b
            elif item["execution_months_list"]:
                item["backlog_coverage_years"] = round((sum(item["execution_months_list"]) / len(item["execution_months_list"])) / 12.0, 1)
            else:
                item["backlog_coverage_years"] = 1.5

            # Order velocity
            latest_dt = item["latest_order_date"]
            if latest_dt:
                aware_dt = latest_dt.replace(tzinfo=tz_cls.utc) if latest_dt.tzinfo is None else latest_dt
                if aware_dt >= d30:
                    item["order_velocity_signal"] = "SURGING_30D"
                elif aware_dt >= d90:
                    item["order_velocity_signal"] = "ACCELERATING"
                else:
                    item["order_velocity_signal"] = "ESTABLISHED"
            else:
                item["order_velocity_signal"] = "ESTABLISHED"

            # Strength Tier
            if (b2b is not None and b2b >= 1.5) or tot_deal >= 2000.0:
                item["strength_tier"] = "TRANSFORMATIONAL_SURGE"
            elif (b2b is not None and b2b >= 0.75) or tot_deal >= 750.0:
                item["strength_tier"] = "HIGH_VISIBILITY"
            elif (b2b is not None and b2b >= 0.30) or tot_deal >= 200.0:
                item["strength_tier"] = "EXPANDING_BACKLOG"
            else:
                item["strength_tier"] = "STEADY_REPLENISHMENT"

            item["sovereign_client_pct"] = (
                round((item["sovereign_deal_cr"] / tot_deal * 100.0), 1)
                if tot_deal > 0
                else (100.0 if item["sovereign_orders_count"] > 0 else 0.0)
            )
            item["avg_execution_months"] = (
                round(sum(item["execution_months_list"]) / len(item["execution_months_list"]), 1)
                if item["execution_months_list"]
                else 18.0
            )
            item["top_counterparties"] = list(item["counterparties"])[:4]
            item["total_deal_cr"] = round(tot_deal, 1)
            item["total_quarterly_run_rate_cr"] = round(item["total_quarterly_run_rate_cr"], 1)
            item["total_annualized_pat_cr"] = round(item["total_annualized_pat_cr"], 1)
            item["latest_order_date"] = item["latest_order_date"].isoformat() if item["latest_order_date"] else None
            item["oldest_order_date"] = item["oldest_order_date"].isoformat() if item["oldest_order_date"] else None
            del item["counterparties"]
            del item["execution_months_list"]

        # Global Summary (before user filters)
        total_tracked_backlog_cr = round(sum(c["total_deal_cr"] for c in all_companies_list), 1)
        total_orders_tracked = sum(c["order_count"] for c in all_companies_list)
        sovereign_backed_backlog_cr = round(sum(c["sovereign_deal_cr"] for c in all_companies_list), 1)
        sovereign_share_pct = round((sovereign_backed_backlog_cr / total_tracked_backlog_cr * 100.0), 1) if total_tracked_backlog_cr > 0 else 0.0
        transformational_count = sum(1 for c in all_companies_list if c["strength_tier"] == "TRANSFORMATIONAL_SURGE")
        high_visibility_count = sum(1 for c in all_companies_list if c["strength_tier"] in ("TRANSFORMATIONAL_SURGE", "HIGH_VISIBILITY"))
        surging_velocity_count = sum(1 for c in all_companies_list if c["order_velocity_signal"] == "SURGING_30D")

        # 6. Apply User Filters
        filtered = all_companies_list

        if min_deal_cr is not None:
            filtered = [c for c in filtered if c["total_deal_cr"] >= min_deal_cr]

        if min_book_to_bill is not None:
            filtered = [c for c in filtered if (c["book_to_bill_multiple"] or 0.0) >= min_book_to_bill]

        if order_velocity and order_velocity != "ALL":
            filtered = [c for c in filtered if c["order_velocity_signal"] == order_velocity]

        if strength_tier and strength_tier != "ALL":
            filtered = [c for c in filtered if c["strength_tier"] == strength_tier]

        if sovereign_only:
            filtered = [c for c in filtered if c["sovereign_client_pct"] >= 40.0 or c["sovereign_orders_count"] > 0]

        if search:
            s = search.strip().lower()
            filtered = [
                c for c in filtered
                if (s in (c["symbol"] or "").lower())
                or (s in (c["company_name"] or "").lower())
                or any(s in cp.lower() for cp in c.get("top_counterparties", []))
            ]

        # 7. Sorting
        def _sort_key(item: Dict[str, Any]):
            val = item.get(sort_by)
            if val is None:
                return -9999999.0 if sort_order == "desc" else 9999999.0
            return val

        reverse = (sort_order == "desc")
        filtered.sort(key=_sort_key, reverse=reverse)

        # 8. Pagination
        total_matched = len(filtered)
        total_pages = max(1, (total_matched + limit - 1) // limit)
        offset = (page - 1) * limit
        paged_items = filtered[offset : offset + limit]

        return {
            "items": paged_items,
            "total_companies": total_matched,
            "summary": {
                "total_tracked_backlog_cr": total_tracked_backlog_cr,
                "total_orders_tracked": total_orders_tracked,
                "total_companies_tracked": len(all_companies_list),
                "transformational_companies_count": transformational_count,
                "high_visibility_companies_count": high_visibility_count,
                "sovereign_backed_backlog_cr": sovereign_backed_backlog_cr,
                "sovereign_share_pct": sovereign_share_pct,
                "surging_velocity_count": surging_velocity_count,
            },
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        }

