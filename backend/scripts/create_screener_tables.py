"""
Script to create Screener.in tables in the database.
Isolated parallel tables:
- screener_growth_records
- screener_import_runs
- screener_import_events
"""

import sys
from pathlib import Path

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.db.database import engine, Base
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.screener_import_run import ScreenerImportRun
from app.models.screener_import_event import ScreenerImportEvent


def main():
    print("Creating Screener.in parallel database tables...")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            ScreenerGrowthRecord.__table__,
            ScreenerImportRun.__table__,
            ScreenerImportEvent.__table__,
        ],
    )
    print("Tables created successfully:")
    print(" - screener_growth_records")
    print(" - screener_import_runs")
    print(" - screener_import_events")


if __name__ == "__main__":
    main()
