"""
Test verification script for Breakout Execution Engine
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import Base, engine, SessionLocal
import app.models
from app.models.breakout_execution import BreakoutExecutionCandidate
from app.services.breakout_execution_service import BreakoutExecutionService


def run_tests():
    print("Ensuring tables are created...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("\n1. Testing Add Candidate...")
        sample = {
            "symbol": "METROPOLIS",
            "company_name": "Metropolis Healthcare Ltd",
            "sector": "Pharma & Healthcare",
            "pattern_tag": "SUPER_COIL",
            "conviction_score": 88,
            "setup_tier": "A+ SUPER COIL",
            "cmp": 2150.0,
            "day_change_pct": 0.85,
            "trigger_price": 2165.0,
            "stop_loss": 2085.0,
            "target_1": 2360.0,
            "target_2": 2555.0,
            "volume_pace_ratio": 1.45,
        }
        cand = BreakoutExecutionService.add_candidate(db, sample)
        print(f"Enrolled {cand.symbol}: CMP={cand.current_cmp}, Trigger={cand.trigger_price}, SL={cand.stop_loss}, Status={cand.execution_status}, Dist={cand.distance_to_trigger_pct}%")
        assert cand.symbol == "METROPOLIS"
        assert cand.execution_status == "READY"  # 2165 vs 2150 is 0.69% away (<1.2% -> READY)

        print("\n2. Testing Watched Candidates Query & Stats...")
        watched = BreakoutExecutionService.get_watched_candidates(db)
        stats = BreakoutExecutionService.get_execution_stats(db)
        print(f"Total watched: {len(watched)}, Stats: {stats}")
        assert len(watched) >= 1
        assert stats["total_watched"] >= 1

        print("\n3. Testing Trigger Transition...")
        # Simulate price crossing trigger
        sample_triggered = {
            "symbol": "METROPOLIS",
            "cmp": 2170.0,  # crossed 2165 trigger, within 2165 * 1.015 = 2197.47 buy zone
            "trigger_price": 2165.0,
            "stop_loss": 2085.0,
        }
        cand_trig = BreakoutExecutionService.add_candidate(db, sample_triggered)
        print(f"Updated {cand_trig.symbol}: CMP={cand_trig.current_cmp}, Status={cand_trig.execution_status}")
        assert cand_trig.execution_status == "TRIGGERED"

        print("\n4. Testing Reset Alert...")
        reset_cand = BreakoutExecutionService.reset_candidate_alert(db, "METROPOLIS")
        print(f"Reset {reset_cand.symbol}: Status={reset_cand.execution_status}, AlertDispatched={reset_cand.alert_dispatched}")
        assert reset_cand.execution_status == "COILING"

        print("\n5. Testing Auto-Enroll Top Coils...")
        enroll_res = BreakoutExecutionService.auto_enroll_top_coils(db, limit=3, min_conviction=60)
        print(f"Auto-enroll result: {enroll_res}")

        print("\nALL BREAKOUT EXECUTION TESTS PASSED!")
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
