import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.database import SessionLocal
from app.services.investor_intelligence_service import InvestorIntelligenceService

db = SessionLocal()
insight = InvestorIntelligenceService.analyze_document(db, 1)
if insight:
    print("=== LAYMAN SUMMARY FOR DIXON ===")
    print(insight.layman_summary)
    print("\n=== DIRECT QUOTES ===")
    for q in (insight.direct_quotes or []):
        print(f"- {q['speaker']}: \"{q['quote']}\"")
    print("\n=== ANALYST GRILL ===")
    for g in (insight.analyst_grill_quotes or []):
        print(f"Q by {g['analyst']}: {g['question']}")
        print(f"A by {g['executive']}: \"{g['answer_quote']}\"")
    print("\n=== ACTIONABLE GAMEPLAN ===")
    print(insight.actionable_gameplan)
db.close()
