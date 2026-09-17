"""
Test ATHENA OMEGA v3.0 Pipeline
Sprint 24
"""

from app.db.database import engine, Base, SessionLocal
import app.models.athena_models
from app.services.athena_exchange_watcher import AthenaExchangeWatcher

def run_test():
    print("1. Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

    print("2. Running 5-Gate Exchange Watcher & Fusion Scan...")
    db = SessionLocal()
    try:
        results = AthenaExchangeWatcher.scan_recent_exchange_results(db)
        print(f"Processed {len(results)} quarterly results through 5-Gate pipeline!\n")

        for r in results:
            sym = r["symbol"]
            shock = r["shock_analysis"]["normalized_shock_score"]
            tier = r["priority"]
            quality = r["quality_analysis"]["quality_score"]
            val_upside = r["valuation_risk"]["upside_potential_pct"]
            conviction = r["flash_decision"]["athena_conviction_score"]
            grade = r["flash_decision"]["conviction_grade"]
            signal = r["flash_decision"]["flash_signal"]
            gap = r["flash_decision"]["expected_moves"]["gap_up"]["label"]
            sec = r["processing_time_sec"]

            print(f"[{tier}] {sym:10} | Shock: {shock:4.1f} | Qual: {quality:4.1f} | Upside: {val_upside:+5.1f}% | Conviction: {conviction:4.1f} ({grade}) -> {signal:16} (Gap: {gap}) in {sec:.3f}s")

    finally:
        db.close()

if __name__ == "__main__":
    run_test()
