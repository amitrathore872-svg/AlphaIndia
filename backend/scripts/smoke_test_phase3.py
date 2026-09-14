"""
Phase 3 verification script.
Tests: NER, scoring, discovery service imports, and API router.
"""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.basicConfig(level=logging.WARNING)

print("=" * 55)
print("PHASE 3 VERIFICATION")
print("=" * 55)

# --- Test 1: NER extractor ---
from app.services.named_entity_extractor import extract_companies
results = extract_companies("Reliance Industries reported 20pct revenue growth. Infosys and TCS also performed well this quarter.")
print(f"[NER] Extracted {len(results)} entities: {[r['company_name'] for r in results]}")
assert len(results) >= 1, "NER must find at least 1 entity"
print("OK: NER extractor")

# --- Test 2: Scoring service ---
from app.services.candidate_scoring_service import compute_trend_score
score = compute_trend_score(mention_count=50, yesterday_count=20, sentiment="positive", sector="Technology")
print(f"[Scoring] trend_score={score} (expect 0-100)")
assert 0 <= score <= 100, f"Score out of range: {score}"
print("OK: Scoring service")

# --- Test 3: Discovery service imports ---
from app.services.early_stage_discovery_service import run_extraction_pipeline
print("OK: Discovery service import")

# --- Test 4: API router ---
from app.api.early_stage import router
assert router.prefix == "/early-stage"
print("OK: API router registered")

# --- Test 5: Daily model ---
from app.models.early_stage_daily import EarlyStageDaily
print("OK: EarlyStageDaily model")

print("")
print("ALL PHASE 3 CHECKS PASSED")
