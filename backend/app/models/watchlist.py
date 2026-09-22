"""
Alpha India Watchlist Models
Supports multiple named watchlists, stock conviction/confidence ranking (1-5),
and inline investment thesis comments.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(30), default="cyan")  # cyan, emerald, amber, purple, blue
    is_default = Column(Integer, default=0)

    # Multi-tenant user ownership
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="watchlists")
    items = relationship(
        "WatchlistItem",
        back_populates="watchlist",
        cascade="all, delete-orphan",
        order_by="WatchlistItem.confidence_score.desc(), WatchlistItem.id.asc()",
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(
        Integer,
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)

    # Confidence Score: 1 to 5 (1 = Low/Speculative, 5 = Maximum Conviction)
    confidence_score = Column(Integer, default=3, nullable=False)

    # Investment Thesis / Note
    comment = Column(Text, nullable=True)

    # Target Price or Range
    target_price = Column(Float, nullable=True)

    added_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    watchlist = relationship("Watchlist", back_populates="items")

    # Composite Unique Constraint: A symbol cannot be added twice to the same watchlist
    __table_args__ = (
        UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),
    )
