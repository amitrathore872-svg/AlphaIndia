"""
Alpha India — Investor Intelligence & Concall API Router
Provides institutional endpoints for querying Investor Presentations, Concall Transcripts,
and Senior Buy-Side Analyst LLM Insights across Indian Equities.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.investor_intelligence_service import InvestorIntelligenceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/investor-intelligence", tags=["Investor Intelligence & Concalls"])


@router.get("/opportunities", response_model=Dict[str, Any])
def get_live_multibagger_opportunities(
    db: Session = Depends(get_db),
):
    """
    Returns real-time actionable multibagger & exponential growth opportunities
    discovered across scanned earnings calls, categorized into:
    1. READY_TO_BUY_STAGE_2: Harmonic alignment of fundamental trigger and Stage 2 uptrend.
    2. INFLECTION_BASE_AT_SUPPORT: Overdelivering on execution, resting on 200 DMA support / near 50 DMA pivot.
    3. STAGE_4_WARNING: Bullish management narrative suppressed due to active institutional distribution.
    """
    return InvestorIntelligenceService.get_active_opportunities(db)


@router.get("/feed", response_model=Dict[str, Any])
def get_insights_feed(
    stance: Optional[str] = Query(default=None, description="Filter by institutional stance"),
    doc_type: Optional[str] = Query(default=None, description="Filter by INVESTOR_PRESENTATION or CONCALL_TRANSCRIPT"),
    symbol: Optional[str] = Query(default=None, description="Search by stock symbol"),
    min_score: Optional[float] = Query(default=None, description="Minimum growth conviction score"),
    transformational_only: Optional[bool] = Query(default=None, description="Filter for only exponential / transformational catalysts"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns paginated feed of senior buy-side analyst insights across equities.
    """
    query = db.query(InvestorIntelligenceInsight)

    if stance and isinstance(stance, str):
        query = query.filter(InvestorIntelligenceInsight.institutional_stance == stance.upper())
    if doc_type and isinstance(doc_type, str):
        query = query.filter(InvestorIntelligenceInsight.doc_type == doc_type.upper())
    if symbol and isinstance(symbol, str):
        query = query.filter(InvestorIntelligenceInsight.symbol.ilike(f"%{symbol.strip()}%"))
    if min_score is not None and isinstance(min_score, (int, float)):
        query = query.filter(InvestorIntelligenceInsight.growth_conviction_score >= min_score)
    if transformational_only is True:
        query = query.filter(InvestorIntelligenceInsight.is_transformational_catalyst == True)

    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 20

    total = query.count()
    insights = (
        query.order_by(desc(InvestorIntelligenceInsight.analyzed_at), desc(InvestorIntelligenceInsight.id))
        .offset((page_val - 1) * limit_val)
        .limit(limit_val)
        .all()
    )

    items = []
    for ins in insights:
        doc = ins.document
        items.append({
            "id": ins.id,
            "document_id": ins.document_id,
            "symbol": ins.symbol,
            "company_name": ins.company_name,
            "fiscal_period": ins.fiscal_period,
            "doc_type": ins.doc_type,
            "institutional_stance": ins.institutional_stance,
            "growth_conviction_score": ins.growth_conviction_score,
            "management_sentiment_score": ins.management_sentiment_score,
            "management_credibility_rating": ins.management_credibility_rating,
            "management_tone": ins.management_tone,
            "executive_thesis": ins.executive_thesis,

            # Transformational / Exponential Catalyst Radar
            "is_transformational_catalyst": ins.is_transformational_catalyst,
            "transformational_category": ins.transformational_category,
            "catalyst_headline": ins.catalyst_headline,
            "immediate_reaction_rationale": ins.immediate_reaction_rationale,
            "exponential_growth_multiple": ins.exponential_growth_multiple,

            "capacity_utilization_pct": ins.capacity_utilization_pct,
            "cwip_amount_cr": ins.cwip_amount_cr,
            "capex_guidance_fy": ins.capex_guidance_fy,
            "commissioning_timeline_cod": ins.commissioning_timeline_cod,
            "expected_asset_turnover": ins.expected_asset_turnover,
            "volume_vs_price_driver": ins.volume_vs_price_driver,
            "ebitda_margin_guidance_corridor": ins.ebitda_margin_guidance_corridor,
            "margin_drivers": ins.margin_drivers,
            "input_cost_pass_through": ins.input_cost_pass_through,
            "value_added_mix_pct": ins.value_added_mix_pct,
            "executable_order_book_cr": ins.executable_order_book_cr,
            "book_to_bill_ratio": ins.book_to_bill_ratio,
            "bid_pipeline_cr": ins.bid_pipeline_cr,
            "execution_duration_months": ins.execution_duration_months,
            "ocf_to_ebitda_ratio_pct": ins.ocf_to_ebitda_ratio_pct,
            "working_capital_days": ins.working_capital_days,
            "working_capital_trend": ins.working_capital_trend,
            "debt_outlook": ins.debt_outlook,
            "key_overhang_questioned_by_analysts": ins.key_overhang_questioned_by_analysts,
            "management_direct_answer": ins.management_direct_answer,
            "evasiveness_detected": ins.evasiveness_detected,
            "guidance_change": ins.guidance_change,
            "critical_monitorables": ins.critical_monitorables,
            "layman_summary": ins.layman_summary,
            "direct_quotes": ins.direct_quotes,
            "analyst_grill_quotes": ins.analyst_grill_quotes,
            "actionable_gameplan": ins.actionable_gameplan,
            "pdf_url": doc.pdf_url if doc else None,
            "headline": doc.headline if doc else None,
            "analyzed_at": ins.analyzed_at.isoformat() if ins.analyzed_at else None,
            "llm_model": ins.llm_model,
        })

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items,
    }


@router.get("/company/{symbol}", response_model=Dict[str, Any])
def get_company_intelligence(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Returns complete timeline of presentations, concalls, and analyst insights for a single equity.
    """
    sym = symbol.strip().upper()

    # Documents
    docs = (
        db.query(InvestorDocument)
        .filter(InvestorDocument.symbol == sym)
        .order_by(desc(InvestorDocument.announcement_date), desc(InvestorDocument.id))
        .all()
    )

    # Insights
    insights = (
        db.query(InvestorIntelligenceInsight)
        .filter(InvestorIntelligenceInsight.symbol == sym)
        .order_by(desc(InvestorIntelligenceInsight.analyzed_at), desc(InvestorIntelligenceInsight.id))
        .all()
    )

    doc_list = []
    for d in docs:
        doc_list.append({
            "id": d.id,
            "doc_type": d.doc_type,
            "fiscal_period": d.fiscal_period,
            "announcement_date": d.announcement_date.isoformat() if d.announcement_date else None,
            "headline": d.headline,
            "pdf_url": d.pdf_url,
            "status": d.status,
            "raw_text_length": d.raw_text_length,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    insight_list = []
    for ins in insights:
        doc = ins.document
        insight_list.append({
            "id": ins.id,
            "document_id": ins.document_id,
            "doc_type": ins.doc_type,
            "fiscal_period": ins.fiscal_period,
            "institutional_stance": ins.institutional_stance,
            "growth_conviction_score": ins.growth_conviction_score,
            "management_sentiment_score": ins.management_sentiment_score,
            "management_tone": ins.management_tone,
            "executive_thesis": ins.executive_thesis,

            # Transformational Catalyst Fields
            "is_transformational_catalyst": ins.is_transformational_catalyst,
            "transformational_category": ins.transformational_category,
            "catalyst_headline": ins.catalyst_headline,
            "immediate_reaction_rationale": ins.immediate_reaction_rationale,
            "exponential_growth_multiple": ins.exponential_growth_multiple,

            "capacity_utilization_pct": ins.capacity_utilization_pct,
            "cwip_amount_cr": ins.cwip_amount_cr,
            "capex_guidance_fy": ins.capex_guidance_fy,
            "commissioning_timeline_cod": ins.commissioning_timeline_cod,
            "expected_asset_turnover": ins.expected_asset_turnover,
            "ebitda_margin_guidance_corridor": ins.ebitda_margin_guidance_corridor,
            "margin_drivers": ins.margin_drivers,
            "executable_order_book_cr": ins.executable_order_book_cr,
            "book_to_bill_ratio": ins.book_to_bill_ratio,
            "working_capital_days": ins.working_capital_days,
            "key_overhang_questioned_by_analysts": ins.key_overhang_questioned_by_analysts,
            "management_direct_answer": ins.management_direct_answer,
            "critical_monitorables": ins.critical_monitorables,
            "layman_summary": ins.layman_summary,
            "direct_quotes": ins.direct_quotes,
            "analyst_grill_quotes": ins.analyst_grill_quotes,
            "actionable_gameplan": ins.actionable_gameplan,
            "pdf_url": doc.pdf_url if doc else None,
            "analyzed_at": ins.analyzed_at.isoformat() if ins.analyzed_at else None,
        })

    latest_insight = insight_list[0] if insight_list else None

    return {
        "symbol": sym,
        "total_documents": len(docs),
        "total_insights": len(insights),
        "latest_insight": latest_insight,
        "insights_history": insight_list,
        "documents": doc_list,
    }


@router.post("/harvest/{symbol}", response_model=Dict[str, Any])
def trigger_harvest(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Harvests all investor presentations and concall transcripts for a company from exchange feeds and Screener.
    """
    sym = symbol.strip().upper()
    res = InvestorDocumentHarvester.harvest_for_symbol(db, sym)
    return res


@router.post("/harvest-market", response_model=Dict[str, Any])
def trigger_market_harvest(
    db: Session = Depends(get_db),
):
    """
    Polls real-time NSE and BSE corporate announcement feeds for newly dropped PPTs & Transcripts.
    """
    res = InvestorDocumentHarvester.harvest_from_exchange_wires(db)
    return res


@router.post("/analyze/{document_id}", response_model=Dict[str, Any])
def trigger_document_analysis(
    document_id: int,
    db: Session = Depends(get_db),
):
    """
    Executes full senior analyst interrogation on an InvestorDocument.
    """
    insight = InvestorIntelligenceService.analyze_document(db, document_id)
    if not insight:
        raise HTTPException(status_code=400, detail="Failed to analyze document. Ensure valid PDF content.")

    return {
        "status": "SUCCESS",
        "insight_id": insight.id,
        "symbol": insight.symbol,
        "stance": insight.institutional_stance,
        "conviction_score": insight.growth_conviction_score,
        "management_tone": insight.management_tone,
        "thesis": insight.executive_thesis,
    }


@router.post("/analyze-latest/{symbol}", response_model=Dict[str, Any])
def analyze_latest_for_symbol(
    symbol: str,
    db: Session = Depends(get_db),
):
    """
    Finds the most recent concall or presentation for a symbol, extracts it, runs analysis, and returns the verdict.
    """
    sym = symbol.strip().upper()

    # Harvest if empty
    existing_count = db.query(InvestorDocument).filter(InvestorDocument.symbol == sym).count()
    if existing_count == 0:
        InvestorDocumentHarvester.harvest_for_symbol(db, sym)

    latest_doc = (
        db.query(InvestorDocument)
        .filter(InvestorDocument.symbol == sym)
        .order_by(desc(InvestorDocument.id))
        .first()
    )

    if not latest_doc:
        raise HTTPException(status_code=404, detail=f"No investor documents found for {sym}.")

    insight = InvestorIntelligenceService.analyze_document(db, latest_doc.id)
    if not insight:
        raise HTTPException(status_code=500, detail="Analysis failed on the latest document.")

    return {
        "status": "SUCCESS",
        "insight_id": insight.id,
        "symbol": insight.symbol,
        "fiscal_period": insight.fiscal_period,
        "doc_type": insight.doc_type,
        "institutional_stance": insight.institutional_stance,
        "growth_conviction_score": insight.growth_conviction_score,
        "management_tone": insight.management_tone,
        "executive_thesis": insight.executive_thesis,
        "capacity_utilization_pct": insight.capacity_utilization_pct,
        "capex_guidance_fy": insight.capex_guidance_fy,
        "ebitda_margin_guidance_corridor": insight.ebitda_margin_guidance_corridor,
        "key_overhang_questioned_by_analysts": insight.key_overhang_questioned_by_analysts,
        "management_direct_answer": insight.management_direct_answer,
        "pdf_url": latest_doc.pdf_url,
    }
