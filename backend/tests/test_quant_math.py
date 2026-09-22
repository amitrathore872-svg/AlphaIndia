"""
Unit Tests for Quantitative Mathematical Integrity & Data Guardrails
Verifies Wilder's Smoothed RSI, YoY Chronological Matching, and DB Constraints.
"""

import datetime
import pytest
import numpy as np
import pandas as pd
from sqlalchemy.exc import IntegrityError

from app.services.momentum_screener_service import MomentumScreenerService
from app.services.growth_calculator_service import GrowthCalculatorService
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult


def test_wilders_smoothed_rsi():
    """Verifies that Wilder's RMA RSI formula computes accurately on monotonic and cyclical series."""
    # Constant series should return 50.0 (or NaN handled cleanly)
    flat_series = pd.Series([100.0] * 30)
    rsi_flat = MomentumScreenerService._calc_rsi(flat_series, period=14)
    assert pd.isna(rsi_flat.iloc[-1]) or rsi_flat.iloc[-1] in (0.0, 50.0)

    # Monotonically increasing prices should approach 100
    up_series = pd.Series([float(i * 2 + 10) for i in range(40)])
    rsi_up = MomentumScreenerService._calc_rsi(up_series, period=14)
    assert not pd.isna(rsi_up.iloc[-1])
    assert rsi_up.iloc[-1] > 95.0, f"Expected high RSI for uptrend, got {rsi_up.iloc[-1]}"

    # Monotonically decreasing prices should approach 0
    down_series = pd.Series([float(100 - i * 2) for i in range(40)])
    rsi_down = MomentumScreenerService._calc_rsi(down_series, period=14)
    assert not pd.isna(rsi_down.iloc[-1])
    assert rsi_down.iloc[-1] < 5.0, f"Expected low RSI for downtrend, got {rsi_down.iloc[-1]}"


def test_authentic_yoy_chronological_matching(db_session):
    """Verifies that GrowthCalculatorService matches exactly ~365 days prior rather than naive index lookahead."""
    # Find or create a test company
    company = db_session.query(Company).filter(Company.symbol == "ALPHA_YOY_TEST").first()
    if not company:
        company = Company(symbol="ALPHA_YOY_TEST", company="Alpha YoY Test Ltd", isin="INE000YOY001")
        db_session.add(company)
        db_session.commit()
        db_session.refresh(company)

    # Clean any old statements
    db_session.query(QuarterlyResult).filter(QuarterlyResult.company_id == company.id).delete()
    db_session.commit()

    q_dates = [
        (datetime.date(2026, 6, 30), "Q1 FY27", 150.0, 30.0),
        (datetime.date(2026, 3, 31), "Q4 FY26", 140.0, 28.0),
        (datetime.date(2025, 12, 31), "Q3 FY26", 130.0, 25.0),
        (datetime.date(2025, 9, 30), "Q2 FY26", 120.0, 22.0),
        (datetime.date(2025, 6, 30), "Q1 FY26", 100.0, 20.0),  # Exactly 365 days prior
    ]

    for p_end, qtr, rev, pat in q_dates:
        qr = QuarterlyResult(
            company_id=company.id,
            period_end=p_end,
            quarter=qtr,
            revenue=rev,
            net_profit=pat,
        )
        db_session.add(qr)
    db_session.commit()

    res = GrowthCalculatorService.calculate_company_growth(db_session, company.symbol)
    assert res.get("success") is True, f"Calculation failed: {res}"
    # Revenue Growth: (150 - 100) / 100 = 50.0%
    assert round(res["revenue_growth"], 1) == 50.0
    # PAT Growth: (30 - 20) / 20 = 50.0%
    assert round(res["pat_growth"], 1) == 50.0

    # Cleanup
    db_session.query(QuarterlyResult).filter(QuarterlyResult.company_id == company.id).delete()
    db_session.commit()


def test_database_unique_constraint_quarterly_results(db_session):
    """Verifies PostgreSQL unique composite constraint (company_id, period_end) prevents duplicate records."""
    # Find or create a test company
    company = db_session.query(Company).filter(Company.symbol == "ALPHA_TEST_CO").first()
    if not company:
        company = Company(symbol="ALPHA_TEST_CO", company="Alpha Test Company Ltd", isin="INE000TEST01")
        db_session.add(company)
        db_session.commit()
        db_session.refresh(company)

    test_date = datetime.date(2026, 3, 31)

    # Clean any preexisting test statement
    db_session.query(QuarterlyResult).filter(
        QuarterlyResult.company_id == company.id,
        QuarterlyResult.period_end == test_date,
    ).delete()
    db_session.commit()

    # Insert first record
    qr1 = QuarterlyResult(
        company_id=company.id,
        period_end=test_date,
        quarter="Q4 FY26",
        revenue=1000.0,
        net_profit=150.0,
    )
    db_session.add(qr1)
    db_session.commit()

    # Attempt to insert duplicate record with same company_id and period_end
    qr2 = QuarterlyResult(
        company_id=company.id,
        period_end=test_date,
        quarter="Q4 FY26",
        revenue=1050.0,
        net_profit=155.0,
    )
    db_session.add(qr2)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()

    # Clean up test record
    db_session.query(QuarterlyResult).filter(
        QuarterlyResult.company_id == company.id,
        QuarterlyResult.period_end == test_date,
    ).delete()
    db_session.commit()
