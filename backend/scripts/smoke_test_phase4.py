"""Phase 4 verification — bulk import service, model, API."""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.basicConfig(level=logging.WARNING)

print("=" * 55)
print("PHASE 4 VERIFICATION")
print("=" * 55)

# Test 1: Import log model
from app.models.early_stage_import_log import EarlyStageImportLog
print("OK: EarlyStageImportLog model imports")

# Test 2: Company model has is_provisional
from app.models.company import Company
assert hasattr(Company, "is_provisional"), "is_provisional missing from Company model"
print("OK: Company.is_provisional field present")

# Test 3: Import service imports cleanly
from app.services.early_stage_import_service import bulk_import_candidates, _sanitize_ticker
print("OK: early_stage_import_service imports")

# Test 4: Ticker sanitisation logic
t1 = _sanitize_ticker("Reliance Industries", None)
t2 = _sanitize_ticker("HDFC Bank Limited", "HDFCBANK")
assert t1.endswith("_PRV"), f"Expected _PRV suffix, got: {t1}"
assert t2.endswith("_PRV"), f"Expected _PRV suffix, got: {t2}"
assert "HDFCBANK" in t2, f"Ticker should preserve provided ticker: {t2}"
print(f"OK: _sanitize_ticker -> '{t1}', '{t2}'")

# Test 5: API router has /import route
from app.api.early_stage import router
routes = [r.path for r in router.routes]
assert "/early-stage/import" in routes, f"Import route missing. Routes: {routes}"
print("OK: POST /early-stage/import route registered")

print("")
print("ALL PHASE 4 CHECKS PASSED")
