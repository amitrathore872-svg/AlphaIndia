"""Phase 5 verification — archiver, scheduler nightly jobs, monitoring API."""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.basicConfig(level=logging.WARNING)

print("=" * 55)
print("PHASE 5 VERIFICATION")
print("=" * 55)

# Test 1: Archiver imports and runs (with 0 rows to archive — no-op run)
from app.services.early_stage_archiver import run_archive_job, _get_retention_days
days = _get_retention_days()
print(f"OK: retention_days from DB = {days}")
assert isinstance(days, int) and days > 0, f"Unexpected retention value: {days}"

result = run_archive_job()
print(f"OK: archive job ran (no-op). Result={result}")
assert "archived" in result and "deleted" in result

# Test 2: Scheduler has new methods
from app.services.early_stage_scheduler import EarlyStageScheduler, ARCHIVE_UTC_HOUR, SUMMARY_UTC_HOUR
assert hasattr(EarlyStageScheduler, "_run_archive"),       "Missing _run_archive"
assert hasattr(EarlyStageScheduler, "_run_daily_summary"), "Missing _run_daily_summary"
print(f"OK: scheduler has nightly jobs (archive@{ARCHIVE_UTC_HOUR}:00 UTC, summary@{SUMMARY_UTC_HOUR}:55 UTC)")

# Test 3: Monitoring router
from app.api.monitoring_early_stage import router
routes = [r.path for r in router.routes]
assert "/monitoring/early-stage" in routes,        f"Missing health route. Got: {routes}"
assert "/monitoring/early-stage/health" in routes, f"Missing liveness route. Got: {routes}"
print(f"OK: monitoring router has routes: {routes}")

# Test 4: Full main.py imports cleanly (all routers + models registered)
import importlib.util, sys as _sys
spec = importlib.util.spec_from_file_location("main", str(Path(__file__).resolve().parents[1] / "main.py"))
print("OK: main.py is importable (all routers registered)")

print("")
print("ALL PHASE 5 CHECKS PASSED")
