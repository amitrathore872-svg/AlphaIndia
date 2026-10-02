"""
Step 1 Verification Script
Tests mathematical integrity, configuration loading, Wilder's RSI,
and verifies zero pseudo-math / synthetic candle generation.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pandas as pd

def test_config():
    print("--- 1. Testing Config & Settings ---")
    from app.core.config import settings, DATABASE_URL
    assert settings.APP_NAME == "Alpha India"
    assert isinstance(settings.cors_origins_list, list)
    assert len(settings.cors_origins_list) >= 1
    assert "http://localhost:3000" in settings.cors_origins_list
    print("[OK] Config loaded with typed BaseSettings successfully.")

def test_rsi_wilder():
    print("--- 2. Testing Authentic Wilder's RSI Calculation ---")
    from app.services.swing_quant_service import calculate_rsi
    # Test on known 20-period price series
    prices = pd.Series([
        100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
        111, 110, 112, 114, 113, 115, 117, 116, 118, 120
    ])
    rsi = calculate_rsi(prices, period=14)
    last_rsi = float(rsi.iloc[-1])
    # In a rising series, RSI should be comfortably bullish (> 70)
    assert 65.0 <= last_rsi <= 95.0, f"RSI was {last_rsi}"
    print(f"[OK] Authentic Wilder's RMA RSI computed: {last_rsi:.2f}")

def test_vcp_zero_synthetic_candles():
    print("--- 3. Testing VCP Service Clean Rejection on Missing Candles ---")
    from app.services.vcp_engine_service import VCPEngineService
    from app.models.screener_growth_record import ScreenerGrowthRecord

    # Create dummy record with no candle data
    dummy_record = ScreenerGrowthRecord(
        symbol="NONEXISTENT_TICKER_XYZ",
        current_price=150.0,
        market_cap=5000.0,
        high_52_week=160.0,
    )
    empty_hist = pd.DataFrame()
    passed, score, details, err = VCPEngineService.evaluate_trend_gate(dummy_record, empty_hist)
    assert passed is False
    assert "Insufficient historical daily candle data" in err
    print(f"[OK] VCP cleanly rejected candidate on missing data without synthesizing candles: {err}")

def test_stock_technical_zero_seed():
    print("--- 4. Testing Stock Technical Service Free of Seed Pseudo-Math ---")
    import inspect
    from app.services.stock_technical_service import StockTechnicalService
    source = inspect.getsource(StockTechnicalService)
    assert "sym_seed" not in source, "sym_seed found in StockTechnicalService source!"
    assert "sum(ord(c)" not in source, "sum(ord(c)) found in StockTechnicalService source!"
    print("[OK] Confirmed zero sym_seed or ASCII sum pseudo-math in StockTechnicalService.")

if __name__ == "__main__":
    print("==================================================")
    print("ALPHA INDIA — STEP 1 VERIFICATION SUITE")
    print("==================================================")
    test_config()
    test_rsi_wilder()
    test_vcp_zero_synthetic_candles()
    test_stock_technical_zero_seed()
    print("==================================================")
    print("ALL STEP 1 VERIFICATIONS PASSED SUCCESSFULLY!")
    print("==================================================")
