import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from main import app

def main():
    client = TestClient(app)
    
    print("--- 1. Triggering Real-Time Discovery Monitor Cycle ---")
    cycle_resp = client.post("/discovery/monitor/run-cycle?limit=10")
    print("Cycle status:", cycle_resp.status_code)
    cycle_data = cycle_resp.json()
    print("Companies Scanned:", cycle_data.get("companies_scanned"))
    print("High Growth Breakouts:", cycle_data.get("high_growth_breakouts"))
    for c in cycle_data.get("companies", [])[:5]:
        print(f"  * {c['symbol']} [{c['exchange']}] {c['quarter']} | {c['category']} | Updated: {c['updated_at']}")

    print("\n--- 2. Fetching Growth Screener Sorted by Last Updated DESC ---")
    screener_resp = client.get("/growth-screener?sort_by=last_updated&sort_order=desc&limit=10")
    print("Screener status:", screener_resp.status_code)
    results = screener_resp.json().get("results", [])
    for idx, r in enumerate(results, 1):
        print(f"  {idx:2d}. {r['symbol']:<12} | {r['company']:<32} | {r['last_updated']} | Health: {r['health_score']}")

    print("\n--- 3. Testing Discovery Recent Activity ---")
    act_resp = client.get("/discovery/monitor/recent-activity?limit=5")
    print("Recent Activity status:", act_resp.status_code)
    for c in act_resp.json().get("recent_companies", []):
        print(f"  * {c['symbol']} ({c['exchange']}) - Updated: {c['updated_at']}")

if __name__ == "__main__":
    main()
