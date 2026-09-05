from datetime import datetime
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.announcement import Announcement

# Temporary sample data (will become live NSE API in Step 4.1.3)
SAMPLE_ANNOUNCEMENTS = [
    {
        "symbol": "KPITTECH",
        "company": "KPIT Technologies",
        "announcement_type": "Quarterly Results",
        "quarter": "Q1 FY27",
        "published_at": datetime(2026, 9, 5, 14, 31),
        "source_url": "https://www.nseindia.com/",
    },
    {
        "symbol": "BEL",
        "company": "Bharat Electronics",
        "announcement_type": "Quarterly Results",
        "quarter": "Q1 FY27",
        "published_at": datetime(2026, 9, 5, 15, 2),
        "source_url": "https://www.nseindia.com/",
    },
    {
        "symbol": "KARNATAKA",
        "company": "Karnataka Bank",
        "announcement_type": "Quarterly Results",
        "quarter": "Q1 FY27",
        "published_at": datetime(2026, 9, 5, 15, 20),
        "source_url": "https://www.nseindia.com/",
    },
]


def collect_nse_announcements():
    """
    Inserts only NEW announcements into PostgreSQL.
    Duplicate announcements are skipped.
    """

    db: Session = SessionLocal()

    inserted = 0
    skipped = 0

    try:
        for item in SAMPLE_ANNOUNCEMENTS:

            existing = (
                db.query(Announcement)
                .filter(
                    Announcement.symbol == item["symbol"],
                    Announcement.quarter == item["quarter"],
                )
                .first()
            )

            if existing:
                skipped += 1
                continue

            announcement = Announcement(
                symbol=item["symbol"],
                company=item["company"],
                announcement_type=item["announcement_type"],
                quarter=item["quarter"],
                published_at=item["published_at"],
                source_url=item["source_url"],
                status="NEW",
            )

            db.add(announcement)
            inserted += 1

        db.commit()

        print("=" * 50)
        print("📡 Alpha India NSE Collector")
        print(f"Inserted : {inserted}")
        print(f"Skipped  : {skipped}")
        print("=" * 50)

    finally:
        db.close()