"""
Alpha India — Backfill Management Commitments from Existing Documents
Extracts commitments across already analyzed documents and evaluates quarter delivery.
"""

import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight, ManagementCommitment
from app.services.investor_intelligence_service import InvestorIntelligenceService

def run():
    db = SessionLocal()
    print("[AlphaIndia] Extracting commitments across analyzed investor documents...")
    
    docs = (
        db.query(InvestorDocument)
        .filter(
            InvestorDocument.raw_text_length > 200,
            (InvestorDocument.parsed_text.isnot(None) | InvestorDocument.management_speech_text.isnot(None))
        )
        .order_by(InvestorDocument.announcement_date.asc().nullslast(), InvestorDocument.id.asc())
        .all()
    )
    print(f"[AlphaIndia] Found {len(docs)} documents with text to extract commitments from.")
    
    total_extracted = 0
    symbols_seen = set()

    for doc in docs:
        text = f"{doc.management_speech_text or ''}\n{doc.analyst_qa_text or ''}\n{doc.parsed_text or ''}"
        comms = InvestorIntelligenceService.extract_commitments_from_document(db, doc, text)
        total_extracted += len(comms)
        symbols_seen.add(doc.symbol)

    print(f"[AlphaIndia] Extracted {total_extracted} management commitments across {len(symbols_seen)} symbols.")

    # Now evaluate delivery across quarters for all symbols seen
    print("[AlphaIndia] Evaluating delivery across historical quarters...")
    total_evaluated = 0
    for sym in symbols_seen:
        # Find latest doc for this symbol
        latest_doc = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.symbol == sym)
            .order_by(InvestorDocument.announcement_date.desc().nullslast(), InvestorDocument.id.desc())
            .first()
        )
        if latest_doc:
            eval_res = InvestorIntelligenceService.evaluate_company_commitments(db, sym, latest_doc)
            total_evaluated += eval_res.get("total_evaluated", 0)

    print(f"[AlphaIndia] Evaluated delivery for {total_evaluated} open commitments.")

    # Summary
    sum_data = InvestorIntelligenceService.get_commitments_summary(db)
    print(f"[AlphaIndia] Current Commitment Ledger State:")
    print(f"  Total recorded: {sum_data['total_recorded']}")
    print(f"  Met: {sum_data['commitments_met']}")
    print(f"  Partially met: {sum_data['commitments_partially_met']}")
    print(f"  Missed: {sum_data['commitments_missed']}")
    print(f"  Delayed: {sum_data['commitments_delayed']}")
    print(f"  Not yet due / In progress: {sum_data['not_yet_due']}")
    print(f"  Delivery rate: {sum_data['delivery_rate_pct']}%")

    db.close()

if __name__ == "__main__":
    run()
