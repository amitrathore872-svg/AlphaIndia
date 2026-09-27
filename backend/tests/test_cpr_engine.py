"""
Unit Tests for Alpha India CPR Compression Engine (Engine #11)
Sprint 38.5 Quant Verification
"""

import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from app.services.cpr_engine_service import CPREngineService
from app.models.cpr_models import CPRScannerDaily
from app.db.database import SessionLocal
from main import app

client = TestClient(app)


def test_cpr_math_calculation():
    """
    Verifies institutional CPR mathematical calculations:
    Pivot = (High + Low + Close) / 3
    BC = (High + Low) / 2
    TC = (2 * Pivot) - BC
    CPR Width % = ABS(TC - BC) / Close * 100
    """
    high = 105.0
    low = 95.0
    close = 100.0

    pivot, bc, tc, width_pct = CPREngineService.calculate_cpr(high, low, close)

    # Pivot = (105 + 95 + 100) / 3 = 100.0
    assert pivot == 100.0
    # BC = (105 + 95) / 2 = 100.0
    assert bc == 100.0
    # TC = (2 * 100) - 100 = 100.0
    assert tc == 100.0
    # Width % = ABS(100 - 100) / 100 * 100 = 0.0%
    assert width_pct == 0.0

    # Test narrow non-zero compression case
    high2 = 100.10
    low2 = 99.90
    close2 = 100.0
    pivot2, bc2, tc2, width_pct2 = CPREngineService.calculate_cpr(high2, low2, close2)
    assert pivot2 == 100.0
    assert bc2 == 100.0
    assert tc2 == 100.0
    assert width_pct2 == 0.0


def test_cpr_category_tiers():
    """
    Verifies institutional categorization based on CPR Width %:
    < 0.10     : Ultra Compression
    0.10 - 0.20: Very Strong
    0.20 - 0.30: Strong
    0.30 - 0.50: Average
    > 0.50     : Ignore
    """
    assert CPREngineService.categorize_cpr_width(0.05) == "Ultra Compression"
    assert CPREngineService.categorize_cpr_width(0.099) == "Ultra Compression"
    assert CPREngineService.categorize_cpr_width(0.10) == "Very Strong"
    assert CPREngineService.categorize_cpr_width(0.18) == "Very Strong"
    assert CPREngineService.categorize_cpr_width(0.20) == "Very Strong"
    assert CPREngineService.categorize_cpr_width(0.25) == "Strong"
    assert CPREngineService.categorize_cpr_width(0.30) == "Strong"
    assert CPREngineService.categorize_cpr_width(0.40) == "Average"
    assert CPREngineService.categorize_cpr_width(0.50) == "Average"
    assert CPREngineService.categorize_cpr_width(0.51) == "Ignore"
    assert CPREngineService.categorize_cpr_width(1.20) == "Ignore"


def test_rsi_calculation():
    """Verifies 14-period RSI output range and direction."""
    series_up = pd.Series([100 + i * 2 for i in range(25)])
    rsi_up = CPREngineService.calculate_rsi(series_up, 14)
    assert rsi_up > 70.0

    series_down = pd.Series([200 - i * 2 for i in range(25)])
    rsi_down = CPREngineService.calculate_rsi(series_down, 14)
    assert rsi_down < 30.0


def test_cpr_endpoints_structure():
    """Verifies that all required CPR Compression API endpoints return 200 OK."""
    # 1. Summary card
    resp_sum = client.get("/scanner/cpr/summary")
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    assert "stocks_scanned" in sum_data
    assert "ultra_compression_stocks" in sum_data

    # 2. Main screener endpoint
    resp_cpr = client.get("/scanner/cpr?limit=10")
    assert resp_cpr.status_code == 200
    cpr_data = resp_cpr.json()
    assert "items" in cpr_data
    assert "total" in cpr_data
    assert len(cpr_data["items"]) <= 10

    # 3. Top 25
    resp_top = client.get("/scanner/cpr/top?limit=10")
    assert resp_top.status_code == 200
    top_data = resp_top.json()
    assert isinstance(top_data, list)
    if len(top_data) > 0:
        assert "cpr_width_pct" in top_data[0]
        assert "tc" in top_data[0]

    # 4. Triple CPR
    resp_triple = client.get("/scanner/cpr/triple?limit=10")
    assert resp_triple.status_code == 200
    assert isinstance(resp_triple.json(), list)

    # 5. Watchlist
    resp_wl = client.get("/scanner/cpr/watchlist?limit=10")
    assert resp_wl.status_code == 200
    assert isinstance(resp_wl.json(), list)

    # 6. Multi-Timeframe Broad to Narrow Transitions
    for tf in ["daily", "weekly", "monthly"]:
        resp_tr = client.get(f"/scanner/cpr/transitions?timeframe={tf}&limit=5")
        assert resp_tr.status_code == 200
        tr_data = resp_tr.json()
        assert isinstance(tr_data, list)
        if len(tr_data) > 0:
            assert "prev_cpr_width" in tr_data[0]
            assert "curr_cpr_width" in tr_data[0]
            assert "compression_ratio" in tr_data[0]
            assert "status" in tr_data[0]

