"""
Migration script to initialize watchlist_alerts and user_personal_telegram_configs tables.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine, Base
from app.models.watchlist_alert import WatchlistAlert, UserPersonalTelegramConfig
import app.models

def main():
    print("Checking and creating WatchlistAlert & UserPersonalTelegramConfig tables...")
    Base.metadata.create_all(bind=engine, tables=[
        WatchlistAlert.__table__,
        UserPersonalTelegramConfig.__table__,
    ])
    print("[OK] Successfully verified/created watchlist_alerts and user_personal_telegram_configs tables.")

if __name__ == "__main__":
    main()
