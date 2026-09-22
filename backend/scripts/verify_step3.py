"""
Alpha India - Step 3 Verification Suite
Tests background worker decoupling, NSE anti-bot bypass with curl_cffi,
real-time corporate announcement ingestion, and Alembic baseline state.
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.clients.nse_client import NSEClient
from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
from app.db.database import SessionLocal
from alembic.config import Config
from alembic import script
from alembic.runtime import migration


def test_configuration():
    print("--- 1. Testing Configuration & Settings ---")
    assert hasattr(settings, "ENABLE_BACKGROUND_WORKERS"), "Missing ENABLE_BACKGROUND_WORKERS in settings"
    assert hasattr(settings, "WORKER_POLL_INTERVAL_SECONDS"), "Missing WORKER_POLL_INTERVAL_SECONDS in settings"
    assert hasattr(settings, "NSE_USE_CURL_CFFI"), "Missing NSE_USE_CURL_CFFI in settings"
    print(f"[OK] Settings validated: ENABLE_BACKGROUND_WORKERS={settings.ENABLE_BACKGROUND_WORKERS}, "
          f"NSE_USE_CURL_CFFI={settings.NSE_USE_CURL_CFFI}")


def test_nse_client():
    print("--- 2. Testing NSEClient (curl_cffi Chrome120 Impersonation) ---")
    client = NSEClient()
    assert client.use_curl_cffi is True, "Expected NSEClient to use curl_cffi"
    announcements = client.global_announcements()
    assert isinstance(announcements, list), f"Expected list from global_announcements, got {type(announcements)}"
    assert len(announcements) > 0, "Expected non-empty list of global announcements from NSE"
    first = announcements[0]
    print(f"[OK] Live corporate announcements fetched ({len(announcements)} items). "
          f"Sample: {first.get('symbol')} | {first.get('desc') or first.get('attchmntText')}")


def test_wire_worker_single_cycle():
    print("--- 3. Testing LiveExchangeWireWorker Global Stream Ingestion ---")
    db = SessionLocal()
    try:
        res = LiveExchangeWireWorker.poll_next_batch(db)
        print(f"[OK] Wire worker cycle executed. Total filings scanned: {res.get('scanned')}, "
              f"Catalysts discovered in batch: {res.get('catalysts')}")
        telemetry = LiveExchangeWireWorker.get_telemetry()
        assert telemetry["total_filings_scanned"] > 0, "Expected filings scanned > 0"
        print(f"[OK] Wire worker telemetry active. Total filings: {telemetry['total_filings_scanned']}, "
              f"Catalysts: {telemetry['catalysts_discovered']}")
    finally:
        db.close()


def test_alembic_head():
    print("--- 4. Testing Alembic Migration Baseline ---")
    alembic_ini_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    alembic_cfg = Config(alembic_ini_path)
    script_dir = script.ScriptDirectory.from_config(alembic_cfg)
    expected_head = script_dir.get_current_head()

    from app.db.database import engine
    with engine.connect() as conn:
        context = migration.MigrationContext.configure(conn)
        current_rev = context.get_current_revision()

    assert current_rev == expected_head, f"Alembic rev {current_rev} does not match expected head {expected_head}"
    print(f"[OK] Alembic database revision matches head: {current_rev}")


def main():
    print("=" * 60)
    print("ALPHA INDIA - STEP 3 VERIFICATION SUITE")
    print("=" * 60)

    test_configuration()
    test_nse_client()
    test_wire_worker_single_cycle()
    test_alembic_head()

    print("=" * 60)
    print("ALL STEP 3 VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
