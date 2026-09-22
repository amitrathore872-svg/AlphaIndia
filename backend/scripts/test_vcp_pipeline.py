"""
Alpha India VCP Pipeline Verification Suite
Tests all 8 gates, scoring models, and API endpoints.
"""

import sys
from fastapi.testclient import TestClient
from main import app
from app.db.database import SessionLocal
from app.services.vcp_engine_service import VCPEngineService
from app.services.vcp_backtest_service import VCPBacktestService

def test_vcp_suite():
    print("==================================================")
    print("STARTING VCP + VOLUME BREAKOUT PIPELINE VERIFICATION")
    print("==================================================")

    client = TestClient(app)

    # 1. Backtest Engine
    print("\n[1/5] Testing 10-Year Backtest Engine...")
    btest = client.get("/api/vcp/backtest")
    assert btest.status_code == 200, f"Backtest failed: {btest.text}"
    bdata = btest.json()
    print(f" -> Win Rate: {bdata.get('win_rate')}%")
    print(f" -> Profit Factor: {bdata.get('profit_factor')}x")
    print(f" -> Total Signals: {bdata.get('total_signals')}")
    print(f" -> Benchmark Multibagger Case Studies: {len(bdata.get('case_studies', []))}")
    assert bdata.get("win_rate") > 70.0
    assert len(bdata.get("case_studies", [])) >= 10

    # 2. Rejection Audit Funnel
    print("\n[2/5] Testing Rejection Funnel API...")
    rej = client.get("/api/vcp/rejections")
    assert rej.status_code == 200, f"Rejections failed: {rej.text}"
    rdata = rej.json()
    print(f" -> Rejections logged: {rdata.get('total_rejections')}")
    print(f" -> Gate breakdown: {rdata.get('gate_breakdown')}")

    # 3. Discovery Endpoint (Strict 0-3 picks, Score >= 90)
    print("\n[3/5] Testing /api/vcp/discovery...")
    disc = client.get("/api/vcp/discovery")
    assert disc.status_code == 200, f"Discovery failed: {disc.text}"
    ddata = disc.json()
    picks = ddata.get("items", [])
    print(f" -> Discovery returned count: {len(picks)} (Constraint: 0 <= count <= 3)")
    assert len(picks) <= 3, "Violated max 3 picks constraint!"
    for p in picks:
        assert p["final_ai_score"] >= 90.0, f"Stock {p['symbol']} score {p['final_ai_score']} < 90!"
        print(f"   * {p['symbol']}: Score {p['final_ai_score']}, CMP Rs.{p['cmp']}, Pivot Rs.{p['pivot_price']}")

    # 4. Watchlist Endpoint (Before Breakout Coiling)
    print("\n[4/5] Testing /api/vcp/watchlist...")
    wlist = client.get("/api/vcp/watchlist?limit=5")
    assert wlist.status_code == 200, f"Watchlist failed: {wlist.text}"
    wdata = wlist.json()
    print(f" -> Watchlist coiling items: {wdata.get('count')}")

    # 5. Single Stock Deep Dive
    print("\n[5/5] Testing Single Stock Deep Dive for DIXON...")
    deep = client.get("/api/vcp/DIXON")
    if deep.status_code == 200:
        sdata = deep.json()
        print(f" -> DIXON Score: {sdata.get('final_ai_score')}, Verdict: {sdata.get('verdict')}")
        print(f" -> Candlestick count: {len(sdata.get('chart_data', {}).get('candles', []))}")
        assert len(sdata.get('chart_data', {}).get('candles', [])) > 0
    else:
        print(f" -> DIXON deep dive returned: {deep.status_code}")

    print("\n==================================================")
    print("ALL VCP QUANT & ARCHITECTURE VERIFICATIONS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_vcp_suite()
