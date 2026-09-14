"""
Alpha India - Equity Universe Classification & Growth Scanner Cleanse
Classifies all companies in the warehouse into:
  - EQUITY
  - MUTUAL_FUND
  - DEBT
  - RIGHTS_ENTITLEMENT

Sets `is_growth_eligible = True` strictly for actively listed equities.
Excludes unlisted (delisted/suspended), debt, and mutual funds from growth scanner.
"""

import sys
from pathlib import Path

# Add backend root to sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from app.db.database import SessionLocal, engine
from app.models import (
    Company,
    CompanyMarketMetrics,
    FinancialImportQueue,
)


def run_classification():
    print("=" * 65)
    print("ALPHA INDIA: EQUITY UNIVERSE CLASSIFICATION & CLEANSE")
    print("=" * 65)

    # 1. Ensure columns and indexes exist in DB
    with engine.begin() as conn:
        print("Checking database columns for 'companies' table...")
        conn.execute(
            text(
                "ALTER TABLE companies ADD COLUMN IF NOT EXISTS security_type VARCHAR(30) DEFAULT 'EQUITY';"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_growth_eligible BOOLEAN DEFAULT TRUE;"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_companies_security_type ON companies(security_type);"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_companies_is_growth_eligible ON companies(is_growth_eligible);"
            )
        )
        print("Schema verified.")

    db = SessionLocal()

    try:
        companies = db.query(Company).all()
        total = len(companies)
        print(f"Loaded {total:,} companies from database.")

        stats = {
            "EQUITY_ACTIVE": 0,
            "EQUITY_INACTIVE": 0,
            "MUTUAL_FUND": 0,
            "DEBT": 0,
            "RIGHTS_ENTITLEMENT": 0,
            "GROWTH_ELIGIBLE": 0,
            "EXCLUDED": 0,
        }

        for c in companies:
            status = (c.listing_status or "").strip().lower()
            symbol = (c.symbol or "").strip().upper()
            name = (c.company or "").strip()
            name_lower = name.lower()
            isin = (c.isin or "").strip().upper()

            is_active = status == "active"

            # Determine security_type
            # 1. Mutual Funds & ETFs
            if (
                isin.startswith("INF")
                or "mutual fund" in name_lower
                or "growth fund" in name_lower
                or "index fund" in name_lower
                or symbol.endswith("ETF")
                or symbol.endswith("BEES")
                or " etf" in name_lower
            ):
                sec_type = "MUTUAL_FUND"
                stats["MUTUAL_FUND"] += 1

            # 2. Rights Entitlements
            elif (
                (len(isin) >= 10 and isin[7:9] == "20")
                or symbol.endswith("-RE")
                or "-RE" in symbol
            ):
                sec_type = "RIGHTS_ENTITLEMENT"
                stats["RIGHTS_ENTITLEMENT"] += 1

            # 3. Debt / Debentures / Commercial Paper / Bonds
            elif (
                (len(isin) >= 10 and isin[7:9] in ("03", "04", "07", "08"))
                or any(
                    kw in name_lower
                    for kw in [
                        "debenture",
                        "commercial paper",
                        "ncd",
                        "bonds & debentures",
                    ]
                )
            ):
                sec_type = "DEBT"
                stats["DEBT"] += 1

            # 4. Standard Equity
            else:
                sec_type = "EQUITY"
                if is_active:
                    stats["EQUITY_ACTIVE"] += 1
                else:
                    stats["EQUITY_INACTIVE"] += 1

            eligible = is_active and (sec_type == "EQUITY")

            c.security_type = sec_type
            c.is_growth_eligible = eligible

            if eligible:
                stats["GROWTH_ELIGIBLE"] += 1
            else:
                stats["EXCLUDED"] += 1

        db.commit()
        print("\nClassification committed successfully.")

        # 2. Update FinancialImportQueue to exclude non-eligible items
        print("\nUpdating Financial Import Queue...")
        excluded_company_ids = (
            db.query(Company.id)
            .filter(Company.is_growth_eligible.is_(False))
            .subquery()
        )

        updated_queue = (
            db.query(FinancialImportQueue)
            .filter(
                FinancialImportQueue.company_id.in_(excluded_company_ids),
                FinancialImportQueue.status.in_(["PENDING", "QUEUED"]),
            )
            .update(
                {"status": "EXCLUDED"},
                synchronize_session=False,
            )
        )
        db.commit()
        print(f"Updated {updated_queue} pending queue items to 'EXCLUDED'.")

        print("\n" + "=" * 65)
        print("CLASSIFICATION AUDIT REPORT")
        print("=" * 65)
        print(f"  Total Companies Processed        : {total:,}")
        print(f"  Growth Scanner Eligible (Active) : {stats['GROWTH_ELIGIBLE']:,}")
        print(f"  Total Excluded from Screener     : {stats['EXCLUDED']:,}")
        print("  ---------------------------------------------------------")
        print(f"  - Active Listed Equities         : {stats['EQUITY_ACTIVE']:,}")
        print(f"  - Inactive Equities (Delisted/Sus): {stats['EQUITY_INACTIVE']:,}")
        print(f"  - Mutual Funds & ETFs            : {stats['MUTUAL_FUND']:,}")
        print(f"  - Debt / Debentures / CP         : {stats['DEBT']:,}")
        print(f"  - Rights Entitlements (RE)       : {stats['RIGHTS_ENTITLEMENT']:,}")
        print("=" * 65)

    finally:
        db.close()


if __name__ == "__main__":
    run_classification()
