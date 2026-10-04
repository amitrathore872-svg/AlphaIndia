import time
from app.services.pattern_engine.candlestick_scanner_service import CandlestickScannerService

print("Starting scan of Nifty 500 universe...")
t0 = time.time()
res = CandlestickScannerService.get_candlestick_opportunities(universe="NIFTY_500", force_refresh=True)
m = res.get("metadata", {})
elapsed = time.time() - t0

print(f"Scan completed in {elapsed:.2f} seconds!")
print(f"Universe: {m.get('universe_name')} ({m.get('universe_scanned')} stocks)")
print(f"Total Signals: {m.get('total_signals')}")
print(f"Elite Conviction (>=90): {m.get('elite_signals')}")
print(f"High Conviction (>=80): {m.get('high_conviction_signals')}")
print(f"Moderate (65-79): {m.get('moderate_signals')}")
print(f"Bullish: {m.get('bullish_signals')}, Bearish: {m.get('bearish_signals')}")
print(f"Average Conviction Score: {m.get('avg_conviction_score')}")

sample = res.get("signals", [])[:3]
for idx, s in enumerate(sample):
    print(f"\nSample {idx+1}: {s.get('symbol')} ({s.get('company_name')}) - {s.get('pattern_name')}")
    print(f"  Score: {s.get('ai_conviction_score')} PTS ({s.get('conviction_tier')})")
    print(f"  Reasons: {s.get('conviction_reasons')}")
    print(f"  CMP: Rs.{s.get('cmp'):.2f}, Trigger: Rs.{s.get('trigger_price'):.2f}, SL: Rs.{s.get('stop_loss'):.2f}, R:R: {s.get('risk_reward')}:1")
