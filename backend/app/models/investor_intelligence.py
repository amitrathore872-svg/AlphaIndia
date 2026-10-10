"""
Alpha India — Investor Intelligence & Senior Analyst Concall/Presentation Models
Stores Investor Presentations, Concall Transcripts/Notes, and deep institutional LLM insights.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class InvestorDocument(Base):
    __tablename__ = "investor_documents"
    __table_args__ = (
        Index("idx_inv_doc_sym_period_type", "symbol", "fiscal_period", "doc_type"),
        Index("idx_inv_doc_status", "status"),
        Index("idx_inv_doc_date", "announcement_date"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Identifiers & Linking
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    exchange = Column(String(20), default="NSE", index=True)  # NSE, BSE, SCREENER

    # Document Classification
    doc_type = Column(String(50), nullable=False, index=True)  # INVESTOR_PRESENTATION, CONCALL_TRANSCRIPT, CONCALL_NOTES
    fiscal_period = Column(String(30), nullable=True, index=True)  # e.g., Q3 FY26, Q4 FY26, FY26 Annual
    announcement_date = Column(Date, nullable=True, index=True)
    headline = Column(Text, nullable=True)

    # Links & Local Artifacts
    source_url = Column(Text, nullable=True)
    pdf_url = Column(Text, nullable=True)
    pdf_local_path = Column(Text, nullable=True)

    # Parsed Content & Text Segmentation
    raw_text_length = Column(Integer, default=0)
    parsed_text = Column(Text, nullable=True)
    management_speech_text = Column(Text, nullable=True)  # Extracted opening management remarks
    analyst_qa_text = Column(Text, nullable=True)         # Extracted analyst Q&A session

    # Processing State
    status = Column(String(30), default="PENDING", index=True)  # PENDING, DOWNLOADED, EXTRACTED, ANALYZED, FAILED
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    company = relationship("Company")
    insights = relationship(
        "InvestorIntelligenceInsight",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="desc(InvestorIntelligenceInsight.id)",
    )


class InvestorIntelligenceInsight(Base):
    __tablename__ = "investor_intelligence_insights"
    __table_args__ = (
        Index("idx_inv_ins_sym_period", "symbol", "fiscal_period"),
        Index("idx_inv_ins_stance", "institutional_stance"),
        Index("idx_inv_ins_score", "growth_conviction_score"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Linkages
    document_id = Column(Integer, ForeignKey("investor_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    fiscal_period = Column(String(30), nullable=True, index=True)
    doc_type = Column(String(50), nullable=False, index=True)

    # -------------------------------------------------------------------------
    # Core Senior Buy-Side Stance & Verdict
    # -------------------------------------------------------------------------
    institutional_stance = Column(
        String(50),
        default="NEUTRAL",
        index=True,
    )  # STRONG_GROWTH_LEADER, ACCUMULATE_ON_DIPS, STEADY_COMPOUNDER, TURNAROUND_CANDIDATE, CYCLICAL_PEAK, AVOID_OR_HEADWINDS
    growth_conviction_score = Column(Float, default=50.0, index=True)  # 0 to 100
    management_sentiment_score = Column(Float, default=0.0)             # -10.0 to +10.0
    management_credibility_rating = Column(String(30), default="MEDIUM") # HIGH, MEDIUM, LOW, PROMOTIONAL
    management_tone = Column(String(50), default="NEUTRAL")              # VERY_BULLISH, PRAGMATIC_BULLISH, NEUTRAL, CAUTIOUS, DEFENSIVE
    executive_thesis = Column(Text, nullable=True)                       # 3-4 sentence institutional buy-side thesis

    # -------------------------------------------------------------------------
    # Pillar 1: Operating Leverage & CWIP Commissioning
    # -------------------------------------------------------------------------
    capacity_utilization_pct = Column(Float, nullable=True)
    cwip_amount_cr = Column(Float, nullable=True)
    capex_guidance_fy = Column(Text, nullable=True)
    commissioning_timeline_cod = Column(Text, nullable=True)
    expected_asset_turnover = Column(String(100), nullable=True)
    volume_vs_price_driver = Column(String(100), nullable=True)

    # -------------------------------------------------------------------------
    # Pillar 2: Margins & Pricing Power
    # -------------------------------------------------------------------------
    ebitda_margin_guidance_corridor = Column(String(100), nullable=True)
    margin_drivers = Column(Text, nullable=True)
    input_cost_pass_through = Column(Text, nullable=True)
    value_added_mix_pct = Column(Float, nullable=True)

    # -------------------------------------------------------------------------
    # Pillar 3: Order Book & Execution Runway
    # -------------------------------------------------------------------------
    executable_order_book_cr = Column(Float, nullable=True)
    book_to_bill_ratio = Column(Float, nullable=True)
    bid_pipeline_cr = Column(Float, nullable=True)
    execution_duration_months = Column(Integer, nullable=True)

    # -------------------------------------------------------------------------
    # Pillar 4: Balance Sheet Health & Cash Flow Quality
    # -------------------------------------------------------------------------
    ocf_to_ebitda_ratio_pct = Column(Float, nullable=True)
    working_capital_days = Column(Integer, nullable=True)
    working_capital_trend = Column(String(50), nullable=True)  # CONTRACTING, STABLE, EXPANDING, STRAINED
    debt_outlook = Column(Text, nullable=True)

    # -------------------------------------------------------------------------
    # Pillar 5: Analyst Grill & Concall Q&A Drilldown
    # -------------------------------------------------------------------------
    key_overhang_questioned_by_analysts = Column(Text, nullable=True)
    management_direct_answer = Column(Text, nullable=True)
    evasiveness_detected = Column(Text, nullable=True)
    guidance_change = Column(String(50), nullable=True)  # UPWARD_REVISION, MAINTAINED, DOWNWARD_REVISION, WITHDRAWN

    # Phase 2: Forensic Evasiveness & Analyst Tension Scoring Engine
    evasiveness_score = Column(Float, default=0.0)             # 0.0 to 10.0 (0=Candid/Numeric, 10=Max Deflection)
    analyst_tension_score = Column(Float, default=3.0)         # 1.0 to 10.0 (1=Cordial, 10=Aggressive Grill)
    hot_seat_question = Column(Text, nullable=True)            # The toughest pushback question
    management_defense_strategy = Column(String(100), nullable=True) # MACRO_EXTERNAL_BLAME, DATA_DRIVEN_TRANSPARENT, etc.
    forensic_discrepancies = Column(JSON, nullable=True)       # Cross-verification discrepancies with P&L / Balance Sheet

    # -------------------------------------------------------------------------
    # Plain English / Layman & Direct Quote Intelligence
    # -------------------------------------------------------------------------
    layman_summary = Column(Text, nullable=True)        # 3-4 bullet plain English breakdown for everyday investors
    direct_quotes = Column(JSON, nullable=True)         # List of exact executive quotes with speaker & context
    analyst_grill_quotes = Column(JSON, nullable=True)  # List of exact analyst grill Q&A exchanges
    actionable_gameplan = Column(JSON, nullable=True)   # Actionable investor pointer (Verdict, Action, Key Trigger, Watch Date)

    # -------------------------------------------------------------------------
    # Exponential / Transformational Growth Catalyst Radar (10x Triggers)
    # -------------------------------------------------------------------------
    is_transformational_catalyst = Column(Boolean, default=False, index=True)
    transformational_category = Column(String(80), nullable=True, index=True)
    catalyst_headline = Column(Text, nullable=True)
    immediate_reaction_rationale = Column(Text, nullable=True)
    exponential_growth_multiple = Column(String(100), nullable=True)

    # -------------------------------------------------------------------------
    # Pillar 6: Critical Monitorables, Headwinds & Full Synthesis
    # -------------------------------------------------------------------------
    critical_monitorables = Column(JSON, nullable=True)  # List of strings
    raw_analyst_payload = Column(JSON, nullable=True)    # Complete structured JSON from LLM
    llm_model = Column(String(50), default="gemini-1.5-flash")
    analyzed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    document = relationship("InvestorDocument", back_populates="insights")
    company = relationship("Company")
