"""
Migration script to add vertical archetypes, announcement & recommendation dates,
absorption metrics, velocity horizons, and trend regimes to announcements_radar.
"""

import sys
sys.path.insert(0, '.')
from sqlalchemy import text
from app.db.database import engine

def migrate():
    columns_to_add = [
        ("announcement_date", "TIMESTAMP WITH TIME ZONE"),
        ("recommendation_date", "TIMESTAMP WITH TIME ZONE"),
        ("vertical_archetype", "VARCHAR(80)"),
        ("trend_regime", "VARCHAR(40)"),
        ("price_at_announcement", "FLOAT"),
        ("realized_move_pct", "FLOAT"),
        ("absorption_status", "VARCHAR(40)"),
        ("est_velocity_days", "VARCHAR(80)"),
        ("dma_50", "FLOAT"),
        ("dma_200", "FLOAT"),
    ]

    with engine.connect() as conn:
        with conn.begin():
            for col_name, col_type in columns_to_add:
                sql = f"ALTER TABLE announcements_radar ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
                conn.execute(text(sql))
                print(f"Verified/added column {col_name} ({col_type})")
            
            # Add indexes for efficient multi-vertical filtering
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_radar_vertical ON announcements_radar(vertical_archetype);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_radar_absorption ON announcements_radar(absorption_status);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_radar_trend ON announcements_radar(trend_regime);"))
            print("Verified/added indexes on vertical, absorption, and trend.")

if __name__ == "__main__":
    migrate()
    print("Migration completed successfully.")
