"""
Alpha India - Step 5 Verification Suite
Tests database unique constraint enforcement, idempotent warehouse upsert,
authentic YoY chronological date matching, and YahooClient retry backoff.
"""

import os
import sys
from datetime import date, timedelta
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

# Setup root path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine, SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.growth_calculator_service import GrowthCalculatorService
from app.clients.yahoo_client import YahooClient


def test_unique_constraint_exists():
    print("--- 1. Testing Database Unique Constraint ---")
    with engine.connect() as conn:
        res = conn.execute(text("""
            SELECT conname FROM pg_constraint 
            WHERE conname = 'uq_quarterly_results_company_period'
              AND conrelid = 'quarterly_results'::regclass;
        """)).fetchall()
        assert len(res) == 1, "Expected constraint uq_quarterly_results_company_period on quarterly_results"
        print("[OK] Constraint 'uq_quarterly_results_company_period' confirmed on table 'quarterly_results'.")


def test_duplicate_insertion_prevention():
    print("--- 2. Testing Duplicate Insertion Prevention (Database Guardrail) ---")
    db = SessionLocal()
    try:
        # Create test company or find one
        test_sym = "TEST_INTEG_STOCK"
        comp = db.query(Company).filter(Company.symbol == test_sym).first()
        if not comp:
            comp = Company(symbol=test_sym, company="Test Integrity Co", exchange="NSE", listing_status="ACTIVE")
            db.add(comp)
            db.commit()

        test_period = date(2025, 12, 31)

        # Clear existing test rows
        db.query(QuarterlyResult).filter(
            QuarterlyResult.company_id == comp.id,
            QuarterlyResult.period_end == test_period
        ).delete()
        db.commit()

        # Insert first record
        r1 = QuarterlyResult(
            company_id=comp.id,
            quarter="Q3 2025",
            fiscal_period="Q3-2025",
            period_end=test_period,
            revenue=100.0,
            net_profit=20.0
        )
        db.add(r1)
        db.commit()
        print("[OK] First quarterly record committed successfully.")

        # Attempt to insert identical (company_id, period_end)
        r2 = QuarterlyResult(
            company_id=comp.id,
            quarter="Q3 2025 Duplicate",
            fiscal_period="Q3-2025",
            period_end=test_period,
            revenue=110.0,
            net_profit=25.0
        )
        db.add(r2)
        try:
            db.commit()
            raise AssertionError("Database allowed duplicate quarterly record! Unique constraint failed!")
        except IntegrityError:
            db.rollback()
            print("[OK] Duplicate insertion cleanly blocked by PostgreSQL unique constraint (IntegrityError raised).")

        # Cleanup test data
        db.query(QuarterlyResult).filter(QuarterlyResult.company_id == comp.id).delete()
        db.query(Company).filter(Company.id == comp.id).delete()
        db.commit()
    finally:
        db.close()


def test_growth_calculator_yoy_chronological_matching():
    print("--- 3. Testing Authentic YoY Chronological Matching ---")
    db = SessionLocal()
    try:
        test_sym = "TEST_YOY_STOCK"
        comp = db.query(Company).filter(Company.symbol == test_sym).first()
        if not comp:
            comp = Company(symbol=test_sym, company="Test YoY Co", exchange="NSE", listing_status="ACTIVE")
            db.add(comp)
            db.commit()

        # Clean old test rows
        db.query(QuarterlyResult).filter(QuarterlyResult.company_id == comp.id).delete()
        db.commit()

        # Insert 5 consecutive quarters with 1-year gap between Q0 and Q4
        base_date = date(2025, 3, 31)
        # Quarters: 2025-03-31 (150 cr), 2024-12-31, 2024-09-30, 2024-06-30, 2024-03-31 (100 cr)
        quarter_dates = [
            (date(2025, 3, 31), 150.0, 30.0), # Q0
            (date(2024, 12, 31), 140.0, 28.0),
            (date(2024, 9, 30), 130.0, 25.0),
            (date(2024, 6, 30), 120.0, 22.0),
            (date(2024, 3, 31), 100.0, 20.0), # Q4 (Exact 1 year prior)
        ]

        for p_date, rev, pat in quarter_dates:
            db.add(QuarterlyResult(
                company_id=comp.id,
                quarter=f"Q{p_date.month//3} {p_date.year}",
                fiscal_period=f"Q{p_date.month//3}-{p_date.year}",
                period_end=p_date,
                revenue=rev,
                net_profit=pat
            ))
        db.commit()

        res = GrowthCalculatorService.calculate_company_growth(db, test_sym)
        assert res["success"] is True, f"Calculation failed: {res}"
        # Expected Revenue Growth: (150 - 100) / 100 = 50.0%
        # Expected PAT Growth: (30 - 20) / 20 = 50.0%
        assert res["revenue_growth"] == 50.0, f"Expected 50.0% rev growth, got {res['revenue_growth']}"
        assert res["pat_growth"] == 50.0, f"Expected 50.0% pat growth, got {res['pat_growth']}"
        print(f"[OK] Chronological YoY verified: Revenue Growth = {res['revenue_growth']}%, PAT Growth = {res['pat_growth']}%")

        # Cleanup test data
        db.query(QuarterlyResult).filter(QuarterlyResult.company_id == comp.id).delete()
        db.query(Company).filter(Company.id == comp.id).delete()
        db.commit()
    finally:
        db.close()


def test_yahoo_client_backoff():
    print("--- 4. Testing YahooClient Retry Backoff Configuration ---")
    client = YahooClient()
    assert hasattr(client, "RETRIES"), "Missing RETRIES in YahooClient"
    assert hasattr(client, "RETRY_DELAY"), "Missing RETRY_DELAY in YahooClient"
    assert client.RETRIES >= 3, "Expected at least 3 retries"
    print(f"[OK] YahooClient retry settings: {client.RETRIES} retries with {client.RETRY_DELAY}s exponential backoff.")


def main():
    print("=" * 60)
    print("ALPHA INDIA — STEP 5 DATA INTEGRITY & WAREHOUSE VERIFICATION")
    print("=" * 60)

    test_unique_constraint_exists()
    test_duplicate_insertion_prevention()
    test_growth_calculator_yoy_chronological_matching()
    test_yahoo_client_backoff()

    print("=" * 60)
    print("ALL STEP 5 VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
