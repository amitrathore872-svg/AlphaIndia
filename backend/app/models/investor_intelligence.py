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

    # Detailed Stage Tracking & Content Identity
    financial_year = Column(Integer, nullable=True, index=True)  # e.g., 2027 for FY27
    financial_quarter = Column(Integer, nullable=True, index=True)  # 1, 2, 3, 4
    content_hash = Column(String(64), nullable=True, index=True)
    download_status = Column(String(30), default="PENDING", index=True)  # PENDING, DOWNLOADED, FAILED
    extraction_status = Column(String(30), default="PENDING", index=True)  # PENDING, EXTRACTED, FAILED
    ai_analysis_status = Column(String(30), default="PENDING", index=True)  # PENDING, IN_PROGRESS, ANALYZED, FAILED
    analysis_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)

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
    commitments = relationship(
        "ManagementCommitment",
        foreign_keys="ManagementCommitment.document_id",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="desc(ManagementCommitment.id)",
    )


class InvestorIntelligenceInsight(Base):
    __tablename__ = "investor_intelligence_insights"
    __table_args__ = (
        Index("idx_inv_ins_sym_period", "symbol", "fiscal_period"),
        Index("idx_inv_ins_stance", "institutional_stance"),
        Index("idx_inv_ins_score", "growth_conviction_score"),
        Index("idx_inv_ins_thesis_impact", "thesis_impact"),
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

    # Investment Thesis Impact & Evidence
    thesis_impact = Column(String(30), default="NEUTRAL", index=True)  # STRENGTHENING, NEUTRAL, WEAKENING
    positive_developments = Column(JSON, nullable=True)  # List of major positive developments
    negative_developments = Column(JSON, nullable=True)  # List of major negative developments / headwinds
    guidance_changes = Column(JSON, nullable=True)  # Guidance changes from previous quarter
    growth_implications = Column(Text, nullable=True)  # Revenue and earnings growth implications
    thesis_evidence = Column(JSON, nullable=True)  # Supporting evidence, contradictory evidence, freshness limitations

    # Quarter-over-Quarter Comparison & Operational KPIs
    qoq_comparison = Column(JSON, nullable=True)  # New, reaffirmed, revised, delayed, withdrawn commitments, resolved risks
    operational_kpis = Column(JSON, nullable=True)  # Segment performance, volume/utilization, working capital/debt

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
    llm_model = Column(String(50), default="alpha-forensic-nlp-engine")
    analyzed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    document = relationship("InvestorDocument", back_populates="insights")
    company = relationship("Company")


class ManagementCommitment(Base):
    """
    Quarter-by-quarter management commitment and forward guidance tracking ledger.
    Tracks numerical targets, capex deadlines, capacity additions, and qualitative milestones,
    evaluating subsequent delivery across quarters.
    """
    __tablename__ = "management_commitments"
    __table_args__ = (
        Index("idx_mgmt_com_sym_status", "symbol", "status"),
        Index("idx_mgmt_com_deadline", "deadline_year", "deadline_quarter"),
        Index("idx_mgmt_com_category", "category"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Identifiers & Linkages
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("investor_documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Commitment Content & Provenance
    statement = Column(Text, nullable=False)  # Description of commitment
    exact_quote = Column(Text, nullable=True)  # Exact quote from presentation / concall
    page_or_slide = Column(String(50), nullable=True)  # Citation: e.g. "Slide 12", "Page 5"
    published_date = Column(Date, nullable=True, index=True)
    financial_year = Column(Integer, nullable=True)  # Inception FY (e.g. 2027)
    financial_quarter = Column(Integer, nullable=True)  # Inception quarter (1-4)

    # Classification & Target Spec
    category = Column(
        String(50),
        default="FINANCIAL_TARGET",
        index=True,
    )  # FINANCIAL_TARGET, CAPEX_EXPANSION, OPERATIONAL_MILESTONE, PRODUCT_GEOGRAPHY, DELEVERAGING_DEBT, STRATEGIC
    is_financial_target = Column(Boolean, default=True, index=True)  # False = qualitative milestone
    metric = Column(String(100), nullable=True)  # e.g. "Revenue", "EBITDA Margin", "Order Inflows", "Capacity COD"
    baseline_value = Column(String(100), nullable=True)  # Baseline before target
    target_value = Column(String(150), nullable=False)  # Target value or description
    target_period = Column(String(50), nullable=True)  # e.g., "Q4 FY27", "FY27", "H2 FY27"
    deadline_quarter = Column(Integer, nullable=True)  # Due quarter (1-4)
    deadline_year = Column(Integer, nullable=True)  # Due FY (e.g. 2027)
    units = Column(String(30), nullable=True)  # Cr, %, MW, bps, MT
    confidence = Column(String(20), default="HIGH")  # HIGH, MEDIUM, LOW

    # Current Evaluation State
    status = Column(
        String(30),
        default="NEW",
        index=True,
    )  # NEW, IN_PROGRESS, ON_TRACK, MET, PARTIALLY_MET, MISSED, DELAYED, REVISED, WITHDRAWN, NOT_YET_DUE, UNABLE_TO_VERIFY

    # Revision History
    revisions = Column(JSON, nullable=True)  # [{date, doc_id, old_target, new_target, reason, quote}]

    # Evaluation & Delivery Evidence
    actual_result = Column(Text, nullable=True)  # Reported figure or outcome
    assessment_rationale = Column(Text, nullable=True)  # Explanation of assessment
    evidence_quote = Column(Text, nullable=True)  # Cited evidence from subsequent reporting
    evidence_document_id = Column(Integer, ForeignKey("investor_documents.id", ondelete="SET NULL"), nullable=True, index=True)
    evidence_url = Column(Text, nullable=True)
    last_evaluated_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    company = relationship("Company")
    document = relationship("InvestorDocument", foreign_keys=[document_id], back_populates="commitments")
    evidence_document = relationship("InvestorDocument", foreign_keys=[evidence_document_id])
