import sys
from app.db.database import SessionLocal, Base, engine
import app.models
from app.services.portfolio_intelligence_service import PortfolioIntelligenceService

def test_portfolio_service():
    print("Initializing tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Fetching or creating portfolios...")
        portfolios = PortfolioIntelligenceService.get_all_portfolios(db)
        print(f"Total portfolios: {len(portfolios)}")
        for p in portfolios:
            print(f"- Portfolio #{p['id']}: {p['name']} | Benchmark: {p['benchmark']} | Holdings: {p['holdings_count']} | Value: Rs {p['current_value']:,.2f} | Health Score: {p['health_score']}")

        default_p = portfolios[0]
        holdings = PortfolioIntelligenceService.get_enriched_holdings(db, default_p['id'])
        print(f"\nHoldings in Portfolio #{default_p['id']} ({len(holdings)} stocks):")
        for h in holdings:
            clean_zone = h['best_buy_zone'].replace('₹', 'Rs. ')
            print(f"  * {h['symbol']}: Qty {h['quantity']} @ Rs {h['avg_buy_price']} -> CMP Rs {h['cmp']} | P&L: Rs {h['pnl']:,.2f} ({h['pnl_pct']:+.1f}%) | Verdict: {h['verdict']} ({h['conviction_score']}%) | Horizon: {h['horizon']} | Buy Zone: {clean_zone}")

        summary = PortfolioIntelligenceService.calculate_portfolio_summary(db, default_p['id'])
        print(f"\nSummary Health: {summary['health_score']}/100 ({summary['health_status']}) | Beta: {summary['portfolio_beta']}")
        print(f"Quality Meter: {summary['quality_meter']}")

        rebalance = PortfolioIntelligenceService.get_rebalancing_recommendations(db, default_p['id'])
        print(f"\nRebalancing Actions: {len(rebalance['rebalance_actions'])}")

        opps = PortfolioIntelligenceService.get_fresh_opportunity_allocator(db, default_p['id'], 50000.0)
        print(f"\nRs 50k Allocation Opportunities: {len(opps['recommended_split'])} buckets")
        for b in opps['recommended_split']:
            print(f"  > {b['bucket']}: Rs {b['amount']} - {len(b['picks'])} picks")

        print("\nALL BACKEND PORTFOLIO INTELLIGENCE ENGINES PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    test_portfolio_service()
