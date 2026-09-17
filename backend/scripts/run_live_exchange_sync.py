"""
Alpha India — Run Real-Time Exchange Filing Ingestion
Sprint 34 Production Ingestion Runner
Fetches live corporate announcements from official NSE & BSE streams and persists them into PostgreSQL.
"""

import sys
from app.collectors.nse_collector import collect_nse_announcements
from app.db.database import SessionLocal
from app.models.announcement import Announcement
from app.models.filing_registry import FilingRegistry
from app.models.monitoring_heartbeat import MonitoringHeartbeat


def main():
    print("=" * 65)
    print("ALPHA INDIA REAL-TIME EXCHANGE FILING INGESTION")
    print("=" * 65)

    
    result = collect_nse_announcements(symbol=None)
    
    print("\n--- INGESTION SUMMARY ---")
    print(f"Status: {result.get('status')}")
    print(f"Total Disclosures Scanned : {result.get('total_scanned')}")
    print(f"New Entries Ingested     : {result.get('new_entries_discovered')}")

    db = SessionLocal()
    try:
        hb = db.query(MonitoringHeartbeat).first()
        if hb:
            print(f"Engine Status: {hb.engine_status} | Results Found Today: {hb.results_found_today} | Scanned Today: {hb.companies_scanned_today}")
        
        # Display the 15 most recent announcements saved in the DB
        recent_ann = db.query(Announcement).order_by(Announcement.id.desc()).limit(15).all()
        print(f"\n--- LATEST REAL-TIME DISCLOSURES SAVED ({len(recent_ann)} shown) ---")
        for a in recent_ann:
            print(f"[{a.id}] {a.symbol} ({a.company[:25]}) | Type: {a.announcement_type[:30]} | Date: {a.published_at.strftime('%Y-%m-%d %H:%M')} | PDF: {a.source_url[:60] if a.source_url else 'None'}")
            
        recent_filings = db.query(FilingRegistry).order_by(FilingRegistry.id.desc()).limit(10).all()
        print(f"\n--- LATEST FILING REGISTRY ENTRIES ({len(recent_filings)} shown) ---")
        for f in recent_filings:
            print(f"[{f.id}] {f.exchange} | {f.symbol} | Period: {f.period} | Type: {f.filing_type} | PDF: {f.pdf_url[:60] if f.pdf_url else 'None'}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
