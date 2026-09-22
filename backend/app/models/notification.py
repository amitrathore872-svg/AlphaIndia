"""
Alpha India Institutional Notification & Alert Models
Sprint 34 — Institutional Notification Engine
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey

from app.db.database import Base


class SystemNotification(Base):
    """
    Internal in-app notification record.
    Tracks institutional trade alerts, flash signals, catalyst filings, and system health.
    """
    __tablename__ = "system_notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)  # ATHENA_PEAD, GROWTH_BREAKOUT, VCP_BREAKOUT, CATALYST_ORDER, SMART_MONEY, SYSTEM_ALERT
    severity = Column(String(20), default="info", index=True)   # critical, warning, info, success
    action_url = Column(String(255), nullable=True)             # Deep link e.g. /vcp-discovery, /athena-omega, /growth-screener
    metadata_json = Column(JSON, nullable=True)                 # Structured payload e.g. symbol, conviction, score, pivot_price
    is_read = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "category": self.category,
            "severity": self.severity,
            "action_url": self.action_url,
            "metadata": self.metadata_json or {},
            "is_read": self.is_read,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AlertChannelConfig(Base):
    """
    External alert channel credentials and rule configurations.
    Stores Telegram bot parameters, WhatsApp web/API parameters, and auto-dispatch thresholds.
    """
    __tablename__ = "alert_channel_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    channel = Column(String(50), nullable=False, index=True)  # TELEGRAM, WHATSAPP
    is_enabled = Column(Boolean, default=True)
    
    # Telegram credentials
    bot_token = Column(String(255), nullable=True)
    chat_id = Column(String(100), nullable=True)

    # WhatsApp API credentials (Cloud API / Webhook)
    api_key = Column(String(255), nullable=True)
    phone_number_id = Column(String(100), nullable=True)
    target_recipient = Column(String(100), nullable=True)  # default phone number

    # Automated trigger rules (JSON)
    # e.g. { "pead_min_conviction": 80, "catalyst_min_cr": 1000, "growth_min_pat_pct": 50, "vcp_min_score": 90, "vcp_enabled": true, "auto_broadcast": true }
    auto_rules = Column(JSON, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, mask_secrets: bool = True):
        token_masked = None
        if self.bot_token:
            token_masked = f"{self.bot_token[:6]}...{self.bot_token[-4:]}" if (mask_secrets and len(self.bot_token) > 10) else self.bot_token

        key_masked = None
        if self.api_key:
            key_masked = f"{self.api_key[:4]}...{self.api_key[-4:]}" if (mask_secrets and len(self.api_key) > 8) else self.api_key

        return {
            "id": self.id,
            "channel": self.channel,
            "is_enabled": self.is_enabled,
            "bot_token": token_masked,
            "chat_id": self.chat_id,
            "api_key": key_masked,
            "phone_number_id": self.phone_number_id,
            "target_recipient": self.target_recipient,
            "auto_rules": self.auto_rules or {},
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AlertDispatchLog(Base):
    """
    Audit ledger of all external alerts broadcast to Telegram or WhatsApp.
    """
    __tablename__ = "alert_dispatch_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String(50), nullable=False, index=True)  # TELEGRAM, WHATSAPP
    recipient = Column(String(100), nullable=True)
    symbol = Column(String(50), nullable=True, index=True)
    payload_preview = Column(Text, nullable=False)
    status = Column(String(20), default="SENT", index=True)    # SUCCESS, FAILED, SIMULATED
    error_message = Column(Text, nullable=True)
    dispatched_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "channel": self.channel,
            "recipient": self.recipient,
            "symbol": self.symbol,
            "payload_preview": self.payload_preview,
            "status": self.status,
            "error_message": self.error_message,
            "dispatched_at": self.dispatched_at.isoformat() if self.dispatched_at else None,
        }
