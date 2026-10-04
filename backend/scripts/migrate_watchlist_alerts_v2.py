"""
Migration: Extend watchlist_alerts to support Stock, Watchlist, Portfolio & Screener scopes
Alpha India - Sprint 38.4
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.db.database import engine

def migrate():
    print("[*] Running migration on watchlist_alerts...")
    with engine.connect() as conn:
        # 1. Allow watchlist_id to be nullable for portfolio-scoped & universe alerts
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ALTER COLUMN watchlist_id DROP NOT NULL;"))
            print("   [+] Altered watchlist_id to nullable")
        except Exception as e:
            print(f"   [-] watchlist_id alter notice: {e}")

        # 2. Add target_scope
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ADD COLUMN IF NOT EXISTS target_scope VARCHAR(30) DEFAULT 'STOCK';"))
            print("   [+] Added target_scope column")
        except Exception as e:
            print(f"   [-] target_scope notice: {e}")

        # 3. Add portfolio_id
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ADD COLUMN IF NOT EXISTS portfolio_id INTEGER NULL REFERENCES portfolios(id) ON DELETE CASCADE;"))
            print("   [+] Added portfolio_id column")
        except Exception as e:
            print(f"   [-] portfolio_id notice: {e}")

        # 4. Add target_name
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ADD COLUMN IF NOT EXISTS target_name VARCHAR(100) NULL;"))
            print("   [+] Added target_name column")
        except Exception as e:
            print(f"   [-] target_name notice: {e}")

        # 5. Add signal_direction
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ADD COLUMN IF NOT EXISTS signal_direction VARCHAR(10) DEFAULT 'BUY';"))
            print("   [+] Added signal_direction column")
        except Exception as e:
            print(f"   [-] signal_direction notice: {e}")

        # 6. Add triggered_stocks
        try:
            conn.execute(text("ALTER TABLE watchlist_alerts ADD COLUMN IF NOT EXISTS triggered_stocks TEXT NULL;"))
            print("   [+] Added triggered_stocks column")
        except Exception as e:
            print(f"   [-] triggered_stocks notice: {e}")

        conn.commit()
    print("[+] Migration completed successfully!")

if __name__ == "__main__":
    migrate()
