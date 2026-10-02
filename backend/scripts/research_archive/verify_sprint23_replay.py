"""
Alpha India Sprint 23 — Complete Automated Verification Script
Validates:
1. Discovery Engine (10 Small-Caps, POST_MARKET, 0 failures)
2. Import Engine (idempotent UPSERT into screener_growth_records)
3. Data Reconciliation Engine (±2% tolerance rule, financial_reconciliation_log audit)
4. Audit Gate (10/10 PASS, 0 WARNING, 0 FAIL)
5. AI Growth Engine (Growth Score, AI summary, Discovery Strength, Hot Topic)
6. Mission Control validation scorecard & 5 engine status cards
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.db.database import SessionLocal
from app.models.financial_reconciliation_log import FinancialReconciliationLog
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.replay_pipeline_service import ReplayPipelineService
from app.services.sprint23_dataset import SPRINT23_SMALLCAP_DATASET
from fastapi.testclient import TestClient
import main


def run_verification():
    print("=" * 75)
    print("ALPHA INDIA SPRINT 23 — MISSION CONTROL PIPELINE VALIDATION")
    print("=" * 75)

    # ---------------------------------------------------------
    # 1. Reset Pipeline State
    # ---------------------------------------------------------
    print("\n[Step 1] Resetting replay pipeline state...")
    reset_res = ReplayPipelineService.reset()
    assert reset_res["success"], "Reset failed!"
    print(" -> Pipeline state reset to IDLE/RESET.")

    # ---------------------------------------------------------
    # 2. Process All 10 Companies
    # ---------------------------------------------------------
    print("\n[Step 2] Processing 10 Small-Cap companies through the 5-stage pipeline...")
    for item in SPRINT23_SMALLCAP_DATASET:
        idx = item["index"]
        sym = item["symbol"]
        print(f" -> [{idx}/10] Replaying historical NSE filing: {sym} ({item['company_name']})...")
        res = ReplayPipelineService.process_single_company(item)

        # Immediate validation of single company result
        assert res["discovery"]["status"] == "DISCOVERED", f"Discovery failed for {sym}"
        assert res["audit"]["status"] == "PASS", f"Audit failed for {sym}"
        assert 0 <= res["ai_growth"]["growth_score"] <= 100, f"Invalid AI score for {sym}"
        assert len(res["ai_growth"]["ai_summary"]) >= 3, f"AI summary missing bullets for {sym}"

    print(" -> All 10 companies processed successfully through all 5 stages.")

    # ---------------------------------------------------------
    # 3. Verify Discovery Engine Metrics
    # ---------------------------------------------------------
    print("\n[Step 3] Verifying Discovery Engine...")
    state = ReplayPipelineService.get_state()
    disc = state["discovery"]
    print(f" -> Session: {disc['session']}")
    print(f" -> Scanned Today: {disc['scanned_today']}")
    print(f" -> Results Today: {disc['results_today']}")
    print(f" -> Parser Failures: {disc['parser_failures_today']}")
    assert disc["scanned_today"] == 10, f"Expected 10 scanned, got {disc['scanned_today']}"
    assert disc["results_today"] == 10, f"Expected 10 results, got {disc['results_today']}"
    assert disc["parser_failures_today"] == 0, "Parser failures should be 0!"
    assert disc["session"] == "POST_MARKET", "Session should be POST_MARKET"
    print(" -> PASS: Discovery Engine verified.")

    # ---------------------------------------------------------
    # 4. Verify Data Reconciliation Engine & Tolerance Rule
    # ---------------------------------------------------------
    print("\n[Step 4] Verifying Data Reconciliation Engine & ±2% Tolerance Rule...")
    db = SessionLocal()
    try:
        recon_count = db.query(FinancialReconciliationLog).count()
        print(f" -> Total reconciliation audit logs in DB: {recon_count}")
        assert recon_count == 80, f"Expected 80 field checks (10 companies x 8 fields), got {recon_count}"

        # Test tolerance cases:
        # Case A: Exact match (e.g. PSPPROJECT)
        psp_logs = db.query(FinancialReconciliationLog).filter_by(company_symbol="PSPPROJECT").all()
        assert all(l.action_taken == "EXACT_MATCH_NO_UPDATE" for l in psp_logs), "PSPPROJECT should have all exact matches"
        print(" -> Verified Case A: Exact matches correctly identified with EXACT_MATCH_NO_UPDATE.")

        # Case B: Within ±2% tolerance (e.g. HMAAGRO at +0.40% variance)
        hma_rev = db.query(FinancialReconciliationLog).filter_by(company_symbol="HMAAGRO", field_name="Revenue").first()
        assert hma_rev is not None, "Missing HMAAGRO revenue log"
        assert hma_rev.diagnosis == "ROUND_OFF", f"Expected ROUND_OFF, got {hma_rev.diagnosis}"
        assert hma_rev.action_taken == "WITHIN_TOLERANCE_NO_UPDATE", f"Expected WITHIN_TOLERANCE_NO_UPDATE, got {hma_rev.action_taken}"
        assert abs(hma_rev.variance_pct) <= 2.0, "HMAAGRO revenue variance should be <= 2%"
        print(f" -> Verified Case B: HMAAGRO (+{hma_rev.variance_pct}%) kept within tolerance WITHOUT update.")

        # Case C: Variance > 2% (e.g. BIRLACABLE at +4.55% PAT variance)
        birla_pat = db.query(FinancialReconciliationLog).filter_by(company_symbol="BIRLACABLE", field_name="PAT").first()
        assert birla_pat is not None, "Missing BIRLACABLE PAT log"
        assert birla_pat.action_taken == "UPDATED_FROM_NSE", f"Expected UPDATED_FROM_NSE, got {birla_pat.action_taken}"
        assert birla_pat.diagnosis == "REVISED_NSE_FILING", f"Expected REVISED_NSE_FILING, got {birla_pat.diagnosis}"
        assert birla_pat.variance_pct > 2.0, "Variance should be > 2%"
        print(f" -> Verified Case C: BIRLACABLE PAT (+{birla_pat.variance_pct}%) triggered UPDATED_FROM_NSE.")

        # Case D: Missing Screener Value (e.g. WINDMACHIN Operating Profit)
        wind_op = db.query(FinancialReconciliationLog).filter_by(company_symbol="WINDMACHIN", field_name="Operating Profit").first()
        assert wind_op is not None, "Missing WINDMACHIN log"
        assert wind_op.diagnosis == "MISSING_SCREENER_VALUE", f"Expected MISSING_SCREENER_VALUE, got {wind_op.diagnosis}"
        assert wind_op.action_taken == "FILLED_FROM_NSE", f"Expected FILLED_FROM_NSE, got {wind_op.action_taken}"
        print(" -> Verified Case D: WINDMACHIN Operating Profit filled from official NSE filing.")
    finally:
        db.close()

    # ---------------------------------------------------------
    # 5. Verify Import Engine (Production screener_growth_records)
    # ---------------------------------------------------------
    print("\n[Step 5] Verifying Import Engine & screener_growth_records table...")
    db = SessionLocal()
    try:
        for item in SPRINT23_SMALLCAP_DATASET:
            sym = item["symbol"]
            rec = db.query(ScreenerGrowthRecord).filter_by(symbol=sym).first()
            assert rec is not None, f"Record for {sym} missing in screener_growth_records"
            assert rec.health_score is not None and rec.health_score > 0, f"AI health score missing for {sym}"
            assert rec.latest_quarter_name == "Q1 FY25", f"Latest quarter mismatch for {sym}"
            assert rec.latest_quarter_sales is not None, f"Revenue missing for {sym}"
            assert rec.latest_quarter_net_profit is not None, f"PAT missing for {sym}"
        print(f" -> PASS: All 10 companies present with verified metrics in screener_growth_records.")
    finally:
        db.close()

    # ---------------------------------------------------------
    # 6. Verify Audit Engine & AI Growth Engine
    # ---------------------------------------------------------
    print("\n[Step 6] Verifying Audit Engine & AI Growth Engine...")
    audit = state["audit"]
    ai = state["ai"]
    print(f" -> Audit Gate: Processed={audit['processed']}, PASS={audit['passed']}, FAIL={audit['failed']}")
    assert audit["processed"] == 10, "Expected 10 audited"
    assert audit["passed"] == 10, "Expected 10 passed"
    assert audit["failed"] == 0, "Audit failures should be 0"

    print(f" -> AI Growth Engine: Scored={ai['scored_companies']}, Reports={ai['ai_reports']}")
    assert ai["scored_companies"] == 10, "Expected 10 scored"
    assert ai["ai_reports"] == 10, "Expected 10 AI reports"
    print(" -> PASS: Audit Gate & AI Growth Engine verified.")

    # ---------------------------------------------------------
    # 7. Test FastAPI Endpoints via TestClient
    # ---------------------------------------------------------
    print("\n[Step 7] Testing Mission Control & Validation Scorecard APIs...")
    client = TestClient(main.app)

    # Test /mission-control/validation/scorecard
    sc_res = client.get("/mission-control/validation/scorecard")
    assert sc_res.status_code == 200, f"Scorecard API error: {sc_res.status_code}"
    sc_json = sc_res.json()
    assert sc_json["success"], "Scorecard success should be True"
    assert sc_json["summary"]["total_companies"] == 10, "Scorecard should return 10 companies"
    assert sc_json["summary"]["pass_rate"] == 100.0, "Scorecard pass rate should be 100%"
    assert len(sc_json["records"]) == 10, "10 detailed records expected"
    print(f" -> PASS: GET /mission-control/validation/scorecard (Pass Rate: {sc_json['summary']['pass_rate']}%, Avg Score: {sc_json['summary']['avg_growth_score']})")

    # Test /mission-control/engines
    eng_res = client.get("/mission-control/engines")
    assert eng_res.status_code == 200, f"Engines API error: {eng_res.status_code}"
    eng_json = eng_res.json()
    assert eng_json["success"], "Engines API success should be True"
    assert len(eng_json["engines"]) == 5, f"Expected 5 engine cards, got {len(eng_json['engines'])}"
    engine_names = [e["name"] for e in eng_json["engines"]]
    assert "Discovery Engine" in engine_names
    assert "Import Engine" in engine_names
    assert "Data Reconciliation Engine" in engine_names
    assert "Audit Engine" in engine_names
    assert "AI Growth Engine" in engine_names
    print(f" -> PASS: GET /mission-control/engines returns 5 engines: {engine_names}")

    # Test /mission-control/reconciliation/logs
    recon_res = client.get("/mission-control/reconciliation/logs?symbol=BIRLACABLE")
    assert recon_res.status_code == 200, f"Recon logs error: {recon_res.status_code}"
    recon_json = recon_res.json()
    assert recon_json["total"] == 8, f"Expected 8 field logs for BIRLACABLE, got {recon_json['total']}"
    print(f" -> PASS: GET /mission-control/reconciliation/logs returned {recon_json['total']} audit logs.")

    # Test /mission-control/replay/status
    rep_status = client.get("/mission-control/replay/status")
    assert rep_status.status_code == 200
    print(" -> PASS: GET /mission-control/replay/status operational.")

    print("\n" + "=" * 75)
    print("ALL SPRINT 23 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY (100% PASS)")
    print("=" * 75)


if __name__ == "__main__":
    run_verification()
