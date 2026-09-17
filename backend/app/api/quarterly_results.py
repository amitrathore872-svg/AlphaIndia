"""
Alpha India — Exchange Quarterly Results & PEAD Scanner API
Sprint 34 Production API

Exposes endpoints for querying real-time corporate earnings disclosures,
PEAD (Post-Earnings Announcement Drift) quantitative scoring, candidate filtering,
and live exchange scanning triggers.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, desc, asc, func
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
# Schemas
# ---------------------------------------------------------------------------

class PillarBreakdown(BaseModel):
    earnings_power: float
    operating_leverage: float
    capital_efficiency: float
    trend_drift: float


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
    
    # Financial metrics
    revenue: Optional[float] = None
    net_profit: Optional[float] = None
    eps: Optional[float] = None
    opm: Optional[float] = None
    revenue_growth: Optional[float] = None
    pat_growth: Optional[float] = None
    roce: Optional[float] = None
    current_price: Optional[float] = None
    dma_50: Optional[float] = None

    # PEAD Intelligence
    pead_score: float
    pead_tier: str
    pead_tier_label: str
    pead_color: str
    drift_days: str
    operating_leverage_ratio: float
    is_pead_candidate: bool
    is_elite_pead: bool
    pead_thesis: str
    pillar_breakdown: PillarBreakdown

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
    results: List[QuarterlyResultItem]


class QuarterlySummaryResponse(BaseModel):
    total_filings: int
    pead_candidates: int
    elite_pead: int
    nse_count: int
    bse_count: int
    latest_discovered_at: Optional[str] = None
    available_periods: List[str]
    top_pead_pick: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_quarterly_filing(filing_type: Optional[str]) -> bool:
    if not filing_type:
        return True
    ft = filing_type.lower()
    return any(k in ft for k in ["result", "financial", "outcome", "statement", "q1", "q2", "q3", "q4", "quarter"])


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
    pead_only: bool = False,
    pead_tier: Optional[str] = "ALL",
    sort_by: str = "discovered_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
):
    """
    Returns exchange quarterly results enriched with financial statements,
    PEAD (Post-Earnings Announcement Drift) score, candidate flags, and official PDFs.
    """
    # 1. Base Query on FilingRegistry joined with Company
    query = (
        db.query(FilingRegistry, Company)
        .join(Company, FilingRegistry.company_id == Company.id)
        .filter(
            or_(
                FilingRegistry.filing_type.ilike("%result%"),
                FilingRegistry.filing_type.ilike("%financial%"),
                FilingRegistry.filing_type.ilike("%outcome%"),
                FilingRegistry.filing_type.ilike("%statement%"),
                FilingRegistry.filing_type.is_(None),
            )
        )
    )

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

    # Fetch candidate filings
    filing_rows = query.order_by(FilingRegistry.discovered_at.desc()).limit(600).all()

    if not filing_rows:
        return {
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0,
            "pead_candidates_count": 0,
            "elite_pead_count": 0,
            "results": [],
        }

    # Deduplicate candidate filings so each symbol appears once per reporting period
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

    # Bulk fetch matching Screener fundamentals
    screener_records = {
        s.symbol: s
        for s in db.query(ScreenerGrowthRecord)
        .filter(ScreenerGrowthRecord.symbol.in_(symbols))
        .all()
    }

    # Bulk fetch matching Athena Omega Conviction flashes
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

    # Enrich each filing with financials & PEAD intelligence
    enriched_items: List[Dict[str, Any]] = []
    total_pead_candidates = 0
    total_elite_pead = 0

    for filing, comp in filing_rows:
        sym = filing.symbol
        scr = screener_records.get(sym)
        company_qrs = qr_by_company.get(filing.company_id, [])

        # Match quarterly result by period or pick the latest available
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

        # Extract growth & financial indicators
        rev = matched_qr.revenue if matched_qr and matched_qr.revenue is not None else (scr.latest_quarter_sales if scr else None)
        pat = matched_qr.net_profit if matched_qr and matched_qr.net_profit is not None else (scr.latest_quarter_net_profit if scr else None)
        eps = matched_qr.eps if matched_qr and matched_qr.eps is not None else (scr.latest_quarter_eps if scr else None)
        
        rev_growth = matched_qr.revenue_growth if matched_qr and matched_qr.revenue_growth is not None else (scr.quarterly_sales_yoy if scr else comp.revenue_growth)
        pat_growth = matched_qr.pat_growth if matched_qr and matched_qr.pat_growth is not None else (scr.quarterly_pat_yoy if scr else comp.pat_growth)
        roce = scr.roce if scr and scr.roce is not None else comp.roce
        opm = scr.opm_latest if scr and scr.opm_latest is not None else 12.0
        cur_price = scr.current_price if scr else None
        dma_50 = scr.dma_50 if scr else None
        d_e = scr.debt_to_equity if scr else None

        # Run PEAD Evaluation
        pead_res = PEADEngine.evaluate(
            revenue_growth_yoy=rev_growth,
            pat_growth_yoy=pat_growth,
            roce=roce,
            opm=opm,
            current_price=cur_price,
            dma_50=dma_50,
            debt_to_equity=d_e,
            symbol=sym,
            quarter=filing.period,
        )

        if pead_res["is_pead_candidate"]:
            total_pead_candidates += 1
        if pead_res["is_elite_pead"]:
            total_elite_pead += 1

        # Apply PEAD filter
        if pead_only and not pead_res["is_pead_candidate"]:
            continue
        if pead_tier and pead_tier != "ALL" and pead_res["pead_tier"] != pead_tier:
            continue

        item = {
            "id": filing.id,
            "company_id": comp.id,
            "symbol": sym,
            "company_name": comp.company,
            "exchange": filing.exchange,
            "sector": comp.sector or (scr.sector if scr else None),
            "market_cap": scr.market_cap if scr else comp.market_cap,
            "market_cap_category": scr.market_cap_category if scr else comp.market_cap_category,
            "filing_type": filing.filing_type or "Quarterly Financial Results",
            "period": filing.period,
            "announcement_date": filing.announcement_date.isoformat() if filing.announcement_date else None,
            "discovered_at": filing.discovered_at.isoformat() if filing.discovered_at else None,
            "pdf_url": filing.pdf_url,
            "download_status": filing.download_status or "PENDING",
            "parse_status": filing.parse_status or "PENDING",
            "revenue": rev,
            "net_profit": pat,
            "eps": eps,
            "opm": opm,
            "revenue_growth": rev_growth,
            "pat_growth": pat_growth,
            "roce": roce,
            "current_price": cur_price,
            "dma_50": dma_50,
            "pead_score": pead_res["pead_score"],
            "pead_tier": pead_res["pead_tier"],
            "pead_tier_label": pead_res["pead_tier_label"],
            "pead_color": pead_res["pead_color"],
            "drift_days": pead_res["drift_days"],
            "operating_leverage_ratio": pead_res["operating_leverage_ratio"],
            "is_pead_candidate": pead_res["is_pead_candidate"],
            "is_elite_pead": pead_res["is_elite_pead"],
            "pead_thesis": pead_res["thesis"],
            "pillar_breakdown": pead_res["pillar_breakdown"],
            "athena_conviction_score": athena_flashes.get(sym).athena_conviction_score if athena_flashes.get(sym) else None,
            "athena_conviction_grade": athena_flashes.get(sym).conviction_grade if athena_flashes.get(sym) else None,
            "athena_signal": athena_flashes.get(sym).flash_signal if athena_flashes.get(sym) else None,
        }
        enriched_items.append(item)

    # Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "pead_score":
        enriched_items.sort(key=lambda x: (x["pead_score"] or 0.0), reverse=reverse)
    elif sort_by == "revenue_growth":
        enriched_items.sort(key=lambda x: (x["revenue_growth"] or -9999.0), reverse=reverse)
    elif sort_by == "pat_growth":
        enriched_items.sort(key=lambda x: (x["pat_growth"] or -9999.0), reverse=reverse)
    elif sort_by == "revenue":
        enriched_items.sort(key=lambda x: (x["revenue"] or 0.0), reverse=reverse)
    elif sort_by == "net_profit":
        enriched_items.sort(key=lambda x: (x["net_profit"] or -9999.0), reverse=reverse)
    else:  # discovered_at
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
        "results": paginated_results,
    }


@router.get("/summary", response_model=QuarterlySummaryResponse)
def get_quarterly_summary(db: Session = Depends(get_db)):
    """
    Returns summary KPIs for the Exchange Quarterly Results & PEAD Radar.
    """
    total = (
        db.query(func.count(FilingRegistry.id))
        .filter(
            or_(
                FilingRegistry.filing_type.ilike("%result%"),
                FilingRegistry.filing_type.ilike("%financial%"),
                FilingRegistry.filing_type.ilike("%outcome%"),
                FilingRegistry.filing_type.ilike("%statement%"),
            )
        )
        .scalar()
        or 0
    )

    nse_count = (
        db.query(func.count(FilingRegistry.id))
        .filter(
            FilingRegistry.exchange == "NSE",
            or_(
                FilingRegistry.filing_type.ilike("%result%"),
                FilingRegistry.filing_type.ilike("%financial%"),
                FilingRegistry.filing_type.ilike("%outcome%"),
                FilingRegistry.filing_type.ilike("%statement%"),
            ),
        )
        .scalar()
        or 0
    )

    bse_count = max(0, total - nse_count)

    latest_filing = (
        db.query(FilingRegistry)
        .order_by(FilingRegistry.discovered_at.desc())
        .first()
    )

    # Distinct periods
    period_rows = (
        db.query(FilingRegistry.period)
        .distinct()
        .filter(FilingRegistry.period.isnot(None))
        .limit(10)
        .all()
    )
    periods = [p[0] for p in period_rows if p[0] and len(p[0]) > 2]

    # Quick sample for top PEAD candidate
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
        top_pick = {
            "symbol": c.symbol,
            "company": c.company,
            "pat_growth": c.pat_growth,
            "revenue_growth": c.revenue_growth,
            "pead_score": eval_res["pead_score"],
            "pead_tier": eval_res["pead_tier_label"],
            "drift_days": eval_res["drift_days"],
        }

    pead_candidates_count = (
        db.query(func.count(Company.id))
        .filter(Company.pat_growth.isnot(None), Company.pat_growth >= 25.0)
        .scalar()
        or 0
    )
    elite_pead_count = (
        db.query(func.count(Company.id))
        .filter(
            Company.pat_growth.isnot(None),
            Company.pat_growth >= 50.0,
            Company.revenue_growth.isnot(None),
            Company.revenue_growth >= 20.0,
        )
        .scalar()
        or 0
    )

    return {
        "total_filings": total,
        "pead_candidates": pead_candidates_count,
        "elite_pead": elite_pead_count,
        "nse_count": nse_count,
        "bse_count": bse_count,
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
