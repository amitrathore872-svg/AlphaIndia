"""
Alpha India - Watchlist Alerts & Personal Telegram Broadcast Models
Institutional Real-Time Rule Alerts and Personalized Telegram Channel Dispatch.
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


class WatchlistAlert(Base):
    """
    Rule-based alert definition configured on a watchlist stock.
    Supports Price Thresholds, 50/200 DMA, VCP Pivot, Volume Surge, and Momentum Matches.
    """
    __tablename__ = "watchlist_alerts"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(
        Integer,
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    symbol = Column(String(30), nullable=False, index=True)

    # Rule type:
    # 'PRICE_CROSS_ABOVE', 'PRICE_CROSS_BELOW', 'DMA_50_RECLAIM', 'DMA_200_BOUNCE',
    # 'VCP_PIVOT_BREAK', 'VOLUME_SPIKE_2X', 'MOMENTUM_MATCH_9', 'PERCENT_SURGE_3'
    rule_type = Column(String(50), nullable=False, index=True)
    threshold_value = Column(Float, nullable=True)  # e.g., 385.0 for price, 2.0 for volume multiplier
    timeframe = Column(String(10), default="1D")

    notes = Column(Text, nullable=True)  # User's thesis note / trade plan
    is_active = Column(Boolean, default=True, index=True)
    status = Column(String(20), default="ACTIVE")  # ACTIVE, TRIGGERED, SNOOZED, MUTED

    notify_in_app = Column(Boolean, default=True)
    notify_telegram = Column(Boolean, default=True)

    trigger_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)
    last_triggered_price = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    watchlist = relationship("Watchlist", backref="alerts")

    def to_dict(self):
        return {
            "id": self.id,
            "watchlist_id": self.watchlist_id,
            "user_id": self.user_id,
            "symbol": self.symbol,
            "rule_type": self.rule_type,
            "threshold_value": self.threshold_value,
            "timeframe": self.timeframe,
            "notes": self.notes,
            "is_active": self.is_active,
            "status": self.status,
            "notify_in_app": self.notify_in_app,
            "notify_telegram": self.notify_telegram,
            "trigger_count": self.trigger_count,
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            "last_triggered_price": self.last_triggered_price,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserPersonalTelegramConfig(Base):
    """
    Personalized Telegram Channel configuration specifically for user's watchlist alerts.
    Keeps high-conviction trade triggers private and isolated from public platform broadcasts.
    """
    __tablename__ = "user_personal_telegram_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    channel_name = Column(String(100), default="Personal Watchlist Radar")
    
    # Custom bot token (optional; if empty, uses default platform bot)
    bot_token = Column(String(255), nullable=True)
    
    # User's personal Telegram chat_id or private channel ID (e.g., "123456789" or "-1001234567890")
    chat_id = Column(String(100), nullable=True)
    telegram_username = Column(String(100), nullable=True)

    is_enabled = Column(Boolean, default=True)
    notify_price_cross = Column(Boolean, default=True)
    notify_dma_reclaim = Column(Boolean, default=True)
    notify_vcp_breakout = Column(Boolean, default=True)
    notify_volume_surge = Column(Boolean, default=True)
    notify_target_stop = Column(Boolean, default=True)

    # Dedicated Portfolio Intelligence BUY & SELL Signal Toggles
    notify_portfolio_buy = Column(Boolean, default=True)           # Best Buy Zone, Accumulate Zone, Strong Buy Upgrade
    notify_portfolio_sell = Column(Boolean, default=True)          # Profit Booking Target, Stop Loss Breach, Exit Downgrade
    notify_portfolio_rebalance = Column(Boolean, default=True)     # Rebalance Add More / Trim Warnings
    notify_watchlist_buy = Column(Boolean, default=True)           # Watchlist Breakout, 50 DMA, Volume Spike
    notify_watchlist_sell = Column(Boolean, default=True)          # Watchlist Stop Loss, 200 DMA breakdown
    min_conviction_score = Column(Integer, default=75)             # Minimum conviction score threshold for Buy signals

    last_dispatched_at = Column(DateTime, nullable=True)
    total_dispatched_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    def to_dict(self, mask_secret: bool = True):
        token_masked = None
        if self.bot_token:
            token_masked = (
                f"{self.bot_token[:6]}...{self.bot_token[-4:]}"
                if (mask_secret and len(self.bot_token) > 10)
                else self.bot_token
            )

        return {
            "id": self.id,
            "user_id": self.user_id,
            "channel_name": self.channel_name,
            "bot_token": token_masked,
            "has_custom_bot": bool(self.bot_token and len(self.bot_token) > 10),
            "chat_id": self.chat_id,
            "telegram_username": self.telegram_username,
            "is_enabled": self.is_enabled,
            "is_configured": bool(self.chat_id and len(self.chat_id) > 3),
            "notify_price_cross": getattr(self, "notify_price_cross", True),
            "notify_dma_reclaim": getattr(self, "notify_dma_reclaim", True),
            "notify_vcp_breakout": getattr(self, "notify_vcp_breakout", True),
            "notify_volume_surge": getattr(self, "notify_volume_surge", True),
            "notify_target_stop": getattr(self, "notify_target_stop", True),
            "notify_portfolio_buy": getattr(self, "notify_portfolio_buy", True),
            "notify_portfolio_sell": getattr(self, "notify_portfolio_sell", True),
            "notify_portfolio_rebalance": getattr(self, "notify_portfolio_rebalance", True),
            "notify_watchlist_buy": getattr(self, "notify_watchlist_buy", True),
            "notify_watchlist_sell": getattr(self, "notify_watchlist_sell", True),
            "min_conviction_score": getattr(self, "min_conviction_score", 75),
            "last_dispatched_at": self.last_dispatched_at.isoformat() if self.last_dispatched_at else None,
            "total_dispatched_count": self.total_dispatched_count,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
