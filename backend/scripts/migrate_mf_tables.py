"""
Database Table Creation Script for Mutual Fund Intelligence Engine
"""
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import engine, Base
from app.models.mf_models import (
    MFScheme,
    MFSchemeHolding,
    MFStockMonthlyAggregate,
    MFSectorFlow,
    MFAccumulationSignal,
)

def create_tables():
    print("Creating Mutual Fund Intelligence tables in database...")
    try:
        MFScheme.__table__.create(bind=engine, checkfirst=True)
        MFSchemeHolding.__table__.create(bind=engine, checkfirst=True)
        MFStockMonthlyAggregate.__table__.create(bind=engine, checkfirst=True)
        MFSectorFlow.__table__.create(bind=engine, checkfirst=True)
        MFAccumulationSignal.__table__.create(bind=engine, checkfirst=True)
        print("Successfully created all MF tables:")
        print(" - mf_schemes")
        print(" - mf_scheme_holdings")
        print(" - mf_stock_monthly_aggregates")
        print(" - mf_sector_flows")
        print(" - mf_accumulation_signals")
    except Exception as e:
        print(f"Error creating tables: {e}")
        raise e

if __name__ == "__main__":
    create_tables()
