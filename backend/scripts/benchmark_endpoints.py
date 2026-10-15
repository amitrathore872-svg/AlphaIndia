import time
import urllib.request
import json

endpoints = [
    "/delivery-radar/live",
    "/api/v1/delivery-radar/live",
    "/api/v1/delivery-radar/screener",
    "/delivery-radar",
    "/growth-screener",
    "/growth/screener",
    "/screener-growth",
    "/screener-growth/records",
    "/market-intelligence/order-wins",
    "/announcements",
    "/api/v1/announcements",
    "/vcp/signals",
    "/api/v1/institutional-radar/funds",
    "/investor-intelligence",
    "/cpr-scanner",
    "/api/v1/cpr-scanner",
    "/athena-omega/flash-decisions",
    "/filings",
    "/companies",
    "/stocks",
]

print("=" * 65)
print("ALPHA INDIA ENDPOINT LATENCY AUDIT")
print("=" * 65)

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Benchmark/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            dur = round((time.time() - t0) * 1000, 1)
            code = resp.getcode()
            print(f"[{code}] {dur:>7} ms  -->  {ep}")
    except urllib.error.HTTPError as e:
        dur = round((time.time() - t0) * 1000, 1)
        print(f"[{e.code}] {dur:>7} ms  -->  {ep}")
    except Exception as e:
        dur = round((time.time() - t0) * 1000, 1)
        print(f"[ERR] {dur:>7} ms  -->  {ep} ({e})")
