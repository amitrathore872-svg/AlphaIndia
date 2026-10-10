"""
Alpha India — Database Table Archival & Log Maintenance Engine
Sprint 39 Maintenance Architecture

Safely archives bulky historical logs and telemetry events from hot transactional
tables into dedicated archive tables:
1. screener_import_events -> archive_screener_import_events (events older than 7 days)
2. system_notifications -> archive_system_notifications (notifications older than 14 days)
3. Runs VACUUM ANALYZE on hot tables to reclaim space and optimize query planners.
"""

import sys
import os
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import engine
from sqlalchemy import text


def run_database_archival():
    print("=" * 70)
    print("ALPHA INDIA — DATABASE LOG ARCHIVAL & VACUUM ENGINE")
    print("=" * 70)

    with engine.begin() as conn:
        # Drop previous incomplete archive table if created without right schema
        conn.execute(text("DROP TABLE IF EXISTS archive_screener_import_events;"))
        conn.execute(text("DROP TABLE IF EXISTS archive_system_notifications;"))

        # 1. Archive screener_import_events
        print("\n[1/3] Archiving screener_import_events older than 7 days...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS archive_screener_import_events AS
            SELECT * FROM screener_import_events WITH NO DATA;
        """))
        conn.execute(text("""
            ALTER TABLE archive_screener_import_events ADD PRIMARY KEY (id);
        """))

        count_to_archive = conn.execute(text("""
            SELECT count(*) FROM screener_import_events
            WHERE created_at < NOW() - INTERVAL '7 days';
        """)).scalar()
        print(f"  -> Found {count_to_archive:,} rows eligible for archival.")

        if count_to_archive > 0:
            conn.execute(text("""
                INSERT INTO archive_screener_import_events
                SELECT * FROM screener_import_events
                WHERE created_at < NOW() - INTERVAL '7 days'
                ON CONFLICT (id) DO NOTHING;
            """))

            deleted = conn.execute(text("""
                DELETE FROM screener_import_events
                WHERE created_at < NOW() - INTERVAL '7 days';
            """)).rowcount
            print(f"  ✓ Moved {deleted:,} rows to archive_screener_import_events table.")
        else:
            print("  ✓ No stale events to archive.")

        # 2. Archive system_notifications
        print("\n[2/3] Archiving system_notifications older than 14 days...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS archive_system_notifications AS
            SELECT * FROM system_notifications WITH NO DATA;
        """))
        conn.execute(text("""
            ALTER TABLE archive_system_notifications ADD PRIMARY KEY (id);
        """))

        count_notif = conn.execute(text("""
            SELECT count(*) FROM system_notifications
            WHERE created_at < NOW() - INTERVAL '14 days';
        """)).scalar()
        print(f"  -> Found {count_notif:,} notifications eligible for archival.")

        if count_notif > 0:
            conn.execute(text("""
                INSERT INTO archive_system_notifications
                SELECT * FROM system_notifications
                WHERE created_at < NOW() - INTERVAL '14 days'
                ON CONFLICT (id) DO NOTHING;
            """))

            deleted_notif = conn.execute(text("""
                DELETE FROM system_notifications
                WHERE created_at < NOW() - INTERVAL '14 days';
            """)).rowcount
            print(f"  ✓ Moved {deleted_notif:,} rows to archive_system_notifications table.")
        else:
            print("  ✓ No stale notifications to archive.")

    # 3. Vacuum and analyze outside transaction block
    print("\n[3/3] Running VACUUM ANALYZE to reclaim disk pages...")
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("VACUUM ANALYZE screener_import_events;"))
            conn.execute(text("VACUUM ANALYZE system_notifications;"))
            print("  ✓ VACUUM ANALYZE completed successfully.")
    except Exception as e:
        print(f"  ⚠️ VACUUM notice: {e}")

    print("\n" + "=" * 70)
    print("⭐ DATABASE ARCHIVAL & OPTIMIZATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    run_database_archival()
