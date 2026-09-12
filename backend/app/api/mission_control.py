# ==========================================================
# Alpha India Mission Control API
# Sprint 33.4 Phase 4C.4
# Enterprise Monitoring APIs
# ==========================================================

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

# Alpha India Database
from app.db.database import get_db

# Models
from app.models.company import Company
from app.models.filing_registry import FilingRegistry

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
    Reads live companies from SQLite warehouse.
    """

    # ---------------------------------------------
    # Base Company Query
    # ---------------------------------------------
    query = db.query(Company)

    # Search
    if search:
        query = query.filter(
            (Company.symbol.ilike(f"%{search}%"))
            | (Company.company.ilike(f"%{search}%"))
        )

    # Total companies after search
    total_records = query.count()

    # ---------------------------------------------
    # Temporary Queue Summary
    # (Will be replaced by QueueManager in Sprint 34)
    # ---------------------------------------------
    completed = 4
    running = 1
    pending = max(total_records - completed - running, 0)

    summary = {
        "pending": pending,
        "completed": completed,
        "running": running,
        "total": total_records,
    }

    # ---------------------------------------------
    # Pagination
    # ---------------------------------------------
    companies = (
        query.order_by(Company.symbol)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    results = []

    for index, company in enumerate(companies):

        # Queue State (temporary logic)
        global_index = (page - 1) * limit + index

        if global_index < completed:
            queue_state = "COMPLETED"
        elif global_index == completed:
            queue_state = "RUNNING"
        else:
            queue_state = "PENDING"

        if status != "ALL" and queue_state != status:
            continue

        filings_found = (
            db.query(FilingRegistry)
            .filter(FilingRegistry.symbol == company.symbol)
            .count()
        )

        results.append(
            {
                "symbol": company.symbol,
                "company": company.company,
                "exchange": getattr(company, "exchange", "NSE"),
                "status": queue_state,
                "filings_discovered": filings_found,
                "updated_at": None,
            }
        )

    return {
        "success": True,
        "summary": summary,
        "page": page,
        "limit": limit,
        "total_pages": (total_records + limit - 1) // limit,
        "search": search,
        "status_filter": status,
        "results": results,
    }


# ==========================================================
# DASHBOARD SNAPSHOT
# ==========================================================


@router.get("/dashboard")
def dashboard():
    """
    Mission Control dashboard snapshot.
    """

    return {
        "success": True,
        "heartbeat": {
            "status": "RUNNING",
            "server_time": datetime.now().isoformat(),
        },
        "engines": {
            "discovery": "RUNNING",
            "warehouse": "RUNNING",
            "audit": "IDLE",
            "growth": "IDLE",
            "ai": "READY",
        },
    }


# ==========================================================
# ENGINE STATUS GRID
# ==========================================================


@router.get("/engines")
def engine_status():
    """
    Returns health of each Alpha India engine.
    """

    return {
        "success": True,
        "engines": [
            {
                "name": "Discovery Engine",
                "status": "RUNNING",
                "color": "green",
            },
            {
                "name": "Warehouse Import Engine",
                "status": "RUNNING",
                "color": "green",
            },
            {
                "name": "Financial Audit Engine",
                "status": "IDLE",
                "color": "yellow",
            },
            {
                "name": "Growth Calculator Engine",
                "status": "IDLE",
                "color": "yellow",
            },
            {
                "name": "AI Scoring Engine",
                "status": "READY",
                "color": "cyan",
            },
        ],
    }