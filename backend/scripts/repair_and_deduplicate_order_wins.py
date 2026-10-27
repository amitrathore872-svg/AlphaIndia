"""
Alpha India — Comprehensive Order Win Repair & Deduplication Engine
Sprint 36.6 Permanent Fix

1. Merges duplicated order wins (e.g. MCLOUD multiple disclosures for the same tender).
2. Cleans false positives (Statement of Deviation, financial results, customs penalty orders).
3. Reads PDFs (using text + native Windows OCR fallback) to extract missing deal values,
   sovereign clients, and execution timelines.
4. Recalculates institutional quantitative intelligence metrics.
"""

import sys
import os
import logging
from datetime import timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.services.order_win_intelligence_service import OrderWinIntelligenceService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("repair_order_wins")


def repair_and_deduplicate():
    db = SessionLocal()
    try:
        logger.info("Starting Order Win Radar Repair & Deduplication Pipeline...")

        # -------------------------------------------------------------------
        # 1. Clean False Positives (Deviations, Quarterly Results, Penalties)
        # -------------------------------------------------------------------
        noise_filings = db.query(AnnouncementRadar).filter(
            AnnouncementRadar.catalyst_type == "ORDER_WIN",
            (AnnouncementRadar.headline.ilike("%statement of deviation%")
             | AnnouncementRadar.headline.ilike("%financial results for quarter%")
             | AnnouncementRadar.headline.ilike("%customs order demanding%")
             | AnnouncementRadar.headline.ilike("%penalty%")
             | AnnouncementRadar.headline.ilike("%outcome of board meeting%"))
        ).all()

        for nf in noise_filings:
            logger.info(f"Reclassifying false positive order win ID={nf.id} ({nf.symbol}): {nf.headline[:70]}")
            if "customs" in nf.headline.lower() or "penalty" in nf.headline.lower():
                nf.catalyst_type = "REGULATORY_DEMAND"
            elif "financial results" in nf.headline.lower():
                nf.catalyst_type = "FINANCIAL_RESULTS"
            else:
                nf.catalyst_type = "GENERAL"
            nf.impact_level = "NOISE"
            nf.deal_value_cr = None
            nf.order_significance_score = None

        db.commit()

        # -------------------------------------------------------------------
        # 2. Reconcile & Deduplicate Magellanic Cloud (MCLOUD)
        # -------------------------------------------------------------------
        mcloud_oct22 = db.query(AnnouncementRadar).filter(
            AnnouncementRadar.symbol == "MCLOUD",
            AnnouncementRadar.catalyst_type == "ORDER_WIN",
            AnnouncementRadar.headline.ilike("%Bank of Maharashtra%")
        ).order_by(AnnouncementRadar.deal_value_cr.desc().nullslast(), AnnouncementRadar.id.desc()).all()

        if len(mcloud_oct22) > 1:
            master = mcloud_oct22[0]
            logger.info(f"Deduplicating MCLOUD Oct 22 tender: Master ID={master.id}, duplicates={[d.id for d in mcloud_oct22[1:]]}")
            master.deal_value_cr = 228.0
            master.order_client_counterparty = "Bank of Maharashtra"
            master.order_execution_months = 60
            master.headline = 'Magellanic Cloud Limited has informed the Exchange regarding a press release dated October 22, 2026, titled "Magellanic Cloud Limited\'s Wholly Owned Subsidiary, Provigil Surveillance Limited, Emerges as L1 Bidder in Bank of Maharashtra\'s E-Surveillance Tender with a Bid Value of approx. Rs. 228 Crore."'
            master.pdf_url = "https://nsearchives.nseindia.com/corporate/MCLOUD_22102026091926_SEUpload.pdf"

            # Recalculate metrics for master
            intel = OrderWinIntelligenceService.analyze_order_win(
                db=db,
                symbol="MCLOUD",
                company_name=master.company_name,
                headline=master.headline,
                filing_description=master.filing_description,
                deal_value_cr=228.0,
                filing_date=master.announcement_date,
                cmp_override=master.current_price,
                pdf_url=master.pdf_url,
            )
            master.synergy_rev_addition_cr = 228.0
            master.synergy_rev_pct_ttm = intel.get("revenue_contribution_pct")
            master.order_quarterly_rev_cr = intel.get("order_quarterly_rev_cr")
            master.order_quarterly_rev_pct = intel.get("order_quarterly_rev_pct")
            master.order_earnings_impact_cr = intel.get("order_earnings_impact_cr")
            master.order_significance_score = intel.get("order_significance_score")
            master.order_significance_tier = intel.get("order_significance_tier")
            master.order_upside_prob_pct = intel.get("order_upside_prob_pct")
            master.order_target_price_low = intel.get("order_target_price_low")
            master.order_target_price_high = intel.get("order_target_price_high")
            master.order_intelligence = intel
            master.buy_thesis = intel.get("investment_thesis")
            master.ai_insight = intel.get("investment_thesis")

            # Remove duplicates
            for dup in mcloud_oct22[1:]:
                db.delete(dup)
            db.commit()

        # MCLOUD Oct 16 Northern Railway
        mcloud_oct16 = db.query(AnnouncementRadar).filter(
            AnnouncementRadar.symbol == "MCLOUD",
            AnnouncementRadar.catalyst_type == "ORDER_WIN",
            AnnouncementRadar.headline.ilike("%Northern Railway%")
        ).order_by(AnnouncementRadar.id.desc()).all()

        if len(mcloud_oct16) > 1:
            master16 = mcloud_oct16[0]
            logger.info(f"Deduplicating MCLOUD Oct 16 Northern Railway order: Master ID={master16.id}")
            master16.deal_value_cr = 29.13
            master16.order_client_counterparty = "Northern Railway, Moradabad Division"
            for dup in mcloud_oct16[1:]:
                db.delete(dup)
            db.commit()

        # -------------------------------------------------------------------
        # 3. Enrich Orders with Missing Deal Values (Powerica, REPL, Power Mech, Tara Chand, Refex)
        # -------------------------------------------------------------------
        orders_to_enrich = db.query(AnnouncementRadar).filter(
            AnnouncementRadar.catalyst_type == "ORDER_WIN",
            (AnnouncementRadar.deal_value_cr == None) | (AnnouncementRadar.order_client_counterparty == None)
        ).order_by(AnnouncementRadar.id.desc()).limit(50).all()

        logger.info(f"Found {len(orders_to_enrich)} order win records needing enrichment...")

        for o in orders_to_enrich:
            logger.info(f"Inspecting order ID={o.id} ({o.symbol}): {o.headline[:70]}")
            intel = OrderWinIntelligenceService.analyze_order_win(
                db=db,
                symbol=o.symbol,
                company_name=o.company_name,
                headline=o.headline,
                filing_description=o.filing_description,
                deal_value_cr=o.deal_value_cr,
                filing_date=o.announcement_date or o.published_at,
                cmp_override=o.current_price,
                pdf_url=o.pdf_url,
            )

            updated = False
            if intel.get("order_value_cr") and not o.deal_value_cr:
                o.deal_value_cr = intel["order_value_cr"]
                o.synergy_rev_addition_cr = intel["order_value_cr"]
                updated = True

            if intel.get("order_client_counterparty") and not o.order_client_counterparty:
                o.order_client_counterparty = intel["order_client_counterparty"]
                updated = True

            if intel.get("order_execution_months") and not o.order_execution_months:
                o.order_execution_months = intel["order_execution_months"]
                updated = True

            # Specific known filings overrides
            if o.symbol == "POWERICA" and not o.order_client_counterparty:
                o.order_client_counterparty = "Gujarat Urja Vikas Nigam Limited (GUVNL)"
                o.order_execution_months = 24
                if not o.deal_value_cr:
                    o.deal_value_cr = 1076.0
                    o.synergy_rev_addition_cr = 1076.0
                updated = True

            if o.symbol == "OMNI":
                if "defence" in o.headline.lower() and not o.order_client_counterparty:
                    o.order_client_counterparty = "Defence / NATO Aerospace"
                    updated = True
                elif "data centre" in o.headline.lower() and not o.order_client_counterparty:
                    o.order_client_counterparty = "Data Centre Infrastructure"
                    updated = True

            if updated:
                o.synergy_rev_pct_ttm = intel.get("revenue_contribution_pct")
                o.order_quarterly_rev_cr = intel.get("order_quarterly_rev_cr")
                o.order_quarterly_rev_pct = intel.get("order_quarterly_rev_pct")
                o.order_earnings_impact_cr = intel.get("order_earnings_impact_cr")
                o.order_significance_score = intel.get("order_significance_score")
                o.order_significance_tier = intel.get("order_significance_tier")
                o.order_upside_prob_pct = intel.get("order_upside_prob_pct")
                o.order_target_price_low = intel.get("order_target_price_low")
                o.order_target_price_high = intel.get("order_target_price_high")
                o.order_intelligence = intel
                if intel.get("investment_thesis"):
                    o.buy_thesis = intel["investment_thesis"]
                    o.ai_insight = intel["investment_thesis"]
                db.commit()
                logger.info(f"  -> Successfully enriched {o.symbol}: Deal={o.deal_value_cr} Cr, Client={o.order_client_counterparty}, Months={o.order_execution_months}")

        db.commit()
        logger.info("Pipeline completed successfully.")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during repair pipeline: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    repair_and_deduplicate()
