# ==========================================================
# Alpha India Mission Control API
# Sprint 33.4 Phase 4C.4
# Enterprise Monitoring APIs
# ==========================================================

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

# Alpha India Database
from app.db.database import get_db

# Models
from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.financial_import_queue import FinancialImportQueue
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.models.financial_reconciliation_log import FinancialReconciliationLog
from app.services.financial_audit_backfill_engine import FinancialAuditBackfillEngine
from app.services.financial_import_engine import FinancialImportEngine
from app.services.replay_pipeline_service import ReplayPipelineService

# Services
from app.services.queue_manager import QueueManager

router = APIRouter(
    prefix="/mission-control",
    tags=["Mission Control"],
)

# ==========================================================
# HEARTBEAT
# ==========================================================


@router.get("/heartbeat")
def heartbeat():
    """
    Mission Control heartbeat endpoint.
    Used by the Monitoring page every 5 seconds.
    """

    return {
        "status": "RUNNING",
        "server_time": datetime.now().isoformat(),
        "version": "2.3.0",
        "environment": "development",
    }


# ==========================================================
# LIVE DISCOVERY QUEUE
# Sprint 33.4 Phase 4C.4
# ==========================================================


@router.get("/queue")
def discovery_queue(
    page: int = 1,
    limit: int = 50,
    search: str = "",
    status: str = "ALL",
    db: Session = Depends(get_db),
):
    """
    Mission Control Discovery Queue.
    Reads live companies and import states from the database.
    """

    # Global Queue Summary counters across all companies
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    completed_count = (
        db.query(func.count(FinancialImportQueue.id))
        .filter(FinancialImportQueue.status == "COMPLETED")
        .scalar()
        or 0
    )
    failed_count = (
        db.query(func.count(FinancialImportQueue.id))
        .filter(FinancialImportQueue.status.in_(["FAILED", "UNAVAILABLE"]))
        .scalar()
        or 0
    )
    running_count = (
        db.query(func.count(FinancialImportQueue.id))
        .filter(FinancialImportQueue.status == "RUNNING")
        .scalar()
        or 0
    )
    pending_count = max(
        total_companies - completed_count - failed_count - running_count, 0
    )

    summary = {
        "pending": pending_count,
        "completed": completed_count,
        "failed": failed_count,
        "running": running_count,
        "total": total_companies,
    }

    # Base Query joined with FinancialImportQueue
    query = (
        db.query(
            Company,
            FinancialImportQueue.status.label("q_status"),
            FinancialImportQueue.imported_at.label("q_imported_at"),
            FinancialImportQueue.created_at.label("q_created_at"),
        )
        .outerjoin(FinancialImportQueue, FinancialImportQueue.symbol == Company.symbol)
    )

    # Search filter
    if search.strip():
        term = search.strip()
        query = query.filter(
            or_(
                Company.symbol.ilike(f"%{term}%"),
                Company.company.ilike(f"%{term}%"),
            )
        )

    # Status filter
    if status == "COMPLETED":
        query = query.filter(FinancialImportQueue.status == "COMPLETED")
    elif status == "FAILED":
        query = query.filter(
            FinancialImportQueue.status.in_(["FAILED", "UNAVAILABLE"])
        )
    elif status == "RUNNING":
        query = query.filter(FinancialImportQueue.status == "RUNNING")
    elif status == "PENDING":
        query = query.filter(
            or_(
                FinancialImportQueue.status == "PENDING",
                FinancialImportQueue.id.is_(None),
            )
        )

    # Total records matching filter
    total_records = query.count()

    # Pagination (Recently updated companies first)
    paged_rows = (
        query.order_by(Company.updated_at.desc().nullslast(), Company.symbol.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    symbols = [row[0].symbol for row in paged_rows]

    # Batch query filing counts for the current page symbols (zero N+1 queries)
    filings_map = {}
    if symbols:
        filing_counts = (
            db.query(FilingRegistry.symbol, func.count(FilingRegistry.id))
            .filter(FilingRegistry.symbol.in_(symbols))
            .group_by(FilingRegistry.symbol)
            .all()
        )
        filings_map = {sym: count for sym, count in filing_counts}

    results = []
    for company, q_status, q_imported_at, q_created_at in paged_rows:
        if q_status == "COMPLETED":
            state = "COMPLETED"
        elif q_status in ("FAILED", "UNAVAILABLE"):
            state = "FAILED"
        elif q_status == "RUNNING":
            state = "RUNNING"
        else:
            state = "PENDING"

        dt = getattr(company, "updated_at", None) or q_imported_at or q_created_at
        formatted_updated = dt.strftime("%Y-%m-%d %H:%M") if dt else "--"

        results.append(
            {
                "symbol": company.symbol,
                "company": company.company,
                "exchange": getattr(company, "exchange", "NSE") or "NSE",
                "status": state,
                "filings_discovered": filings_map.get(company.symbol, 0),
                "updated_at": formatted_updated,
            }
        )

    return {
        "success": True,
        "summary": summary,
        "page": page,
        "limit": limit,
        "total_pages": max((total_records + limit - 1) // limit, 1),
        "total_records": total_records,
        "search": search,
        "status_filter": status,
        "results": results,
    }


# ==========================================================
# DASHBOARD SNAPSHOT
# ==========================================================


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    """
    Mission Control dashboard snapshot.
    """

    hb = (
        db.query(MonitoringHeartbeat)
        .order_by(MonitoringHeartbeat.id.desc())
        .first()
    )
    discovery_status = hb.engine_status if (hb and hb.engine_status) else "ONLINE"
    audit_status = (
        "RUNNING" if FinancialAuditBackfillEngine._running else "ONLINE"
    )
    warehouse_status = (
        "RUNNING"
        if FinancialImportEngine.status().get("running")
        else "ONLINE"
    )

    return {
        "success": True,
        "heartbeat": {
            "status": "RUNNING",
            "server_time": datetime.now().isoformat(),
        },
        "engines": {
            "discovery": discovery_status,
            "warehouse": warehouse_status,
            "audit": audit_status,
            "growth": "ONLINE",
            "ai": "ONLINE",
        },
    }


# ==========================================================
# ENGINE STATUS GRID
# ==========================================================


@router.get("/engines")
def engine_status(db: Session = Depends(get_db)):
    """
    Returns health and live metrics for all 5 Alpha India processing engines:
    1. Discovery Engine
    2. Import Engine
    3. Data Reconciliation Engine (NEW)
    4. Audit Engine
    5. AI Growth Engine
    """
    state = ReplayPipelineService.get_state()
    disc_m = state["discovery"]
    imp_m = state["import"]
    rec_m = state["reconciliation"]
    aud_m = state["audit"]
    ai_m = state["ai"]

    hb = (
        db.query(MonitoringHeartbeat)
        .order_by(MonitoringHeartbeat.id.desc())
        .first()
    )
    discovery_status = disc_m["engine_status"] if disc_m["scanned_today"] > 0 else (hb.engine_status if (hb and hb.engine_status) else "ONLINE")
    import_status = "RUNNING" if state["is_running"] else ("ONLINE" if imp_m["imported_new"] > 0 or imp_m["unchanged"] > 0 else "READY")
    reconciliation_status = "ONLINE" if rec_m["compared"] > 0 else "READY"
    audit_status = "RUNNING" if state["is_running"] else ("ONLINE" if aud_m["processed"] > 0 else "READY")
    ai_status = "ONLINE" if ai_m["scored_companies"] > 0 else "READY"

    return {
        "success": True,
        "engines": [
            {
                "name": "Discovery Engine",
                "status": discovery_status,
                "color": "green",
                "metrics": [
                    ["Session", disc_m["session"]],
                    ["Scanned Today", str(disc_m["scanned_today"])],
                    ["Results Today", str(disc_m["results_today"])],
                    ["Parser Failures", str(disc_m["parser_failures_today"])],
                ],
            },
            {
                "name": "Import Engine",
                "status": import_status,
                "color": "blue",
                "metrics": [
                    ["Imported", str(imp_m["imported_new"])],
                    ["Updated From NSE", str(imp_m["updated_from_nse"])],
                    ["Unchanged", str(imp_m["unchanged"])],
                    ["Pending Queue", str(imp_m["pending_queue"])],
                    ["Coverage", f"{imp_m['coverage_percent']}%"],
                ],
            },
            {
                "name": "Data Reconciliation Engine",
                "status": reconciliation_status,
                "color": "cyan",
                "metrics": [
                    ["Compared", str(rec_m["compared"])],
                    ["Exact Match", str(rec_m["exact_match"])],
                    ["Within Tolerance", str(rec_m["within_tolerance"])],
                    ["Differences >2%", str(rec_m["differences_gt_2pct"])],
                    ["Missing Values", str(rec_m["missing_values"])],
                    ["Parse Errors", str(rec_m["parse_errors"])],
                ],
            },
            {
                "name": "Audit Engine",
                "status": audit_status,
                "color": "amber",
                "metrics": [
                    ["Processed", str(aud_m["processed"])],
                    ["PASS", str(aud_m["passed"])],
                    ["WARNING", str(aud_m["warning"])],
                    ["FAIL", str(aud_m["failed"])],
                ],
            },
            {
                "name": "AI Growth Engine",
                "status": ai_status,
                "color": "violet",
                "metrics": [
                    ["Scored Companies", str(ai_m["scored_companies"])],
                    ["AI Reports", str(ai_m["ai_reports"])],
                    ["Pending Queue", str(ai_m["pending_queue"])],
                    ["Avg Processing Time", f"{ai_m['avg_processing_time_ms']:.0f}ms"],
                ],
            },
        ],
    }


# ==========================================================
# LIVE EVENT STREAM / SCANNER TIMELINE
# Real events from FilingRegistry
# ==========================================================


@router.get("/events")
@router.get("/timeline")
def scanner_timeline_events(
    limit: int = 50,
    symbol: str = "",
    event_type: str = "ALL",
    db: Session = Depends(get_db),
):
    """
    Returns real filing discovery and processing events from FilingRegistry.
    """

    query = (
        db.query(FilingRegistry, Company.company)
        .outerjoin(Company, Company.id == FilingRegistry.company_id)
    )

    if symbol.strip():
        query = query.filter(FilingRegistry.symbol.ilike(f"%{symbol.strip()}%"))

    # SQL-level category filters
    if event_type == "DOWNLOAD":
        query = query.filter(
            FilingRegistry.download_status.in_(["DOWNLOADED", "COMPLETED"])
        )
    elif event_type == "AI":
        query = query.filter(
            or_(
                FilingRegistry.parse_status == "COMPLETED",
                FilingRegistry.ai_processed == True,
            )
        )
    elif event_type == "IMPORT":
        query = query.filter(
            or_(
                FilingRegistry.filing_type.ilike("%result%"),
                FilingRegistry.filing_type.ilike("%audited%"),
                FilingRegistry.filing_type.ilike("%earnings%"),
                FilingRegistry.filing_type.ilike("%financial%"),
            )
        )
    elif event_type == "AUDIT":
        query = query.filter(
            or_(
                FilingRegistry.filing_type.ilike("%board meeting%"),
                FilingRegistry.filing_type.ilike("%investor%"),
                FilingRegistry.filing_type.ilike("%agm%"),
                FilingRegistry.filing_type.ilike("%report%"),
                FilingRegistry.filing_type.ilike("%clarification%"),
            )
        )
    elif event_type == "DISCOVERY":
        query = query.filter(
            FilingRegistry.download_status != "DOWNLOADED"
        )

    filings = (
        query.order_by(
            FilingRegistry.discovered_at.desc().nullslast(),
            FilingRegistry.id.desc(),
        )
        .limit(min(max(limit, 1), 100))
        .all()
    )

    events = []
    for filing, company_name in filings:
        f_type = (filing.filing_type or "").lower()

        if filing.download_status in ("DOWNLOADED", "COMPLETED"):
            etype = "DOWNLOAD"
            message = f"Quarterly PDF archived for {filing.period}: {filing.filing_type or 'Report'}"
        elif filing.parse_status == "COMPLETED" or filing.ai_processed:
            etype = "AI"
            message = f"AI parsed financial filing: {filing.filing_type} ({filing.period})"
        elif any(k in f_type for k in ["audited", "result", "earnings", "financial", "quarter"]):
            etype = "IMPORT"
            message = f"Financial statement logged: {filing.filing_type} ({filing.period})"
        elif any(k in f_type for k in ["board meeting", "investor", "agm", "review"]):
            etype = "AUDIT"
            message = f"Corporate disclosure: {filing.filing_type} ({filing.period})"
        else:
            etype = "DISCOVERY"
            message = f"Discovered filing: {filing.filing_type or 'Announcement'} ({filing.period})"

        if event_type != "ALL" and etype != event_type:
            continue

        discovered_dt = filing.discovered_at or filing.created_at or datetime.utcnow()

        events.append(
            {
                "id": filing.id,
                "symbol": filing.symbol,
                "company": company_name or filing.symbol,
                "type": etype,
                "filing_type": filing.filing_type or "Filing",
                "period": filing.period or "Unknown",
                "exchange": getattr(filing, "exchange", "NSE"),
                "download_status": filing.download_status,
                "parse_status": filing.parse_status,
                "pdf_url": filing.pdf_url if filing.pdf_url and filing.pdf_url != "-" else None,
                "time": discovered_dt.isoformat(),
                "time_display": discovered_dt.strftime("%H:%M:%S"),
                "date_display": discovered_dt.strftime("%d %b %Y"),
                "message": message,
            }
        )

    return {
        "success": True,
        "count": len(events),
        "total_filings": db.query(FilingRegistry).count(),
        "events": events,
    }


# ==========================================================
# SPRINT 23 REPLAY PIPELINE CONTROLS & VALIDATION SCORECARD
# ==========================================================


@router.post("/replay/start")
def start_replay(interval_seconds: float = 5.0):
    """
    Start pipeline replay for 10 Small-Cap companies at interval_seconds (default 5s).
    """
    return ReplayPipelineService.start_replay(interval_seconds=interval_seconds)


@router.post("/replay/reset")
def reset_replay():
    """
    Reset replay counters, queues, and reconciliation logs.
    """
    return ReplayPipelineService.reset()


@router.get("/replay/status")
def replay_status():
    """
    Get live replay status across all 5 engines.
    """
    return {
        "success": True,
        "state": ReplayPipelineService.get_state(),
    }


@router.get("/validation/scorecard")
def validation_scorecard(db: Session = Depends(get_db)):
    """
    Returns complete validation scorecard for the 10 sample Small-Cap companies,
    including stage-by-stage progression, audit checks, AI growth scores,
    and reconciliation logs.
    """
    state = ReplayPipelineService.get_state()
    records = ReplayPipelineService.get_detailed_results()

    total_companies = len(records)
    passed_count = sum(1 for r in records if r.get("audit", {}).get("status") == "PASS")
    pass_rate = round((passed_count / total_companies) * 100.0, 1) if total_companies > 0 else 0.0

    growth_scores = [r.get("ai_growth", {}).get("growth_score", 0.0) for r in records if "ai_growth" in r]
    avg_growth_score = round(sum(growth_scores) / len(growth_scores), 1) if growth_scores else 0.0

    strength_scores = [r.get("ai_growth", {}).get("discovery_strength", 0.0) for r in records if "ai_growth" in r]
    avg_discovery_strength = round(sum(strength_scores) / len(strength_scores), 1) if strength_scores else 0.0

    reconciliation_logs_count = db.query(func.count(FinancialReconciliationLog.id)).scalar() or 0

    return {
        "success": True,
        "summary": {
            "total_companies": total_companies,
            "target_companies": state["total_companies"],
            "passed_audit": passed_count,
            "pass_rate": pass_rate,
            "avg_growth_score": avg_growth_score,
            "avg_discovery_strength": avg_discovery_strength,
            "status": state["status"],
            "is_running": state["is_running"],
            "current_company": state["current_company"],
            "total_reconciled_fields": reconciliation_logs_count,
        },
        "engine_metrics": {
            "discovery": state["discovery"],
            "import": state["import"],
            "reconciliation": state["reconciliation"],
            "audit": state["audit"],
            "ai": state["ai"],
        },
        "records": records,
    }


@router.get("/reconciliation/logs")
def reconciliation_logs(
    symbol: Optional[str] = None,
    diagnosis: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    Returns audit records from financial_reconciliation_log.
    """
    query = db.query(FinancialReconciliationLog)
    if symbol:
        query = query.filter(FinancialReconciliationLog.company_symbol == symbol.strip().upper())
    if diagnosis:
        query = query.filter(FinancialReconciliationLog.diagnosis == diagnosis.strip())
    if action:
        query = query.filter(FinancialReconciliationLog.action_taken == action.strip())

    total = query.count()
    rows = query.order_by(FinancialReconciliationLog.id.asc()).offset(offset).limit(limit).all()

    return {
        "success": True,
        "total": total,
        "logs": [
            {
                "id": r.id,
                "symbol": r.company_symbol,
                "company_name": r.company_name,
                "quarter": r.quarter,
                "field_name": r.field_name,
                "screener_value": r.screener_value,
                "nse_value": r.nse_value,
                "variance_pct": r.variance_pct,
                "diagnosis": r.diagnosis,
                "action_taken": r.action_taken,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/reconciliation/summary")
def reconciliation_summary(db: Session = Depends(get_db)):
    """
    Returns summary metrics for Data Reconciliation Engine.
    """
    state = ReplayPipelineService.get_state()
    return {
        "success": True,
        "metrics": state["reconciliation"],
    }


@router.post("/simulate-feeds")
def simulate_exchange_feeds():
    """
    Simulates real-time capture of 5 NSE and 5 BSE quarterly results,
    processes them through the 5-stage pipeline, and returns high-growth winners.
    """
    from app.services.exchange_feed_simulator import ExchangeFeedSimulator

    results = ExchangeFeedSimulator.run_simulation()
    return {
        "success": True,
        "message": "Successfully processed 5 NSE and 5 BSE corporate disclosures.",
        "data": results,
    }