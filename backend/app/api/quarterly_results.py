"""
Alpha India — Exchange Quarterly Results & PEAD Scanner API
Sprint 36.4 — Dual-Feed Intelligence Upgrade

Exposes endpoints for:
  • RESULTS feed  — Actual quarterly earnings, full 4-pillar PEAD scoring
  • ANNOUNCEMENTS feed — Board meeting notices, Pre-Beat Readiness scoring
  • ALL (default)  — Combined view (legacy behaviour preserved)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, and_, desc, asc, func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.pead_engine import PEADEngine
from app.services.discovery_service import DiscoveryService

router = APIRouter(
    prefix="/quarterly-results",
    tags=["Quarterly Results & PEAD Radar"],
)


# ---------------------------------------------------------------------------
# Constants — filing-type classification keywords
# ---------------------------------------------------------------------------

_RESULT_KEYWORDS = ["result", "financial", "outcome", "statement"]
_ANNOUNCEMENT_KEYWORDS = [
    "board meeting", "intimation", "date of meeting", "notice",
    "meeting of board", "board of directors meeting", "schedule",
]


def _is_results_filing(filing_type: Optional[str]) -> bool:
    if not filing_type:
        return True  # treat unknown as result (legacy)
    ft = filing_type.lower()
    return any(k in ft for k in _RESULT_KEYWORDS)


def _is_announcement_filing(filing_type: Optional[str]) -> bool:
    if not filing_type:
        return False
    ft = filing_type.lower()
    return any(k in ft for k in _ANNOUNCEMENT_KEYWORDS)


def _filing_feed_type(filing_type: Optional[str]) -> str:
    """Returns 'ANNOUNCEMENT' or 'RESULT'."""
    if _is_announcement_filing(filing_type):
        return "ANNOUNCEMENT"
    return "RESULT"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PillarBreakdown(BaseModel):
    rank1_operating_leverage: Optional[float] = 0.0
    rank2_run_rate_surprise: Optional[float] = 0.0
    rank3_pat_velocity: Optional[float] = 0.0
    rank4_sales_expansion: Optional[float] = 0.0
    rank5_operating_margin: Optional[float] = 0.0
    rank6_capital_quality: Optional[float] = 0.0
    rank7_freshness_drift: Optional[float] = 0.0
    trap_penalties: Optional[float] = 0.0
    earnings_power: Optional[float] = 0.0
    operating_leverage: Optional[float] = 0.0
    capital_efficiency: Optional[float] = 0.0
    trend_drift: Optional[float] = 0.0


class QuarterlyResultItem(BaseModel):
    id: int
    company_id: int
    symbol: str
    company_name: str
    exchange: str
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    market_cap_category: Optional[str] = None
    filing_type: Optional[str] = None
    period: str
    announcement_date: Optional[str] = None
    discovered_at: Optional[str] = None
    pdf_url: Optional[str] = None
    download_status: str
    parse_status: str
    tradingview_url: Optional[str] = None

    # Feed classification (new in Sprint 36.4)
    feed_type: str = "RESULT"               # "RESULT" | "ANNOUNCEMENT"
    is_pre_announcement: bool = False

    # Financial metrics
    revenue: Optional[float] = None
    net_profit: Optional[float] = None
    eps: Optional[float] = None
    opm: Optional[float] = None
    revenue_growth: Optional[float] = None
    pat_growth: Optional[float] = None
    revenue_growth_qoq: Optional[float] = None
    pat_growth_qoq: Optional[float] = None
    roce: Optional[float] = None
    current_price: Optional[float] = None
    dma_50: Optional[float] = None

    # PEAD Intelligence (post-results)
    pead_score: float
    pead_tier: str
    pead_tier_label: str
    pead_color: str
    drift_days: str
    operating_leverage_ratio: float
    run_rate_beat_pct: Optional[float] = 0.0
    is_turnaround: Optional[bool] = False
    is_pead_candidate: bool
    is_elite_pead: bool
    pead_thesis: str
    pillar_breakdown: PillarBreakdown

    # Pre-Beat Intelligence (pre-announcement — new in Sprint 36.4)
    pre_beat_score: Optional[float] = None
    beat_tier: Optional[str] = None
    beat_tier_label: Optional[str] = None
    beat_color: Optional[str] = None
    beat_velocity: Optional[str] = None
    beat_thesis: Optional[str] = None
    beat_count_of_4: Optional[int] = None
    avg_pat_growth_trailing: Optional[float] = None

    # Athena Omega Intelligence
    athena_conviction_score: Optional[float] = None
    athena_conviction_grade: Optional[str] = None
    athena_signal: Optional[str] = None


class QuarterlyResultsResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    pead_candidates_count: int
    elite_pead_count: int
    results_count: int           # new in Sprint 36.4
    announcements_count: int     # new in Sprint 36.4
    results: List[QuarterlyResultItem]


class QuarterlySummaryResponse(BaseModel):
    total_filings: int
    pead_candidates: int
    elite_pead: int
    nse_count: int
    bse_count: int
    results_filings_count: int       # new in Sprint 36.4
    announcements_filings_count: int # new in Sprint 36.4
    latest_discovered_at: Optional[str] = None
    available_periods: List[str]
    top_pead_pick: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Internal helper — build base filing query with feed_type filter
# ---------------------------------------------------------------------------

def _build_filing_query(db: Session, feed_type: str):
    """
    Returns a SQLAlchemy query filtered to the requested feed_type.
    feed_type: 'RESULTS' | 'ANNOUNCEMENTS' | 'ALL'
    """
    base = db.query(FilingRegistry, Company).join(
        Company, FilingRegistry.company_id == Company.id
    )

    if feed_type == "RESULTS":
        conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _RESULT_KEYWORDS]
        conditions.append(FilingRegistry.filing_type.is_(None))
        # Exclude pure announcement filings
        base = base.filter(or_(*conditions))
        # Extra exclusion: strip away board-meeting-only rows
        ann_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _ANNOUNCEMENT_KEYWORDS]
        from sqlalchemy import not_
        base = base.filter(not_(or_(*ann_conditions)))

    elif feed_type == "ANNOUNCEMENTS":
        ann_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _ANNOUNCEMENT_KEYWORDS]
        base = base.filter(or_(*ann_conditions))

    else:  # ALL — legacy behaviour
        result_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _RESULT_KEYWORDS]
        result_conditions.append(FilingRegistry.filing_type.is_(None))
        ann_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _ANNOUNCEMENT_KEYWORDS]
        base = base.filter(or_(*result_conditions, *ann_conditions))

    # Filter for active current year filings (>= 2026) to prevent stale 2025/2024 results from appearing
    import datetime
    current_year_filter = or_(
        FilingRegistry.announcement_date >= datetime.date(2026, 1, 1),
        and_(
            FilingRegistry.announcement_date.is_(None),
            FilingRegistry.discovered_at >= datetime.datetime(2026, 1, 1),
        ),
    )
    base = base.filter(current_year_filter)

    return base


def _resolve_period(
    filing_period: Optional[str],
    filing_type: Optional[str],
    announcement_date: Optional[Any],
    matched_qr: Optional[Any] = None,
) -> str:
    """
    Resolves clean fiscal period representation (e.g. Q1 FY27, Q4 FY26),
    ensuring 'Unknown', 'LIVE_WIRE', or null are properly populated from
    the company's latest quarterly result or filing date.
    """
    # 1. Clean explicit filing_period if valid and not Unknown/LIVE_WIRE
    if filing_period and filing_period.strip():
        p = filing_period.strip()
        if p.lower() not in ("unknown", "live_wire", "none", "null") and any(
            t in p.upper() for t in ["Q1", "Q2", "Q3", "Q4", "FY", "HALF", "ANNUAL"]
        ):
            return p

    # 2. Extract from matched QuarterlyResult
    if matched_qr:
        if matched_qr.fiscal_period and matched_qr.fiscal_period.strip().lower() not in ("unknown", "none"):
            return matched_qr.fiscal_period.strip()
        if matched_qr.quarter and matched_qr.quarter.strip().lower() not in ("unknown", "none"):
            return matched_qr.quarter.strip()
        if matched_qr.period_end:
            m, y = matched_qr.period_end.month, matched_qr.period_end.year
            if m in (4, 5, 6):
                return f"Q1 FY{str(y + 1)[-2:]}"
            elif m in (7, 8, 9):
                return f"Q2 FY{str(y + 1)[-2:]}"
            elif m in (10, 11, 12):
                return f"Q3 FY{str(y + 1)[-2:]}"
            elif m in (1, 2, 3):
                return f"Q4 FY{str(y)[-2:]}"

    # 3. Extract from announcement_date
    if announcement_date:
        if hasattr(announcement_date, "month") and hasattr(announcement_date, "year"):
            m, y = announcement_date.month, announcement_date.year
            if m in (4, 5, 6):
                return f"Q4 FY{str(y)[-2:]}"
            elif m in (7, 8, 9):
                return f"Q1 FY{str(y + 1)[-2:]}"
            elif m in (10, 11, 12):
                return f"Q2 FY{str(y + 1)[-2:]}"
            elif m in (1, 2, 3):
                return f"Q3 FY{str(y)[-2:]}"

    return "Q1 FY27"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=QuarterlyResultsResponse)
def get_quarterly_results(
    page: int = 1,
    limit: int = 25,
    search: Optional[str] = None,
    exchange: Optional[str] = "ALL",
    period: Optional[str] = "ALL",
    feed_type: Optional[str] = "ALL",          # NEW: RESULTS | ANNOUNCEMENTS | ALL
    pead_only: bool = False,
    pead_tier: Optional[str] = "ALL",
    sort_by: str = "announcement_date",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    """
    Returns exchange filings enriched with PEAD intelligence.

    feed_type controls which filings are returned:
      • RESULTS       — Actual quarterly earnings; full 4-pillar PEAD score
      • ANNOUNCEMENTS — Board meeting notices; Pre-Beat Readiness score
      • ALL           — Both combined (default, legacy behaviour)
    """
    feed = (feed_type or "ALL").upper().strip()
    if feed not in ("RESULTS", "ANNOUNCEMENTS", "ALL"):
        feed = "ALL"

    # 1. Base query with feed filter
    query = _build_filing_query(db, feed)

    # 2. Search filter
    if search:
        s = f"%{search.strip().upper()}%"
        query = query.filter(
            or_(
                FilingRegistry.symbol.ilike(s),
                Company.company.ilike(s),
            )
        )

    # 3. Exchange filter
    if exchange and exchange != "ALL":
        query = query.filter(FilingRegistry.exchange == exchange.upper())

    # 4. Period filter
    if period and period != "ALL":
        query = query.filter(FilingRegistry.period.ilike(f"%{period}%"))

    # Fetch candidate filings (prioritize recent 2026 announcement dates)
    filing_rows = (
        query.order_by(
            FilingRegistry.announcement_date.desc().nullslast(),
            FilingRegistry.discovered_at.desc(),
        )
        .limit(600)
        .all()
    )

    if not filing_rows:
        return {
            "total": 0, "page": page, "limit": limit, "pages": 0,
            "pead_candidates_count": 0, "elite_pead_count": 0,
            "results_count": 0, "announcements_count": 0, "results": [],
        }

    # Deduplicate — one entry per (symbol, period)
    seen_equities = set()
    deduped_filing_rows = []
    for f, c in filing_rows:
        key = (f.symbol.strip().upper(), (f.period or "LATEST").strip().upper())
        if key not in seen_equities:
            seen_equities.add(key)
            deduped_filing_rows.append((f, c))
    filing_rows = deduped_filing_rows

    company_ids = list({f.company_id for f, _ in filing_rows})
    symbols = list({f.symbol for f, _ in filing_rows})

    # Bulk fetch screener fundamentals
    screener_records = {
        s.symbol: s
        for s in db.query(ScreenerGrowthRecord)
        .filter(ScreenerGrowthRecord.symbol.in_(symbols))
        .all()
    }

    # Bulk fetch Athena Omega conviction flashes
    from app.models.athena_models import AthenaConvictionFlash
    athena_flashes = {
        af.symbol: af
        for af in db.query(AthenaConvictionFlash)
        .filter(AthenaConvictionFlash.symbol.in_(symbols))
        .order_by(AthenaConvictionFlash.published_at.desc())
        .all()
    }

    # Bulk fetch quarterly financial statements
    qr_records = (
        db.query(QuarterlyResult)
        .filter(QuarterlyResult.company_id.in_(company_ids))
        .order_by(QuarterlyResult.period_end.desc())
        .all()
    )
    qr_by_company: Dict[int, List[QuarterlyResult]] = {}
    for qr in qr_records:
        qr_by_company.setdefault(qr.company_id, []).append(qr)

    # Enrich each filing
    enriched_items: List[Dict[str, Any]] = []
    total_pead_candidates = 0
    total_elite_pead = 0
    total_results_count = 0
    total_announcements_count = 0

    for filing, comp in filing_rows:
        sym = filing.symbol
        scr = screener_records.get(sym)
        company_qrs = qr_by_company.get(filing.company_id, [])

        # Determine this filing's category
        item_feed_type = _filing_feed_type(filing.filing_type)
        is_pre = item_feed_type == "ANNOUNCEMENT"

        if is_pre:
            total_announcements_count += 1
        else:
            total_results_count += 1

        # Match quarterly result by period or pick latest
        matched_qr = None
        for qr in company_qrs:
            if qr.fiscal_period and filing.period and qr.fiscal_period.lower() in filing.period.lower():
                matched_qr = qr
                break
            if qr.quarter and filing.period and qr.quarter.lower() in filing.period.lower():
                matched_qr = qr
                break
        if not matched_qr and company_qrs:
            matched_qr = company_qrs[0]

        # Extract financial indicators
        rev = matched_qr.revenue if matched_qr and matched_qr.revenue is not None else (scr.latest_quarter_sales if scr else None)
        pat = matched_qr.net_profit if matched_qr and matched_qr.net_profit is not None else (scr.latest_quarter_net_profit if scr else None)
        eps = matched_qr.eps if matched_qr and matched_qr.eps is not None else (scr.latest_quarter_eps if scr else None)
        rev_growth = matched_qr.revenue_growth if matched_qr and matched_qr.revenue_growth is not None else (scr.quarterly_sales_yoy if scr else comp.revenue_growth)
        pat_growth = matched_qr.pat_growth if matched_qr and matched_qr.pat_growth is not None else (scr.quarterly_pat_yoy if scr else comp.pat_growth)

        # Sequential QoQ calculation (consecutive quarters or ScreenerGrowthRecord)
        rev_growth_qoq = scr.quarterly_sales_qoq if scr and scr.quarterly_sales_qoq is not None else None
        pat_growth_qoq = scr.quarterly_pat_qoq if scr and scr.quarterly_pat_qoq is not None else None
        if len(company_qrs) >= 2:
            prev_qr = company_qrs[1]
            if pat_growth_qoq is None and matched_qr and matched_qr.net_profit is not None and prev_qr.net_profit is not None and prev_qr.net_profit != 0:
                pat_growth_qoq = round(((matched_qr.net_profit - prev_qr.net_profit) / abs(prev_qr.net_profit)) * 100.0, 1)
            if rev_growth_qoq is None and matched_qr and matched_qr.revenue is not None and prev_qr.revenue is not None and prev_qr.revenue != 0:
                rev_growth_qoq = round(((matched_qr.revenue - prev_qr.revenue) / abs(prev_qr.revenue)) * 100.0, 1)

        # Trailing 12-month net profit for Run-Rate Surprise (Rank 2)
        pat_12m_val = scr.pat_12m if scr and scr.pat_12m is not None else None
        if pat_12m_val is None and len(company_qrs) >= 4:
            valid_profits = [q.net_profit for q in company_qrs[:4] if q.net_profit is not None]
            if len(valid_profits) == 4:
                pat_12m_val = sum(valid_profits)

        roce = scr.roce if scr and scr.roce is not None else comp.roce
        opm = scr.opm_latest if scr and scr.opm_latest is not None else 12.0
        cur_price = scr.current_price if scr else None
        dma_50 = scr.dma_50 if scr else None
        d_e = scr.debt_to_equity if scr else None

        # Parse discovered_at for freshness scoring
        discovered_dt = None
        if filing.discovered_at:
            try:
                discovered_dt = filing.discovered_at
                if hasattr(discovered_dt, "tzinfo") and discovered_dt.tzinfo is None:
                    discovered_dt = discovered_dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass

        # Run Prioritized 100-Point PEAD Evaluation
        pead_res = PEADEngine.evaluate(
            revenue_growth_yoy=rev_growth,
            pat_growth_yoy=pat_growth,
            roce=roce,
            opm=opm,
            current_price=cur_price,
            dma_50=dma_50,
            debt_to_equity=d_e,
            revenue_growth_qoq=rev_growth_qoq,
            pat_growth_qoq=pat_growth_qoq,
            eps=eps,
            discovered_at=discovered_dt,
            symbol=sym,
            quarter=filing.period,
            latest_quarter_net_profit=pat,
            pat_12m=pat_12m_val,
            profit_growth_ttm=scr.profit_growth_ttm if scr else None,
        )

        if pead_res["is_pead_candidate"]:
            total_pead_candidates += 1
        if pead_res["is_elite_pead"]:
            total_elite_pead += 1

        # Apply PEAD filter (only on RESULTS feed)
        if pead_only and not is_pre and not pead_res["is_pead_candidate"]:
            continue
        if pead_tier and pead_tier != "ALL" and not is_pre and pead_res["pead_tier"] != pead_tier:
            continue

        # Pre-Beat Readiness scoring for ANNOUNCEMENT filings
        pre_beat_res = None
        if is_pre:
            # Compute trailing beat stats from company_qrs
            beat_count = 0
            q_positive = 0
            pat_growths = []
            rev_growths = []
            for qr in company_qrs[:4]:
                pg = qr.pat_growth if qr.pat_growth is not None else 0.0
                rg = qr.revenue_growth if qr.revenue_growth is not None else 0.0
                pat_growths.append(pg)
                rev_growths.append(rg)
                if pg >= 25.0:
                    beat_count += 1
                if pg > 0.0:
                    q_positive += 1

            avg_pat = round(sum(pat_growths) / max(1, len(pat_growths)), 1) if pat_growths else 0.0
            avg_rev = round(sum(rev_growths) / max(1, len(rev_growths)), 1) if rev_growths else 0.0

            pre_beat_res = PEADEngine.evaluate_pre_announcement(
                avg_revenue_growth_trailing=avg_rev,
                avg_pat_growth_trailing=avg_pat,
                quarters_with_positive_pat=q_positive,
                beat_count_of_4=beat_count,
                roce=roce,
                debt_to_equity=d_e,
                current_price=cur_price,
                dma_50=dma_50,
                discovered_at=discovered_dt,
                symbol=sym,
                period=filing.period,
            )

        # Resolve clean fiscal period (never show Unknown)
        resolved_period = _resolve_period(
            filing.period,
            filing.filing_type,
            filing.announcement_date,
            matched_qr,
        )

        ann_date_str = None
        if filing.announcement_date:
            ann_date_str = filing.announcement_date.isoformat()
        elif filing.discovered_at:
            ann_date_str = filing.discovered_at.date().isoformat()
        elif matched_qr and matched_qr.period_end:
            ann_date_str = matched_qr.period_end.isoformat()

        clean_sym = sym.strip().upper() if sym else ""
        tv_ex = "BSE" if (filing.exchange or "").upper() == "BSE" else "NSE"
        item = {
            "id": filing.id,
            "company_id": comp.id,
            "symbol": sym,
            "company_name": comp.company,
            "exchange": filing.exchange,
            "tradingview_url": f"https://in.tradingview.com/chart/?symbol={tv_ex}:{clean_sym}",
            "sector": comp.sector or (scr.sector if scr else None),
            "market_cap": scr.market_cap if scr else comp.market_cap,
            "market_cap_category": scr.market_cap_category if scr else comp.market_cap_category,
            "filing_type": filing.filing_type or "Quarterly Financial Results",
            "period": resolved_period,
            "announcement_date": ann_date_str,
            "discovered_at": filing.discovered_at.isoformat() if filing.discovered_at else None,
            "pdf_url": filing.pdf_url,
            "download_status": filing.download_status or "PENDING",
            "parse_status": filing.parse_status or "PENDING",
            # Feed classification
            "feed_type": item_feed_type,
            "is_pre_announcement": is_pre,
            # Financials
            "revenue": rev,
            "net_profit": pat,
            "eps": eps,
            "opm": opm,
            "revenue_growth": rev_growth,
            "pat_growth": pat_growth,
            "revenue_growth_qoq": rev_growth_qoq,
            "pat_growth_qoq": pat_growth_qoq,
            "roce": roce,
            "current_price": cur_price,
            "dma_50": dma_50,
            # Post-results PEAD
            "pead_score": pead_res["pead_score"],
            "pead_tier": pead_res["pead_tier"],
            "pead_tier_label": pead_res["pead_tier_label"],
            "pead_color": pead_res["pead_color"],
            "drift_days": pead_res["drift_days"],
            "operating_leverage_ratio": pead_res["operating_leverage_ratio"],
            "run_rate_beat_pct": pead_res.get("run_rate_beat_pct", 0.0),
            "is_turnaround": pead_res.get("is_turnaround", False),
            "is_pead_candidate": pead_res["is_pead_candidate"],
            "is_elite_pead": pead_res["is_elite_pead"],
            "pead_thesis": pead_res["thesis"],
            "pillar_breakdown": pead_res["pillar_breakdown"],
            # Pre-Beat (announcement phase)
            "pre_beat_score": pre_beat_res["pre_beat_score"] if pre_beat_res else None,
            "beat_tier": pre_beat_res["beat_tier"] if pre_beat_res else None,
            "beat_tier_label": pre_beat_res["beat_tier_label"] if pre_beat_res else None,
            "beat_color": pre_beat_res["beat_color"] if pre_beat_res else None,
            "beat_velocity": pre_beat_res["velocity"] if pre_beat_res else None,
            "beat_thesis": pre_beat_res["beat_thesis"] if pre_beat_res else None,
            "beat_count_of_4": pre_beat_res["beat_count_of_4"] if pre_beat_res else None,
            "avg_pat_growth_trailing": pre_beat_res["avg_pat_growth_trailing"] if pre_beat_res else None,
            # Athena
            "athena_conviction_score": athena_flashes.get(sym).athena_conviction_score if athena_flashes.get(sym) else None,
            "athena_conviction_grade": athena_flashes.get(sym).conviction_grade if athena_flashes.get(sym) else None,
            "athena_signal": athena_flashes.get(sym).flash_signal if athena_flashes.get(sym) else None,
        }
        enriched_items.append(item)

    # Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "announcement_date":
        enriched_items.sort(
            key=lambda x: (
                x["announcement_date"] or "",
                (x["pre_beat_score"] if x["is_pre_announcement"] else x["pead_score"]) or 0.0,
            ),
            reverse=reverse,
        )
    elif sort_by == "pead_score":
        enriched_items.sort(
            key=lambda x: (
                (x["pre_beat_score"] if x["is_pre_announcement"] else x["pead_score"]) or 0.0,
                x["announcement_date"] or "",
            ),
            reverse=reverse,
        )
    elif sort_by == "period":
        enriched_items.sort(key=lambda x: (x["period"] or ""), reverse=reverse)
    elif sort_by == "revenue_growth":
        enriched_items.sort(key=lambda x: (x["revenue_growth"] or -9999.0), reverse=reverse)
    elif sort_by == "pat_growth":
        enriched_items.sort(key=lambda x: (x["pat_growth"] or -9999.0), reverse=reverse)
    elif sort_by == "pat_growth_qoq":
        enriched_items.sort(
            key=lambda x: (
                x["pat_growth_qoq"] if x["pat_growth_qoq"] is not None else -9999.0,
                x["pead_score"] or 0.0,
            ),
            reverse=reverse,
        )
    elif sort_by == "revenue_growth_qoq":
        enriched_items.sort(
            key=lambda x: (
                x["revenue_growth_qoq"] if x["revenue_growth_qoq"] is not None else -9999.0,
                x["pead_score"] or 0.0,
            ),
            reverse=reverse,
        )
    elif sort_by == "run_rate_beat_pct":
        enriched_items.sort(key=lambda x: (x["run_rate_beat_pct"] or -9999.0), reverse=reverse)
    elif sort_by == "revenue":
        enriched_items.sort(key=lambda x: (x["revenue"] or 0.0), reverse=reverse)
    elif sort_by == "net_profit":
        enriched_items.sort(key=lambda x: (x["net_profit"] or -9999.0), reverse=reverse)
    else:  # discovered_at (default)
        enriched_items.sort(key=lambda x: (x["discovered_at"] or ""), reverse=reverse)

    # Pagination
    total_count = len(enriched_items)
    pages = (total_count + limit - 1) // limit if total_count > 0 else 0
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_results = enriched_items[start_idx:end_idx]

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": pages,
        "pead_candidates_count": total_pead_candidates,
        "elite_pead_count": total_elite_pead,
        "results_count": total_results_count,
        "announcements_count": total_announcements_count,
        "results": paginated_results,
    }


@router.get("/summary", response_model=QuarterlySummaryResponse)
def get_quarterly_summary(db: Session = Depends(get_db)):
    """
    Returns summary KPIs for the Exchange Quarterly Results & PEAD Radar.
    """
    all_filings_q = db.query(FilingRegistry)

    total = all_filings_q.count()

    # Split counts by feed type
    ann_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _ANNOUNCEMENT_KEYWORDS]
    announcements_count = (
        db.query(func.count(FilingRegistry.id))
        .filter(or_(*ann_conditions))
        .scalar() or 0
    )
    results_conditions = [FilingRegistry.filing_type.ilike(f"%{k}%") for k in _RESULT_KEYWORDS]
    results_conditions_with_none = results_conditions + [FilingRegistry.filing_type.is_(None)]
    results_count = (
        db.query(func.count(FilingRegistry.id))
        .filter(or_(*results_conditions_with_none))
        .scalar() or 0
    )

    nse_count = (
        db.query(func.count(FilingRegistry.id))
        .filter(FilingRegistry.exchange == "NSE")
        .scalar() or 0
    )
    bse_count = max(0, total - nse_count)

    latest_filing = (
        db.query(FilingRegistry)
        .order_by(FilingRegistry.discovered_at.desc())
        .first()
    )

    # Clean standardized fiscal quarters for filter dropdown
    periods = ["Q1 FY27", "Q4 FY26", "Q3 FY26", "Q2 FY26", "Q1 FY26", "Q4 FY25"]

    # Top PEAD candidate
    top_candidates = (
        db.query(Company)
        .filter(Company.pat_growth.isnot(None), Company.pat_growth > 30.0)
        .order_by(Company.pat_growth.desc())
        .limit(5)
        .all()
    )

    top_pick = None
    if top_candidates:
        c = top_candidates[0]
        eval_res = PEADEngine.evaluate(
            revenue_growth_yoy=c.revenue_growth,
            pat_growth_yoy=c.pat_growth,
            roce=c.roce,
            symbol=c.symbol,
        )
        top_clean_sym = c.symbol.strip().upper() if c.symbol else ""
        top_pick = {
            "symbol": c.symbol,
            "company": c.company,
            "pat_growth": c.pat_growth,
            "revenue_growth": c.revenue_growth,
            "pead_score": eval_res["pead_score"],
            "pead_tier": eval_res["pead_tier_label"],
            "drift_days": eval_res["drift_days"],
            "tradingview_url": f"https://in.tradingview.com/chart/?symbol=NSE:{top_clean_sym}",
        }

    pead_candidates_count = (
        db.query(func.count(Company.id))
        .filter(Company.pat_growth.isnot(None), Company.pat_growth >= 25.0)
        .scalar() or 0
    )
    elite_pead_count = (
        db.query(func.count(Company.id))
        .filter(
            Company.pat_growth.isnot(None), Company.pat_growth >= 50.0,
            Company.revenue_growth.isnot(None), Company.revenue_growth >= 20.0,
        )
        .scalar() or 0
    )

    return {
        "total_filings": total,
        "pead_candidates": pead_candidates_count,
        "elite_pead": elite_pead_count,
        "nse_count": nse_count,
        "bse_count": bse_count,
        "results_filings_count": results_count,
        "announcements_filings_count": announcements_count,
        "latest_discovered_at": latest_filing.discovered_at.isoformat() if latest_filing and latest_filing.discovered_at else None,
        "available_periods": periods,
        "top_pead_pick": top_pick,
    }


@router.post("/scan-exchange")
def scan_exchange_now(limit: int = 10, db: Session = Depends(get_db)):
    """
    Triggers an immediate discovery scan across exchange disclosure feeds
    to capture newly dropped quarterly filings in real time.
    """
    result = DiscoveryService.run_realtime_monitor_cycle(db, limit=limit)
    return {
        "success": True,
        "message": "Exchange discovery cycle completed",
        **result,
    }
