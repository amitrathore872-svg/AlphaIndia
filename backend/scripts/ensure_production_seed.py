"""
Production Database Integrity, Optimization & Seed Verification Script
Alpha India - Production Deployment Pipeline
Verifies and auto-seeds all core master tables on EC2 deployment (Companies, Mutual Funds, Velocity, etc.)
"""

import sys
import os
import logging
from sqlalchemy import text

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import Base, engine, SessionLocal
import app.models
from app.models.company import Company
from app.models.mf_models import MFScheme, MFSchemeHolding, MFStockMonthlyAggregate
from app.models.mf_radar_models import MFRadarScheme, MFRadarNavHistory
from app.services.mf_radar.mf_warehouse_service import MFWarehouseService
from app.services.mf_engine_service import MFEngineService
from scripts.optimize_production_database import optimize_database
from scripts.import_nse_companies import import_nse_companies
from scripts.seed_mutual_fund_data import seed_mutual_fund_intelligence

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ensure_production_seed")


def ensure_production_database():
    logger.info("=" * 65)
    logger.info("ALPHA INDIA - PRODUCTION DATABASE INTEGRITY & SEED VERIFICATION")
    logger.info("=" * 65)

    # 1. Verify schema tables
    logger.info("[1/5] Verifying database schema & tables...")
    Base.metadata.create_all(bind=engine)

    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS velocity_market_regime (
                    id SERIAL PRIMARY KEY,
                    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    market_score FLOAT NOT NULL DEFAULT 50.0,
                    market_bias VARCHAR(50) NOT NULL,
                    risk_level VARCHAR(30) NOT NULL DEFAULT 'MODERATE',
                    position_size_multiplier FLOAT NOT NULL DEFAULT 1.0,
                    nifty_price FLOAT,
                    nifty_change_pct FLOAT,
                    banknifty_price FLOAT,
                    banknifty_change_pct FLOAT,
                    vix_value FLOAT,
                    vix_change_pct FLOAT,
                    advance_decline_ratio FLOAT,
                    sector_breadth_pct FLOAT,
                    gift_nifty FLOAT,
                    dollar_index FLOAT,
                    us_10y_yield FLOAT,
                    brent_crude FLOAT,
                    component_scores JSON,
                    weights_used JSON,
                    summary_verdict TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS nifty_price FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS nifty_change_pct FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS banknifty_price FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS banknifty_change_pct FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS vix_value FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS vix_change_pct FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS advance_decline_ratio FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS sector_breadth_pct FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS gift_nifty FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS dollar_index FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS us_10y_yield FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS brent_crude FLOAT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS component_scores JSON;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS weights_used JSON;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS summary_verdict TEXT;
                ALTER TABLE velocity_market_regime ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            conn.commit()
        logger.info("      Schema tables and custom velocity extensions verified.")
    except Exception as e:
        logger.warning(f"      Schema notice: {e}")

    # 2. Database optimization
    logger.info("[2/5] Running database normalization & indexing optimization...")
    try:
        optimize_database()
    except Exception as e:
        logger.warning(f"      Optimization note: {e}")

    db = SessionLocal()
    try:
        # 3. Verify Master Equities
        active_count = db.query(Company).filter(Company.listing_status == "Active").count()
        total_companies = db.query(Company).count()
        logger.info(f"[3/5] Master Companies: {active_count} active / {total_companies} total.")
        if active_count < 100:
            logger.info("      Seeding full NSE company master list (2,100+ equities)...")
            import_nse_companies()
            active_count = db.query(Company).filter(Company.listing_status == "Active").count()
            logger.info(f"      Company seeding completed. Total active: {active_count}")

        # 4. Verify Mutual Fund Intelligence & Fresh Entries Radar
        mf_schemes_count = db.query(MFScheme).count()
        mf_holdings_count = db.query(MFSchemeHolding).count()
        logger.info(f"[4/5] Mutual Fund Intelligence: {mf_schemes_count} schemes, {mf_holdings_count} holdings.")
        if mf_schemes_count < 10 or mf_holdings_count < 500:
            logger.info("      Seeding Full-Universe Mutual Fund Intelligence & Fresh Entries...")
            seed_mutual_fund_intelligence()
            mf_schemes_count = db.query(MFScheme).count()
            mf_holdings_count = db.query(MFSchemeHolding).count()
            logger.info(f"      Mutual fund seeding completed: {mf_schemes_count} schemes, {mf_holdings_count} holdings.")

        # 5. Verify Pure Equity Radar & Live AMFI NAVs
        radar_schemes_count = db.query(MFRadarScheme).count()
        logger.info(f"[5/5] Pure Equity MF Radar: {radar_schemes_count} schemes.")
        if radar_schemes_count < 50:
            logger.info("      Bootstrapping Top Equity MF Universe...")
            b_res = MFWarehouseService.bootstrap_universe(db)
            logger.info(f"      Bootstrap completed: {b_res}")

        # Always trigger AMFI live daily NAV sync during deployment
        logger.info("      Syncing daily NAVs from official AMFI portal...")
        s_res = MFWarehouseService.sync_daily_navs_from_amfi(db)
        logger.info(f"      AMFI daily NAV sync completed: {s_res}")

        # Verify automated monthly cycle
        logger.info("      Evaluating SEBI filing calendar cycle...")
        cycle_res = MFEngineService.run_scheduled_mf_cycle(db)
        logger.info(f"      MF cycle evaluation: {cycle_res.get('status')}")

    except Exception as exc:
        logger.error(f"Error during production seed verification: {exc}", exc_info=True)
        raise exc
    finally:
        db.close()

    logger.info("=" * 65)
    logger.info("PRODUCTION SEED & INTEGRITY VERIFICATION COMPLETED SUCCESSFULLY!")
    logger.info("=" * 65)


if __name__ == "__main__":
    ensure_production_database()
