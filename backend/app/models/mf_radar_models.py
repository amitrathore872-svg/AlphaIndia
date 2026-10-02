"""
Mutual Fund Alpha Radar & Intelligence Models
Alpha India - Institutional MF Radar (Sprint 39)
Dedicated models for Top 100 Pure Equity schemes, daily & historical NAV time-series, and dip audit.
"""

from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Float,
    Boolean,
    Date,
    DateTime,
    Text,
    UniqueConstraint,
    Index,
)
from app.db.database import Base, utc_now


class MFRadarScheme(Base):
    """
    Master registry of curated Top 100 Pure Equity schemes in India.
    Includes performance metrics, risk ratios (Sharpe/Alpha), expense ratios, and dip stats.
    """
    __tablename__ = "mf_radar_schemes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheme_code = Column(String(50), unique=True, index=True, nullable=False)  # AMFI Scheme Code e.g. "122639"
    scheme_name = Column(String(255), index=True, nullable=False)
    amc_name = Column(String(150), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False)  # Flexi Cap, Large Cap, Mid Cap, Small Cap, Multi Cap, Focused, Sectoral
    benchmark_index = Column(String(100), index=True, nullable=False)  # NIFTY 50, NIFTY MIDCAP 150, NIFTY SMALLCAP 250, etc.
    plan_type = Column(String(50), default="Direct", index=True)
    option_type = Column(String(50), default="Growth", index=True)
    fund_manager = Column(String(150), nullable=True)
    aum_cr = Column(Float, default=0.0)  # Assets Under Management in ₹ Crores
    ter = Column(Float, default=0.0)     # Total Expense Ratio %
    
    # Latest NAV & Daily Delta
    current_nav = Column(Float, nullable=True)
    nav_date = Column(Date, nullable=True, index=True)
    prev_nav = Column(Float, nullable=True)
    day_change_pct = Column(Float, default=0.0, index=True)
    
    # Multi-Timeframe Historical Returns (%)
    return_1m_pct = Column(Float, nullable=True)
    return_3m_pct = Column(Float, nullable=True, index=True)
    return_6m_pct = Column(Float, nullable=True, index=True)
    return_1y_pct = Column(Float, nullable=True, index=True)
    return_3y_pct = Column(Float, nullable=True)
    return_5y_pct = Column(Float, nullable=True)

    # Risk & Alpha Metrics
    alpha_1y = Column(Float, default=0.0, index=True)   # Excess return over benchmark
    beta = Column(Float, default=1.0)
    sharpe_ratio = Column(Float, default=0.0, index=True)
    sortino_ratio = Column(Float, default=0.0)
    category_rank = Column(Integer, nullable=True)
    category_total = Column(Integer, nullable=True)

    # 52-Week Range & Dip History
    nav_52w_high = Column(Float, nullable=True)
    nav_52w_low = Column(Float, nullable=True)
    dip_from_52w_high_pct = Column(Float, default=0.0)
    dip_count_1y = Column(Integer, default=0)           # Count of > 1% drops in last 365 days
    last_dip_date = Column(Date, nullable=True)
    
    # Status flags
    is_top_universe = Column(Boolean, default=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "scheme_code": self.scheme_code,
            "scheme_name": self.scheme_name,
            "amc_name": self.amc_name,
            "category": self.category,
            "benchmark_index": self.benchmark_index,
            "plan_type": self.plan_type,
            "option_type": self.option_type,
            "fund_manager": self.fund_manager,
            "aum_cr": self.aum_cr,
            "ter": self.ter,
            "current_nav": self.current_nav,
            "nav_date": self.nav_date.isoformat() if self.nav_date else None,
            "prev_nav": self.prev_nav,
            "day_change_pct": round(self.day_change_pct, 2) if self.day_change_pct is not None else 0.0,
            "return_1m_pct": round(self.return_1m_pct, 2) if self.return_1m_pct is not None else None,
            "return_3m_pct": round(self.return_3m_pct, 2) if self.return_3m_pct is not None else None,
            "return_6m_pct": round(self.return_6m_pct, 2) if self.return_6m_pct is not None else None,
            "return_1y_pct": round(self.return_1y_pct, 2) if self.return_1y_pct is not None else None,
            "return_3y_pct": round(self.return_3y_pct, 2) if self.return_3y_pct is not None else None,
            "return_5y_pct": round(self.return_5y_pct, 2) if self.return_5y_pct is not None else None,
            "alpha_1y": round(self.alpha_1y, 2) if self.alpha_1y is not None else 0.0,
            "beta": round(self.beta, 2) if self.beta is not None else 1.0,
            "sharpe_ratio": round(self.sharpe_ratio, 2) if self.sharpe_ratio is not None else 0.0,
            "sortino_ratio": round(self.sortino_ratio, 2) if self.sortino_ratio is not None else 0.0,
            "category_rank": self.category_rank,
            "category_total": self.category_total,
            "nav_52w_high": self.nav_52w_high,
            "nav_52w_low": self.nav_52w_low,
            "dip_from_52w_high_pct": round(self.dip_from_52w_high_pct, 2) if self.dip_from_52w_high_pct is not None else 0.0,
            "dip_count_1y": self.dip_count_1y,
            "last_dip_date": self.last_dip_date.isoformat() if self.last_dip_date else None,
            "is_top_universe": self.is_top_universe,
            "is_active": self.is_active,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class MFRadarNavHistory(Base):
    """
    Time-series historical daily NAV points for charting and dip detection.
    Indexed by scheme_code and nav_date for instant retrieval.
    """
    __tablename__ = "mf_radar_nav_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheme_code = Column(String(50), nullable=False, index=True)
    nav_date = Column(Date, nullable=False, index=True)
    nav = Column(Float, nullable=False)
    day_change_pct = Column(Float, default=0.0)
    is_dip_day = Column(Boolean, default=False, index=True)  # True when day_change_pct <= -1.0%
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("scheme_code", "nav_date", name="uq_mf_radar_scheme_nav_date"),
        Index("idx_mf_radar_scheme_date_desc", "scheme_code", "nav_date"),
    )

    def to_dict(self):
        return {
            "date": self.nav_date.isoformat(),
            "nav": self.nav,
            "day_change_pct": round(self.day_change_pct, 2) if self.day_change_pct is not None else 0.0,
            "is_dip_day": self.is_dip_day,
        }


class MFRadarDipAlert(Base):
    """
    Dedicated audit ledger for Pre-2:00 PM cutoff intraday dip triggers
    and post-market EOD validation records.
    """
    __tablename__ = "mf_radar_dip_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    alert_date = Column(Date, nullable=False, index=True)
    detected_at = Column(DateTime, default=utc_now)
    index_name = Column(String(100), nullable=False, index=True)      # e.g. NIFTY SMALLCAP 100, NIFTY 500
    category = Column(String(100), nullable=False, index=True)        # Small Cap, Flexi Cap, Mid Cap
    index_drop_pct = Column(Float, nullable=False)                    # e.g. -1.45%
    estimated_nav_drop_pct = Column(Float, nullable=False)            # e.g. -1.35%
    flagship_schemes = Column(Text, nullable=True)                    # JSON list of top schemes recommended
    cutoff_time = Column(String(20), default="14:00 IST")
    urgency = Column(String(20), default="HIGH", index=True)          # HIGH (> 1%), CRITICAL (> 2%)
    is_cutoff_active = Column(Boolean, default=True)                  # True if currently before 2:00 PM
    actual_eod_nav_drop_pct = Column(Float, nullable=True)            # Reconciled after 9:30 PM AMFI feed
    is_alert_dispatched = Column(Boolean, default=False)
    dispatch_channels = Column(String(100), default="IN_APP,TELEGRAM")
    message = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "alert_date": self.alert_date.isoformat() if self.alert_date else None,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "index_name": self.index_name,
            "category": self.category,
            "index_drop_pct": round(self.index_drop_pct, 2),
            "estimated_nav_drop_pct": round(self.estimated_nav_drop_pct, 2),
            "flagship_schemes": self.flagship_schemes,
            "cutoff_time": self.cutoff_time,
            "urgency": self.urgency,
            "is_cutoff_active": self.is_cutoff_active,
            "actual_eod_nav_drop_pct": round(self.actual_eod_nav_drop_pct, 2) if self.actual_eod_nav_drop_pct is not None else None,
            "is_alert_dispatched": self.is_alert_dispatched,
            "dispatch_channels": self.dispatch_channels,
            "message": self.message,
        }


class MFRadarPortfolioHolding(Base):
    """
    User portfolio mutual fund holdings ledger.
    Tracks purchase dates, units, purchase NAV, holding days, exit load status, and capital gains tax brackets.
    """
    __tablename__ = "mf_radar_portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheme_code = Column(String(50), nullable=False, index=True)
    scheme_name = Column(String(255), nullable=False)
    folio_number = Column(String(50), nullable=True)
    units = Column(Float, nullable=False)
    purchase_date = Column(Date, nullable=False, index=True)
    purchase_nav = Column(Float, nullable=False)
    invested_amt = Column(Float, nullable=False)                       # units * purchase_nav
    current_nav = Column(Float, nullable=True)
    current_value = Column(Float, nullable=True)                      # units * current_nav
    unrealized_pnl = Column(Float, default=0.0)                       # current_value - invested_amt
    unrealized_pnl_pct = Column(Float, default=0.0)                   # (pnl / invested) * 100
    holding_days = Column(Integer, default=0)
    exit_load_active = Column(Boolean, default=False)                 # True if holding_days < 365
    exit_load_pct = Column(Float, default=0.0)                        # 1.0% or 0.0%
    exit_load_amt = Column(Float, default=0.0)
    tax_bracket = Column(String(30), default="LTCG_12_5")             # STCG_20 or LTCG_12_5
    tax_amt_est = Column(Float, default=0.0)                          # Estimated tax liability
    net_redemption_proceeds = Column(Float, default=0.0)              # current_value - exit_load - tax
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "scheme_code": self.scheme_code,
            "scheme_name": self.scheme_name,
            "folio_number": self.folio_number,
            "units": round(self.units, 4),
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "purchase_nav": round(self.purchase_nav, 4),
            "invested_amt": round(self.invested_amt, 2),
            "current_nav": round(self.current_nav, 4) if self.current_nav else None,
            "current_value": round(self.current_value, 2) if self.current_value else None,
            "unrealized_pnl": round(self.unrealized_pnl, 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 2),
            "holding_days": self.holding_days,
            "exit_load_active": self.exit_load_active,
            "exit_load_pct": self.exit_load_pct,
            "exit_load_amt": round(self.exit_load_amt, 2),
            "tax_bracket": self.tax_bracket,
            "tax_amt_est": round(self.tax_amt_est, 2),
            "net_redemption_proceeds": round(self.net_redemption_proceeds, 2),
            "notes": self.notes,
        }


