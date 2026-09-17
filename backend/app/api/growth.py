# ==========================================================
# Alpha India Growth Screener PRO API
# Production Screener.in Architecture
# 100% Server-Side Sorting, Filtering & Pagination
# ==========================================================

from datetime import datetime
from math import ceil
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.watchlist import Watchlist, WatchlistItem

router = APIRouter(
    prefix="/growth-screener",
    tags=["Growth Screener PRO"],
)


# ==========================================================
# Latest Screener Growth + Quarterly Result Query
# ==========================================================

def latest_screener_query(db: Session):
    """
    Returns Master Company joined with authoritative ScreenerGrowthRecord fundamentals.
    Historical quarterly time-series are batched per-page for maximum query performance.
    """
    return (
        db.query(
            Company,
            ScreenerGrowthRecord,
        )
        .outerjoin(
            ScreenerGrowthRecord,
            ScreenerGrowthRecord.symbol == Company.symbol,
        )
        .filter(Company.listing_status == "Active")
        .filter(Company.is_growth_eligible.is_(True))
    )


# Backward-compatibility alias
latest_results_query = latest_screener_query



# ==========================================================
# Growth Screener PRO Endpoint
# ==========================================================

@router.get("")
def growth_screener(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),

    # Universal search
    search: str = Query(default=""),

    # Filter Ribbon Parameters
    sector: Optional[str] = Query(default=None),
    exchange: Optional[str] = Query(default=None),
    market_cap_category: Optional[str] = Query(default=None),

    min_pe: Optional[float] = Query(default=None),
    max_pe: Optional[float] = Query(default=None),

    min_pb: Optional[float] = Query(default=None),
    max_pb: Optional[float] = Query(default=None),

    min_roce: Optional[float] = Query(default=None),
    min_roe: Optional[float] = Query(default=None),

    min_sales_growth: Optional[float] = Query(default=None),
    min_profit_growth: Optional[float] = Query(default=None),

    min_health_score: Optional[float] = Query(default=None),
    max_health_score: Optional[float] = Query(default=None),

    # Watchlist & Conviction Parameters
    watchlist_only: bool = Query(default=False),
    watchlist_id: Optional[int] = Query(default=None),
    min_conviction: Optional[int] = Query(default=None),

    # Sorting
    sort_by: str = Query(default="market_cap"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),

    db: Session = Depends(get_db),
):
    """
    Enterprise Growth Screener PRO API.
    Powered by Screener.in institutional fundamentals and historical quarterly time-series.
    """

    query = latest_screener_query(db)

    # ------------------------------------------------------
    # Universal Search
    # ------------------------------------------------------
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Company.symbol.ilike(term),
                Company.company.ilike(term),
                Company.sector.ilike(term),
                Company.industry.ilike(term),
                ScreenerGrowthRecord.company_name.ilike(term),
            )
        )

    # ------------------------------------------------------
    # Sector Filter
    # ------------------------------------------------------
    if sector and sector.strip() and sector != "ALL":
        s_clean = sector.strip().lower()
        query = query.filter(
            or_(
                func.lower(Company.sector) == s_clean,
                func.lower(ScreenerGrowthRecord.sector) == s_clean,
            )
        )

    # ------------------------------------------------------
    # Exchange Filter
    # ------------------------------------------------------
    if exchange and exchange.strip() and exchange != "ALL":
        ex_val = exchange.strip().upper()
        if ex_val in ("NSE", "BSE"):
            query = query.filter(
                or_(
                    Company.exchange == ex_val,
                    Company.exchange == "BOTH",
                    ScreenerGrowthRecord.exchange == ex_val,
                )
            )

    # ------------------------------------------------------
    # Market Cap Category Filter
    # ------------------------------------------------------
    if market_cap_category and market_cap_category.strip() and market_cap_category != "ALL":
        cat_val = market_cap_category.strip().upper()
        query = query.filter(
            or_(
                ScreenerGrowthRecord.market_cap_category == cat_val,
                Company.market_cap_category == cat_val,
            )
        )

    # ------------------------------------------------------
    # Valuation & Fundamental Filters
    # ------------------------------------------------------
    if min_pe is not None:
        query = query.filter(ScreenerGrowthRecord.stock_pe >= min_pe)
    if max_pe is not None:
        query = query.filter(ScreenerGrowthRecord.stock_pe <= max_pe)

    if min_pb is not None:
        query = query.filter(ScreenerGrowthRecord.price_to_book >= min_pb)
    if max_pb is not None:
        query = query.filter(ScreenerGrowthRecord.price_to_book <= max_pb)

    if min_roce is not None:
        query = query.filter(
            func.coalesce(ScreenerGrowthRecord.roce, Company.roce) >= min_roce
        )

    if min_roe is not None:
        query = query.filter(ScreenerGrowthRecord.roe >= min_roe)

    if min_sales_growth is not None:
        query = query.filter(
            func.coalesce(
                ScreenerGrowthRecord.quarterly_sales_yoy,
                ScreenerGrowthRecord.sales_growth_ttm,
                ScreenerGrowthRecord.sales_growth_3yr,
                Company.revenue_growth,
            ) >= min_sales_growth
        )

    if min_profit_growth is not None:
        query = query.filter(
            func.coalesce(
                ScreenerGrowthRecord.quarterly_pat_yoy,
                ScreenerGrowthRecord.profit_growth_ttm,
                ScreenerGrowthRecord.profit_growth_3yr,
                Company.pat_growth,
            ) >= min_profit_growth
        )

    score_expr = func.coalesce(ScreenerGrowthRecord.health_score, Company.ai_score)
    if min_health_score is not None:
        query = query.filter(score_expr >= min_health_score)
    if max_health_score is not None:
        query = query.filter(score_expr <= max_health_score)

    # ------------------------------------------------------
    # Watchlist & Conviction Subquery & Filters
    # ------------------------------------------------------
    conviction_subq = (
        db.query(
            WatchlistItem.symbol.label("wl_sym"),
            func.max(WatchlistItem.confidence_score).label("max_conviction"),
        )
        .group_by(WatchlistItem.symbol)
        .subquery()
    )
    query = query.outerjoin(conviction_subq, conviction_subq.c.wl_sym == Company.symbol)

    if watchlist_id is not None:
        wl_q = db.query(WatchlistItem.symbol).filter(WatchlistItem.watchlist_id == watchlist_id)
        if min_conviction is not None:
            wl_q = wl_q.filter(WatchlistItem.confidence_score >= min_conviction)
        wl_syms = [r[0].strip().upper() for r in wl_q.all()]
        query = query.filter(Company.symbol.in_(wl_syms))
    elif watchlist_only or min_conviction is not None:
        wl_q = db.query(WatchlistItem.symbol)
        if min_conviction is not None:
            wl_q = wl_q.filter(WatchlistItem.confidence_score >= min_conviction)
        wl_syms = [r[0].strip().upper() for r in wl_q.distinct().all()]
        query = query.filter(Company.symbol.in_(wl_syms))

    # ------------------------------------------------------
    # Server-Side Sorting across all columns
    # ------------------------------------------------------
    sortable_columns = {
        "company": Company.company,
        "symbol": Company.symbol,
        "cmp": ScreenerGrowthRecord.current_price,
        "market_cap": ScreenerGrowthRecord.market_cap,
        "pe_ratio": ScreenerGrowthRecord.stock_pe,
        "conviction": func.coalesce(conviction_subq.c.max_conviction, 0),
        "pb_ratio": ScreenerGrowthRecord.price_to_book,
        "roce": func.coalesce(ScreenerGrowthRecord.roce, Company.roce),
        "roe": ScreenerGrowthRecord.roe,
        "opm": ScreenerGrowthRecord.opm_latest,
        "revenue_growth": func.coalesce(
            ScreenerGrowthRecord.quarterly_sales_yoy,
            ScreenerGrowthRecord.sales_growth_ttm,
            Company.revenue_growth,
        ),
        "sales_growth_yoy": func.coalesce(
            ScreenerGrowthRecord.quarterly_sales_yoy,
            ScreenerGrowthRecord.sales_growth_ttm,
            Company.revenue_growth,
        ),
        "sales_growth_qoq": func.coalesce(
            ScreenerGrowthRecord.quarterly_sales_qoq,
            ScreenerGrowthRecord.quarterly_sales_yoy,
            Company.revenue_growth,
        ),
        "pat_growth": func.coalesce(
            ScreenerGrowthRecord.quarterly_pat_yoy,
            ScreenerGrowthRecord.profit_growth_ttm,
            Company.pat_growth,
        ),
        "profit_growth_yoy": func.coalesce(
            ScreenerGrowthRecord.quarterly_pat_yoy,
            ScreenerGrowthRecord.profit_growth_ttm,
            Company.pat_growth,
        ),
        "profit_growth_qoq": func.coalesce(
            ScreenerGrowthRecord.quarterly_pat_qoq,
            ScreenerGrowthRecord.quarterly_pat_yoy,
            Company.pat_growth,
        ),
        "sales_cagr_3y": ScreenerGrowthRecord.sales_growth_3yr,
        "profit_cagr_3y": ScreenerGrowthRecord.profit_growth_3yr,
        "health_score": score_expr,
        "last_updated": func.coalesce(ScreenerGrowthRecord.last_updated, Company.updated_at),
    }

    sort_column = sortable_columns.get(
        sort_by,
        ScreenerGrowthRecord.market_cap,
    )

    ordering = (
        asc(sort_column).nullslast()
        if sort_order == "asc"
        else desc(sort_column).nullslast()
    )

    total_items = query.order_by(None).count()

    rows = (
        query.order_by(ordering, asc(Company.company))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # ------------------------------------------------------
    # Batch Retrieve Historical Quarters for QoQ & 3Y CAGR
    # ------------------------------------------------------
    company_ids = [c.id for c, _ in rows]
    history_by_company = {}

    if company_ids:
        history_quarters = (
            db.query(
                QuarterlyResult.company_id,
                QuarterlyResult.quarter,
                QuarterlyResult.revenue,
                QuarterlyResult.net_profit,
                QuarterlyResult.period_end,
                QuarterlyResult.result_date,
                QuarterlyResult.revenue_growth,
                QuarterlyResult.pat_growth,
            )
            .filter(QuarterlyResult.company_id.in_(company_ids))
            .order_by(
                QuarterlyResult.company_id,
                QuarterlyResult.period_end.desc().nullslast(),
                QuarterlyResult.result_date.desc().nullslast(),
                QuarterlyResult.id.desc(),
            )
            .all()
        )

        for r in history_quarters:
            history_by_company.setdefault(r.company_id, []).append(r)

    # ------------------------------------------------------
    # Retrieve Watchlist Information for Page Symbols
    # ------------------------------------------------------
    page_symbols = [c.symbol for c, _ in rows]
    watchlist_info_by_symbol = {}
    if page_symbols:
        wl_items = (
            db.query(WatchlistItem, Watchlist)
            .join(Watchlist, Watchlist.id == WatchlistItem.watchlist_id)
            .filter(WatchlistItem.symbol.in_(page_symbols))
            .all()
        )
        for item, wl in wl_items:
            sym = item.symbol.strip().upper()
            if sym not in watchlist_info_by_symbol or item.confidence_score > (
                watchlist_info_by_symbol[sym].get("conviction_score") or 0
            ):
                watchlist_info_by_symbol[sym] = {
                    "in_watchlist": True,
                    "watchlist_item_id": item.id,
                    "watchlist_id": wl.id,
                    "watchlist_name": wl.name,
                    "conviction_score": item.confidence_score,
                    "watchlist_comment": item.comment,
                    "target_price": item.target_price,
                }

    # ------------------------------------------------------
    # Result Serialization
    # ------------------------------------------------------
    results = []

    for index, (company, scr) in enumerate(rows, start=(page - 1) * limit + 1):
        qh = history_by_company.get(company.id, [])
        q0 = qh[0] if len(qh) > 0 else None
        q1 = qh[1] if len(qh) > 1 else None
        q4 = qh[4] if len(qh) > 4 else None
        q12 = qh[12] if len(qh) > 12 else None

        # Sales Growth QoQ
        sales_qoq = None
        if q0 and q1 and q1.revenue and q1.revenue != 0 and q0.revenue:
            sales_qoq = round(((q0.revenue - q1.revenue) / abs(q1.revenue)) * 100.0, 2)
        elif scr and scr.quarterly_sales_qoq is not None:
            sales_qoq = scr.quarterly_sales_qoq

        # Profit Growth QoQ
        profit_qoq = None
        if q0 and q1 and q1.net_profit and q1.net_profit != 0 and q0.net_profit:
            denom_qoq = abs(q1.net_profit) if abs(q1.net_profit) >= 0.1 else 0.5
            profit_qoq = round(((q0.net_profit - q1.net_profit) / denom_qoq) * 100.0, 2)
        elif scr and scr.quarterly_pat_qoq is not None:
            profit_qoq = scr.quarterly_pat_qoq

        # Sales 3Y CAGR
        sales_cagr = None
        if scr and scr.sales_growth_3yr is not None:
            sales_cagr = scr.sales_growth_3yr
        elif q0 and q12 and q12.revenue and q12.revenue > 0 and q0.revenue and q0.revenue > 0:
            try:
                sales_cagr = round((((q0.revenue / q12.revenue) ** (1.0 / 3.0)) - 1.0) * 100.0, 2)
            except Exception:
                pass
        elif q0 and q4 and q4.revenue and q4.revenue > 0 and q0.revenue and q0.revenue > 0:
            sales_cagr = round(((q0.revenue / q4.revenue) - 1.0) * 100.0, 2)

        # Profit 3Y CAGR
        profit_cagr = None
        if scr and scr.profit_growth_3yr is not None:
            profit_cagr = scr.profit_growth_3yr
        elif q0 and q12 and q12.net_profit and q12.net_profit > 0 and q0.net_profit and q0.net_profit > 0:
            try:
                profit_cagr = round((((q0.net_profit / q12.net_profit) ** (1.0 / 3.0)) - 1.0) * 100.0, 2)
            except Exception:
                pass
        elif q0 and q4 and q4.net_profit and q4.net_profit > 0 and q0.net_profit and q0.net_profit > 0:
            profit_cagr = round(((q0.net_profit / q4.net_profit) - 1.0) * 100.0, 2)

        # Valuation & Multiples (Screener.in primary)
        cmp_val = scr.current_price if scr else None
        mcap_val = (scr.market_cap if scr and scr.market_cap is not None else None) or company.market_cap
        mcap_cat = (
            (scr.market_cap_category if scr and scr.market_cap_category else None)
            or getattr(company, "market_cap_category", "SMALL")
            or "SMALL"
        )
        pe_val = scr.stock_pe if scr else None
        ind_pe_val = scr.industry_pe if scr else None
        pb_val = scr.price_to_book if scr else None
        peg_val = scr.peg_ratio if scr else None

        roce_val = (
            (scr.roce if scr and scr.roce is not None else None)
            or (company.roce if company and company.roce is not None else None)
        )
        roe_val = scr.roe if scr else None
        opm_val = scr.opm_latest if scr else None

        # YoY Sales Growth
        sales_yoy = (
            (scr.quarterly_sales_yoy if scr and scr.quarterly_sales_yoy is not None else None)
            or (scr.sales_growth_ttm if scr and scr.sales_growth_ttm is not None else None)
            or (q0.revenue_growth if q0 and q0.revenue_growth is not None else None)
            or company.revenue_growth
        )

        # YoY Profit Growth
        pat_yoy = (
            (scr.quarterly_pat_yoy if scr and scr.quarterly_pat_yoy is not None else None)
            or (scr.profit_growth_ttm if scr and scr.profit_growth_ttm is not None else None)
            or (q0.pat_growth if q0 and q0.pat_growth is not None else None)
            or company.pat_growth
        )

        # Health score
        health = (
            (scr.health_score if scr and scr.health_score is not None else None)
            or (company.ai_score if company and company.ai_score is not None else 50.0)
        )

        # Last updated date string
        last_upd_dt = (
            (scr.last_updated if scr and scr.last_updated else None)
            or getattr(company, "updated_at", None)
        )

        # Result date string
        res_date_str = None
        if q0 and q0.period_end:
            res_date_str = q0.period_end.isoformat()
        elif q0 and q0.result_date:
            res_date_str = q0.result_date.isoformat()
        elif scr and scr.latest_quarter_name:
            res_date_str = scr.latest_quarter_name


        results.append(
            {
                "index": index,
                "symbol": company.symbol,
                "company": (scr.company_name if scr and scr.company_name else None) or company.company,
                "sector": (scr.sector if scr and scr.sector else None) or company.sector or "Unknown",
                "industry": (scr.industry if scr and scr.industry else None) or company.industry or "Unknown",
                "exchange": getattr(company, "exchange", "NSE") or (scr.exchange if scr else "NSE") or "NSE",

                # Market Valuation (Screener.in)
                "cmp": cmp_val,
                "market_cap": mcap_val,
                "market_cap_category": mcap_cat,
                "pe_ratio": pe_val,
                "industry_pe": ind_pe_val,
                "pb_ratio": pb_val,
                "peg_ratio": peg_val,

                # Returns & Margins
                "roce": round(float(roce_val), 2) if roce_val is not None else None,
                "roe": round(float(roe_val), 2) if roe_val is not None else None,
                "opm": round(float(opm_val), 2) if opm_val is not None else None,

                # Sales Growth
                "sales_growth_yoy": round(float(sales_yoy), 2) if sales_yoy is not None else None,
                "sales_growth_qoq": sales_qoq,

                # Profit Growth
                "profit_growth_yoy": round(float(pat_yoy), 2) if pat_yoy is not None else None,
                "profit_growth_qoq": profit_qoq,

                # Compounders
                "sales_cagr_3y": round(float(sales_cagr), 2) if sales_cagr is not None else None,
                "profit_cagr_3y": round(float(profit_cagr), 2) if profit_cagr is not None else None,

                # Quality / Health
                "health_score": round(float(health), 1) if health is not None else None,
                "piotroski_score": scr.piotroski_score if scr else None,
                "result_date": res_date_str,
                "last_updated": last_upd_dt.isoformat() if last_upd_dt else None,

                # Watchlist & Conviction
                "in_watchlist": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("in_watchlist", False),
                "watchlist_item_id": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("watchlist_item_id"),
                "watchlist_id": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("watchlist_id"),
                "watchlist_name": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("watchlist_name"),
                "conviction_score": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("conviction_score"),
                "watchlist_comment": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("watchlist_comment"),
                "target_price": watchlist_info_by_symbol.get(company.symbol.strip().upper(), {}).get("target_price"),

                # Backward compatibility aliases
                "revenue_growth": round(float(sales_yoy), 2) if sales_yoy is not None else None,
                "pat_growth": round(float(pat_yoy), 2) if pat_yoy is not None else None,
            }
        )

    return {
        "success": True,
        "results": results,
        "page": page,
        "limit": limit,
        "total": total_items,
        "total_pages": ceil(total_items / limit) if total_items else 1,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }


# ==========================================================
# Growth Screener Filters Dropdown Options (Cached TTL: 5 min)
# ==========================================================

import time
_filters_cache: Dict[str, Any] = {"timestamp": 0.0, "data": None}


@router.get("/filters")
def growth_screener_filters(db: Session = Depends(get_db)):
    """
    Returns dynamic dropdown options for Growth Screener filters.
    Cached for 5 minutes in memory to avoid repetitive full-table DISTINCT scans.
    """
    now = time.time()
    if _filters_cache["data"] is not None and (now - _filters_cache["timestamp"]) < 300:
        return _filters_cache["data"]

    sectors = (
        db.query(Company.sector)
        .filter(Company.listing_status == "Active")
        .filter(Company.is_growth_eligible.is_(True))
        .filter(Company.sector.isnot(None))
        .filter(Company.sector != "")
        .filter(Company.sector != "Unknown")
        .distinct()
        .order_by(Company.sector)
        .all()
    )

    data = {
        "success": True,
        "sectors": [row[0] for row in sectors if row[0]],
        "exchanges": ["ALL", "NSE", "BSE"],
        "market_caps": ["ALL", "LARGE", "MID", "SMALL", "MICRO"],
        "pe_ranges": [
            {"label": "All P/E", "min": None, "max": None},
            {"label": "< 15 (Value)", "min": 0, "max": 15},
            {"label": "15 - 30 (Moderate)", "min": 15, "max": 30},
            {"label": "30 - 50 (Growth)", "min": 30, "max": 50},
            {"label": "> 50 (High Multiple)", "min": 50, "max": None},
        ],
        "pb_ranges": [
            {"label": "All P/B", "min": None, "max": None},
            {"label": "< 2", "min": 0, "max": 2},
            {"label": "2 - 5", "min": 2, "max": 5},
            {"label": "> 5", "min": 5, "max": None},
        ],
        "roce_ranges": [
            {"label": "All ROCE", "min": None},
            {"label": "> 15%", "min": 15},
            {"label": "> 20%", "min": 20},
            {"label": "> 25%", "min": 25},
        ],
        "roe_ranges": [
            {"label": "All ROE", "min": None},
            {"label": "> 12%", "min": 12},
            {"label": "> 18%", "min": 18},
            {"label": "> 25%", "min": 25},
        ],
        "health_score_ranges": [
            {"label": "All Scores", "min": None, "max": None},
            {"label": "80 - 100 (Strong)", "min": 80, "max": 100},
            {"label": "60 - 79 (Moderate)", "min": 60, "max": 79},
            {"label": "< 60 (Weak)", "min": 0, "max": 59},
        ],
    }

    _filters_cache["timestamp"] = now
    _filters_cache["data"] = data
    return data