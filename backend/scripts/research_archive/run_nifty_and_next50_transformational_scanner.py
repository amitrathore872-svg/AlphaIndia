"""
Alpha India — Nifty 50 & Nifty Next 50 Transformational Growth Scanner
Harvests, extracts, and performs senior forensic concall & investor presentation analysis
to detect extraordinary corporate transformations, 10x triggers, and immediate buy catalysts.
"""

import sys
import os
import time
import json
import logging

# Ensure UTF-8 output on Windows terminal
if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Setup paths
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.WARNING)

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.pdf_extractor_service import PDFExtractorService
from app.services.investor_intelligence_service import InvestorIntelligenceService

NIFTY50_TARGETS = [
    "LT", "TCS", "INFY", "BHARTIARTL", "MARUTI", "HINDALCO", "BAJFINANCE",
    "EICHERMOT", "DRREDDY", "ULTRACEMCO", "JSWSTEEL", "CIPLA", "ASIANPAINT",
    "TITAN", "SUNPHARMA", "TECHM", "DIVISLAB", "BEL", "M&M",
    "NTPC", "POWERGRID", "COALINDIA", "TATASTEEL"
]

NIFTY_NEXT50_TARGETS = [
    "HAL", "TRENT", "DIXON", "KEC", "POLYCAB", "CGPOWER", "KAYNES",
    "SUZLON", "CHOLAFIN", "SIEMENS", "ABB", "PERSISTENT", "COFORGE",
    "BHEL", "CUMMINSIND", "RVNL", "MAZDOCK", "DLF", "VBL"
]

def score_doc(d: InvestorDocument) -> int:
    score = 0
    if d.raw_text_length and d.raw_text_length > 1000:
        score += 20000

    p = d.fiscal_period or ""
    if "FY27" in p: score += 6000
    elif "FY26" in p: score += 5000
    elif "FY25" in p: score += 4000
    elif "FY24" in p: score += 3000
    elif "FY23" in p: score += 2000
    elif "FY22" in p: score += 1000

    if d.doc_type == "CONCALL_TRANSCRIPT": score += 1000
    elif d.doc_type == "INVESTOR_PRESENTATION": score += 400

    url = (d.pdf_url or "").lower()
    if "bseindia.com" in url or "nseindia.com" in url:
        score += 1500

    # Penalize broken, obsolete or dead third-party domains
    if any(bad in url for bad in ["varunpepsi.com", "suzlon.com/pdf", "cholamandalam.com/files", "coforgetech.com/sites"]):
        score -= 20000

    if not d.pdf_url:
        score -= 30000

    return score

def scan_symbol(db, sym: str, basket: str) -> dict:
    print(f"\n=======================================================")
    print(f"[{basket}] Scanning: {sym}")
    print(f"=======================================================")

    # 1. Check existing documents
    existing_docs = (
        db.query(InvestorDocument)
        .filter(InvestorDocument.symbol == sym)
        .all()
    )

    if not existing_docs or len(existing_docs) < 2:
        print(f"  Harvesting exchange filings for {sym}...")
        try:
            h_res = InvestorDocumentHarvester.harvest_for_symbol(db, sym)
            print(f"  Harvested: {h_res.get('discovered', 0)} documents discovered.")
        except Exception as e:
            print(f"  Harvest warning: {e}")

        existing_docs = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.symbol == sym)
            .all()
        )

    if not existing_docs:
        print(f"  No filings discovered for {sym}. Skipping.")
        return {"symbol": sym, "basket": basket, "status": "NO_DOCS"}

    # Sort documents by quality score
    sorted_docs = sorted(existing_docs, key=score_doc, reverse=True)

    target_doc = None
    # Try up to 3 candidate documents in case one fails to download
    for candidate in sorted_docs[:3]:
        print(f"  Candidate Document ID {candidate.id}: {candidate.doc_type} | Period: {candidate.fiscal_period} | URL: {(candidate.pdf_url or '')[:55]}...")
        if candidate.raw_text_length and candidate.raw_text_length > 1000:
            target_doc = candidate
            break
        elif candidate.pdf_url:
            print(f"    Downloading & extracting PDF...")
            ext_res = PDFExtractorService.process_document_url(
                pdf_url=candidate.pdf_url,
                symbol=sym,
                doc_type=candidate.doc_type,
                doc_name=f"{sym}_{candidate.fiscal_period}_{candidate.doc_type}_{candidate.id}",
            )
            if ext_res.get("success"):
                candidate.raw_text_length = len(ext_res["raw_text"])
                candidate.parsed_text = ext_res["raw_text"][:45000]
                candidate.management_speech_text = ext_res["management_speech"]
                candidate.analyst_qa_text = ext_res["analyst_qa"]
                candidate.status = "EXTRACTED"
                db.commit()
                print(f"    Successfully extracted {candidate.raw_text_length:,} characters (Speech: {len(candidate.management_speech_text or ''):,}, QA: {len(candidate.analyst_qa_text or ''):,})")
                target_doc = candidate
                break
            else:
                print(f"    Extraction failed: {ext_res.get('error')}. Trying next candidate...")
                candidate.status = "FAILED"
                db.commit()

    if not target_doc:
        print(f"  Could not extract any valid filing for {sym}.")
        return {"symbol": sym, "basket": basket, "status": "EXTRACT_FAILED"}

    # 3. Perform Deep Forensic Layman & Transformational Analysis
    print(f"  Executing Forensic Interrogation Engine on Doc {target_doc.id} ({target_doc.fiscal_period})...")
    insight = InvestorIntelligenceService.analyze_document(db, target_doc.id)

    if not insight:
        print("  Analysis failed.")
        return {"symbol": sym, "basket": basket, "status": "ANALYSIS_FAILED"}

    is_catalyst = insight.is_transformational_catalyst
    print(f"  Institutional Stance : {insight.institutional_stance}")
    print(f"  Growth Conviction    : {insight.growth_conviction_score}/100")
    print(f"  Management Tone      : {insight.management_tone}")

    if is_catalyst:
        print(f"\n  *** [TRANSFORMATIONAL 10X CATALYST DETECTED] ***")
        print(f"  Category             : {insight.transformational_category}")
        print(f"  Headline             : {insight.catalyst_headline}")
        print(f"  Expected Horizon     : {insight.exponential_growth_multiple}")
        print(f"  Why Smart Money Buys : {insight.immediate_reaction_rationale}")

    if insight.actionable_gameplan:
        print(f"  Actionable Verdict   : {insight.actionable_gameplan.get('verdict')}")

    if insight.direct_quotes:
        first_q = insight.direct_quotes[0]
        print(f"  Leadership Quote     : ({first_q['speaker']}): \"{first_q['quote'][:140]}...\"")

    return {
        "symbol": sym,
        "basket": basket,
        "company_name": insight.company_name,
        "doc_type": insight.doc_type,
        "fiscal_period": insight.fiscal_period,
        "stance": insight.institutional_stance,
        "conviction": insight.growth_conviction_score,
        "tone": insight.management_tone,
        "is_catalyst": is_catalyst,
        "catalyst_category": insight.transformational_category,
        "catalyst_headline": insight.catalyst_headline,
        "expected_multiple": insight.exponential_growth_multiple,
        "immediate_reaction_rationale": insight.immediate_reaction_rationale,
        "actionable_verdict": insight.actionable_gameplan.get("verdict") if insight.actionable_gameplan else None,
        "quote": insight.direct_quotes[0] if insight.direct_quotes else None,
        "analyst_grill": insight.analyst_grill_quotes[0] if insight.analyst_grill_quotes else None,
        "status": "SUCCESS"
    }

def main():
    db = SessionLocal()
    results = []

    print("\n" + "=" * 80)
    print("STARTING ALPHA INDIA NIFTY 50 & NIFTY NEXT 50 CATALYST RADAR")
    print("=" * 80)

    all_symbols = (
        [(sym, "NIFTY_NEXT_50") for sym in NIFTY_NEXT50_TARGETS] +
        [(sym, "NIFTY_50") for sym in NIFTY50_TARGETS]
    )

    try:
        for sym, basket in all_symbols:
            try:
                res = scan_symbol(db, sym, basket)
                results.append(res)
                time.sleep(0.5)
            except Exception as e:
                print(f"Error processing {sym}: {e}")
                results.append({"symbol": sym, "basket": basket, "status": "ERROR", "error": str(e)})

        # Save complete results artifact
        out_file = os.path.join(backend_dir, "data", "nifty_and_next50_transformational_results.json")
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("RADAR SCAN COMPLETE — SUMMARY OF HIGH CONVICTION EXPONENTIAL CATALYSTS")
        print("=" * 80)

        catalysts = [r for r in results if r.get("is_catalyst")]
        print(f"\nTotal Analyzed: {len([r for r in results if r.get('status') == 'SUCCESS'])}")
        print(f"Exponential Catalysts Identified: {len(catalysts)}\n")

        for c in catalysts:
            print(f"[{c['basket']}] {c['symbol']} ({c['company_name'] or c['symbol']}) - {c['fiscal_period']}")
            print(f"  TRIGGER: {c['catalyst_category']} | {c['expected_multiple']}")
            print(f"  HEADLINE: {c['catalyst_headline']}")
            print(f"  WHY SMART MONEY BUYS: {c['immediate_reaction_rationale']}")
            print(f"  VERDICT: {c['actionable_verdict']}")
            if c.get("quote"):
                print(f"  QUOTE ({c['quote']['speaker']}): \"{c['quote']['quote'][:140]}...\"")
            print("-" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    main()
