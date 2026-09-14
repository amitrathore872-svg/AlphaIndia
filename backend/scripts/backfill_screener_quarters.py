"""
Alpha India Screener.in Historical Quarters Backfill Script
Sprint 35 Migration

Iterates through companies and populates full historical quarterly statements
(10-14 quarters per company) into quarterly_results table with source='SCREENER.IN'.
Also updates screener_growth_records and Company master metrics.
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.screener_client import ScreenerClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ScreenerQuarterBackfill")


def backfill_company_quarters(db: Session, symbol: str) -> int:
    """
    Fetches full Screener profile and upserts all historical quarters into quarterly_results.
    Returns count of quarters synced.
    """
    clean_sym = symbol.strip().upper()
    company = db.query(Company).filter(Company.symbol == clean_sym).first()
    if not company:
        logger.warning(f"Company {clean_sym} not found in master table.")
        return 0

    profile = ScreenerClient.fetch_full_profile(clean_sym)
    if not profile:
        logger.warning(f"Failed to fetch Screener profile for {clean_sym}.")
        return 0

    # Upsert into screener_growth_records
    existing_rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == clean_sym).first()
    if existing_rec:
        for k, v in profile.items():
            if hasattr(existing_rec, k) and k not in ("id", "import_timestamp", "quarters_history"):
                setattr(existing_rec, k, v)
        existing_rec.last_updated = datetime.utcnow()
    else:
        clean_data = {
            k: v for k, v in profile.items()
            if hasattr(ScreenerGrowthRecord, k) and k not in ("id", "quarters_history")
        }
        clean_data["company_name"] = clean_data.get("company_name") or company.company
        rec = ScreenerGrowthRecord(**clean_data)
        db.add(rec)

    # Upsert quarters_history into quarterly_results
    quarters_history = profile.get("quarters_history", [])
    quarters_synced = 0
    for q in quarters_history:
        period_end = q.get("period_end")
        q_label = q.get("quarter")
        if not period_end or not q_label:
            continue

        existing_q = (
            db.query(QuarterlyResult)
            .filter(
                QuarterlyResult.company_id == company.id,
                (QuarterlyResult.period_end == period_end) | (QuarterlyResult.quarter == q_label),
            )
            .first()
        )
        if existing_q:
            existing_q.quarter = q_label
            existing_q.fiscal_period = q.get("fiscal_period") or q_label
            existing_q.period_end = period_end
            existing_q.result_date = period_end
            existing_q.revenue = q.get("revenue")
            existing_q.operating_income = q.get("operating_income")
            existing_q.net_profit = q.get("net_profit")
            existing_q.eps = q.get("eps")
            existing_q.interest_expense = q.get("interest_expense")
            existing_q.revenue_growth = q.get("revenue_growth")
            existing_q.pat_growth = q.get("pat_growth")
            existing_q.source = "SCREENER.IN"
            existing_q.imported_at = datetime.utcnow()
        else:
            new_q = QuarterlyResult(
                company_id=company.id,
                quarter=q_label,
                fiscal_period=q.get("fiscal_period") or q_label,
                period_end=period_end,
                result_date=period_end,
                revenue=q.get("revenue"),
                operating_income=q.get("operating_income"),
                net_profit=q.get("net_profit"),
                eps=q.get("eps"),
                interest_expense=q.get("interest_expense"),
                revenue_growth=q.get("revenue_growth"),
                pat_growth=q.get("pat_growth"),
                source="SCREENER.IN",
                imported_at=datetime.utcnow(),
            )
            db.add(new_q)
        quarters_synced += 1

    # Update Company master metrics
    if profile.get("market_cap") is not None:
        company.market_cap = profile.get("market_cap")
    if profile.get("quarterly_sales_yoy") is not None:
        company.revenue_growth = profile.get("quarterly_sales_yoy")
    elif profile.get("sales_growth_ttm") is not None:
        company.revenue_growth = profile.get("sales_growth_ttm")
    if profile.get("quarterly_pat_yoy") is not None:
        company.pat_growth = profile.get("quarterly_pat_yoy")
    elif profile.get("profit_growth_ttm") is not None:
        company.pat_growth = profile.get("profit_growth_ttm")
    if profile.get("roce") is not None:
        company.roce = profile.get("roce")
    if profile.get("health_score") is not None:
        company.health_score = profile.get("health_score")
    company.updated_at = datetime.utcnow()

    db.commit()
    return quarters_synced


def main():
    parser = argparse.ArgumentParser(description="Backfill Screener historical quarterly statements")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols to backfill, e.g. --symbols TCS INFY RELIANCE")
    parser.add_argument("--limit", type=int, default=10, help="Number of companies to process (default: 10)")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay between HTTP requests in seconds (default: 0.8)")
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        if args.symbols:
            targets = [s.strip().upper() for s in args.symbols]
        else:
            # Pick highest market cap or existing screener companies
            companies = (
                db.query(Company.symbol)
                .join(ScreenerGrowthRecord, ScreenerGrowthRecord.symbol == Company.symbol)
                .order_by(ScreenerGrowthRecord.market_cap.desc().nullslast())
                .limit(args.limit)
                .all()
            )
            targets = [c[0] for c in companies]

        logger.info(f"Starting Screener quarters backfill for {len(targets)} companies...")
        total_quarters = 0

        for idx, sym in enumerate(targets, start=1):
            logger.info(f"[{idx}/{len(targets)}] Processing {sym}...")
            count = backfill_company_quarters(db, sym)
            total_quarters += count
            logger.info(f" -> {sym}: Synced {count} historical quarters.")
            time.sleep(args.delay)

        logger.info(f"\nBackfill finished. Processed {len(targets)} companies, synced {total_quarters} quarters.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
