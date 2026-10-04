"""
Alpha India — Create Investor Intelligence Tables
Initializes `investor_documents` and `investor_intelligence_insights` in PostgreSQL.
"""

import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import engine, Base
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight


def init_tables():
    print("[AlphaIndia] Creating Investor Intelligence tables in database...")
    Base.metadata.create_all(bind=engine, tables=[
        InvestorDocument.__table__,
        InvestorIntelligenceInsight.__table__,
    ])
    print("[AlphaIndia] Successfully created `investor_documents` and `investor_intelligence_insights` tables.")


if __name__ == "__main__":
    init_tables()
