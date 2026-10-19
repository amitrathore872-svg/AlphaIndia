"""
Alpha India — Rapid Sync of Recent Financial Result Disclosures
Ingests full quarterly statements and YoY growth figures into QuarterlyResult
for companies that declared quarterly results on NSE or BSE in the current month/quarter.
"""

import sys
import time
from datetime import date, datetime
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry
from app.models.quarterly_result import QuarterlyResult
from app.models.company import Company
from scripts.backfill_screener_quarters import backfill_company_quarters
from sqlalchemy import func


from app.models.screener_growth_record import ScreenerGrowthRecord

def sync_recent_results(limit: int = 500, delay_seconds: float = 0.35):
    db = SessionLocal()
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting reconciliation of recent result disclosures...")

    # Find unique companies that filed genuine RESULT disclosures in October 2026, ordered by Market Cap
    recent_results = (
        db.query(FilingRegistry.symbol, ScreenerGrowthRecord.market_cap)
        .outerjoin(ScreenerGrowthRecord, FilingRegistry.symbol == ScreenerGrowthRecord.symbol)
        .filter(
            FilingRegistry.feed_type == "RESULT",
            FilingRegistry.announcement_date >= date(2026, 10, 1),
        )
        .distinct()
        .order_by(ScreenerGrowthRecord.market_cap.desc().nullslast())
        .all()
    )

    print(f"Found {len(recent_results)} unique companies with RESULT disclosures in Oct 2026.")

    candidates = []
    seen = set()
    for sym, mcap in recent_results:
        clean_sym = sym.strip().upper()
        if clean_sym in seen:
            continue
        seen.add(clean_sym)
        comp = db.query(Company).filter(Company.symbol == clean_sym).first()
        if not comp:
            continue
        
        # Check if company already has Q2 FY27 statement (period_end >= 2026-09-01)
        latest_q = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == comp.id)
            .order_by(QuarterlyResult.period_end.desc().nullslast())
            .first()
        )
        if not latest_q or not latest_q.period_end or latest_q.period_end < date(2026, 9, 1):
            candidates.append((clean_sym, mcap))

    print(f"Identified {len(candidates)} companies missing recent Q2 FY27 quarterly statements.")
    to_process = candidates[:limit]
    print(f"Processing batch of {len(to_process)} companies with delay={delay_seconds}s...")

    synced_ok = 0
    synced_failed = 0

    for idx, (sym, mcap) in enumerate(to_process, 1):
        try:
            quarters = backfill_company_quarters(db, sym)
            db.commit()
            if quarters > 0:
                synced_ok += 1
                mcap_str = f"Rs {mcap:,.0f} Cr" if mcap else "N/A"
                print(f"[{idx}/{len(to_process)}] {sym:<12} (MCap: {mcap_str}): Synced {quarters} quarters.")
            else:
                synced_failed += 1
        except Exception as e:
            db.rollback()
            synced_failed += 1
            print(f"[{idx}/{len(to_process)}] {sym}: Error syncing: {e}")

        time.sleep(delay_seconds)

    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Completed sync! Successfully synced: {synced_ok}, Pending/Failed: {synced_failed}.")
    db.close()


if __name__ == "__main__":
    sync_recent_results()
