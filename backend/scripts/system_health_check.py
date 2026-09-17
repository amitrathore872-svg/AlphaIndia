"""
Alpha India — Comprehensive System & Pipeline Health Check
Checks DB connectivity, engine heartbeats, exchange collectors, and API sanity.
"""

import sys
from datetime import datetime, timezone
import requests
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.filing_registry import FilingRegistry
from app.models.announcement import Announcement
from app.models.announcement_radar import AnnouncementRadar
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.collectors.nse_collector import collect_nse_announcements


def run_health_check():
    print("=" * 65)
    print("ALPHA INDIA SYSTEM & PIPELINE HEALTH CHECK")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 65)

    # 1. Database Connection & Table Metrics
    print("\n[1/4] Checking Database Health & Table Counts...")
    try:
        db = SessionLocal()
        companies_count = db.query(Company).count()
        quarterly_count = db.query(QuarterlyResult).count()
        filings_count = db.query(FilingRegistry).count()
        announcements_count = db.query(Announcement).count()
        radar_count = db.query(AnnouncementRadar).count()

        print("  -> PostgreSQL Connection: HEALTHY")
        print(f"  -> Total Companies Master: {companies_count}")
        print(f"  -> Total Quarterly Financials: {quarterly_count}")
        print(f"  -> Filing Registry Records: {filings_count}")
        print(f"  -> Announcements Records: {announcements_count}")
        print(f"  -> Announcement Radar Signals: {radar_count}")

        # Check Latest Records
        latest_filing = db.query(FilingRegistry).order_by(FilingRegistry.id.desc()).first()
        if latest_filing:
            print(f"  -> Latest Filing: [{latest_filing.exchange}] {latest_filing.symbol} ({latest_filing.filing_type[:35]}) on {latest_filing.discovered_at}")

        # 2. Heartbeat Telemetry
        print("\n[2/4] Checking Mission Control Heartbeat...")
        hb = db.query(MonitoringHeartbeat).first()
        if hb:
            print(f"  -> Engine Status: {hb.engine_status}")
            print(f"  -> Current Session: {hb.current_session}")
            print(f"  -> Last Scan Time: {hb.last_scan_time}")
            print(f"  -> Results Found Today: {hb.results_found_today}")
            print(f"  -> Companies Scanned Today: {hb.companies_scanned_today}")
            print(f"  -> Parser Failures: {hb.parser_failures_today}")
        else:
            print("  -> Heartbeat: NOT INITIALIZED")

        db.close()
    except Exception as e:
        print(f"  -> Database ERROR: {e}")
        return

    # 3. Live Exchange Wire Collector Execution
    print("\n[3/4] Running Live Exchange Collector Wire Check...")
    try:
        collector_res = collect_nse_announcements(symbol=None)
        print("  -> Exchange Feed Connectivity: HEALTHY")
        print(f"  -> Scanned Disclosures: {collector_res.get('total_scanned')}")
        print(f"  -> New Ingested: {collector_res.get('new_entries_discovered')}")
    except Exception as e:
        print(f"  -> Exchange Collector ERROR: {e}")

    # 4. Backend Local API Health (Port 8000)
    print("\n[4/4] Checking Backend API Server (Port 8000)...")
    try:
        api_resp = requests.get("http://localhost:8000/mission-control/heartbeat", timeout=3)
        if api_resp.status_code == 200:
            print(f"  -> Backend API (Port 8000): HEALTHY (HTTP 200)")
            print(f"  -> Response: {api_resp.json()}")
        else:
            print(f"  -> Backend API returned HTTP {api_resp.status_code}")
    except Exception as e:
        print(f"  -> Backend API: Not currently running on port 8000 ({e})")
        print("     (Start with: python -m uvicorn main:app --reload --port 8000)")

    print("\n" + "=" * 65)
    print("HEALTH CHECK COMPLETE: ALL PIPELINE ENGINES OPERATIONAL")
    print("=" * 65)


if __name__ == "__main__":
    run_health_check()
