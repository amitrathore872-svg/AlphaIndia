"""
Alpha India - Custom Quantitative Screener Formula API
Provides formula validation, execution, preset strategies, and metric definitions.
"""

import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.db.database import get_db
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.formula_parser import (
    QuantitativeFormulaService,
    FormulaParserError,
    METRIC_MAP,
)

router = APIRouter(
    prefix="/api/v1/screener-formula",
    tags=["Quantitative Screener Formula Engine"],
)


class FormulaValidateRequest(BaseModel):
    formula: str


class FormulaRunRequest(BaseModel):
    formula: str
    page: int = 1
    limit: int = 25
    sort_by: str = "market_cap"
    sort_order: str = "desc"


@router.post("/validate")
def validate_formula(req: FormulaValidateRequest):
    """
    Validates the quantitative syntax of a custom screener formula
    and returns parsed metric tokens and character error offsets.
    """
    return QuantitativeFormulaService.validate_formula(req.formula)


@router.get("/presets")
def get_presets():
    """
    Returns curated institutional preset strategies ready for one-click execution.
    """
    return {
        "success": True,
        "presets": QuantitativeFormulaService.get_presets(),
    }


@router.get("/metrics")
def get_available_metrics():
    """
    Returns all supported financial metrics grouped by fundamental category
    for UI autocomplete chips and syntax hints.
    """
    categories = [
        {
            "category": "Growth & Acceleration",
            "items": [
                {"name": "Sales Growth", "token": "Sales Growth > 20", "desc": "Quarterly Sales YoY (%)"},
                {"name": "Profit Growth", "token": "Profit Growth > 25", "desc": "Quarterly Net Profit YoY (%)"},
                {"name": "Sales Growth 3Yr", "token": "Sales Growth 3Yr > 15", "desc": "Compounded 3-Year Sales Growth (%)"},
                {"name": "Profit Growth 3Yr", "token": "Profit Growth 3Yr > 20", "desc": "Compounded 3-Year Profit Growth (%)"},
                {"name": "Sales QoQ", "token": "Quarterly Sales QoQ > 5", "desc": "Quarter-on-Quarter Sales Growth (%)"},
                {"name": "Profit QoQ", "token": "Quarterly PAT QoQ > 10", "desc": "Quarter-on-Quarter Profit Growth (%)"},
            ],
        },
        {
            "category": "Profitability & Returns",
            "items": [
                {"name": "ROCE", "token": "ROCE > 20", "desc": "Return on Capital Employed (%)"},
                {"name": "ROE", "token": "ROE > 18", "desc": "Return on Equity (%)"},
                {"name": "OPM", "token": "OPM > 15", "desc": "Operating Profit Margin (%)"},
            ],
        },
        {
            "category": "Valuation & Pricing",
            "items": [
                {"name": "PE", "token": "PE < 25", "desc": "Price to Earnings Multiple"},
                {"name": "PB", "token": "PB < 3.0", "desc": "Price to Book Multiple"},
                {"name": "Market Cap", "token": "Market Cap > 500", "desc": "Market Capitalization (₹ Cr)"},
                {"name": "CMP", "token": "CMP > 100", "desc": "Current Market Price (₹)"},
                {"name": "Dividend Yield", "token": "Dividend Yield > 2.0", "desc": "Dividend Yield (%)"},
            ],
        },
        {
            "category": "Quality & Balance Sheet",
            "items": [
                {"name": "Debt to Equity", "token": "Debt to Equity < 0.5", "desc": "Solvency Leverage Ratio"},
                {"name": "Piotroski Score", "token": "Piotroski Score >= 7", "desc": "Fundamental Health Score (0-9)"},
                {"name": "Health Score", "token": "Health Score > 75", "desc": "Alpha India Institutional Score (0-100)"},
                {"name": "Interest Coverage", "token": "Interest Coverage > 4", "desc": "EBIT / Interest Expense"},
            ],
        },
        {
            "category": "Cash Flow & Efficiency",
            "items": [
                {"name": "FCF Yield", "token": "FCF Yield > 3.5", "desc": "Free Cash Flow Yield % (FCF / MCAP)"},
                {"name": "CFO to PAT", "token": "CFO to PAT > 0.9", "desc": "Operating Cash Flow / Net Profit (Earnings Quality)"},
                {"name": "Cash Conversion Cycle", "token": "Cash Conversion Cycle < 60", "desc": "Working Capital Cycle (Days)"},
                {"name": "CFO", "token": "CFO > 100", "desc": "Cash Flow from Operations (₹ Cr)"},
                {"name": "Free Cash Flow", "token": "Free Cash Flow > 50", "desc": "Free Cash Flow (₹ Cr)"},
                {"name": "Debtor Days", "token": "Debtor Days < 45", "desc": "Receivable Days"},
                {"name": "Inventory Days", "token": "Inventory Days < 60", "desc": "Inventory Turnover Days"},
            ],
        },
        {
            "category": "Technical Momentum & Risk",
            "items": [
                {"name": "RSI", "token": "RSI >= 55", "desc": "14-Day Relative Strength Index (Momentum / Oversold)"},
                {"name": "Beta", "token": "Beta < 1.0", "desc": "Systematic Market Beta vs Nifty 50"},
                {"name": "Distance to 52W High", "token": "Distance to 52W High <= 15", "desc": "% Drawdown from 52-Week High Pivot"},
                {"name": "DMA 50", "token": "CMP > DMA 50", "desc": "50-Day Moving Average (₹)"},
                {"name": "DMA 200", "token": "CMP > DMA 200", "desc": "200-Day Moving Average (₹)"},
            ],
        },
        {
            "category": "Ownership & Governance",
            "items": [
                {"name": "Promoter Holding", "token": "Promoter Holding > 50", "desc": "Promoter Equity Stake (%)"},
                {"name": "FII Holding", "token": "FII Holding > 10", "desc": "Foreign Institutional Stake (%)"},
                {"name": "DII Holding", "token": "DII Holding > 10", "desc": "Domestic Institutional Stake (%)"},
            ],
        },
    ]
    return {"success": True, "categories": categories}


@router.post("/run")
def execute_formula(req: FormulaRunRequest, db: Session = Depends(get_db)):
    """
    Compiles and executes a custom quantitative screening formula against live warehouse records.
    Supports server-side sorting, pagination, and execution latency timing.
    """
    t0 = time.perf_counter()
    clean_formula = req.formula.strip()
    if not clean_formula:
        raise HTTPException(status_code=400, detail="Formula expression cannot be empty.")

    try:
        filter_clause = QuantitativeFormulaService.compile_filter(clean_formula)
    except FormulaParserError as e:
        raise HTTPException(status_code=400, detail=f"Formula Syntax Error: {e.message}")
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Failed to parse formula: {str(ex)}")

    query = (
        db.query(ScreenerGrowthRecord, Company)
        .outerjoin(Company, Company.symbol == ScreenerGrowthRecord.symbol)
        .filter(filter_clause)
    )

    total_matches = query.count()

    # Dynamic Column Sorting
    sort_column_map = {
        "market_cap": ScreenerGrowthRecord.market_cap,
        "current_price": ScreenerGrowthRecord.current_price,
        "roce": ScreenerGrowthRecord.roce,
        "roe": ScreenerGrowthRecord.roe,
        "stock_pe": ScreenerGrowthRecord.stock_pe,
        "pe": ScreenerGrowthRecord.stock_pe,
        "sales_growth": ScreenerGrowthRecord.quarterly_sales_yoy,
        "profit_growth": ScreenerGrowthRecord.quarterly_pat_yoy,
        "debt_to_equity": ScreenerGrowthRecord.debt_to_equity,
        "piotroski_score": ScreenerGrowthRecord.piotroski_score,
        "health_score": ScreenerGrowthRecord.health_score,
        "fcf_yield": ScreenerGrowthRecord.fcf_yield,
        "rsi": ScreenerGrowthRecord.rsi_14,
        "rsi_14": ScreenerGrowthRecord.rsi_14,
        "beta": ScreenerGrowthRecord.beta,
        "distance_52w_high": ScreenerGrowthRecord.distance_52w_high,
        "cfo_to_pat": ScreenerGrowthRecord.cfo_to_pat,
        "symbol": ScreenerGrowthRecord.symbol,
    }

    sort_col = sort_column_map.get(req.sort_by.lower(), ScreenerGrowthRecord.market_cap)
    if req.sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col).nullslast())
    else:
        query = query.order_by(desc(sort_col).nullslast())

    # Pagination
    limit = max(1, min(100, req.limit))
    page = max(1, req.page)
    offset = (page - 1) * limit

    records = query.offset(offset).limit(limit).all()
    duration_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    results = []
    for scr, comp in records:
        results.append({
            "symbol": scr.symbol,
            "company_name": scr.company_name or (comp.company if comp else scr.symbol),
            "sector": scr.sector or (comp.sector if comp else "Diversified"),
            "industry": scr.industry,
            "current_price": scr.current_price,
            "market_cap": scr.market_cap,
            "market_cap_category": scr.market_cap_category,
            "stock_pe": scr.stock_pe,
            "price_to_book": scr.price_to_book,
            "roce": scr.roce,
            "roe": scr.roe,
            "opm": scr.opm_latest,
            "quarterly_sales_yoy": scr.quarterly_sales_yoy,
            "quarterly_pat_yoy": scr.quarterly_pat_yoy,
            "sales_growth_3yr": scr.sales_growth_3yr,
            "profit_growth_3yr": scr.profit_growth_3yr,
            "debt_to_equity": scr.debt_to_equity,
            "piotroski_score": scr.piotroski_score,
            "health_score": scr.health_score,
            "fcf_yield": scr.fcf_yield,
            "rsi_14": scr.rsi_14,
            "beta": scr.beta,
            "distance_52w_high": scr.distance_52w_high,
            "cfo_to_pat": scr.cfo_to_pat,
            "promoter_holding": scr.promoter_holding,
            "techno_funda_url": f"/techno-funda/{scr.symbol}",
        })

    import math
    total_pages = math.ceil(total_matches / limit) if total_matches > 0 else 1

    return {
        "success": True,
        "formula": clean_formula,
        "total": total_matches,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "execution_time_ms": duration_ms,
        "results": results,
    }
