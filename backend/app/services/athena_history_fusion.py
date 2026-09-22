"""
ATHENA OMEGA v3.0 — Local Historical Fusion Engine
Sprint 24
Fuses fresh quarterly filing data from NSE/BSE with local PostgreSQL historical warehouse:
- Prior quarter (Q-1) for QoQ growth and margin acceleration
- Same quarter prior year (Q-4) for YoY growth and margin expansion
- Trailing 8 quarters for multi-year trend acceleration
- Balance Sheet baselines (Borrowings, Reserves, Total Assets, Debtor Days, Inventory Days)
- Valuation baselines (Industry PE, 52W High/Low, Historical PE)
Execution Latency Target: < 10 milliseconds (In-Memory Local DB Query)
"""

import logging
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)


@dataclass
class AthenaFusedState:
    """Complete merged quarterly state ready for 5-gate evaluation."""
    symbol: str
    company_name: str
    exchange: str
    fiscal_period: str
    period_end: Optional[date]
    filing_type: str
    pdf_url: Optional[str]

    # Fresh Q0 extracted values
    revenue_q0: float
    operating_profit_q0: float  # EBITDA
    ebitda_margin_pct_q0: float
    pat_q0: float  # Net profit
    eps_q0: float
    other_income_q0: float = 0.0
    interest_expense_q0: float = 0.0
    depreciation_q0: float = 0.0
    tax_expense_q0: float = 0.0

    # Historical Q-1 (Prior quarter)
    revenue_q_minus_1: Optional[float] = None
    pat_q_minus_1: Optional[float] = None
    ebitda_margin_q_minus_1: Optional[float] = None
    eps_q_minus_1: Optional[float] = None

    # Historical Q-4 (Prior year same quarter)
    revenue_q_minus_4: Optional[float] = None
    pat_q_minus_4: Optional[float] = None
    ebitda_margin_q_minus_4: Optional[float] = None
    eps_q_minus_4: Optional[float] = None

    # 8-Quarter Trend Trajectory
    revenue_history_8q: List[float] = field(default_factory=list)
    pat_history_8q: List[float] = field(default_factory=list)
    opm_history_8q: List[float] = field(default_factory=list)

    # Balance Sheet & Solvency Baselines from Local Warehouse
    total_debt: float = 0.0
    total_equity: float = 0.0
    debt_to_equity: float = 0.0
    interest_coverage: float = 0.0
    cfo_latest: float = 0.0
    fcf_latest: float = 0.0
    debtor_days: float = 60.0
    inventory_days: float = 60.0
    cash_conversion_cycle: float = 60.0
    roce_baseline: float = 15.0

    # Valuation Multiples & Market Baselines from Local Warehouse
    current_price: float = 100.0
    market_cap: float = 1000.0
    market_cap_category: str = "SMALL"
    stock_pe: float = 20.0
    industry_pe: float = 25.0
    peg_ratio: float = 1.0
    high_52w: float = 120.0
    low_52w: float = 80.0
    promoter_holding_pct: float = 50.0

    # Computed YoY & QoQ Deltas
    revenue_growth_yoy: float = 0.0
    revenue_growth_qoq: float = 0.0
    pat_growth_yoy: float = 0.0
    pat_growth_qoq: float = 0.0
    eps_growth_yoy: float = 0.0
    ebitda_margin_change_bps: float = 0.0


class AthenaHistoryFusion:
    """
    Executes in-memory fusion of fresh exchange data with local PostgreSQL tables.
    """

    @classmethod
    def resolve_accurate_cmp(
        cls,
        db: Session,
        symbol: str,
        fresh_q0: Dict[str, Any],
        s_record: Optional[ScreenerGrowthRecord] = None,
    ) -> float:
        """
        Multi-tier institutional CMP resolver:
        1. Explicit current_price in fresh_q0 (if valid and not 500.0/100.0 placeholder)
        2. Database ScreenerGrowthRecord.current_price (if valid and not 500.0/100.0 placeholder)
        3. Database CompanyMarketMetrics.cmp
        4. Live Yahoo Finance fast quote (NSE: .NS, BSE: .BO, handling aliases like CPCL -> CHENNPETRO)
        5. Persist the fetched real CMP into s_record.current_price so future queries are sub-millisecond
        """
        sym = symbol.strip().upper()

        # Priority 1: fresh_q0 explicit price
        raw_price = fresh_q0.get("current_price")
        if raw_price is not None:
            try:
                p = float(raw_price)
                if p > 0 and p not in (500.0, 100.0):
                    return round(p, 2)
            except (ValueError, TypeError):
                pass

        # Priority 2: ScreenerGrowthRecord
        if s_record and s_record.current_price is not None:
            try:
                p = float(s_record.current_price)
                if p > 0 and p not in (500.0, 100.0):
                    return round(p, 2)
            except (ValueError, TypeError):
                pass

        # Priority 3: CompanyMarketMetrics
        try:
            from app.models.company_market_metrics import CompanyMarketMetrics
            mm = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.symbol == sym).first()
            if mm and mm.cmp and float(mm.cmp) > 0 and float(mm.cmp) not in (500.0, 100.0):
                return round(float(mm.cmp), 2)
        except Exception:
            pass

        # Priority 4: Live Yahoo Finance fast quote
        lookup_sym = "CHENNPETRO" if sym == "CPCL" else sym
        for suffix in [".NS", ".BO"]:
            try:
                import yfinance as yf
                t = yf.Ticker(f"{lookup_sym}{suffix}")
                fi = t.fast_info
                lp = getattr(fi, "last_price", None)
                if lp and lp == lp and float(lp) > 0:
                    real_cmp = round(float(lp), 2)
                    if s_record:
                        s_record.current_price = real_cmp
                        yh = getattr(fi, "year_high", None)
                        yl = getattr(fi, "year_low", None)
                        if yh and yh == yh:
                            s_record.high_52_week = round(float(yh), 2)
                        if yl and yl == yl:
                            s_record.low_52_week = round(float(yl), 2)
                    return real_cmp
            except Exception:
                pass

        # Priority 5: Any non-zero price from input/DB as fallback
        if raw_price is not None:
            try:
                p = float(raw_price)
                if p > 0:
                    return round(p, 2)
            except Exception:
                pass

        if s_record and s_record.current_price is not None:
            try:
                p = float(s_record.current_price)
                if p > 0:
                    return round(p, 2)
            except Exception:
                pass

        return 100.0

    @classmethod
    def fuse(
        cls,
        db: Session,
        symbol: str,
        fresh_q0: Dict[str, Any],
        exchange: str = "NSE",
        filing_type: str = "Financial Results",
        pdf_url: Optional[str] = None,
    ) -> AthenaFusedState:
        sym = symbol.strip().upper()

        # 1. Fetch Company Master
        company = db.query(Company).filter(Company.symbol == sym).first()
        company_name = company.company if company else fresh_q0.get("company_name", sym)

        # 2. Fetch Screener Growth Record for Valuation & Balance Sheet baselines
        s_record = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == sym).first()

        # 3. Fetch Historical Quarterly Results (sorted newest to oldest)
        historical_quarters = []
        if company:
            historical_quarters = (
                db.query(QuarterlyResult)
                .filter(QuarterlyResult.company_id == company.id)
                .order_by(desc(QuarterlyResult.period_end))
                .limit(10)
                .all()
            )

        # Extract fresh Q0 primitives
        rev_q0 = float(fresh_q0.get("revenue") or 0.0)
        pat_q0 = float(fresh_q0.get("pat") or fresh_q0.get("net_profit") or 0.0)
        op_q0 = float(fresh_q0.get("operating_profit") or fresh_q0.get("ebitda") or (rev_q0 * 0.15))
        eps_q0 = float(fresh_q0.get("eps") or 0.0)
        other_inc = float(fresh_q0.get("other_income") or 0.0)
        int_exp = float(fresh_q0.get("interest_expense") or 0.0)
        deprec = float(fresh_q0.get("depreciation") or 0.0)

        opm_q0 = round((op_q0 / rev_q0) * 100, 2) if rev_q0 > 0 else float(fresh_q0.get("operating_margin_pct") or 0.0)

        # Extract Q-1 and Q-4 from historical quarters
        rev_q_minus_1, pat_q_minus_1, opm_q_minus_1, eps_q_minus_1 = None, None, None, None
        rev_q_minus_4, pat_q_minus_4, opm_q_minus_4, eps_q_minus_4 = None, None, None, None

        rev_hist_8q = []
        pat_hist_8q = []
        opm_hist_8q = []

        if historical_quarters:
            # Q-1 is the most recent past quarter in DB
            q1 = historical_quarters[0]
            rev_q_minus_1 = q1.revenue
            pat_q_minus_1 = q1.net_profit
            eps_q_minus_1 = q1.eps
            if q1.revenue and q1.revenue > 0 and q1.operating_income:
                opm_q_minus_1 = round((q1.operating_income / q1.revenue) * 100, 2)

            # Q-4 is 4 quarters back if available
            if len(historical_quarters) >= 4:
                q4 = historical_quarters[3]
                rev_q_minus_4 = q4.revenue
                pat_q_minus_4 = q4.net_profit
                eps_q_minus_4 = q4.eps
                if q4.revenue and q4.revenue > 0 and q4.operating_income:
                    opm_q_minus_4 = round((q4.operating_income / q4.revenue) * 100, 2)

            for hq in historical_quarters[:8]:
                if hq.revenue:
                    rev_hist_8q.append(hq.revenue)
                if hq.net_profit:
                    pat_hist_8q.append(hq.net_profit)
                if hq.revenue and hq.operating_income and hq.revenue > 0:
                    opm_hist_8q.append(round((hq.operating_income / hq.revenue) * 100, 2))

        # Fallback to fresh_q0 explicit growth figures if historical rows aren't present yet
        rev_g_yoy = float(fresh_q0.get("revenue_growth_pct") or 0.0)
        pat_g_yoy = float(fresh_q0.get("pat_growth_pct") or 0.0)
        eps_g_yoy = float(fresh_q0.get("eps_growth_pct") or 0.0)

        # Precise YoY calculation if Q-4 exists in local DB
        if rev_q_minus_4 and rev_q_minus_4 > 0:
            rev_g_yoy = round(((rev_q0 - rev_q_minus_4) / abs(rev_q_minus_4)) * 100, 2)
        if pat_q_minus_4 is not None:
            denom = abs(pat_q_minus_4) if abs(pat_q_minus_4) >= 0.1 else 0.5
            pat_g_yoy = round(((pat_q0 - pat_q_minus_4) / denom) * 100, 2)
        if eps_q_minus_4 and eps_q_minus_4 != 0:
            eps_g_yoy = round(((eps_q0 - eps_q_minus_4) / abs(eps_q_minus_4)) * 100, 2)

        # Precise QoQ calculation if Q-1 exists in local DB
        rev_g_qoq = 0.0
        pat_g_qoq = 0.0
        margin_bps = 0.0
        if rev_q_minus_1 and rev_q_minus_1 > 0:
            rev_g_qoq = round(((rev_q0 - rev_q_minus_1) / abs(rev_q_minus_1)) * 100, 2)
        if pat_q_minus_1 is not None:
            denom_q = abs(pat_q_minus_1) if abs(pat_q_minus_1) >= 0.1 else 0.5
            pat_g_qoq = round(((pat_q0 - pat_q_minus_1) / denom_q) * 100, 2)
        if opm_q_minus_4 is not None:
            margin_bps = round((opm_q0 - opm_q_minus_4) * 100, 1)  # Basis points

        # Pull Balance sheet & Solvency baselines from ScreenerGrowthRecord if available
        total_debt = 0.0
        total_equity = 100.0
        debt_to_eq = 0.0
        cfo = rev_q0 * 0.12  # baseline default
        fcf = cfo * 0.8
        d_days = 60.0
        i_days = 60.0
        ccc = 60.0
        roce_val = 15.0

        # Multi-Tier Accurate Current Market Price Resolver
        curr_price = cls.resolve_accurate_cmp(
            db=db,
            symbol=sym,
            fresh_q0=fresh_q0,
            s_record=s_record,
        )

        mcap = float(fresh_q0.get("market_cap") or (s_record.market_cap if s_record and s_record.market_cap else 2500.0))
        mcap_cat = s_record.market_cap_category if (s_record and s_record.market_cap_category) else "SMALL"
        s_pe = float(fresh_q0.get("pe") or (s_record.stock_pe if s_record and s_record.stock_pe else 25.0))
        ind_pe = s_record.industry_pe if (s_record and s_record.industry_pe) else 25.0
        peg = s_record.peg_ratio if (s_record and s_record.peg_ratio) else 1.0
        h_52 = s_record.high_52_week if (s_record and s_record.high_52_week) else round(curr_price * 1.2, 2)
        l_52 = s_record.low_52_week if (s_record and s_record.low_52_week) else round(curr_price * 0.7, 2)
        promoter = s_record.promoter_holding if (s_record and s_record.promoter_holding) else 55.0

        if s_record:
            total_debt = s_record.borrowings or 0.0
            total_equity = s_record.reserves or 100.0
            debt_to_eq = s_record.debt_to_equity if s_record.debt_to_equity is not None else 0.0
            cfo = s_record.cfo_latest if s_record.cfo_latest is not None else (pat_q0 * 4 * 0.9)
            fcf = s_record.free_cash_flow if s_record.free_cash_flow is not None else cfo
            d_days = s_record.debtor_days or 60.0
            i_days = s_record.inventory_days or 60.0
            ccc = s_record.cash_conversion_cycle or 60.0
            roce_val = s_record.roce or 15.0
            mcap = s_record.market_cap or mcap
            mcap_cat = s_record.market_cap_category or mcap_cat
            s_pe = s_record.stock_pe or s_pe
            ind_pe = s_record.industry_pe or ind_pe
            peg = s_record.peg_ratio or peg
            h_52 = s_record.high_52_week or h_52
            l_52 = s_record.low_52_week or l_52
            promoter = s_record.promoter_holding or promoter

        fused = AthenaFusedState(
            symbol=sym,
            company_name=company_name,
            exchange=exchange,
            fiscal_period=fresh_q0.get("quarter", "Q1 FY26"),
            period_end=None,
            filing_type=filing_type,
            pdf_url=pdf_url,
            revenue_q0=rev_q0,
            operating_profit_q0=op_q0,
            ebitda_margin_pct_q0=opm_q0,
            pat_q0=pat_q0,
            eps_q0=eps_q0,
            other_income_q0=other_inc,
            interest_expense_q0=int_exp,
            depreciation_q0=deprec,
            revenue_q_minus_1=rev_q_minus_1,
            pat_q_minus_1=pat_q_minus_1,
            ebitda_margin_q_minus_1=opm_q_minus_1,
            eps_q_minus_1=eps_q_minus_1,
            revenue_q_minus_4=rev_q_minus_4,
            pat_q_minus_4=pat_q_minus_4,
            ebitda_margin_q_minus_4=opm_q_minus_4,
            eps_q_minus_4=eps_q_minus_4,
            revenue_history_8q=rev_hist_8q,
            pat_history_8q=pat_hist_8q,
            opm_history_8q=opm_hist_8q,
            total_debt=total_debt,
            total_equity=total_equity,
            debt_to_equity=debt_to_eq,
            cfo_latest=cfo,
            fcf_latest=fcf,
            debtor_days=d_days,
            inventory_days=i_days,
            cash_conversion_cycle=ccc,
            roce_baseline=roce_val,
            current_price=curr_price,
            market_cap=mcap,
            market_cap_category=mcap_cat,
            stock_pe=s_pe,
            industry_pe=ind_pe,
            peg_ratio=peg,
            high_52w=h_52,
            low_52w=l_52,
            promoter_holding_pct=promoter,
            revenue_growth_yoy=rev_g_yoy,
            revenue_growth_qoq=rev_g_qoq,
            pat_growth_yoy=pat_g_yoy,
            pat_growth_qoq=pat_g_qoq,
            eps_growth_yoy=eps_g_yoy,
            ebitda_margin_change_bps=margin_bps,
        )

        return fused
