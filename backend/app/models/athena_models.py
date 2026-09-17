"""
ATHENA OMEGA v3.0 — Database Models
Official Sprint 24
Models for 5-Gate Institutional Earnings Intelligence Engine:
- AthenaOmegaFiling (Filing metadata & SLA queue tracking)
- AthenaQuarterlyMetrics (120+ metrics structured storage)
- AthenaShockAnalysis (Gate 1: 200-Point Business Shock Engine breakdown)
- AthenaQualityAnalysis (Gate 2: Forensic Earnings Quality Engine)
- AthenaValuationRisk (Gate 3: Valuation & Solvency Risk Engine)
- AthenaConvictionFlash (Gate 4 & 5: ATHENA Conviction & FLASH Decision Cards)
"""

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class AthenaOmegaFiling(Base):
    """
    Filing queue & SLA tracking for incoming quarterly disclosures from NSE/BSE.
    """
    __tablename__ = "athena_omega_filings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)
    company_name = Column(String(200), nullable=True)
    exchange = Column(String(20), default="NSE", index=True)  # NSE, BSE
    filing_type = Column(String(150), nullable=True)  # Outcome of Board Meeting, Financial Results
    fiscal_period = Column(String(30), nullable=False, index=True)  # Q1 FY26, Q3 FY25
    period_end = Column(Date, nullable=True)
    pdf_url = Column(String, nullable=True)
    pdf_local_path = Column(String, nullable=True)

    # SLA Timers & Status
    priority = Column(String(20), default="AAA+", index=True)  # AAA+, AAA, AA, ARCHIVE
    status = Column(String(30), default="DETECTED", index=True)
    # DETECTED -> DOWNLOADING -> PARSING -> FUSING -> G1_SHOCK -> G2_QUALITY -> G3_VALUATION -> FLASH_PUBLISHED -> FAILED

    processing_time_sec = Column(Float, default=0.0)
    sla_met = Column(Boolean, default=True)

    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    parsed_at = Column(DateTime, nullable=True)
    analyzed_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)

    # Relationships
    metrics = relationship("AthenaQuarterlyMetrics", back_populates="filing", uselist=False, cascade="all, delete-orphan")
    shock_analysis = relationship("AthenaShockAnalysis", back_populates="filing", uselist=False, cascade="all, delete-orphan")
    quality_analysis = relationship("AthenaQualityAnalysis", back_populates="filing", uselist=False, cascade="all, delete-orphan")
    valuation_risk = relationship("AthenaValuationRisk", back_populates="filing", uselist=False, cascade="all, delete-orphan")
    flash_decision = relationship("AthenaConvictionFlash", back_populates="filing", uselist=False, cascade="all, delete-orphan")


class AthenaQuarterlyMetrics(Base):
    """
    Structured 120+ metrics extracted from the quarterly filing and fused with local history.
    """
    __tablename__ = "athena_quarterly_metrics"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("athena_omega_filings.id"), nullable=False, unique=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)
    fiscal_period = Column(String(30), nullable=False)

    # Income Statement Metrics (₹ Crore)
    revenue = Column(Float, nullable=True)
    revenue_growth_yoy = Column(Float, nullable=True)
    revenue_growth_qoq = Column(Float, nullable=True)
    operating_profit = Column(Float, nullable=True)  # EBITDA
    ebitda_margin_pct = Column(Float, nullable=True)
    ebitda_margin_change_bps = Column(Float, nullable=True)
    ebit = Column(Float, nullable=True)
    pbt = Column(Float, nullable=True)
    pat = Column(Float, nullable=True)  # Net Profit
    pat_growth_yoy = Column(Float, nullable=True)
    pat_growth_qoq = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    eps_growth_yoy = Column(Float, nullable=True)
    other_income = Column(Float, nullable=True)
    interest_expense = Column(Float, nullable=True)
    depreciation = Column(Float, nullable=True)
    effective_tax_rate_pct = Column(Float, nullable=True)

    # Balance Sheet & Solvency
    total_debt = Column(Float, nullable=True)
    cash_and_equivalents = Column(Float, nullable=True)
    net_debt = Column(Float, nullable=True)
    total_equity = Column(Float, nullable=True)
    debt_to_equity = Column(Float, nullable=True)
    interest_coverage = Column(Float, nullable=True)

    # Cash Flows & Working Capital
    operating_cash_flow = Column(Float, nullable=True)  # CFO
    free_cash_flow = Column(Float, nullable=True)  # FCF
    cfo_to_pat_ratio = Column(Float, nullable=True)
    cfo_to_ebitda_ratio = Column(Float, nullable=True)
    debtor_days = Column(Float, nullable=True)
    inventory_days = Column(Float, nullable=True)
    cash_conversion_cycle = Column(Float, nullable=True)

    # Operating Efficiency & Order Book
    roce = Column(Float, nullable=True)
    roe = Column(Float, nullable=True)
    order_book_cr = Column(Float, nullable=True)
    order_inflow_growth_pct = Column(Float, nullable=True)
    book_to_bill_ratio = Column(Float, nullable=True)

    # Raw 120+ metric dictionary for granular inspection
    granular_metrics_json = Column(JSON, nullable=True)

    filing = relationship("AthenaOmegaFiling", back_populates="metrics")


class AthenaShockAnalysis(Base):
    """
    Gate 1: 200-Point Business Shock Engine evaluation breakdown.
    """
    __tablename__ = "athena_shock_analyses"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("athena_omega_filings.id"), nullable=False, unique=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)

    # 8 Sub-Engine Scores (Total 200 Points)
    revenue_acceleration_pts = Column(Float, default=0.0)  # Max 30
    ebitda_margin_expansion_pts = Column(Float, default=0.0)  # Max 30
    earnings_power_pat_pts = Column(Float, default=0.0)  # Max 30
    cash_flow_conversion_pts = Column(Float, default=0.0)  # Max 25
    order_book_visibility_pts = Column(Float, default=0.0)  # Max 25
    capital_efficiency_roce_pts = Column(Float, default=0.0)  # Max 25
    balance_sheet_deleveraging_pts = Column(Float, default=0.0)  # Max 20
    working_capital_momentum_pts = Column(Float, default=0.0)  # Max 15

    raw_shock_score_200 = Column(Float, default=0.0)  # 0 - 200
    normalized_shock_score = Column(Float, default=0.0)  # 0 - 100

    shock_tier = Column(String(20), default="ARCHIVE")  # CRITICAL (90-100), HIGH (80-89), MEDIUM (70-79), ARCHIVE (<70)
    shock_action = Column(String(50), default="ARCHIVE_ONLY")
    primary_catalyst_driver = Column(String(100), nullable=True)  # e.g., "Triple-Digit PAT Breakout + Margin Surge"
    shock_details_json = Column(JSON, nullable=True)

    filing = relationship("AthenaOmegaFiling", back_populates="shock_analysis")


class AthenaQualityAnalysis(Base):
    """
    Gate 2: Forensic Earnings Quality Engine.
    """
    __tablename__ = "athena_quality_analyses"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("athena_omega_filings.id"), nullable=False, unique=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)

    quality_score = Column(Float, default=0.0)  # 0 - 100
    quality_grade = Column(String(30), default="MIXED")  # GENUINE (90+), MOSTLY_CLEAN (80-90), MIXED (70-80), CONCERN (<70)

    # Forensic Verification Checks
    operating_vs_other_income_pass = Column(Boolean, default=True)
    other_income_pct_of_pbt = Column(Float, default=0.0)

    cash_backed_earnings_pass = Column(Boolean, default=True)  # CFO >= 0.7 * PAT
    cfo_pat_variance_pct = Column(Float, default=0.0)

    tax_benefit_anomaly_detected = Column(Boolean, default=False)
    asset_sale_one_time_detected = Column(Boolean, default=False)
    inventory_demand_divergence_flag = Column(Boolean, default=False)
    working_capital_stress_flag = Column(Boolean, default=False)

    piotroski_f_score = Column(Float, default=0.0)  # 0 to 9
    forensic_flags_count = Column(Integer, default=0)
    forensic_details_json = Column(JSON, nullable=True)

    filing = relationship("AthenaOmegaFiling", back_populates="quality_analysis")


class AthenaValuationRisk(Base):
    """
    Gate 3: Valuation & Solvency Risk Engine.
    """
    __tablename__ = "athena_valuation_risks"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("athena_omega_filings.id"), nullable=False, unique=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)

    current_price = Column(Float, nullable=True)
    ttm_eps_post_result = Column(Float, nullable=True)
    post_result_pe = Column(Float, nullable=True)
    industry_pe = Column(Float, nullable=True)
    pe_discount_to_industry_pct = Column(Float, nullable=True)
    peg_ratio = Column(Float, nullable=True)
    ev_to_ebitda = Column(Float, nullable=True)

    estimated_fair_value = Column(Float, nullable=True)  # ₹
    upside_potential_pct = Column(Float, nullable=True)  # %

    valuation_score = Column(Float, default=50.0)  # 0 - 100
    risk_score = Column(Float, default=30.0)  # 0 - 100 (Lower is safer)
    risk_level = Column(String(20), default="LOW")  # LOW, MODERATE, HIGH, EXTREME

    risk_penalties_applied = Column(Float, default=0.0)
    valuation_details_json = Column(JSON, nullable=True)

    filing = relationship("AthenaOmegaFiling", back_populates="valuation_risk")


class AthenaConvictionFlash(Base):
    """
    Gate 4 & 5: ATHENA Conviction Engine & FLASH Decision Output.
    """
    __tablename__ = "athena_conviction_flashes"

    id = Column(Integer, primary_key=True, index=True)
    filing_id = Column(Integer, ForeignKey("athena_omega_filings.id"), nullable=False, unique=True, index=True)
    symbol = Column(String(30), index=True, nullable=False)
    company_name = Column(String(200), nullable=True)

    # Conviction & Grade
    athena_conviction_score = Column(Float, default=0.0)  # 0 - 100
    conviction_grade = Column(String(20), default="A", index=True)  # AAA+, AAA, AA, A, BELOW_A
    confidence_pct = Column(Float, default=85.0)  # 80 - 99%
    growth_category = Column(String(50), default="High Growth Breakout")  # High Growth Breakout, Turnaround, Value Compounder

    # FLASH Decision Action
    flash_signal = Column(String(50), default="WATCHLIST", index=True)
    # BUY IMMEDIATELY, STRONG BUY, ACCUMULATE, WATCHLIST, AVOID

    # Expected Statistical Price Reactions
    expected_gap_up_min = Column(Float, default=0.0)
    expected_gap_up_max = Column(Float, default=0.0)

    expected_1d_move_min = Column(Float, default=0.0)
    expected_1d_move_max = Column(Float, default=0.0)

    expected_1w_move_min = Column(Float, default=0.0)
    expected_1w_move_max = Column(Float, default=0.0)

    expected_1m_move_min = Column(Float, default=0.0)
    expected_1m_move_max = Column(Float, default=0.0)

    # Component Scores
    financial_shock_score = Column(Float, default=0.0)
    earnings_quality_score = Column(Float, default=0.0)
    valuation_opportunity_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="LOW")

    ai_investment_summary = Column(Text, nullable=True)
    key_drivers = Column(JSON, nullable=True)

    is_published = Column(Boolean, default=True, index=True)
    published_at = Column(DateTime, default=datetime.utcnow, index=True)

    filing = relationship("AthenaOmegaFiling", back_populates="flash_decision")
