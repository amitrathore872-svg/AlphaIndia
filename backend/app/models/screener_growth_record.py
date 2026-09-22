"""
Alpha India Screener.in Growth Record Model
Parallel Architecture - Isolated from Yahoo Finance tables
Stores complete institutional fundamental & growth metrics extracted from Screener.in.
Includes all Screener custom screen metrics:
CMP, P/E, Mar Cap, Ind PE, PAT 12M, B.V., CMP/BV, OPM %, Sales growth %, Profit growth %,
Profit Var 3Yrs %, Sales Var 3Yrs %, EPS 12M, Piotroski Scr, 3mth return %, 6mth return %,
Qtr Profit Var %, NP Qtr.
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


class ScreenerGrowthRecord(Base):
    __tablename__ = "screener_growth_records"

    id = Column(Integer, primary_key=True, index=True)

    # Symbol identity
    symbol = Column(String(20), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=True)
    isin = Column(String(20), nullable=True, index=True)
    sector = Column(String(100), nullable=True, index=True)
    industry = Column(String(100), nullable=True, index=True)
    exchange = Column(String(20), default="NSE", index=True)

    # Valuation Multiples & Price (Screener: CMP Rs., Mar Cap Rs.Cr., P/E, Ind PE, B.V. Rs., CMP / BV)
    current_price = Column(Float, nullable=True)  # CMP Rs.
    market_cap = Column(Float, nullable=True, index=True)  # Mar Cap Rs.Cr.
    market_cap_category = Column(String(20), nullable=True, index=True)  # LARGE, MID, SMALL, MICRO
    stock_pe = Column(Float, nullable=True, index=True)  # P/E
    industry_pe = Column(Float, nullable=True)  # Ind PE
    price_to_book = Column(Float, nullable=True)  # CMP / BV
    book_value = Column(Float, nullable=True)  # B.V. Rs.
    dividend_yield = Column(Float, nullable=True)  # Dividend Yield (%)
    face_value = Column(Float, nullable=True)
    peg_ratio = Column(Float, nullable=True)

    # Trailing 12-Month & Profitability (Screener: PAT 12M Rs.Cr., EPS 12M Rs., OPM %)
    pat_12m = Column(Float, nullable=True)  # PAT 12M Rs.Cr. (TTM Net Profit)
    eps_12m = Column(Float, nullable=True)  # EPS 12M Rs. (TTM EPS)
    roce = Column(Float, nullable=True, index=True)  # ROCE (%)
    roe = Column(Float, nullable=True)  # ROE (%)
    opm_latest = Column(Float, nullable=True)  # OPM % (Operating Profit Margin %)
    opm_ttm = Column(Float, nullable=True)  # OPM TTM (%)

    # Multi-Year Compounded Variance & Growth (Screener: Sales growth %, Profit growth %, Profit Var 3Yrs %, Sales Var 3Yrs %)
    sales_growth_ttm = Column(Float, nullable=True)  # Sales growth % (TTM)
    profit_growth_ttm = Column(Float, nullable=True)  # Profit growth % (TTM)
    sales_growth_3yr = Column(Float, nullable=True)  # Sales Var 3Yrs % (Compounded Sales Growth 3Y)
    sales_growth_5yr = Column(Float, nullable=True)  # Sales Var 5Yrs %
    sales_growth_10yr = Column(Float, nullable=True)  # Sales Var 10Yrs %
    profit_growth_3yr = Column(Float, nullable=True)  # Profit Var 3Yrs % (Compounded Profit Growth 3Y)
    profit_growth_5yr = Column(Float, nullable=True)  # Profit Var 5Yrs %
    profit_growth_10yr = Column(Float, nullable=True)  # Profit Var 10Yrs %

    # Stock Price Returns & Moving Averages (Screener: 3mth return %, 6mth return %, Stock CAGR)
    return_3m = Column(Float, nullable=True)  # 3mth return %
    return_6m = Column(Float, nullable=True)  # 6mth return %
    return_1y = Column(Float, nullable=True)  # 1yr return %
    stock_cagr_3yr = Column(Float, nullable=True)  # Stock Price CAGR 3Y (%)
    stock_cagr_5yr = Column(Float, nullable=True)  # Stock Price CAGR 5Y (%)
    dma_50 = Column(Float, nullable=True)  # 50 DMA
    dma_200 = Column(Float, nullable=True)  # 200 DMA

    # Financial Quality & Composite (Screener: Piotroski Scr)
    piotroski_score = Column(Float, nullable=True)  # Piotroski Scr (0 to 9)
    health_score = Column(Float, nullable=True, index=True)  # Alpha India Institutional Score (0 to 100)

    # Quarterly Momentum (Screener: Qtr Profit Var %, NP Qtr Rs.Cr.)
    latest_quarter_name = Column(String(50), nullable=True)  # e.g. "Dec 2024"
    latest_quarter_sales = Column(Float, nullable=True)  # Sales Latest Quarter (₹ Cr)
    latest_quarter_net_profit = Column(Float, nullable=True)  # NP Qtr Rs.Cr. (Net Profit Latest Quarter)
    operating_profit = Column(Float, nullable=True)  # Operating Profit Latest Quarter (₹ Cr)
    latest_quarter_eps = Column(Float, nullable=True)  # EPS Latest Quarter (₹)
    quarterly_sales_yoy = Column(Float, nullable=True, index=True)  # Qtr Sales Var % (Quarterly Sales YoY %)
    quarterly_pat_yoy = Column(Float, nullable=True, index=True)  # Qtr Profit Var % (Quarterly Profit YoY %)
    quarterly_sales_qoq = Column(Float, nullable=True)  # Sales QoQ %
    quarterly_pat_qoq = Column(Float, nullable=True)  # Profit / PAT QoQ %
    quarterly_eps_yoy = Column(Float, nullable=True)  # Qtr EPS Var % (Quarterly EPS YoY %)

    # Balance Sheet, Solvency & Cash Flows
    debt_to_equity = Column(Float, nullable=True)
    interest_coverage = Column(Float, nullable=True)
    borrowings = Column(Float, nullable=True)  # ₹ Cr
    reserves = Column(Float, nullable=True)  # ₹ Cr
    total_assets = Column(Float, nullable=True)  # ₹ Cr
    cfo_latest = Column(Float, nullable=True)  # Cash Flow from Operations (₹ Cr)
    free_cash_flow = Column(Float, nullable=True)  # Free Cash Flow (₹ Cr)
    debtor_days = Column(Float, nullable=True)  # Debtor Days
    inventory_days = Column(Float, nullable=True)  # Inventory Days
    cash_conversion_cycle = Column(Float, nullable=True)  # Working Capital / Cash Conversion Cycle Days

    # Shareholding Pattern (%)
    promoter_holding = Column(Float, nullable=True)
    fii_holding = Column(Float, nullable=True)
    dii_holding = Column(Float, nullable=True)
    public_holding = Column(Float, nullable=True)

    # 52-Week High / Low
    high_52_week = Column(Float, nullable=True)
    low_52_week = Column(Float, nullable=True)

    # Quantitative Risk, Cash Flow & Momentum Factors (Sprint 36.6)
    fcf_yield = Column(Float, nullable=True, index=True)  # Free Cash Flow Yield (%) = (FCF / MCAP) * 100
    rsi_14 = Column(Float, nullable=True, index=True)  # 14-Day Relative Strength Index (0 to 100)
    beta = Column(Float, nullable=True, index=True)  # Market Beta (Sensitivity relative to Nifty 50)
    distance_52w_high = Column(Float, nullable=True, index=True)  # Drawdown from 52-Week High (%)
    cfo_to_pat = Column(Float, nullable=True)  # Cash Flow from Operations / PAT 12M (Earnings Quality Ratio)

    # Import Metadata
    import_source = Column(String(50), default="screener.in")
    import_timestamp = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    data_completeness_score = Column(Float, default=0.0)  # Percentage of non-null metrics
