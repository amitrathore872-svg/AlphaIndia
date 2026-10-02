"""
Bootstrap and Seed Script for Mutual Fund Alpha Radar Engine
Alpha India - Sprint 39
Initializes Top Pure Equity schemes and backfills multi-year daily NAV history and metrics.
"""

import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.services.mf_radar.mf_warehouse_service import MFWarehouseService
from app.models.mf_radar_models import MFRadarScheme


def main():
    print("=" * 60)
    print("ALPHA INDIA - MUTUAL FUND ALPHA RADAR BOOTSTRAP")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Step 1: Bootstrap Top Universe
        print("\n[Step 1] Seeding Top 100 Pure Equity Scheme Master...")
        boot_res = MFWarehouseService.bootstrap_universe(db)
        print(f"-> Result: {boot_res}")

        # Step 2: Sync Daily NAVs from official AMFI feed
        print("\n[Step 2] Fetching live AMFI daily NAV feed...")
        amfi_res = MFWarehouseService.sync_daily_navs_from_amfi(db)
        print(f"-> AMFI Feed Sync: {amfi_res}")

        # Step 3: Backfill initial history for top 15 flagship schemes across categories
        schemes = db.query(MFRadarScheme).limit(15).all()
        print(f"\n[Step 3] Backfilling historical NAV & calculating metrics for {len(schemes)} flagship schemes...")
        for s in schemes:
            print(f"  Backfilling {s.scheme_code} - {s.scheme_name[:40]}...")
            try:
                res = MFWarehouseService.backfill_scheme_history(db, s.scheme_code, limit_points=800)
                print(f"    [OK] {s.category} | NAV: {res.get('latest_nav')} | 6M Return: {res.get('return_6m_pct')}% | 1Y Dips: {res.get('dip_count_1y')}")
            except Exception as ex:
                print(f"    [ERR] Error: {ex}")

        # Step 4: Display Summary KPIs
        print("\n[Step 4] Checking Summary KPIs...")
        kpis = MFWarehouseService.get_summary_kpis(db)
        print(f"-> Total Tracked: {kpis['total_schemes']}")
        print(f"-> Category Breakdown: {kpis['category_breakdown']}")
        print(f"-> Today's Dips Count: {kpis['today_dips_count']}")
        print(f"-> Momentum Leaders (6M):")
        for m in kpis['momentum_leaders'][:4]:
            print(f"    * {m['scheme_name'][:35]} ({m['category']}): +{m['return_6m_pct']}% 6M, Alpha: +{m['alpha_1y']}%")

        print("\n" + "=" * 60)
        print("[SUCCESS] PHASE 1 SEED & BOOTSTRAP COMPLETE!")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
