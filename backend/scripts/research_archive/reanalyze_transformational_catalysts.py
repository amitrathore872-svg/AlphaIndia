"""
Alpha India — Re-Analyze All Extracted Documents for Transformational Growth Triggers
Executes the upgraded forensic engine across all documents to surface companies
with exponential catalysts that trigger immediate institutional buying.
"""

import sys
import os

# Set UTF-8 stdout for Windows console
if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight
from app.services.investor_intelligence_service import InvestorIntelligenceService

def run():
    db = SessionLocal()
    try:
        # Find all documents with extracted text or previously analyzed
        docs = (
            db.query(InvestorDocument)
            .filter(
                (InvestorDocument.raw_text_length > 0) |
                (InvestorDocument.management_speech_text != None) |
                (InvestorDocument.status == "ANALYZED")
            )
            .order_by(InvestorDocument.symbol)
            .all()
        )

        print(f"Found {len(docs)} documents ready for transformational catalyst analysis.\n")

        catalysts_found = []

        for doc in docs:
            print(f"Analyzing {doc.symbol} ({doc.fiscal_period} {doc.doc_type})...")
            try:
                insight = InvestorIntelligenceService.analyze_document(db, doc.id)
                if insight and insight.is_transformational_catalyst:
                    catalysts_found.append(insight)
                    print(f"  --> [TRANSFORMATIONAL TRIGGER DETECTED] {insight.transformational_category}")
                    print(f"      Headline: {insight.catalyst_headline}")
                    print(f"      Multiple: {insight.exponential_growth_multiple}")
                else:
                    print(f"      Stance: {insight.institutional_stance if insight else 'None'} (No exponential trigger)")
            except Exception as e:
                print(f"  --> Error analyzing doc {doc.id} ({doc.symbol}): {e}")

        print("\n" + "=" * 80)
        print(f"RESULTS: {len(catalysts_found)} COMPANIES WITH TRANSFORMATIONAL BUY TRIGGERS FOUND")
        print("=" * 80 + "\n")

        for c in catalysts_found:
            print(f"SYMBOL: {c.symbol} | PERIOD: {c.fiscal_period} | TYPE: {c.doc_type}")
            print(f"CATEGORY: {c.transformational_category}")
            print(f"HEADLINE: {c.catalyst_headline}")
            print(f"EXPECTED MULTIPLE: {c.exponential_growth_multiple}")
            print(f"WHY SMART MONEY BUYS NOW: {c.immediate_reaction_rationale}")
            if c.direct_quotes:
                print(f"EXECUTIVE QUOTE ({c.direct_quotes[0]['speaker']}): \"{c.direct_quotes[0]['quote']}\"")
            print("-" * 80 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    run()
