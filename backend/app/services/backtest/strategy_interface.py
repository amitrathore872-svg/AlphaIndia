"""
Alpha India - Generic Strategy Engine Interface
Sprint 43.1 Extensible Quantitative Strategy Abstraction

Defines the contract for all backtesting strategies:
- BaseStrategy
- StrategySignal (Data object)
Enables plug-and-play strategies without the backtest engine coupling to strategy internals.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd


@dataclass
class StrategySignal:
    symbol: str
    timestamp: datetime
    strategy: str
    timeframe: str
    signal_type: str  # BREAKOUT, EARLY, COMPRESSION, etc.
    entry_price: float
    resistance: Optional[float] = None
    stop_loss: Optional[float] = None
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    vwap: Optional[float] = None
    atr: Optional[float] = None
    volume_ratio: Optional[float] = None
    compression_pct: Optional[float] = None
    close_location_pct: Optional[float] = None
    extension_pct: Optional[float] = None
    rule_diagnostics: Dict[str, bool] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat() if hasattr(self.timestamp, "isoformat") else str(self.timestamp),
            "strategy": self.strategy,
            "timeframe": self.timeframe,
            "signal_type": self.signal_type,
            "entry_price": round(self.entry_price, 2),
            "resistance": round(self.resistance, 2) if self.resistance is not None else None,
            "stop_loss": round(self.stop_loss, 2) if self.stop_loss is not None else None,
            "target_1": round(self.target_1, 2) if self.target_1 is not None else None,
            "target_2": round(self.target_2, 2) if self.target_2 is not None else None,
            "vwap": round(self.vwap, 2) if self.vwap is not None else None,
            "atr": round(self.atr, 2) if self.atr is not None else None,
            "volume_ratio": round(self.volume_ratio, 2) if self.volume_ratio is not None else None,
            "compression_pct": round(self.compression_pct, 3) if self.compression_pct is not None else None,
            "close_location_pct": round(self.close_location_pct, 3) if self.close_location_pct is not None else None,
            "extension_pct": round(self.extension_pct, 3) if self.extension_pct is not None else None,
            "rule_diagnostics": self.rule_diagnostics,
            "metadata": self.metadata,
        }


class BaseStrategy(ABC):
    """
    Abstract interface for quantitative trading strategies.
    """

    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        self.parameters = parameters or {}

    @abstractmethod
    def strategy_metadata(self) -> Dict[str, Any]:
        """Returns strategy name, default parameters, description, and rules definition."""
        pass

    @abstractmethod
    def prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepares and validates incoming candlestick DataFrame."""
        pass

    @abstractmethod
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculates indicators (VWAP, ATR, SMA, Highs/Lows) strictly without forward leakage."""
        pass

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[StrategySignal]:
        """
        Evaluates strategy conditions on each bar.
        Returns all valid StrategySignal instances with complete rule diagnostics.
        """
        pass
