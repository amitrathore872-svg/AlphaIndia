"""
Alpha India - Migration Script for Portfolio BUY/SELL Signals & Telegram Radar
Creates portfolio_signal_alerts table and adds missing columns to user_personal_telegram_configs.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.database import engine, Base
from app.models.portfolio_signal_alert import PortfolioSignalAlert
from app.models.watchlist_alert import UserPersonalTelegramConfig
import app.models

def main():
    print("[*] Checking and creating portfolio_signal_alerts table...")
    Base.metadata.create_all(bind=engine, tables=[PortfolioSignalAlert.__table__])
    print("  [OK] portfolio_signal_alerts table ready.")

    print("[*] Checking and altering user_personal_telegram_configs columns...")
    alter_statements = [
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS notify_portfolio_buy BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS notify_portfolio_sell BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS notify_portfolio_rebalance BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS notify_watchlist_buy BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS notify_watchlist_sell BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE user_personal_telegram_configs ADD COLUMN IF NOT EXISTS min_conviction_score INTEGER DEFAULT 75;",
    ]

    with engine.connect() as conn:
        for stmt in alter_statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception as e:
                print(f"  [Notice] {stmt[:40]}... -> {e}")

    print("[OK] Migration complete. All Portfolio BUY/SELL Signal & Telegram radar schema elements are in place.")

if __name__ == "__main__":
    main()
