import urllib.request
import time

endpoints = [
    ("Chart Patterns", "http://127.0.0.1:8000/api/v1/chart-patterns"),
    ("Pre-Breakout Radar", "http://127.0.0.1:8000/api/v1/pre-breakout-radar"),
    ("Cup and Handle", "http://127.0.0.1:8000/api/v1/cup-handle"),
    ("Staircase Screener", "http://127.0.0.1:8000/api/v1/staircase-screener"),
    ("Breakout Candidates", "http://127.0.0.1:8000/api/v1/breakout-execution/candidates"),
    ("Apex Confluence Radar", "http://127.0.0.1:8000/api/v1/confluence"),
    ("Swing Overlay Dashboard", "http://127.0.0.1:8000/swing-overlay/dashboard"),
    ("CPR Scanner", "http://127.0.0.1:8000/api/v1/scanner/cpr"),
    ("Momentum Screener", "http://127.0.0.1:8000/api/v1/momentum-screener"),
    ("VCP Discovery", "http://127.0.0.1:8000/api/vcp/discovery"),
    ("Candlestick Radar", "http://127.0.0.1:8000/api/v1/candlesticks"),
]

print(f"{'Endpoint':30} | {'Status':6} | {'Latency':10} | {'Payload':10}")
print("-" * 65)

for name, url in endpoints:
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "benchmark"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            dt = (time.time() - t0) * 1000
            print(f"{name:30} | {resp.status:6} | {dt:7.1f} ms | {len(data):6} B")
    except Exception as e:
        dt = (time.time() - t0) * 1000
        print(f"{name:30} | ERR    | {dt:7.1f} ms | {e}")
