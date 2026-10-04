"""
Alpha India — Re-Analyze All Harvested Documents with Forensic Deep Quotes & Layman Engine
Updates all database records with exact leadership quotes, analyst Q&A dialogues,
plain-English summaries, and actionable investor pointers.
"""

import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight
from app.services.investor_intelligence_service import InvestorIntelligenceService


def reanalyze_all():
    db = SessionLocal()
    # Find all documents that have already been extracted or analyzed
    docs = (
        db.query(InvestorDocument)
        .filter(InvestorDocument.status.in_(["ANALYZED", "EXTRACTED"]))
        .order_by(InvestorDocument.id.asc())
        .all()
    )

    print(f"[AlphaIndia] Re-analyzing {len(docs)} documents with Deep Forensic Engine...")

    for d in docs:
        print(f"\nProcessing {d.symbol} (Doc {d.id} - {d.fiscal_period} - {d.doc_type})...")
        insight = InvestorIntelligenceService.analyze_document(db, d.id)
        if insight:
            quotes_count = len(insight.direct_quotes or [])
            grill_count = len(insight.analyst_grill_quotes or [])
            verdict = (insight.actionable_gameplan or {}).get("verdict", "N/A")
            print(f"  -> Success! Stance: {insight.institutional_stance} | Action: {verdict}")
            print(f"  -> Direct Quotes: {quotes_count} | Analyst Grill Dialogs: {grill_count}")
            if quotes_count > 0:
                print(f"  -> Sample Quote ({insight.direct_quotes[0]['speaker']}): \"{insight.direct_quotes[0]['quote'][:90]}...\"")
        else:
            print("  -> Failed to analyze.")

    db.close()
    print("\n[AlphaIndia] All documents successfully updated with deep quotes and layman format!")


if __name__ == "__main__":
    reanalyze_all()
