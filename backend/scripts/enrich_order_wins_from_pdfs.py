import sys
import os
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.services.order_win_intelligence_service import OrderWinIntelligenceService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("enrich_order_wins_from_pdfs")

def enrich_order_wins_from_pdfs(limit: int = 50):
    db = SessionLocal()
    try:
        # Find order wins where deal_value_cr is missing or order_execution_months is missing, and has PDF
        rows = (
            db.query(AnnouncementRadar)
            .filter(
                AnnouncementRadar.catalyst_type == "ORDER_WIN",
                (AnnouncementRadar.deal_value_cr == None) | (AnnouncementRadar.order_execution_months == None),
                AnnouncementRadar.pdf_url.isnot(None),
                AnnouncementRadar.pdf_url != "-",
                AnnouncementRadar.pdf_url.like("http%")
            )
            .order_by(AnnouncementRadar.announcement_date.desc(), AnnouncementRadar.id.desc())
            .limit(limit)
            .all()
        )

        logger.info(f"Found {len(rows)} order win filings with PDFs needing enrichment.")

        enriched_count = 0
        for r in rows:
            logger.info(f"Processing ID {r.id} | {r.symbol} | {r.pdf_url}")
            analysis = OrderWinIntelligenceService.analyze_order_win(
                db=db,
                symbol=r.symbol,
                company_name=r.company_name,
                headline=r.headline,
                filing_description=r.filing_description,
                deal_value_cr=r.deal_value_cr,
                filing_date=r.announcement_date or r.published_at,
                cmp_override=r.current_price,
                pdf_url=r.pdf_url,
            )

            updated = False
            if analysis.get("order_value_cr") and not r.deal_value_cr:
                r.deal_value_cr = analysis["order_value_cr"]
                r.synergy_rev_addition_cr = analysis["order_value_cr"]
                updated = True

            if analysis.get("order_client_counterparty") and not r.order_client_counterparty:
                r.order_client_counterparty = analysis["order_client_counterparty"]
                updated = True

            if analysis.get("order_execution_months") and not r.order_execution_months:
                r.order_execution_months = analysis["order_execution_months"]
                updated = True

            if updated:
                r.synergy_rev_pct_ttm = analysis.get("revenue_contribution_pct")
                r.order_quarterly_rev_cr = analysis.get("order_quarterly_rev_cr")
                r.order_quarterly_rev_pct = analysis.get("order_quarterly_rev_pct")
                r.order_earnings_impact_cr = analysis.get("order_earnings_impact_cr")
                r.order_significance_score = analysis.get("order_significance_score")
                r.order_significance_tier = analysis.get("order_significance_tier")
                r.order_upside_prob_pct = analysis.get("order_upside_prob_pct")
                r.order_target_price_low = analysis.get("order_target_price_low")
                r.order_target_price_high = analysis.get("order_target_price_high")
                r.order_intelligence = analysis
                r.buy_thesis = analysis.get("investment_thesis")
                r.ai_insight = analysis.get("investment_thesis")
                enriched_count += 1
                logger.info(f"Enriched {r.symbol}: Deal={r.deal_value_cr} Cr | Client={r.order_client_counterparty} | Months={r.order_execution_months}")

        db.commit()
        logger.info(f"Successfully enriched {enriched_count} filings from their exchange PDF documents.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error enriching filings from PDFs: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    enrich_order_wins_from_pdfs(limit=25)
