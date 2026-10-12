"""
Alpha India — Investor Intelligence & Concall API Router
Provides institutional endpoints for querying Investor Presentations, Concall Transcripts,
and Senior Buy-Side Analyst LLM Insights across Indian Equities.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, or_

from app.db.database import get_db
from app.models.company import Company
from app.models.investor_intelligence import (
    InvestorDocument,
    InvestorIntelligenceInsight,
    ManagementCommitment,
)
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.investor_intelligence_service import InvestorIntelligenceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/investor-intelligence", tags=["Investor Intelligence & Concalls"])


@router.get("/coverage", response_model=Dict[str, Any])
def get_quarterly_coverage(
    quarter: Optional[str] = Query(default=None, description="Fiscal quarter (e.g. Q2 FY27)"),
    db: Session = Depends(get_db),
):
    """
    Returns live quarterly presentation discovery and processing coverage,
    stage health breakdown, commitments due/evaluated, and drill-down records.
    """
    return InvestorIntelligenceService.get_quarterly_coverage(db, selected_quarter=quarter)


@router.get("/telemetry", response_model=Dict[str, Any])
def get_investor_intelligence_telemetry(db: Session = Depends(get_db)):
    """
    Returns live pipeline telemetry, document repository stats, and sync timestamps.
    """
    doc_count = db.query(InvestorDocument).count()
    insight_count = db.query(InvestorIntelligenceInsight).count()
    pending_count = db.query(InvestorDocument).filter(InvestorDocument.status == "PENDING").count()
    analyzed_count = db.query(InvestorDocument).filter(InvestorDocument.status == "ANALYZED").count()

    latest_doc_created = db.query(func.max(InvestorDocument.created_at)).scalar()
    latest_doc_updated = db.query(func.max(InvestorDocument.updated_at)).scalar()
    latest_insight_analyzed = db.query(func.max(InvestorIntelligenceInsight.analyzed_at)).scalar()

    strong_growth_count = db.query(InvestorIntelligenceInsight).filter(
        InvestorIntelligenceInsight.institutional_stance.in_(["STRONG_GROWTH_LEADER", "ACCUMULATE_ON_DIPS"])
    ).count()

    return {
        "total_documents": doc_count,
        "total_insights": insight_count,
        "pending_documents": pending_count,
        "analyzed_documents": analyzed_count,
        "strong_growth_count": strong_growth_count,
        "latest_document_created_at": latest_doc_created.isoformat() if latest_doc_created else None,
        "latest_document_updated_at": latest_doc_updated.isoformat() if latest_doc_updated else None,
        "latest_insight_analyzed_at": latest_insight_analyzed.isoformat() if latest_insight_analyzed else None,
    }


@router.post("/batch-scan", response_model=Dict[str, Any])
def trigger_batch_scan(
    target: str = Query("LATEST_RESULTS", description="LATEST_RESULTS, NIFTY50, or PENDING_QUEUE"),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """
    Executes an autonomous batch harvest and interrogation cycle.
    """
    analyzed_results = []

    if target == "PENDING_QUEUE":
        pending_docs = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.status == "PENDING", InvestorDocument.pdf_url.isnot(None))
            .order_by(InvestorDocument.announcement_date.desc().nullslast(), InvestorDocument.id.desc())
            .limit(limit)
            .all()
        )
        for doc in pending_docs:
            ins = InvestorIntelligenceService.analyze_document(db, doc.id)
            if ins:
                analyzed_results.append({
                    "symbol": ins.symbol,
                    "stance": ins.institutional_stance,
                    "score": ins.growth_conviction_score,
                    "period": ins.fiscal_period,
                })
    elif target == "LATEST_RESULTS":
        from app.models.filing_registry import FilingRegistry
        recent_filings = (
            db.query(FilingRegistry.symbol)
            .filter(FilingRegistry.filing_type.ilike("%result%"))
            .order_by(FilingRegistry.announcement_date.desc().nullslast(), FilingRegistry.id.desc())
            .limit(limit * 3)
            .all()
        )
        symbols = list(dict.fromkeys([f[0] for f in recent_filings if f[0]]))[:limit]
        for sym in symbols:
            try:
                docs_count = db.query(InvestorDocument).filter(InvestorDocument.symbol == sym).count()
                if docs_count == 0:
                    InvestorDocumentHarvester.harvest_for_symbol(db, sym)
                latest_doc = (
                    db.query(InvestorDocument)
                    .filter(InvestorDocument.symbol == sym)
                    .order_by(desc(InvestorDocument.id))
                    .first()
                )
                if latest_doc:
                    ins = InvestorIntelligenceService.analyze_document(db, latest_doc.id)
                    if ins:
                        analyzed_results.append({
                            "symbol": ins.symbol,
                            "stance": ins.institutional_stance,
                            "score": ins.growth_conviction_score,
                            "period": ins.fiscal_period,
                        })
            except Exception as e:
                logger.warning(f"Batch scan error for {sym}: {e}")
    else:  # NIFTY50
        nifty_sample = ["TCS", "INFY", "HDFCBANK", "RELIANCE", "ICICIBANK", "BHARTIARTL", "LT", "SBIN", "KOTAKBANK", "ITC"][:limit]
        for sym in nifty_sample:
            try:
                docs_count = db.query(InvestorDocument).filter(InvestorDocument.symbol == sym).count()
                if docs_count == 0:
                    InvestorDocumentHarvester.harvest_for_symbol(db, sym)
                latest_doc = (
                    db.query(InvestorDocument)
                    .filter(InvestorDocument.symbol == sym)
                    .order_by(desc(InvestorDocument.id))
                    .first()
                )
                if latest_doc:
                    ins = InvestorIntelligenceService.analyze_document(db, latest_doc.id)
                    if ins:
                        analyzed_results.append({
                            "symbol": ins.symbol,
                            "stance": ins.institutional_stance,
                            "score": ins.growth_conviction_score,
                            "period": ins.fiscal_period,
                        })
            except Exception as e:
                logger.warning(f"Batch scan error for {sym}: {e}")

    return {
        "status": "SUCCESS",
        "target": target,
        "processed_count": len(analyzed_results),
        "results": analyzed_results,
    }


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
    quarter: Optional[str] = Query(default=None, description="Filter by fiscal quarter (e.g. Q2 FY27)"),
    stance: Optional[str] = Query(default=None, description="Filter by institutional stance"),
    thesis_impact: Optional[str] = Query(default=None, description="Filter by thesis impact: STRENGTHENING, NEUTRAL, WEAKENING"),
    analysis_status: Optional[str] = Query(default=None, description="Filter by analysis status: ANALYZED, PENDING, FAILED"),
    doc_type: Optional[str] = Query(default=None, description="Filter by INVESTOR_PRESENTATION or CONCALL_TRANSCRIPT"),
    symbol: Optional[str] = Query(default=None, description="Search by stock symbol"),
    sector: Optional[str] = Query(default=None, description="Filter by industry sector"),
    min_score: Optional[float] = Query(default=None, description="Minimum growth conviction score"),
    transformational_only: Optional[bool] = Query(default=None, description="Filter for only exponential / transformational catalysts"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns latest quarterly investor intelligence feed, sorted primarily by actual publication date
    in descending order. Displays both newly discovered pending presentations and fully analyzed insights.
    """
    query = (
        db.query(InvestorDocument, InvestorIntelligenceInsight, Company.sector)
        .outerjoin(
            InvestorIntelligenceInsight,
            InvestorIntelligenceInsight.document_id == InvestorDocument.id,
        )
        .outerjoin(Company, Company.id == InvestorDocument.company_id)
    )

    if quarter and isinstance(quarter, str) and quarter != "ALL":
        query = query.filter(InvestorDocument.fiscal_period == quarter.strip())

    if doc_type and isinstance(doc_type, str) and doc_type != "ALL":
        query = query.filter(InvestorDocument.doc_type == doc_type.upper().strip())

    if symbol and isinstance(symbol, str):
        query = query.filter(InvestorDocument.symbol.ilike(f"%{symbol.strip()}%"))

    if sector and isinstance(sector, str) and sector != "ALL":
        query = query.filter(Company.sector.ilike(f"%{sector.strip()}%"))

    if analysis_status and analysis_status != "ALL":
        stat = analysis_status.upper().strip()
        if stat == "ANALYZED":
            query = query.filter(or_(InvestorDocument.ai_analysis_status == "ANALYZED", InvestorDocument.status == "ANALYZED"))
        elif stat == "PENDING":
            query = query.filter(and_(InvestorDocument.ai_analysis_status == "PENDING", InvestorDocument.status != "FAILED"))
        elif stat == "FAILED":
            query = query.filter(or_(InvestorDocument.ai_analysis_status == "FAILED", InvestorDocument.status == "FAILED"))

    if stance and isinstance(stance, str) and stance != "ALL":
        query = query.filter(InvestorIntelligenceInsight.institutional_stance == stance.upper().strip())

    if thesis_impact and isinstance(thesis_impact, str) and thesis_impact != "ALL":
        query = query.filter(InvestorIntelligenceInsight.thesis_impact == thesis_impact.upper().strip())

    if min_score is not None and isinstance(min_score, (int, float)):
        query = query.filter(InvestorIntelligenceInsight.growth_conviction_score >= min_score)

    if transformational_only is True:
        query = query.filter(InvestorIntelligenceInsight.is_transformational_catalyst == True)

    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 20

    total = query.count()

    # Primary sort: actual presentation publication date descending, secondary sort: document ID descending
    records = (
        query.order_by(
            desc(InvestorDocument.announcement_date).nullslast(),
            desc(InvestorDocument.id),
        )
        .offset((page_val - 1) * limit_val)
        .limit(limit_val)
        .all()
    )

    items = []
    for doc, ins, comp_sector in records:
        is_analyzed = bool(ins and (doc.ai_analysis_status == "ANALYZED" or doc.status == "ANALYZED"))
        effective_status = "ANALYZED" if is_analyzed else ("FAILED" if doc.status == "FAILED" or doc.ai_analysis_status == "FAILED" else "PENDING")

        # Count commitments linked to document
        comms_count = db.query(ManagementCommitment).filter(ManagementCommitment.document_id == doc.id).count()

        items.append({
            "id": ins.id if ins else doc.id,
            "document_id": doc.id,
            "symbol": doc.symbol,
            "company_name": doc.company_name or doc.symbol,
            "sector": comp_sector,
            "fiscal_period": doc.fiscal_period,
            "financial_year": doc.financial_year,
            "financial_quarter": doc.financial_quarter,
            "announcement_date": doc.announcement_date.isoformat() if doc.announcement_date else None,
            "doc_type": doc.doc_type,
            "pdf_url": doc.pdf_url,
            "headline": doc.headline,
            "status": doc.status,
            "download_status": doc.download_status or "PENDING",
            "extraction_status": doc.extraction_status or "PENDING",
            "ai_analysis_status": effective_status,
            "analysis_completed_at": doc.analysis_completed_at.isoformat() if doc.analysis_completed_at else (ins.analyzed_at.isoformat() if ins and ins.analyzed_at else None),
            "processing_error": doc.processing_error or doc.error_message,

            # Analysis Stance & Thesis Impact
            "institutional_stance": ins.institutional_stance if ins else "PENDING_ANALYSIS",
            "thesis_impact": ins.thesis_impact if ins else "PENDING",
            "growth_conviction_score": ins.growth_conviction_score if ins else None,
            "management_sentiment_score": ins.management_sentiment_score if ins else None,
            "management_credibility_rating": ins.management_credibility_rating if ins else None,
            "management_tone": ins.management_tone if ins else "PENDING",
            "executive_thesis": ins.executive_thesis if ins else (
                f"Official {doc.doc_type.replace('_', ' ')} discovered for {doc.symbol} ({doc.fiscal_period}). "
                "Document is currently queued for AI interrogation and management commitment extraction."
            ),

            # Major Developments & Implications
            "positive_developments": ins.positive_developments if ins and ins.positive_developments else [],
            "negative_developments": ins.negative_developments if ins and ins.negative_developments else [],
            "guidance_changes": ins.guidance_changes if ins else None,
            "growth_implications": ins.growth_implications if ins else None,
            "thesis_evidence": ins.thesis_evidence if ins else None,
            "qoq_comparison": ins.qoq_comparison if ins else None,
            "operational_kpis": ins.operational_kpis if ins else None,
            "commitments_count": comms_count,

            # Transformational / Exponential Catalyst Radar
            "is_transformational_catalyst": ins.is_transformational_catalyst if ins else False,
            "transformational_category": ins.transformational_category if ins else None,
            "catalyst_headline": ins.catalyst_headline if ins else None,
            "immediate_reaction_rationale": ins.immediate_reaction_rationale if ins else None,
            "exponential_growth_multiple": ins.exponential_growth_multiple if ins else None,

            # Operating Metrics
            "capacity_utilization_pct": ins.capacity_utilization_pct if ins else None,
            "cwip_amount_cr": ins.cwip_amount_cr if ins else None,
            "capex_guidance_fy": ins.capex_guidance_fy if ins else None,
            "commissioning_timeline_cod": ins.commissioning_timeline_cod if ins else None,
            "expected_asset_turnover": ins.expected_asset_turnover if ins else None,
            "volume_vs_price_driver": ins.volume_vs_price_driver if ins else None,
            "ebitda_margin_guidance_corridor": ins.ebitda_margin_guidance_corridor if ins else None,
            "margin_drivers": ins.margin_drivers if ins else None,
            "executable_order_book_cr": ins.executable_order_book_cr if ins else None,
            "book_to_bill_ratio": ins.book_to_bill_ratio if ins else None,
            "working_capital_days": ins.working_capital_days if ins else None,
            "debt_outlook": ins.debt_outlook if ins else None,
            "key_overhang_questioned_by_analysts": ins.key_overhang_questioned_by_analysts if ins else None,
            "management_direct_answer": ins.management_direct_answer if ins else None,
            "guidance_change": ins.guidance_change if ins else None,

            # Forensic Metrics
            "evasiveness_score": ins.evasiveness_score if ins else None,
            "analyst_tension_score": ins.analyst_tension_score if ins else None,
            "hot_seat_question": ins.hot_seat_question if ins else None,
            "management_defense_strategy": ins.management_defense_strategy if ins else None,
            "forensic_discrepancies": ins.forensic_discrepancies if ins else [],

            "layman_summary": ins.layman_summary if ins else None,
            "direct_quotes": ins.direct_quotes if ins else None,
            "analyst_grill_quotes": ins.analyst_grill_quotes if ins else None,
            "actionable_gameplan": ins.actionable_gameplan if ins else None,
            "analyzed_at": ins.analyzed_at.isoformat() if ins and ins.analyzed_at else None,
            "llm_model": ins.llm_model if ins else "alpha-forensic-nlp-engine",
        })

    return {
        "total": total,
        "page": page_val,
        "limit": limit_val,
        "items": items,
    }


@router.get("/commitments", response_model=Dict[str, Any])
def get_management_commitments(
    symbol: Optional[str] = Query(default=None, description="Filter by stock symbol"),
    quarter: Optional[str] = Query(default=None, description="Filter by target quarter"),
    status: Optional[str] = Query(default=None, description="Filter by status: MET, MISSED, ON_TRACK, DELAYED, REVISED, etc."),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    is_financial_target: Optional[bool] = Query(default=None, description="Filter financial target vs qualitative milestone"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns paginated Management Commitment Ledger with delivery assessment across quarters.
    """
    return InvestorIntelligenceService.get_commitments_ledger(
        db=db,
        symbol=symbol,
        quarter=quarter,
        status=status,
        category=category,
        is_financial_target=is_financial_target,
        page=page,
        limit=limit,
    )


@router.get("/commitments/summary/{symbol}", response_model=Dict[str, Any])
def get_company_commitments_summary(symbol: str, db: Session = Depends(get_db)):
    """
    Returns transparent delivery rate scorecard and breakdown for a single company.
    """
    return InvestorIntelligenceService.get_commitments_summary(db, symbol=symbol)


@router.get("/commitments/summary", response_model=Dict[str, Any])
def get_overall_commitments_summary(db: Session = Depends(get_db)):
    """
    Returns aggregate delivery rate scorecard across all covered companies.
    """
    return InvestorIntelligenceService.get_commitments_summary(db, symbol=None)


@router.get("/document/{document_id}", response_model=Dict[str, Any])
def get_document_details(document_id: int, db: Session = Depends(get_db)):
    """
    Returns comprehensive details of a presentation/transcript, its AI analysis,
    and associated management commitments.
    """
    doc = db.query(InvestorDocument).filter(InvestorDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document ID {document_id} not found")

    ins = db.query(InvestorIntelligenceInsight).filter(InvestorIntelligenceInsight.document_id == doc.id).first()
    commitments = db.query(ManagementCommitment).filter(ManagementCommitment.document_id == doc.id).all()

    return {
        "document": {
            "id": doc.id,
            "symbol": doc.symbol,
            "company_name": doc.company_name,
            "doc_type": doc.doc_type,
            "fiscal_period": doc.fiscal_period,
            "financial_year": doc.financial_year,
            "financial_quarter": doc.financial_quarter,
            "announcement_date": doc.announcement_date.isoformat() if doc.announcement_date else None,
            "headline": doc.headline,
            "pdf_url": doc.pdf_url,
            "source_url": doc.source_url,
            "status": doc.status,
            "download_status": doc.download_status or "PENDING",
            "extraction_status": doc.extraction_status or "PENDING",
            "ai_analysis_status": doc.ai_analysis_status or "PENDING",
            "raw_text_length": doc.raw_text_length,
            "analysis_completed_at": doc.analysis_completed_at.isoformat() if doc.analysis_completed_at else None,
            "processing_error": doc.processing_error or doc.error_message,
        },
        "insight": {
            "id": ins.id,
            "institutional_stance": ins.institutional_stance,
            "thesis_impact": ins.thesis_impact,
            "growth_conviction_score": ins.growth_conviction_score,
            "management_sentiment_score": ins.management_sentiment_score,
            "management_tone": ins.management_tone,
            "executive_thesis": ins.executive_thesis,
            "positive_developments": ins.positive_developments,
            "negative_developments": ins.negative_developments,
            "guidance_changes": ins.guidance_changes,
            "growth_implications": ins.growth_implications,
            "thesis_evidence": ins.thesis_evidence,
            "qoq_comparison": ins.qoq_comparison,
            "operational_kpis": ins.operational_kpis,
            "capacity_utilization_pct": ins.capacity_utilization_pct,
            "capex_guidance_fy": ins.capex_guidance_fy,
            "ebitda_margin_guidance_corridor": ins.ebitda_margin_guidance_corridor,
            "executable_order_book_cr": ins.executable_order_book_cr,
            "key_overhang_questioned_by_analysts": ins.key_overhang_questioned_by_analysts,
            "management_direct_answer": ins.management_direct_answer,
            "evasiveness_score": ins.evasiveness_score,
            "analyst_tension_score": ins.analyst_tension_score,
            "hot_seat_question": ins.hot_seat_question,
            "management_defense_strategy": ins.management_defense_strategy,
            "forensic_discrepancies": ins.forensic_discrepancies,
            "layman_summary": ins.layman_summary,
            "direct_quotes": ins.direct_quotes,
            "analyst_grill_quotes": ins.analyst_grill_quotes,
            "actionable_gameplan": ins.actionable_gameplan,
            "analyzed_at": ins.analyzed_at.isoformat() if ins.analyzed_at else None,
        } if ins else None,
        "commitments": [
            {
                "id": c.id,
                "statement": c.statement,
                "exact_quote": c.exact_quote,
                "page_or_slide": c.page_or_slide,
                "category": c.category,
                "is_financial_target": c.is_financial_target,
                "metric": c.metric,
                "target_value": c.target_value,
                "target_period": c.target_period,
                "status": c.status,
                "actual_result": c.actual_result,
                "assessment_rationale": c.assessment_rationale,
                "evidence_quote": c.evidence_quote,
            }
            for c in commitments
        ],
    }


@router.post("/reprocess/{document_id}", response_model=Dict[str, Any])
def reprocess_document(document_id: int, db: Session = Depends(get_db)):
    """
    Retries failed document download, extraction, or AI analysis.
    """
    return InvestorIntelligenceService.reprocess_document(db, document_id)


@router.post("/backfill", response_model=Dict[str, Any])
def run_historical_backfill(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Processes pending presentations that lack AI analysis and commitment extraction.
    """
    pending = (
        db.query(InvestorDocument)
        .filter(
            InvestorDocument.ai_analysis_status == "PENDING",
            InvestorDocument.pdf_url.isnot(None),
        )
        .order_by(desc(InvestorDocument.announcement_date).nullslast(), desc(InvestorDocument.id))
        .limit(limit)
        .all()
    )

    processed = []
    for doc in pending:
        try:
            ins = InvestorIntelligenceService.analyze_document(db, doc.id)
            if ins:
                processed.append({
                    "document_id": doc.id,
                    "symbol": doc.symbol,
                    "fiscal_period": doc.fiscal_period,
                    "stance": ins.institutional_stance,
                    "thesis_impact": ins.thesis_impact,
                })
        except Exception as e:
            logger.warning(f"Backfill error for document {doc.id}: {e}")

    return {
        "status": "SUCCESS",
        "processed_count": len(processed),
        "results": processed,
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
            "evasiveness_detected": ins.evasiveness_detected,
            "guidance_change": ins.guidance_change,

            # Phase 2: Forensic Evasiveness, Tension & Discrepancies
            "evasiveness_score": ins.evasiveness_score,
            "analyst_tension_score": ins.analyst_tension_score,
            "hot_seat_question": ins.hot_seat_question,
            "management_defense_strategy": ins.management_defense_strategy,
            "forensic_discrepancies": ins.forensic_discrepancies,

            "thesis_impact": ins.thesis_impact or "NEUTRAL",
            "positive_developments": ins.positive_developments or [],
            "negative_developments": ins.negative_developments or [],
            "guidance_changes": ins.guidance_changes,
            "growth_implications": ins.growth_implications,
            "thesis_evidence": ins.thesis_evidence,
            "qoq_comparison": ins.qoq_comparison,
            "operational_kpis": ins.operational_kpis,

            "critical_monitorables": ins.critical_monitorables,
            "layman_summary": ins.layman_summary,
            "direct_quotes": ins.direct_quotes,
            "analyst_grill_quotes": ins.analyst_grill_quotes,
            "actionable_gameplan": ins.actionable_gameplan,
            "pdf_url": doc.pdf_url if doc else None,
            "analyzed_at": ins.analyzed_at.isoformat() if ins.analyzed_at else None,
        })

    latest_insight = insight_list[0] if insight_list else None

    # Retrieve commitments for this company
    commitments_data = InvestorIntelligenceService.get_commitments_ledger(db, symbol=sym, limit=100)
    commitments_summary = InvestorIntelligenceService.get_commitments_summary(db, symbol=sym)

    return {
        "symbol": sym,
        "total_documents": len(docs),
        "total_insights": len(insights),
        "latest_insight": latest_insight,
        "insights_history": insight_list,
        "documents": doc_list,
        "commitments": commitments_data.get("items", []),
        "commitments_summary": commitments_summary,
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
        "evasiveness_score": insight.evasiveness_score,
        "analyst_tension_score": insight.analyst_tension_score,
        "hot_seat_question": insight.hot_seat_question,
        "management_defense_strategy": insight.management_defense_strategy,
        "forensic_discrepancies": insight.forensic_discrepancies,
        "pdf_url": latest_doc.pdf_url,
    }
