"""
Alpha India — Nifty 50 June 2026 Quarter Concall & Investor Presentation Backtest
Harvests, extracts, and runs Senior Buy-Side Analyst Interrogation across Nifty 50 constituents
for the June 2026 quarter (Q1 FY27 reporting cycle).
"""

import sys
import json
import logging
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.investor_intelligence import InvestorDocument, InvestorIntelligenceInsight
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.investor_intelligence_service import InvestorIntelligenceService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("nifty50_backtest")

# Diverse institutional universe representing Nifty 50 across key sectors
NIFTY50_TARGET_SYMBOLS = [
    "INFY",         # IT Services
    "TCS",          # IT Services
    "LT",           # Heavy Engineering & Infra Capex
    "BHARTIARTL",   # Telecom & 5G ARPUs
    "TATAMOTORS",   # Auto (EV & JLR)
    "MARUTI",       # Auto Passenger Vehicles
    "TITAN",        # Discretionary Consumer & Jewellery
    "DIVISLAB",     # Pharma CDMO & Peptides
    "TRENT",        # Fast Retail Compounder
    "ULTRACEMCO",   # Building Materials & Capex
    "HINDALCO",     # Metals & Novelis
    "SUNPHARMA",    # Specialty Pharma
    "BAJFINANCE",   # Retail Lending & NBFC
    "DRREDDY",      # Generic Pharma & US Sales
    "EICHERMOT",    # Auto (Royal Enfield)
    "BEL",          # Defense Electronics & Navratna
    "JSWSTEEL",     # Steel & Capacity Addition
    "TECHM",        # IT Turnaround
    "ASIANPAINT",   # Decorative Paints & Raw Mat Pass-Through
    "CIPLA",        # Domestic & Respiratory Pharma
]


def run_nifty50_backtest():
    db = SessionLocal()
    results = []

    print("================================================================================")
    print("ALPHA INDIA | NIFTY 50 JUNE 2026 QUARTER CONCALL & PPT BACKTEST ENGINE")
    print("================================================================================")

    for idx, sym in enumerate(NIFTY50_TARGET_SYMBOLS, 1):
        print(f"\n[{idx}/{len(NIFTY50_TARGET_SYMBOLS)}] Processing {sym}...")

        # 1. Harvest filings if not already present
        existing_count = db.query(InvestorDocument).filter(InvestorDocument.symbol == sym).count()
        if existing_count == 0:
            print(f"    Harvesting filings for {sym}...")
            InvestorDocumentHarvester.harvest_for_symbol(db, sym)

        # 2. Find filing for June 2026 quarter (Q1 FY27 / Q2 FY27 / Aug 2026 / Jul 2026)
        doc = (
            db.query(InvestorDocument)
            .filter(
                InvestorDocument.symbol == sym,
                InvestorDocument.fiscal_period.in_(["Q1 FY27", "Q2 FY27", "Q4 FY26"]),
            )
            .order_by(InvestorDocument.id.asc())  # Screener lists recent first (lower IDs)
            .first()
        )

        if not doc:
            # Fallback to the latest available document
            doc = (
                db.query(InvestorDocument)
                .filter(InvestorDocument.symbol == sym)
                .order_by(InvestorDocument.id.asc())
                .first()
            )

        if not doc:
            print(f"    [SKIP] No filings discovered for {sym}.")
            continue

        print(f"    Target Filing: ID={doc.id} | Type={doc.doc_type} | Period={doc.fiscal_period}")
        print(f"    PDF URL: {doc.pdf_url[:80]}...")

        # 3. Interrogate with Senior Buy-Side Analyst Engine
        try:
            insight = InvestorIntelligenceService.analyze_document(db, doc.id)
            if insight:
                print(f"    [ANALYST VERDICT] Stance: {insight.institutional_stance} | Conviction: {insight.growth_conviction_score}/100 | Tone: {insight.management_tone}")
                
                results.append({
                    "symbol": sym,
                    "company_name": doc.company_name or sym,
                    "doc_type": doc.doc_type,
                    "fiscal_period": doc.fiscal_period,
                    "pdf_url": doc.pdf_url,
                    "institutional_stance": insight.institutional_stance,
                    "growth_conviction_score": insight.growth_conviction_score,
                    "management_sentiment_score": insight.management_sentiment_score,
                    "management_tone": insight.management_tone,
                    "executive_thesis": insight.executive_thesis,
                    "capacity_utilization_pct": insight.capacity_utilization_pct,
                    "capex_guidance_fy": insight.capex_guidance_fy,
                    "commissioning_timeline_cod": insight.commissioning_timeline_cod,
                    "ebitda_margin_guidance_corridor": insight.ebitda_margin_guidance_corridor,
                    "executable_order_book_cr": insight.executable_order_book_cr,
                    "key_overhang_questioned_by_analysts": insight.key_overhang_questioned_by_analysts,
                    "management_direct_answer": insight.management_direct_answer,
                    "critical_monitorables": insight.critical_monitorables,
                })
            else:
                print(f"    [FAILED] Could not generate insight for doc {doc.id}.")
        except Exception as exc:
            print(f"    [ERROR] Interrogation failed for {sym}: {exc}")

    # Output summary
    output_path = Path("data/nifty50_june2026_backtest_results.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print("\n================================================================================")
    print(f"BACKTEST COMPLETE: {len(results)} NIFTY 50 COMPANIES INTERROGATED FOR JUNE 2026")
    print(f"Saved structured dataset to: {output_path}")
    print("================================================================================")

    db.close()
    return results


if __name__ == "__main__":
    run_nifty50_backtest()
