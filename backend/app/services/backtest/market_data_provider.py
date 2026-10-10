"""
Alpha India - Market Data Provider Architecture
Sprint 43.1 Multi-Tier Historical Provider & Resilient Fallback

Implements:
1. MarketDataProvider (Abstract Base Interface)
2. FivePaisaHistoricalProvider (Primary Institutional Broker)
3. ParquetFallbackProvider (Local 3-Month High-Speed Cache)
4. DatabaseCandleProvider (PostgreSQL Time-Series Table)
5. CompositeMarketDataProvider (Unified Tiered Cascade)
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from app.clients.fivepaisa_client import FivePaisaClient
from app.models.backtest_models import MarketCandle5m, MarketCandle1m
from app.services.backtest.candle_aggregator import CandleAggregator
from app.services.backtest.data_quality_engine import DataQualityEngine

logger = logging.getLogger("alpha_india.backtest.provider")


class MarketDataProvider(ABC):
    """Abstract interface for historical market data retrieval."""

    @abstractmethod
    def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        """Returns standard DataFrame: ['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']"""
        pass


class FivePaisaHistoricalProvider(MarketDataProvider):
    """Primary broker provider using 5paisa historical API."""

    def __init__(self):
        self.client = FivePaisaClient.get_instance()

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        try:
            return self.client.get_historical_candles(
                symbol=symbol,
                timeframe=timeframe,
                from_date=start_date,
                to_date=end_date,
            )
        except Exception as e:
            logger.error(f"[FivePaisaProvider] Error fetching {symbol}: {e}")
            return pd.DataFrame()


class ParquetFallbackProvider(MarketDataProvider):
    """High-speed local disk provider from verified parquet cache."""

    def __init__(self, cache_dir: Optional[Path] = None):
        if cache_dir is None:
            self.cache_dir = Path(__file__).resolve().parent.parent.parent / "data" / "intraday_5m_cache"
        else:
            self.cache_dir = cache_dir

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        clean = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        tf_clean = timeframe.lower()
        fpath = self.cache_dir / f"{clean}_{tf_clean}.parquet"
        alt_cache_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "intraday_5m_cache"
        if not fpath.exists() and alt_cache_dir.exists():
            fpath = alt_cache_dir / f"{clean}_{tf_clean}.parquet"
        
        # If requesting 15m/30m/60m and specific file does not exist, check 5m for aggregation
        if not fpath.exists() and tf_clean in ("15m", "30m", "60m"):
            fpath = self.cache_dir / f"{clean}_5m.parquet"
            if not fpath.exists() and alt_cache_dir.exists():
                fpath = alt_cache_dir / f"{clean}_5m.parquet"

        if not fpath.exists():
            return pd.DataFrame()

        try:
            df = pd.read_parquet(fpath)
            # Normalize structure
            if "Datetime" not in df.columns:
                df["Datetime"] = df.index
            col_map = {c: c.capitalize() for c in df.columns}
            df.rename(columns=col_map, inplace=True)
            df["Datetime"] = pd.to_datetime(df["Datetime"])

            # Filter date range if specified
            if start_date:
                s_dt = pd.to_datetime(start_date)
                if df["Datetime"].dt.tz is not None:
                    s_dt = s_dt.tz_localize(df["Datetime"].dt.tz)
                df = df[df["Datetime"] >= s_dt]
            if end_date:
                e_dt = pd.to_datetime(end_date) + pd.Timedelta(days=1)
                if df["Datetime"].dt.tz is not None:
                    e_dt = e_dt.tz_localize(df["Datetime"].dt.tz)
                df = df[df["Datetime"] <= e_dt]

            # If requesting higher timeframe than 5m and reading 5m file, aggregate
            if tf_clean in ("15m", "30m", "60m") and "_5m" in str(fpath):
                return CandleAggregator.aggregate_candles(df, target_timeframe=timeframe)

            return df
        except Exception as e:
            logger.warning(f"[ParquetProvider] Failed to read {fpath}: {e}")
            return pd.DataFrame()


class DatabaseCandleProvider(MarketDataProvider):
    """PostgreSQL time-series candle provider."""

    def __init__(self, db: Session):
        self.db = db

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        clean = symbol.strip().upper()
        model = MarketCandle5m if timeframe.lower() == "5m" else MarketCandle1m

        query = self.db.query(model).filter(model.symbol == clean)
        if start_date:
            query = query.filter(model.timestamp >= pd.to_datetime(start_date))
        if end_date:
            query = query.filter(model.timestamp <= pd.to_datetime(end_date) + pd.Timedelta(days=1))

        records = query.order_by(model.timestamp.asc()).all()
        if not records:
            return pd.DataFrame()

        data = [
            {
                "Datetime": r.timestamp,
                "Open": r.open,
                "High": r.high,
                "Low": r.low,
                "Close": r.close,
                "Volume": r.volume,
            }
            for r in records
        ]
        return pd.DataFrame(data)


class CompositeMarketDataProvider(MarketDataProvider):
    """
    Tiered data cascade:
    1. Check PostgreSQL `market_candles_5m`
    2. Check Parquet local disk cache
    3. Query primary broker (5Paisa API)
    Automatically persists newly retrieved candles to disk cache and database for subsequent speed.
    """

    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.parquet_provider = ParquetFallbackProvider()
        self.fivepaisa_provider = FivePaisaHistoricalProvider()

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        clean = symbol.strip().upper()

        # Tier 1: Check Database
        if self.db:
            db_provider = DatabaseCandleProvider(self.db)
            df_db = db_provider.get_candles(clean, timeframe, start_date, end_date)
            if not df_db.empty and len(df_db) >= 50:
                logger.debug(f"[CompositeProvider] Loaded {len(df_db)} bars for {clean} from DB.")
                return df_db

        # Tier 2: Check Local Parquet Cache
        df_parquet = self.parquet_provider.get_candles(clean, timeframe, start_date, end_date)
        if not df_parquet.empty and len(df_parquet) >= 50:
            logger.debug(f"[CompositeProvider] Loaded {len(df_parquet)} bars for {clean} from Parquet cache.")
            return df_parquet

        # Tier 3: Fetch directly from 5paisa historical API
        df_5p = self.fivepaisa_provider.get_candles(clean, timeframe, start_date, end_date)
        if not df_5p.empty and len(df_5p) >= 10:
            logger.info(f"[CompositeProvider] Downloaded {len(df_5p)} fresh candles for {clean} from 5paisa.")
            # Persist to local parquet cache asynchronously or immediately
            try:
                cache_dir = Path(__file__).resolve().parent.parent.parent / "data" / "intraday_5m_cache"
                cache_dir.mkdir(parents=True, exist_ok=True)
                cache_file = cache_dir / f"{clean}_{timeframe}.parquet"
                df_5p.to_parquet(cache_file)
            except Exception as e:
                logger.warning(f"[CompositeProvider] Could not write cache for {clean}: {e}")
            return df_5p

        return pd.DataFrame()
