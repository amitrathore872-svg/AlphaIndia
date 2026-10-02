"""
Database Migration Script for Mutual Fund Alpha Radar Engine
Alpha India - Sprint 39
Creates `mf_radar_schemes` and `mf_radar_nav_history` tables.
"""

import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import engine, Base
from app.models.mf_radar_models import (
    MFRadarScheme,
    MFRadarNavHistory,
)


def create_tables():
    print("Creating Mutual Fund Alpha Radar tables in database...")
    try:
        MFRadarScheme.__table__.create(bind=engine, checkfirst=True)
        MFRadarNavHistory.__table__.create(bind=engine, checkfirst=True)
        print("Successfully created tables:")
        print(" - mf_radar_schemes")
        print(" - mf_radar_nav_history")
    except Exception as e:
        print(f"Error creating tables: {e}")
        raise e


if __name__ == "__main__":
    create_tables()
