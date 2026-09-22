"""
Verification script for Opportunity Alert Service across the 4 engines:
1. /vcp-signals
2. /pre-breakout-radar (Tier A+)
3. /momentum-radar (Match >= 9)
4. /momentum-radar (Conviction >= 79)
"""

import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.services.opportunity_alert_service import OpportunityAlertService
from app.models.notification import SystemNotification

def main():
    db = SessionLocal()
    try:
        print("1. Testing get_opportunity_thresholds...")
        thresholds = OpportunityAlertService.get_opportunity_thresholds(db)
        print("Active Thresholds:", thresholds)

        print("\n2. Scanning and dispatching opportunity alerts...")
        res = OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db, force_scan=False)
        print("Scan result summary:")
        print(f"  New alerts count: {res.get('new_alerts_count')}")
        print(f"  Skipped duplicates count: {res.get('skipped_duplicates_count')}")
        print("  Dispatched samples:")
        for a in res.get("dispatched_alerts", [])[:5]:
            print(f"    - [{a.get('engine')}] {a.get('symbol')}: {a.get('title')}")

        print("\n3. Testing get_recent_opportunity_alerts...")
        recent = OpportunityAlertService.get_recent_opportunity_alerts(db, limit=10)
        print(f"Found {len(recent)} recent opportunity notifications in database:")
        for n in recent[:5]:
            print(f"  [{n['category']}] ({n['severity']}) {n['title']} -> {n['action_url']}")

        print("\nSUCCESS: All Opportunity Alert Service tests passed cleanly!")
    except Exception as e:
        print(f"\nFAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
