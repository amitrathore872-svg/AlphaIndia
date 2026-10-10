"""
Alpha India — Earnings Calendar Service
Ingests official scheduled board meetings from the NSE Event Calendar API and BSE disclosures.
Provides:
1. Daily lightweight synchronization of scheduled board meetings.
2. Auto-reconciliation matching live result filings against scheduled expectations.
3. Fast query helpers for 'Today's Expected Results' and upcoming earnings schedules.
"""

from datetime import datetime, date, timedelta, timezone
import logging
import re
from typing import Any, Dict, List, Optional
from sqlalchemy import or_, and_, desc
from sqlalchemy.orm import Session

from app.clients.nse_client import NSEClient
from app.clients.bse_client import BSEClient
from app.models.company import Company
from app.models.earnings_calendar import EarningsCalendar
from app.models.filing_registry import FilingRegistry

logger = logging.getLogger(__name__)


def parse_calendar_date(raw_date_str: str) -> Optional[date]:
    """
    Parses date strings like '12-Oct-2026', '12-10-2026', '2026-10-12'.
    """
    if not raw_date_str:
        return None
    raw = str(raw_date_str).strip()
    
    formats = [
        "%d-%b-%Y",  # 12-Oct-2026
        "%d-%B-%Y",  # 12-October-2026
        "%Y-%m-%d",  # 2026-10-12
        "%d-%m-%Y",  # 12-10-2026
        "%d/%m/%Y",  # 12/10/2026
        "%Y/%m/%d",  # 2026/10/12
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


class EarningsCalendarService:

    @classmethod
    def sync_nse_calendar(cls, db: Session) -> Dict[str, Any]:
        """
        Synchronizes all upcoming corporate board meetings directly from the official NSE API.
        One clean JSON query, zero regex parsing required.
        """
        client = NSEClient()
        try:
            items = client.get_json("/api/event-calendar", params={"index": "equities"})
        except Exception as e:
            logger.error(f"[EarningsCalendar] NSE calendar fetch failed: {e}")
            return {"status": "error", "error": str(e), "synced": 0}

        if not isinstance(items, list):
            logger.warning(f"[EarningsCalendar] Unexpected NSE response format: {type(items)}")
            return {"status": "error", "error": "Invalid format", "synced": 0}

        synced_count = 0
        updated_count = 0
        today_date = date.today()

        # Cache existing records and track in-flight records in this batch to prevent duplicate key errors
        tracked_in_batch: Dict[tuple, EarningsCalendar] = {}

        for item in items:
            symbol = str(item.get("symbol") or "").strip().upper()
            if not symbol:
                continue

            purpose = str(item.get("purpose") or "Financial Results").strip()
            # Focus on financial results board meetings
            is_result_purpose = any(k in purpose.lower() for k in ["financial result", "result", "quarterly"])
            if not is_result_purpose and purpose:
                continue

            meeting_date = parse_calendar_date(item.get("date"))
            if not meeting_date:
                continue

            company_name = str(item.get("company") or "").strip()
            bm_desc = str(item.get("bm_desc") or "").strip()

            # Extract fiscal period if present in description
            fiscal_period = None
            m_p = re.search(r"(Q[1-4])\s*(?:FY)?\s*(\d{2,4})", bm_desc, re.IGNORECASE)
            if m_p:
                fiscal_period = f"{m_p.group(1).upper()} FY{m_p.group(2)[-2:]}"

            # Determine initial status
            initial_status = "TODAY" if meeting_date == today_date else ("SCHEDULED" if meeting_date > today_date else "PAST_DUE")

            cache_key = (symbol, meeting_date, purpose)

            # Check if record already seen in this batch or in DB
            target_entry = tracked_in_batch.get(cache_key)
            if not target_entry:
                target_entry = db.query(EarningsCalendar).filter(
                    EarningsCalendar.symbol == symbol,
                    EarningsCalendar.meeting_date == meeting_date,
                    EarningsCalendar.purpose == purpose,
                ).first()

            if target_entry:
                # Update details if not already marked COMPLETED
                if target_entry.status not in ["COMPLETED", "UNSCHEDULED_SURPRISE"]:
                    target_entry.status = initial_status
                if fiscal_period and not target_entry.fiscal_period:
                    target_entry.fiscal_period = fiscal_period
                if bm_desc:
                    # If new description is more detailed or revised, update it
                    if not target_entry.details or len(bm_desc) > len(target_entry.details):
                        target_entry.details = bm_desc
                tracked_in_batch[cache_key] = target_entry
                updated_count += 1
            else:
                comp = db.query(Company).filter(Company.symbol == symbol).first()
                new_entry = EarningsCalendar(
                    company_id=comp.id if comp else None,
                    symbol=symbol,
                    company_name=company_name or (comp.company if comp else symbol),
                    exchange="NSE",
                    meeting_date=meeting_date,
                    fiscal_period=fiscal_period,
                    purpose=purpose,
                    details=bm_desc,
                    status=initial_status,
                )
                db.add(new_entry)
                tracked_in_batch[cache_key] = new_entry
                synced_count += 1

        db.commit()
        logger.info(f"[EarningsCalendar] NSE Sync Complete: {synced_count} inserted, {updated_count} updated.")
        return {
            "status": "success",
            "synced_new": synced_count,
            "updated_existing": updated_count,
            "total_queried": len(items),
        }

    @classmethod
    def reconcile_incoming_filing(
        cls,
        db: Session,
        symbol: str,
        filing_type: str,
        filing_id: Optional[int] = None,
        period: Optional[str] = None,
        reported_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Bi-directional reconciler:
        Matches an incoming live result filing against scheduled expectations.
        - If matched: Marks as COMPLETED.
        - If not in calendar (surprise disclosure): Records as UNSCHEDULED_SURPRISE.
        """
        sym = symbol.strip().upper()
        now = reported_at or datetime.now(timezone.utc)
        today_date = now.date() if isinstance(now, datetime) else date.today()

        # Look for active scheduled entry within a 3-day window of today
        calendar_entry = db.query(EarningsCalendar).filter(
            EarningsCalendar.symbol == sym,
            EarningsCalendar.status.in_(["SCHEDULED", "TODAY"]),
            EarningsCalendar.meeting_date.between(today_date - timedelta(days=3), today_date + timedelta(days=2)),
        ).order_by(desc(EarningsCalendar.meeting_date)).first()

        if calendar_entry:
            calendar_entry.status = "COMPLETED"
            calendar_entry.result_filing_id = filing_id
            calendar_entry.reported_at = now
            if period and not calendar_entry.fiscal_period:
                calendar_entry.fiscal_period = period
            db.commit()
            return {
                "matched": True,
                "reconciliation_type": "SCHEDULED_MATCH",
                "calendar_id": calendar_entry.id,
                "meeting_date": str(calendar_entry.meeting_date),
            }
        else:
            # Unscheduled surprise filing (reported without pre-scheduled calendar date)
            purpose_surprise = "Financial Results (Immediate Disclosure)"
            existing_surprise = db.query(EarningsCalendar).filter(
                EarningsCalendar.symbol == sym,
                EarningsCalendar.meeting_date == today_date,
                EarningsCalendar.purpose == purpose_surprise,
            ).first()

            if existing_surprise:
                existing_surprise.result_filing_id = filing_id
                existing_surprise.reported_at = now
                if period and not existing_surprise.fiscal_period:
                    existing_surprise.fiscal_period = period
                db.commit()
                return {
                    "matched": False,
                    "reconciliation_type": "UNSCHEDULED_SURPRISE",
                    "calendar_id": existing_surprise.id,
                    "meeting_date": str(today_date),
                }

            comp = db.query(Company).filter(Company.symbol == sym).first()

            surprise_entry = EarningsCalendar(
                company_id=comp.id if comp else None,
                symbol=sym,
                company_name=comp.company if comp else sym,
                exchange="NSE",
                meeting_date=today_date,
                fiscal_period=period,
                purpose=purpose_surprise,
                status="UNSCHEDULED_SURPRISE",
                result_filing_id=filing_id,
                reported_at=now,
            )
            db.add(surprise_entry)
            db.commit()
            return {
                "matched": False,
                "reconciliation_type": "UNSCHEDULED_SURPRISE",
                "calendar_id": surprise_entry.id,
                "meeting_date": str(today_date),
            }

    @classmethod
    def get_todays_earnings(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Returns all corporate earnings scheduled or reported for today.
        """
        today_date = date.today()
        records = db.query(EarningsCalendar).filter(
            or_(
                EarningsCalendar.meeting_date == today_date,
                and_(
                    EarningsCalendar.status == "COMPLETED",
                    EarningsCalendar.reported_at >= datetime.combine(today_date, datetime.min.time()),
                ),
            )
        ).order_by(EarningsCalendar.status, EarningsCalendar.symbol).all()

        return [
            {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name,
                "exchange": r.exchange,
                "meeting_date": str(r.meeting_date),
                "fiscal_period": r.fiscal_period,
                "purpose": r.purpose,
                "status": r.status,
                "reported_at": r.reported_at.isoformat() if r.reported_at else None,
                "result_filing_id": r.result_filing_id,
            }
            for r in records
        ]

    @classmethod
    def get_upcoming_schedule(cls, db: Session, days_ahead: int = 14) -> List[Dict[str, Any]]:
        """
        Returns upcoming scheduled results for the next `days_ahead` days.
        """
        today_date = date.today()
        end_date = today_date + timedelta(days=days_ahead)

        records = db.query(EarningsCalendar).filter(
            EarningsCalendar.meeting_date >= today_date,
            EarningsCalendar.meeting_date <= end_date,
            EarningsCalendar.status.in_(["SCHEDULED", "TODAY"]),
        ).order_by(EarningsCalendar.meeting_date.asc(), EarningsCalendar.symbol.asc()).all()

        return [
            {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name,
                "exchange": r.exchange,
                "meeting_date": str(r.meeting_date),
                "fiscal_period": r.fiscal_period,
                "purpose": r.purpose,
                "status": r.status,
            }
            for r in records
        ]
