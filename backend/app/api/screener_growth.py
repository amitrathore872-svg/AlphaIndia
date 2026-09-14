"""
Alpha India Screener.in Growth API
Parallel Architecture - Isolated API for Screener.in Growth Scanner
Provides high-performance server-side sorting, multi-factor filtering, search, and pagination.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.screener_growth_record import ScreenerGrowthRecord

router = APIRouter(
    prefix="/screener-growth",
    tags=["Screener.in Growth Scanner"],
)


@router.get("")
def get_screener_growth_records(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    sector: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    min_roce: Optional[float] = Query(default=None),
    min_sales_growth_3yr: Optional[float] = Query(default=None),
    min_profit_growth_3yr: Optional[float] = Query(default=None),
    min_promoter_holding: Optional[float] = Query(default=None),
    sort_by: str = Query(default="last_updated"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated, sorted, and filtered list of Screener.in growth companies.
    """
    query = db.query(ScreenerGrowthRecord)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (ScreenerGrowthRecord.symbol.ilike(term))
            | (ScreenerGrowthRecord.company_name.ilike(term))
        )

    # Sector filter
    if sector and sector.strip() and sector.upper() != "ALL":
        query = query.filter(ScreenerGrowthRecord.sector == sector.strip())

    # Market Cap Category filter
    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(ScreenerGrowthRecord.market_cap_category == category.strip().upper())

    # Multi-factor fundamental filters
    if min_roce is not None:
        query = query.filter(ScreenerGrowthRecord.roce >= min_roce)
    if min_sales_growth_3yr is not None:
        query = query.filter(ScreenerGrowthRecord.sales_growth_3yr >= min_sales_growth_3yr)
    if min_profit_growth_3yr is not None:
        query = query.filter(ScreenerGrowthRecord.profit_growth_3yr >= min_profit_growth_3yr)
    if min_promoter_holding is not None:
        query = query.filter(ScreenerGrowthRecord.promoter_holding >= min_promoter_holding)

    total = query.count()

    # Dynamic server-side sorting
    sort_column = getattr(ScreenerGrowthRecord, sort_by, ScreenerGrowthRecord.last_updated)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc().nullslast())
    else:
        query = query.order_by(sort_column.desc().nullslast())

    offset = (page - 1) * limit
    records = query.offset(offset).limit(limit).all()

    results = []
    for r in records:
        results.append({
            "id": r.id,
            "symbol": r.symbol,
            "company_name": r.company_name,
            "sector": r.sector,
            "industry": r.industry,
            "exchange": r.exchange,
            "current_price": r.current_price,
            "market_cap": r.market_cap,
            "market_cap_category": r.market_cap_category,
            "stock_pe": r.stock_pe,
            "industry_pe": r.industry_pe,
            "price_to_book": r.price_to_book,
            "book_value": r.book_value,
            "dividend_yield": r.dividend_yield,
            "pat_12m": r.pat_12m,
            "eps_12m": r.eps_12m,
            "roce": r.roce,
            "roe": r.roe,
            "opm_latest": r.opm_latest,
            "sales_growth_ttm": r.sales_growth_ttm,
            "profit_growth_ttm": r.profit_growth_ttm,
            "sales_growth_3yr": r.sales_growth_3yr,
            "sales_growth_5yr": r.sales_growth_5yr,
            "profit_growth_3yr": r.profit_growth_3yr,
            "profit_growth_5yr": r.profit_growth_5yr,
            "return_3m": r.return_3m,
            "return_6m": r.return_6m,
            "return_1y": r.return_1y,
            "dma_50": r.dma_50,
            "dma_200": r.dma_200,
            "piotroski_score": r.piotroski_score,
            "stock_cagr_3yr": r.stock_cagr_3yr,
            "latest_quarter_name": r.latest_quarter_name,
            "latest_quarter_sales": r.latest_quarter_sales,
            "latest_quarter_net_profit": r.latest_quarter_net_profit,
            "quarterly_sales_yoy": r.quarterly_sales_yoy,
            "quarterly_pat_yoy": r.quarterly_pat_yoy,
            "debt_to_equity": r.debt_to_equity,
            "cfo_latest": r.cfo_latest,
            "free_cash_flow": r.free_cash_flow,
            "debtor_days": r.debtor_days,
            "inventory_days": r.inventory_days,
            "cash_conversion_cycle": r.cash_conversion_cycle,
            "promoter_holding": r.promoter_holding,
            "fii_holding": r.fii_holding,
            "dii_holding": r.dii_holding,
            "public_holding": r.public_holding,
            "high_52_week": r.high_52_week,
            "low_52_week": r.low_52_week,
            "health_score": r.health_score,
            "data_completeness_score": r.data_completeness_score,
            "last_updated": r.last_updated.isoformat() if r.last_updated else None,
            "import_source": r.import_source,
        })

    total_pages = max(1, (total + limit - 1) // limit)

    return {
        "success": True,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
        "results": results,
    }


@router.get("/filters")
def get_screener_growth_filters(db: Session = Depends(get_db)):
    """
    Returns dynamic filter options from screener_growth_records.
    """
    sectors = (
        db.query(ScreenerGrowthRecord.sector)
        .filter(ScreenerGrowthRecord.sector.isnot(None))
        .distinct()
        .order_by(ScreenerGrowthRecord.sector.asc())
        .all()
    )
    sector_list = [s[0] for s in sectors if s[0]]

    categories = (
        db.query(ScreenerGrowthRecord.market_cap_category)
        .filter(ScreenerGrowthRecord.market_cap_category.isnot(None))
        .distinct()
        .all()
    )
    category_list = [c[0] for c in categories if c[0]]

    total_count = db.query(ScreenerGrowthRecord).count()
    avg_roce = db.query(func.avg(ScreenerGrowthRecord.roce)).scalar() or 0.0
    avg_sales_growth = db.query(func.avg(ScreenerGrowthRecord.sales_growth_3yr)).scalar() or 0.0

    return {
        "success": True,
        "sectors": sector_list,
        "categories": category_list,
        "summary": {
            "total_companies": total_count,
            "avg_roce": round(avg_roce, 1),
            "avg_sales_growth_3yr": round(avg_sales_growth, 1),
        },
    }


@router.get("/{symbol}")
def get_screener_growth_company(symbol: str, db: Session = Depends(get_db)):
    """
    Returns single company Screener fundamental growth profile.
    """
    clean_symbol = symbol.strip().upper()
    rec = (
        db.query(ScreenerGrowthRecord)
        .filter(ScreenerGrowthRecord.symbol == clean_symbol)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail=f"Company {clean_symbol} not found in Screener records.")

    return {
        "success": True,
        "record": {
            "id": rec.id,
            "symbol": rec.symbol,
            "company_name": rec.company_name,
            "sector": rec.sector,
            "industry": rec.industry,
            "exchange": rec.exchange,
            "current_price": rec.current_price,
            "market_cap": rec.market_cap,
            "market_cap_category": rec.market_cap_category,
            "stock_pe": rec.stock_pe,
            "price_to_book": rec.price_to_book,
            "book_value": rec.book_value,
            "dividend_yield": rec.dividend_yield,
            "roce": rec.roce,
            "roe": rec.roe,
            "opm_latest": rec.opm_latest,
            "sales_growth_3yr": rec.sales_growth_3yr,
            "sales_growth_5yr": rec.sales_growth_5yr,
            "sales_growth_10yr": rec.sales_growth_10yr,
            "profit_growth_3yr": rec.profit_growth_3yr,
            "profit_growth_5yr": rec.profit_growth_5yr,
            "stock_cagr_3yr": rec.stock_cagr_3yr,
            "latest_quarter_name": rec.latest_quarter_name,
            "latest_quarter_sales": rec.latest_quarter_sales,
            "latest_quarter_net_profit": rec.latest_quarter_net_profit,
            "quarterly_sales_yoy": rec.quarterly_sales_yoy,
            "quarterly_pat_yoy": rec.quarterly_pat_yoy,
            "debt_to_equity": rec.debt_to_equity,
            "promoter_holding": rec.promoter_holding,
            "fii_holding": rec.fii_holding,
            "dii_holding": rec.dii_holding,
            "public_holding": rec.public_holding,
            "high_52_week": rec.high_52_week,
            "low_52_week": rec.low_52_week,
            "health_score": rec.health_score,
            "data_completeness_score": rec.data_completeness_score,
            "last_updated": rec.last_updated.isoformat() if rec.last_updated else None,
            "import_source": rec.import_source,
        },
    }
