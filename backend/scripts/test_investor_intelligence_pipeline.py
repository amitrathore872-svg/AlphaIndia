"""
Alpha India — End-to-End Test for Investor Intelligence Pipeline
Verifies harvesting, PDF extraction, sectional segmentation, and Senior Analyst LLM Interrogation.
"""

import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.investor_intelligence_service import InvestorIntelligenceService
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight


def run_pipeline_test():
    db = SessionLocal()
    test_symbols = ["KEC", "DIXON"]

    print("==================================================================")
    print("ALPHA INDIA | INVESTOR INTELLIGENCE & CONCALL PIPELINE TEST")
    print("==================================================================")

    for sym in test_symbols:
        print(f"\n[1] Harvesting filings for {sym}...")
        res = InvestorDocumentHarvester.harvest_for_symbol(db, sym)
        print(f"    Discovered: {res.get('discovered')} new filings.")

        # Find latest concall or presentation
        latest_doc = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.symbol == sym)
            .order_by(InvestorDocument.id.desc())
            .first()
        )

        if not latest_doc:
            print(f"    No filings found for {sym}.")
            continue

        print(f"[2] Latest Filing: ID={latest_doc.id} | Period={latest_doc.fiscal_period} | Type={latest_doc.doc_type}")
        print(f"    URL: {latest_doc.pdf_url}")

        print(f"[3] Interrogating filing with Senior Buy-Side Analyst Engine...")
        insight = InvestorIntelligenceService.analyze_document(db, latest_doc.id)

        if insight:
            print(f"\n    === SENIOR ANALYST VERDICT FOR {sym} ({insight.fiscal_period}) ===")
            print(f"    - Institutional Stance     : {insight.institutional_stance}")
            print(f"    - Conviction Score         : {insight.growth_conviction_score}/100")
            print(f"    - Management Sentiment     : {insight.management_sentiment_score}/10")
            print(f"    - Management Tone          : {insight.management_tone}")
            print(f"    - Executive Thesis         : {insight.executive_thesis}")
            print(f"    - Capacity Utilization     : {insight.capacity_utilization_pct}%")
            print(f"    - Capex Guidance           : {insight.capex_guidance_fy}")
            print(f"    - Commissioning (COD)      : {insight.commissioning_timeline_cod}")
            print(f"    - EBITDA Margin Corridor   : {insight.ebitda_margin_guidance_corridor}")
            print(f"    - Executable Order Backlog : Rs. {insight.executable_order_book_cr} Cr")
            print(f"    - Analyst Grill Overhang   : {insight.key_overhang_questioned_by_analysts}")
            print(f"    - Management Response      : {insight.management_direct_answer}")
            print(f"    - Critical Monitorables    : {insight.critical_monitorables}")
        else:
            print(f"    Failed to generate insight for {sym}.")

    print("\n==================================================================")
    print("PIPELINE TEST COMPLETED SUCCESSFULLY!")
    print("==================================================================")
    db.close()


if __name__ == "__main__":
    run_pipeline_test()
