"""
Alpha India Historical Discovery API
Sprint 28.5.2 — Production Discovery Worker
Version: v0.9.8
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.collectors.nse.announcements import NSEAnnouncementCollector

from app.models.company import Company
from app.models.filing_registry import FilingRegistry

from app.services.discovery_service import DiscoveryService
from app.services.queue_manager import QueueManager

router = APIRouter(
    prefix="/discovery",
    tags=["Historical Discovery Engine"],
)


# ==========================================================
# Database Dependency
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
# Discovery Engine Status
# ==========================================================
@router.get("/status")
def discovery_status(db: Session = Depends(get_db)):
    heartbeat = DiscoveryService.get_status(db)

    return {
        "engine_status": heartbeat.engine_status,
        "current_session": heartbeat.current_session,
        "next_scan_time": heartbeat.next_scan_time,
        "last_scan_time": heartbeat.last_scan_time,
        "companies_scanned_today": heartbeat.companies_scanned_today,
        "results_found_today": heartbeat.results_found_today,
        "parser_failures_today": heartbeat.parser_failures_today,
    }


# ==========================================================
# Start Engine
# ==========================================================
@router.post("/start")
def start_discovery(db: Session = Depends(get_db)):
    heartbeat = DiscoveryService.start_engine(db)

    return {
        "success": True,
        "message": "Historical Discovery Engine Started",
        "status": heartbeat.engine_status,
        "session": heartbeat.current_session,
    }


# ==========================================================
# Pause Engine
# ==========================================================
@router.post("/pause")
def pause_discovery(db: Session = Depends(get_db)):
    heartbeat = DiscoveryService.pause_engine(db)

    return {
        "success": True,
        "message": "Historical Discovery Engine Paused",
        "status": heartbeat.engine_status,
    }


# ==========================================================
# Resume Engine
# ==========================================================
@router.post("/resume")
def resume_discovery(db: Session = Depends(get_db)):
    heartbeat = DiscoveryService.resume_engine(db)

    return {
        "success": True,
        "message": "Historical Discovery Engine Resumed",
        "status": heartbeat.engine_status,
    }


# ==========================================================
# Bootstrap Discovery Queue
# ==========================================================
@router.post("/bootstrap")
def bootstrap_queue(db: Session = Depends(get_db)):
    """
    Loads all NSE/BSE companies into the discovery queue.
    """

    total = QueueManager.bootstrap(db)

    heartbeat = DiscoveryService.get_status(db)
    heartbeat.companies_scanned_today = 0
    heartbeat.results_found_today = 0
    heartbeat.parser_failures_today = 0
    heartbeat.last_scan_time = None

    db.commit()

    return {
        "success": True,
        "message": "Historical Discovery Queue Created",
        "companies_loaded": total,
    }


# ==========================================================
# Queue Status
# ==========================================================
@router.get("/queue")
def queue_status():
    return {
        "success": True,
        **QueueManager.status(),
    }


# ==========================================================
# Next Company
# ==========================================================
@router.post("/next")
def next_company():
    symbol = QueueManager.next_company()

    if symbol is None:
        raise HTTPException(
            status_code=404,
            detail="Discovery queue is empty."
        )

    return {
        "success": True,
        "message": "Next company ready for discovery.",
        "symbol": symbol,
    }


# ==========================================================
# Complete Company
# ==========================================================
@router.post("/complete/{symbol}")
def complete_company(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()

    QueueManager.complete_company(symbol)

    heartbeat = DiscoveryService.get_status(db)
    heartbeat.companies_scanned_today += 1
    heartbeat.last_scan_time = datetime.utcnow()

    db.commit()

    return {
        "success": True,
        "message": f"{symbol} marked as completed.",
        "queue": QueueManager.status(),
    }


# ==========================================================
# Discover Historical Filings
# ==========================================================
@router.post("/company/{symbol}")
def discover_company(symbol: str, db: Session = Depends(get_db)):
    """
    Discover ALL historical NSE filings for one company and
    save them into filing_registry.
    """

    symbol = symbol.upper()

    # ------------------------------------------------------
    # Lookup company master
    # ------------------------------------------------------
    company = (
        db.query(Company)
        .filter(Company.symbol == symbol)
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail=f"{symbol} not found in companies table."
        )

    collector = NSEAnnouncementCollector()

    try:
        filings = collector.fetch_announcements(symbol)

    except Exception as e:
        heartbeat = DiscoveryService.get_status(db)
        heartbeat.parser_failures_today += 1
        heartbeat.last_scan_time = datetime.utcnow()
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"NSE collector failed: {e}",
        )

    inserted = 0
    skipped = 0

    # ------------------------------------------------------
    # Insert filings
    # ------------------------------------------------------
    for filing in filings:

        with db.no_autoflush:

            exists = (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.symbol == symbol,
                    FilingRegistry.period == filing["period"][:30],
                    FilingRegistry.announcement_date == filing["announcement_date"],
                    FilingRegistry.filing_type ==
                    (
                        filing["filing_type"][:150]
                        if filing["filing_type"]
                        else None
                    ),
                )
                .first()
            )

        if exists:
            skipped += 1
            continue

        registry = FilingRegistry(
            company_id=company.id,

            symbol=symbol,
            exchange="NSE",

            filing_type=(
                filing["filing_type"][:150]
                if filing["filing_type"]
                else None
            ),
            period=filing["period"][:30],
            announcement_date=filing["announcement_date"],

            pdf_url=filing["pdf_url"],
            pdf_local_path=None,

            download_status="PENDING",
            parse_status="PENDING",

            ai_processed=False,

            discovered_at=datetime.utcnow(),
            downloaded_at=None,
            parsed_at=None,
            created_at=datetime.utcnow(),
        )

        db.add(registry)
        inserted += 1

    # ------------------------------------------------------
    # Commit safely
    # ------------------------------------------------------
    try:
        db.commit()

    except Exception as e:
        db.rollback()

        heartbeat = DiscoveryService.get_status(db)
        heartbeat.parser_failures_today += 1
        heartbeat.last_scan_time = datetime.utcnow()
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Database insert failed: {str(e)}",
        )

    # ------------------------------------------------------
    # Queue + Heartbeat
    # ------------------------------------------------------
    QueueManager.complete_company(symbol)

    heartbeat = DiscoveryService.get_status(db)
    heartbeat.companies_scanned_today += 1
    heartbeat.results_found_today += inserted
    heartbeat.last_scan_time = datetime.utcnow()

    db.commit()

    return {
        "success": True,
        "message": f"Historical filings discovered for {symbol}",
        "symbol": symbol,
        "company_id": company.id,
        "exchange": "NSE",
        "filings_discovered": inserted,
        "duplicates_skipped": skipped,
        "queue": QueueManager.status(),
    }


# ==========================================================
# Run Next Company (Background Worker)
# ==========================================================
@router.post("/run-next")
def run_next_company(db: Session = Depends(get_db)):
    """
    Pops next company from queue and performs discovery.
    Used later by scheduler/background worker.
    """

    symbol = QueueManager.next_company()

    if symbol is None:
        raise HTTPException(
            status_code=404,
            detail="Discovery queue empty."
        )

    company = (
        db.query(Company)
        .filter(Company.symbol == symbol)
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail=f"{symbol} not found in companies table."
        )

    collector = NSEAnnouncementCollector()

    try:
        filings = collector.fetch_announcements(symbol)

    except Exception as e:
        heartbeat = DiscoveryService.get_status(db)
        heartbeat.parser_failures_today += 1
        heartbeat.last_scan_time = datetime.utcnow()
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    inserted = 0

    for filing in filings:

        with db.no_autoflush:

            exists = (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.symbol == symbol,
                    FilingRegistry.period == filing["period"][:30],
                    FilingRegistry.announcement_date == filing["announcement_date"],
                    FilingRegistry.filing_type ==
                    (
                        filing["filing_type"][:150]
                        if filing["filing_type"]
                        else None
                    ),
                )
                .first()
            )

        if exists:
            continue

        db.add(
            FilingRegistry(
                company_id=company.id,

                symbol=symbol,
                exchange="NSE",

                filing_type=(
                    filing["filing_type"][:150]
                    if filing["filing_type"]
                    else None
                ),
                period=filing["period"][:30],
                announcement_date=filing["announcement_date"],

                pdf_url=filing["pdf_url"],
                pdf_local_path=None,

                download_status="PENDING",
                parse_status="PENDING",

                ai_processed=False,

                discovered_at=datetime.utcnow(),
                downloaded_at=None,
                parsed_at=None,
                created_at=datetime.utcnow(),
            )
        )

        inserted += 1

    try:
        db.commit()

    except Exception as e:
        db.rollback()

        heartbeat = DiscoveryService.get_status(db)
        heartbeat.parser_failures_today += 1
        heartbeat.last_scan_time = datetime.utcnow()
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Database insert failed: {str(e)}",
        )

    QueueManager.complete_company(symbol)

    heartbeat = DiscoveryService.get_status(db)
    heartbeat.companies_scanned_today += 1
    heartbeat.results_found_today += inserted
    heartbeat.last_scan_time = datetime.utcnow()

    db.commit()

    return {
        "success": True,
        "symbol": symbol,
        "company_id": company.id,
        "exchange": "NSE",
        "filings_discovered": inserted,
        "queue": QueueManager.status(),
    }