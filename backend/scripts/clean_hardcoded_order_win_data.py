import sys
import os
import re

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.services.order_win_intelligence_service import OrderWinIntelligenceService

def clean_order_win_data():
    db = SessionLocal()
    try:
        orders = db.query(AnnouncementRadar).filter(AnnouncementRadar.catalyst_type == "ORDER_WIN").all()
        print(f"Total ORDER_WIN rows: {len(orders)}")

        cleaned_pct = 0
        cleaned_months = 0
        recalculated = 0

        for r in orders:
            needs_update = False
            
            # Check if execution months was 18 but text doesn't mention 18
            if r.order_execution_months == 18:
                h = r.headline or ""
                d = r.filing_description or ""
                text = f"{h} {d}"
                has_18 = bool(re.search(r"18\s*[-–]?\s*months?", text, re.IGNORECASE) or re.search(r"1\.5\s*[-–]?\s*years?", text, re.IGNORECASE))
                if not has_18:
                    needs_update = True
                    cleaned_months += 1

            # Check if synergy_rev_pct_ttm was synthetic 12.5%
            if r.synergy_rev_pct_ttm == 12.5:
                needs_update = True
                cleaned_pct += 1

            if needs_update:
                analysis = OrderWinIntelligenceService.analyze_order_win(
                    db=db,
                    symbol=r.symbol,
                    company_name=r.company_name,
                    headline=r.headline,
                    filing_description=r.filing_description,
                    deal_value_cr=r.deal_value_cr,
                    filing_date=r.announcement_date or r.published_at,
                    cmp_override=r.current_price,
                )

                if analysis["order_value_cr"]:
                    r.deal_value_cr = analysis["order_value_cr"]
                    r.synergy_rev_addition_cr = analysis["order_value_cr"]

                r.synergy_rev_pct_ttm = analysis["revenue_contribution_pct"]
                r.order_execution_months = analysis["order_execution_months"]
                r.order_quarterly_rev_cr = analysis["order_quarterly_rev_cr"]
                r.order_quarterly_rev_pct = analysis["order_quarterly_rev_pct"]
                r.order_earnings_impact_cr = analysis["order_earnings_impact_cr"]
                r.order_significance_score = analysis["order_significance_score"]
                r.order_significance_tier = analysis["order_significance_tier"]
                r.order_upside_prob_pct = analysis["order_upside_prob_pct"]
                r.order_target_price_low = analysis["order_target_price_low"]
                r.order_target_price_high = analysis["order_target_price_high"]
                r.order_confidence_score = analysis["order_confidence_score"]
                r.order_client_counterparty = analysis["order_client_counterparty"]
                r.order_historical_comparison = analysis["order_historical_comparison"]
                r.order_intelligence = analysis

                r.target_price = analysis["order_target_price_base"]
                r.current_price = analysis["cmp"]
                r.upside_pct = analysis["upside_pct"]
                r.stop_loss = analysis["stop_loss"]
                r.buy_thesis = analysis["investment_thesis"]
                r.ai_insight = analysis["investment_thesis"]

                recalculated += 1

        db.commit()
        print(f"Successfully cleaned database:")
        print(f" - Rows where synthetic 12.5% was removed/recalculated: {cleaned_pct}")
        print(f" - Rows where synthetic 18M was removed: {cleaned_months}")
        print(f" - Total rows updated and committed: {recalculated}")

    except Exception as e:
        db.rollback()
        print(f"Error cleaning order win data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_order_win_data()
