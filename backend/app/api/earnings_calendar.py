"""
Alpha India — Earnings Calendar API Router
Endpoints for scheduled board meetings, live reconciliation, and pre-announcement tracking.
"""

from datetime import date, datetime, timedelta
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy import or_, and_, func, desc
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.earnings_calendar import EarningsCalendar
from app.services.earnings_calendar_service import EarningsCalendarService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/earnings-calendar", tags=["Earnings Calendar"])


@router.get("/upcoming")
def get_upcoming_calendar(
    days_ahead: int = Query(14, ge=1, le=90, description="Days ahead to fetch"),
    limit: int = Query(100, ge=1, le=500, description="Max entries to return"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns upcoming scheduled earnings disclosures / board meetings.
    """
    today_date = date.today()
    end_date = today_date + timedelta(days=days_ahead)

    records = (
        db.query(EarningsCalendar)
        .filter(
            EarningsCalendar.meeting_date >= today_date,
            EarningsCalendar.meeting_date <= end_date,
            EarningsCalendar.status.in_(["SCHEDULED", "TODAY"]),
        )
        .order_by(EarningsCalendar.meeting_date.asc(), EarningsCalendar.symbol.asc())
        .limit(limit)
        .all()
    )

    data = [
        {
            "id": r.id,
            "company_id": r.company_id,
            "symbol": r.symbol,
            "company_name": r.company_name,
            "exchange": r.exchange,
            "meeting_date": str(r.meeting_date),
            "fiscal_period": r.fiscal_period,
            "purpose": r.purpose,
            "status": r.status,
            "details": r.details,
        }
        for r in records
    ]

    return {
        "status": "success",
        "days_ahead": days_ahead,
        "count": len(data),
        "results": data,
    }


@router.get("/today")
def get_todays_calendar(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns all corporate earnings scheduled for today, along with completed results and surprises.
    """
    today_date = date.today()

    records = (
        db.query(EarningsCalendar)
        .filter(
            or_(
                EarningsCalendar.meeting_date == today_date,
                and_(
                    EarningsCalendar.status.in_(["COMPLETED", "UNSCHEDULED_SURPRISE"]),
                    EarningsCalendar.reported_at >= datetime.combine(today_date, datetime.min.time()),
                ),
            )
        )
        .order_by(EarningsCalendar.status.asc(), EarningsCalendar.symbol.asc())
        .all()
    )

    data = [
        {
            "id": r.id,
            "company_id": r.company_id,
            "symbol": r.symbol,
            "company_name": r.company_name,
            "exchange": r.exchange,
            "meeting_date": str(r.meeting_date),
            "fiscal_period": r.fiscal_period,
            "purpose": r.purpose,
            "status": r.status,
            "details": r.details,
            "reported_at": r.reported_at.isoformat() if r.reported_at else None,
            "result_filing_id": r.result_filing_id,
        }
        for r in records
    ]

    expected_today = [r for r in data if r["status"] in ["SCHEDULED", "TODAY"]]
    reported_today = [r for r in data if r["status"] == "COMPLETED"]
    surprises_today = [r for r in data if r["status"] == "UNSCHEDULED_SURPRISE"]

    return {
        "status": "success",
        "date": str(today_date),
        "summary": {
            "total_expected": len(expected_today),
            "total_reported": len(reported_today),
            "total_surprises": len(surprises_today),
        },
        "results": data,
    }


@router.get("/stats")
def get_calendar_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns high-level radar statistics for the earnings calendar.
    """
    today_date = date.today()

    total_tracked = db.query(func.count(EarningsCalendar.id)).scalar() or 0
    upcoming_count = (
        db.query(func.count(EarningsCalendar.id))
        .filter(
            EarningsCalendar.meeting_date >= today_date,
            EarningsCalendar.status.in_(["SCHEDULED", "TODAY"]),
        )
        .scalar()
        or 0
    )
    due_today_count = (
        db.query(func.count(EarningsCalendar.id))
        .filter(EarningsCalendar.meeting_date == today_date)
        .scalar()
        or 0
    )
    completed_count = (
        db.query(func.count(EarningsCalendar.id))
        .filter(EarningsCalendar.status == "COMPLETED")
        .scalar()
        or 0
    )
    surprise_count = (
        db.query(func.count(EarningsCalendar.id))
        .filter(EarningsCalendar.status == "UNSCHEDULED_SURPRISE")
        .scalar()
        or 0
    )

    return {
        "status": "success",
        "today": str(today_date),
        "stats": {
            "total_tracked": total_tracked,
            "upcoming_next_14d": upcoming_count,
            "due_today": due_today_count,
            "completed_reconciled": completed_count,
            "unscheduled_surprises": surprise_count,
        },
    }


@router.post("/sync")
def trigger_calendar_sync(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Manually triggers official NSE Event Calendar synchronization.
    """
    result = EarningsCalendarService.sync_nse_calendar(db)
    return result
