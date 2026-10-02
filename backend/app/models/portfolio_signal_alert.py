"""
Alpha India - Portfolio Signal Alert Model
Tracks generated BUY / SELL signals for portfolio intelligence holdings
and their dispatch history to the user's dedicated Telegram group/channel.
"""

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base, utc_now


class PortfolioSignalAlert(Base):
    """
    Records institutional BUY / SELL signals detected across user's portfolio holdings.
    Maintains complete audit history and prevents duplicate spam alerts.
    """
    __tablename__ = "portfolio_signal_alerts"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    holding_id = Column(
        Integer,
        ForeignKey("portfolio_holdings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    symbol = Column(String(30), nullable=False, index=True)

    # Signal direction: 'BUY' or 'SELL'
    signal_type = Column(String(20), nullable=False, index=True)
    
    # Specific trigger:
    # BUY: 'BEST_BUY_ZONE', 'ACCUMULATE_DIP', 'STRONG_BUY_RATING', 'REBALANCE_ADD'
    # SELL: 'PROFIT_BOOKING_TARGET', 'STOP_LOSS_BREACH', 'RATING_DOWNGRADE_EXIT', 'REBALANCE_TRIM'
    trigger_category = Column(String(50), nullable=False, index=True)

    cmp = Column(Float, nullable=False)
    buy_trigger_price = Column(Float, nullable=True)
    avg_buy_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    pnl_pct = Column(Float, nullable=True)
    conviction_score = Column(Integer, nullable=True)

    headline = Column(String(255), nullable=False)
    message_text = Column(Text, nullable=False)
    action_guidance = Column(Text, nullable=True)

    is_dispatched = Column(Boolean, default=False, index=True)
    dispatched_at = Column(DateTime, nullable=True)
    chat_id = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=utc_now, index=True)

    # Relationships
    portfolio = relationship("Portfolio", backref="signal_alerts")
    holding = relationship("PortfolioHolding", backref="signals")

    def to_dict(self):
        return {
            "id": self.id,
            "portfolio_id": self.portfolio_id,
            "holding_id": self.holding_id,
            "user_id": self.user_id,
            "symbol": self.symbol,
            "signal_type": self.signal_type,
            "trigger_category": self.trigger_category,
            "cmp": self.cmp,
            "buy_trigger_price": self.buy_trigger_price,
            "avg_buy_price": self.avg_buy_price,
            "target_price": self.target_price,
            "stop_loss": self.stop_loss,
            "pnl_pct": self.pnl_pct,
            "conviction_score": self.conviction_score,
            "headline": self.headline,
            "message_text": self.message_text,
            "action_guidance": self.action_guidance,
            "is_dispatched": self.is_dispatched,
            "dispatched_at": self.dispatched_at.isoformat() if self.dispatched_at else None,
            "chat_id": self.chat_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
