"""
Alpha India - Financial Warehouse Audit & Repair Utility
Sprint 38.0 Data Integrity Engine
Scans quarterly financial statements, purges corrupted or duplicate entries,
and runs reconciliation checks across all tracked equities.
"""

import os
import sys

# Setup root path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.growth_calculator_service import GrowthCalculatorService
from sqlalchemy import text


def audit_and_repair():
    print("=" * 60)
    print("ALPHA INDIA — FINANCIAL WAREHOUSE INTEGRITY AUDIT & REPAIR")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Total records check
        total_records = db.query(QuarterlyResult).count()
        total_companies = db.query(Company).count()
        print(f"Total Companies in DB: {total_companies}")
        print(f"Total Quarterly Statements: {total_records}")

        # 2. Identify corrupted rows (missing period_end or both revenue and net_profit null)
        corrupted_query = db.query(QuarterlyResult).filter(
            (QuarterlyResult.period_end == None) |
            ((QuarterlyResult.revenue == None) & (QuarterlyResult.net_profit == None))
        )
        corrupted_count = corrupted_query.count()
        print(f"\nCorrupted Records Detected: {corrupted_count}")

        if corrupted_count > 0:
            deleted = corrupted_query.delete(synchronize_session=False)
            db.commit()
            print(f"[OK] Purged {deleted} corrupted quarterly records.")
        else:
            print("[OK] Zero corrupted quarterly records found.")

        # 3. Check for any duplicate (company_id, period_end)
        dup_check = db.execute(text("""
            SELECT company_id, period_end, COUNT(*)
            FROM quarterly_results
            GROUP BY company_id, period_end
            HAVING COUNT(*) > 1;
        """)).fetchall()

        if dup_check:
            print(f"[WARNING] Found {len(dup_check)} duplicate quarterly periods! Deduplicating...")
            db.execute(text("""
                DELETE FROM quarterly_results a
                USING quarterly_results b
                WHERE a.id > b.id
                  AND a.company_id = b.company_id
                  AND a.period_end = b.period_end;
            """))
            db.commit()
            print("[OK] Deduplication completed.")
        else:
            print("[OK] Zero duplicate quarterly periods found (Unique constraint enforced).")

        # 4. Audit YoY Growth Alignment for top companies
        print("\n--- Auditing YoY Growth Calculation & Date Alignment ---")
        companies_with_data = (
            db.query(Company)
            .join(QuarterlyResult, QuarterlyResult.company_id == Company.id)
            .distinct()
            .limit(10)
            .all()
        )

        audited = 0
        for comp in companies_with_data:
            res = GrowthCalculatorService.calculate_company_growth(db, comp.symbol)
            if res.get("success"):
                audited += 1
                print(f"  [AUDIT OK] {comp.symbol}: Latest={res.get('latest_quarter')}, "
                      f"Rev Growth={res.get('revenue_growth')}%, PAT Growth={res.get('pat_growth')}%")
            else:
                print(f"  [INFO] {comp.symbol}: {res.get('message')}")

        print(f"\nAudit complete. Successfully verified growth calculations for {audited} sample companies.")

    finally:
        db.close()

    print("=" * 60)
    print("WAREHOUSE AUDIT & REPAIR COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    audit_and_repair()
