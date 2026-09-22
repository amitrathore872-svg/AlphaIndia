from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, Index, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class AnnouncementRadar(Base):
    __tablename__ = "announcements_radar"

    id = Column(Integer, primary_key=True, index=True)

    # Identifiers
    symbol = Column(String(50), nullable=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    is_listed = Column(Boolean, default=True, index=True)

    # Announcement details
    category = Column(String(100), nullable=True, index=True)   # Raw category from exchange/Screener
    headline = Column(Text, nullable=False)                      # Filing title / subject
    filing_description = Column(Text, nullable=True)             # Additional filing summary / details

    # Catalyst & AI Growth Insights
    catalyst_type = Column(String(50), nullable=False, index=True)  # CAPEX_COMMISSIONING, ORDER_WIN, USFDA_REGULATORY, DELEVERAGING, DEMERGER_UNLOCK, GENERAL
    impact_level = Column(String(20), nullable=False, index=True)   # CRITICAL, HIGH, MEDIUM, NOISE
    impact_score = Column(Float, default=5.0)                       # 1.0 to 10.0
    ai_insight = Column(Text, nullable=True)                        # 2-line financial growth takeaway
    deal_value_cr = Column(Float, nullable=True)                    # Order / deal size in ₹ Cr (if extracted)

    # Financial Synergy Metrics (Real-time Cross-reference)
    synergy_cwip_cr = Column(Float, nullable=True)                  # Estimated CWIP converted into assets (₹ Cr)
    synergy_rev_addition_cr = Column(Float, nullable=True)          # Estimated Annual Revenue Addition (₹ Cr)
    synergy_rev_pct_ttm = Column(Float, nullable=True)              # Deal/Capex addition as % of TTM Sales
    synergy_ebitda_addition_cr = Column(Float, nullable=True)       # Estimated Incremental EBITDA (₹ Cr)
    synergy_ebitda_margin_pct = Column(Float, nullable=True)        # Assumed or historical EBITDA margin %
    synergy_interest_saved_cr = Column(Float, nullable=True)        # Annual interest saved via deleveraging (₹ Cr)
    synergy_pat_accretion_pct = Column(Float, nullable=True)        # Estimated instant PAT accretion %

    # Market Reaction & Momentum
    post_catalyst_return_1w = Column(Float, nullable=True)          # 1-week price return since announcement
    momentum_status = Column(String(30), default="EARLY")           # EARLY | ACCUMULATING | PRICED_IN

    # Buy Conviction & Valuation Bridge
    recommendation = Column(String(30), default="TACTICAL_BUY", index=True)  # STRONG_BUY | TACTICAL_BUY | ACCUMULATE | PRICED_IN
    conviction_score = Column(Float, default=80.0)                           # 0 to 100%
    current_price = Column(Float, nullable=True)                             # Current Market Price (CMP in ₹)
    target_price = Column(Float, nullable=True)                              # Calculated Target Price (₹)
    upside_pct = Column(Float, nullable=True)                                # Expected Upside %
    stop_loss = Column(Float, nullable=True)                                 # Risk guardrail Stop Loss (₹)
    current_eps = Column(Float, nullable=True)                               # TTM EPS (₹)
    forward_eps = Column(Float, nullable=True)                               # Projected Forward FY27 EPS (₹)
    valuation_pe = Column(Float, nullable=True)                              # Current P/E multiple
    fair_pe = Column(Float, nullable=True)                                   # 5-Year Median / Fair P/E multiple
    buy_thesis = Column(Text, nullable=True)                                 # Institutional Buy Thesis

    # Links & Sources
    source_url = Column(String(500), nullable=True)                 # Link to Screener.in or filing page
    pdf_url = Column(String(500), nullable=True)                    # Direct link to official PDF attachment

    # Timing, Dates & Real-Time Tracking
    announcement_date = Column(DateTime(timezone=True), nullable=True, index=True)   # Exact filing/quarter release timestamp
    recommendation_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True) # Recommendation generation timestamp
    published_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Vertical & Archetype Classification
    vertical_archetype = Column(String(80), nullable=True, index=True) # EARNINGS_ACCELERATION, BASE_BREAKOUT, INSTITUTIONAL_CONSENSUS, OPERATING_LEVERAGE, TURNAROUND_INFLECTION, EXCHANGE_CATALYST
    trend_regime = Column(String(40), default="GOLDEN_TREND", index=True) # GOLDEN_TREND, EARLY_BREAKOUT, CONSOLIDATING, DOWNTREND_TRAP
    est_velocity_days = Column(String(80), nullable=True) # e.g. "15–35 Days (PEAD Drift)"

    # Post-Announcement Absorption & Price Realism
    price_at_announcement = Column(Float, nullable=True)  # P0: Market price on announcement date
    realized_move_pct = Column(Float, nullable=True)      # % move since announcement: (CMP - P0)/P0 * 100
    absorption_status = Column(String(40), default="FRESH_TRIGGER", index=True) # FRESH_TRIGGER, IN_EXPANSION, PRICED_IN, STOPPED_OUT
    dma_50 = Column(Float, nullable=True)
    dma_200 = Column(Float, nullable=True)

    # Order Win Quantitative Intelligence (Sprint 36.5)
    order_execution_months = Column(Integer, nullable=True)                  # Realization timeline in months (e.g. 18)
    order_quarterly_rev_cr = Column(Float, nullable=True)                    # Incremental Quarterly Revenue (₹ Cr)
    order_quarterly_rev_pct = Column(Float, nullable=True)                   # Quarterly Revenue Lift % vs Avg Quarterly Sales
    order_earnings_impact_cr = Column(Float, nullable=True)                  # Incremental Annualized PAT (₹ Cr)
    order_significance_score = Column(Float, nullable=True, index=True)      # 0 to 100 Multi-factor Quant Score
    order_significance_tier = Column(String(40), nullable=True, index=True)  # TRANSFORMATIONAL | HIGH_IMPACT | MODERATE | ROUTINE
    order_upside_prob_pct = Column(Float, nullable=True)                     # AI Upside Probability % (e.g. 82.5%)
    order_target_price_low = Column(Float, nullable=True)                    # Conservative Target Price (₹)
    order_target_price_high = Column(Float, nullable=True)                   # Bull Case Target Price (₹)
    order_confidence_score = Column(Float, nullable=True)                    # Model Confidence % (e.g. 94.0%)
    order_client_counterparty = Column(String(255), nullable=True)           # Client / Agency (e.g. AP TRANSCO, ONGC)
    order_historical_comparison = Column(Text, nullable=True)                # Historical comparison vs previous orders
    order_intelligence = Column(JSON, nullable=True)                         # Detailed structured calculation payload

    __table_args__ = (
        Index("ix_announcements_radar_symbol_pub", "symbol", "published_at"),
        Index("ix_announcements_radar_catalyst_score", "catalyst_type", "impact_score"),
        Index("ix_announcements_radar_vertical_regime", "vertical_archetype", "trend_regime"),
        Index("ix_announcements_radar_order_sig", "catalyst_type", "order_significance_score"),
    )
