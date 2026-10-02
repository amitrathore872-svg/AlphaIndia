"""
Alpha India - Comprehensive Test Suite for Velocity Burst Elite (VBE)
Sprint 39 Flagship Institutional Breakout Intelligence Test Coverage
Tests:
- Indicator calculations (TTM, Keltner, ATR, ADR, NR5/7/10, Inside Bars, CMF, MFI, OBV)
- Market Regime Engine (Stage 0)
- Sleeping Giant & Compression Intelligence (Stages 1 & 2)
- Base Pattern Engine (Stage 3)
- Institutional Footprint Engine (Stage 4)
- Relative Strength & Sector Rotation (Stages 5 & 6)
- Smart Money & Liquidity Engine (Stages 7 & 8)
- News Risk Engine (Stage 9)
- Live Breakout & Entry Quality Gate (Stages 10 & 11)
- Trade Management Lifecycle (Stage 12)
- BTST Continuation Engine (Stage 13)
- AI Confidence & Verdicts (Stage 14)
- Alert Deduplication & Dispatch (Stage 15)
- Backtest Simulator & Learning Engine (Stage 17)
- FastAPI /api/v4/velocity Router Endpoints
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.db.database import SessionLocal, Base, engine
import app.models
from main import app
from app.services.velocity.indicator_suite import VelocityIndicatorSuite
from app.services.velocity.market_regime_engine import MarketRegimeEngine
from app.services.velocity.sleeping_giant_engine import SleepingGiantEngine
from app.services.velocity.base_pattern_engine import BasePatternEngine
from app.services.velocity.institutional_footprint_engine import InstitutionalFootprintEngine
from app.services.velocity.relative_strength_engine import RelativeStrengthEngine, SectorRotationEngine
from app.services.velocity.smart_money_engine import SmartMoneyEngine, LiquidityEngine
from app.services.velocity.news_risk_engine import NewsRiskEngine
from app.services.velocity.live_breakout_engine import LiveBreakoutEngine
from app.services.velocity.trade_management_engine import TradeManagementEngine, BTSTContinuationEngine
from app.services.velocity.ai_confidence_engine import AIConfidenceEngine
from app.services.velocity.alert_intelligence_engine import AlertIntelligenceEngine
from app.services.velocity.historical_learning_engine import HistoricalLearningEngine
from app.services.velocity.velocity_orchestrator import VelocityBurstOrchestrator


@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture
def sample_ohlcv():
    n = 60
    closes = np.linspace(100.0, 120.0, n)
    highs = closes * 1.015
    lows = closes * 0.985
    opens = (closes + np.roll(closes, 1)) / 2.0
    opens[0] = closes[0]
    volumes = np.random.uniform(50000, 150000, n)
    return pd.DataFrame({
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": volumes,
    })


def test_indicator_suite_calculations(sample_ohlcv):
    ind = VelocityIndicatorSuite.compute_all_indicators(sample_ohlcv)
    assert ind is not None
    assert "cmp" in ind
    assert "atr14" in ind
    assert "adr20" in ind
    assert "bb_width_percentile" in ind
    assert "ttm_squeeze_active" in ind
    assert "cmf_20" in ind
    assert "mfi_14" in ind
    assert "obv_slope" in ind
    assert "rs_score" in ind
    assert ind["cmp"] > 0
    assert 0 <= ind["rs_score"] <= 100


def test_market_regime_engine(db_session):
    res = MarketRegimeEngine.evaluate_regime(db_session)
    assert res is not None
    assert 0 <= res["market_score"] <= 100
    assert res["market_bias"] in ["Bull Expansion", "Bull Pullback", "Sideways", "Bear Expansion", "High Volatility", "Crash Risk"]
    assert res["risk_level"] in ["LOW", "MODERATE", "HIGH", "EXTREME"]
    assert 0.0 <= res["position_size_multiplier"] <= 1.5


def test_sleeping_giant_and_compression(sample_ohlcv, db_session):
    meta = {"company_name": "Test Co", "sector": "Technology", "market_cap": 8500.0}
    sg = SleepingGiantEngine.analyze_stock_compression("TESTCO", sample_ohlcv, meta=meta)
    assert sg is not None
    assert sg["symbol"] == "TESTCO"
    assert 0 <= sg["compression_score"] <= 100
    assert sg["compression_quality"] in ["ELITE", "HIGH", "MEDIUM", "LOW"]

    # Test batch upsert
    sg_c, comp_c = SleepingGiantEngine.batch_upsert_candidates(db_session, [sg])
    assert sg_c == 1
    assert comp_c == 1


def test_base_pattern_engine(sample_ohlcv, db_session):
    pattern = BasePatternEngine.detect_base_pattern("TESTPAT", sample_ohlcv)
    assert pattern is not None
    assert pattern["symbol"] == "TESTPAT"
    assert pattern["pattern_type"] in ["VCP", "FLAT_BASE", "CUP_HANDLE", "ASCENDING_TRIANGLE", "BULL_FLAG", "TIGHT_FLAG", "RE_ACCUMULATION"]
    assert pattern["pivot_point"] > 0
    assert 0 <= pattern["base_quality_score"] <= 100

    upserted = BasePatternEngine.batch_upsert_patterns(db_session, [pattern])
    assert upserted == 1


def test_institutional_footprint_engine(sample_ohlcv, db_session):
    inst = InstitutionalFootprintEngine.evaluate_institution_footprint("TESTINST", sample_ohlcv, delivery_pct_override=58.5)
    assert inst is not None
    assert inst["symbol"] == "TESTINST"
    assert 0 <= inst["institution_score"] <= 100
    assert inst["accumulation_type"] in ["STEALTH_ACCUMULATION", "POCKET_PIVOT_IGNITION", "ABSORPTION_AT_SUPPORT", "RE_ACCUMULATION", "OPERATOR_EXPANSION"]

    upserted = InstitutionalFootprintEngine.batch_upsert_institutions(db_session, [inst])
    assert upserted == 1


def test_relative_strength_engine(sample_ohlcv, db_session):
    rs = RelativeStrengthEngine.evaluate_stock_rs("TESTRS", sample_ohlcv, sector_name="NIFTY IT")
    assert rs is not None
    assert rs["symbol"] == "TESTRS"
    assert 1 <= rs["rs_rank"] <= 99

    upserted = RelativeStrengthEngine.batch_upsert_rs(db_session, [rs])
    assert upserted == 1

    sectors = SectorRotationEngine.evaluate_all_sectors(db_session)
    assert len(sectors) > 0
    assert sectors[0]["rank"] == 1


def test_smart_money_and_liquidity(sample_ohlcv, db_session):
    sm = SmartMoneyEngine.evaluate_smart_money("TESTSM", sample_ohlcv)
    assert sm is not None
    assert 0 <= sm["smart_money_score"] <= 100

    liq = LiquidityEngine.evaluate_liquidity("TESTSM", sample_ohlcv, market_cap_cr=12000.0, is_fno=True)
    assert liq is not None
    assert liq["liquidity_score"] >= 25.0
    assert liq["is_fno"] is True


def test_news_risk_engine(db_session):
    news = NewsRiskEngine.evaluate_news_risk("RELIANCE", db_session)
    assert news is not None
    assert news["symbol"] == "RELIANCE"
    assert news["verdict"] in ["CLEAR_TO_TRADE", "CAUTION_EVENT_AHEAD", "BLOCKED_HIGH_RISK"]


def test_live_breakout_and_entry_quality(sample_ohlcv, db_session):
    # Pass lower pivot so it triggers a breakout
    sig = LiveBreakoutEngine.evaluate_live_breakout("TESTBRK", sample_ohlcv, pivot_price=105.0)
    assert sig is not None
    assert sig["entry_price"] > 0
    assert sig["stop_loss"] < sig["entry_price"]
    assert sig["target_1"] > sig["entry_price"]
    assert sig["target_2"] > sig["target_1"]
    assert sig["ai_verdict"] in ["ELITE A+", "ELITE A", "ELITE B+", "WATCHLIST"]
    assert "entry_quality" in sig

    persisted = LiveBreakoutEngine.persist_and_broadcast_signal(db_session, sig)
    assert persisted.id is not None


def test_trade_management_lifecycle(db_session):
    trade = TradeManagementEngine.create_trade(
        db_session,
        symbol="TESTTRADE",
        entry_price=100.0,
        stop_loss=95.0,
        target_1=110.0,
        target_2=120.0,
        target_3=135.0,
    )
    assert trade.trade_status == "ACTIVE"

    # Simulate price reaching target 1
    updates = TradeManagementEngine.update_active_trades(db_session, {"TESTTRADE": 112.0})
    assert len(updates) > 0
    assert trade.target_1_hit is True
    assert trade.trade_status == "TARGET_1_HIT"
    assert trade.trailing_stop >= 100.0  # Moved to breakeven


def test_btst_continuation_engine(sample_ohlcv, db_session):
    # Simulate bar closing near the high
    sample_ohlcv.iloc[-1, sample_ohlcv.columns.get_loc("Close")] = sample_ohlcv["High"].iloc[-1]
    btst = BTSTContinuationEngine.scan_evening_btst("TESTBTST", sample_ohlcv, delivery_pct=62.0)
    if btst:
        assert btst["symbol"] == "TESTBTST"
        assert btst["btst_confidence"] > 50.0
        count = BTSTContinuationEngine.batch_upsert_btst(db_session, [btst])
        assert count == 1


def test_ai_confidence_engine(db_session):
    scores = {
        "market_score": 85.0,
        "compression_score": 90.0,
        "base_quality": 95.0,
        "institution_score": 88.0,
        "rs_score": 92.0,
        "sector_score": 85.0,
        "smart_money_score": 80.0,
        "liquidity_score": 90.0,
        "news_score": 90.0,
    }
    conf = AIConfidenceEngine.compute_composite_confidence(db_session, scores)
    assert conf["confidence_score"] >= 85.0
    assert conf["ai_verdict"] in ["ELITE A+", "ELITE A"]
    assert "ai_explanation" in conf

    history_row = AIConfidenceEngine.record_signal_history(
        db=db_session,
        symbol="TESTHIST",
        entry_price=250.0,
        stop_loss=240.0,
        target_price=280.0,
        confidence_payload=conf,
    )
    assert history_row.id is not None


def test_alert_intelligence_and_deduplication(db_session):
    import time
    sym = f"TALT_{int(time.time() * 1000) % 1000000}"
    alert1 = AlertIntelligenceEngine.dispatch_vbe_alert(
        db=db_session,
        symbol=sym,
        alert_type="BREAKOUT",
        title="Test Breakout",
        message="Breakout detected at pivot",
        cooldown_hours=12,
    )
    assert alert1 is not None

    # Immediate second call with same symbol and alert_type should be safely deduplicated
    alert2 = AlertIntelligenceEngine.dispatch_vbe_alert(
        db=db_session,
        symbol=sym,
        alert_type="BREAKOUT",
        title="Test Breakout Duplicate",
        message="Should be suppressed",
        cooldown_hours=12,
    )
    assert alert2 is None


def test_historical_learning_and_backtest(db_session):
    sim = HistoricalLearningEngine.run_backtest_simulation(db_session, years=5)
    assert sim["total_trades"] > 0
    assert sim["win_rate_pct"] > 60.0
    assert sim["profit_factor"] > 1.5

    learning = HistoricalLearningEngine.run_monthly_learning_job(db_session)
    assert "optimal_weights" in learning
    assert learning["overall_win_rate"] > 60.0


def test_fastapi_velocity_endpoints(client):
    # 1. Status
    res = client.get("/api/v4/velocity/status")
    assert res.status_code == 200
    data = res.json()
    assert data["engine_name"] == "Velocity Burst Elite"
    assert "market_score" in data
    assert "stocks_scanned" in data

    # 2. Market Regime
    res = client.get("/api/v4/velocity/market-regime")
    assert res.status_code == 200
    assert "market_score" in res.json()

    # 3. Sleeping Giants
    res = client.get("/api/v4/velocity/sleeping-giants?page=1&limit=10")
    assert res.status_code == 200
    assert "items" in res.json()

    # 4. Patterns
    res = client.get("/api/v4/velocity/patterns?page=1&limit=10")
    assert res.status_code == 200

    # 5. Sector
    res = client.get("/api/v4/velocity/sector")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # 6. Backtest
    res = client.get("/api/v4/velocity/backtest")
    assert res.status_code == 200

    # 7. Velocity Stage Funnel & Attrition Waterfall
    res = client.get("/api/v4/velocity/funnel")
    assert res.status_code == 200
    funnel = res.json()
    assert "summary" in funnel
    assert "sequential_waterfall" in funnel
    assert "independent_gates" in funnel
    assert len(funnel["sequential_waterfall"]) >= 10
    assert "filtered_out_count" in funnel["sequential_waterfall"][1]
    assert "attrition_pct" in funnel["sequential_waterfall"][1]

    # 8. Momentum Screener Stage Funnel
    res_mom = client.get("/momentum-screener/funnel")
    assert res_mom.status_code == 200
    mom_funnel = res_mom.json()
    assert "stage_funnel" in mom_funnel
    assert "sequential_waterfall" in mom_funnel["stage_funnel"]
    assert "independent_conditions" in mom_funnel["stage_funnel"]
    assert len(mom_funnel["stage_funnel"]["sequential_waterfall"]) >= 10

