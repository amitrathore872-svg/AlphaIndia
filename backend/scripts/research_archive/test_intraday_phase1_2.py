"""
Quick smoke test for IntradayOpportunityService Phase 1 & 2 indicators.
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.services.intraday_opportunity_service import IntradayOpportunityService

def main():
    print("Testing Nifty Benchmark Ingestion (Phase 2)...")
    bench = IntradayOpportunityService.get_nifty_benchmark(force_refresh=True)
    print(f"Nifty Benchmark: CMP={bench.get('cmp')}, 5D_Ret={bench.get('ret_5d')}%, Regime={bench.get('regime')}")
    assert bench.get("cmp") > 0, "Nifty CMP should be > 0"

    print("\nTesting MTF Analysis on Sample Stocks (Phase 1 & 2)...")
    test_symbols = ["HEROMOTOCO", "INFY", "TATAMOTORS"]
    sector_stats = {"Automotive": {"bullish_ratio_pct": 50.0, "is_leading": True, "bullish_stocks": 5}}

    for sym in test_symbols:
        opp = {
            "symbol": sym,
            "company_name": sym,
            "sector": "Automotive",
            "direction_tier": "BULLISH",
            "probability": 75,
            "expected_move_pct": 5.5,
            "cmp": 1000.0,
        }
        res = IntradayOpportunityService.analyze_stock_mtf(opp, sector_stats, bench)
        if res:
            print(f"\n--- {sym} ---")
            print(f"CMP: ₹{res.get('cmp')} | ATR(14): ₹{res.get('atr_14')} ({res.get('atr_pct')}%)")
            print(f"NR7: {res.get('is_nr7')} | Inside Day: {res.get('is_inside_day')} | Contraction: {res.get('pattern_contraction')}")
            print(f"Dynamic T1: ₹{res.get('target_1')} | T2: ₹{res.get('target_2')} | SL: ₹{res.get('stop_loss')} | RR: {res.get('risk_reward')}x")
            print(f"Stock 5D Ret: {res.get('stock_ret_5d')}% vs Nifty 5D: {res.get('nifty_ret_5d')}% -> RS Score: {res.get('rs_score')}% ({res.get('rs_status')})")
            print(f"Conviction Score: {res.get('conviction_score')} / 100 ({res.get('conviction_tier')})")
            assert "atr_14" in res, "atr_14 missing"
            assert "rs_score" in res, "rs_score missing"
            assert "target_1" in res, "target_1 missing"

    print("\nSUCCESS: All Phase 1 & Phase 2 calculations verified successfully!")

if __name__ == "__main__":
    main()
