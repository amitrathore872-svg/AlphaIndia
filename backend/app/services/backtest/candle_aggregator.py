"""
Alpha India - Intraday Candle Aggregator
Sprint 43.1 Canonical Timeframe Resampling Engine

Aggregates lower timeframe candles (canonical 1-minute) into higher timeframes:
- 5m, 15m, 30m, 60m
Enforces Indian market trading session boundaries (09:15 to 15:30 Asia/Kolkata).
"""

from __future__ import annotations

import pandas as pd
import pytz

IST = pytz.timezone("Asia/Kolkata")


class CandleAggregator:
    """
    Timeframe aggregation engine for intraday OHLCV time-series.
    """

    SUPPORTED_TIMEFRAMES = {
        "1m": "1min",
        "3m": "3min",
        "5m": "5min",
        "15m": "15min",
        "30m": "30min",
        "60m": "60min",
        "1h": "60min",
        "1d": "1D",
    }

    @classmethod
    def aggregate_candles(
        cls,
        df: pd.DataFrame,
        target_timeframe: str = "5m",
        session_only: bool = True,
    ) -> pd.DataFrame:
        """
        Resamples canonical 1-minute OHLCV data into the target timeframe.
        Required columns in df: ['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume'] or DatetimeIndex.
        """
        if df.empty:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

        df_work = df.copy()

        # Ensure Datetime column is datetime type
        if "Datetime" in df_work.columns:
            df_work["Datetime"] = pd.to_datetime(df_work["Datetime"])
            # Ensure timezone
            if df_work["Datetime"].dt.tz is None:
                df_work["Datetime"] = df_work["Datetime"].dt.tz_localize(IST)
            else:
                df_work["Datetime"] = df_work["Datetime"].dt.tz_convert(IST)
            df_work.set_index("Datetime", inplace=True)
        elif isinstance(df_work.index, pd.DatetimeIndex):
            if df_work.index.tz is None:
                df_work.index = df_work.index.tz_localize(IST)
            else:
                df_work.index = df_work.index.tz_convert(IST)

        # Standardize column casing
        col_map = {c: c.capitalize() for c in df_work.columns}
        df_work.rename(columns=col_map, inplace=True)

        # Filter strictly for regular market session (09:15:00 to 15:30:00)
        if session_only:
            time_filter = (
                (df_work.index.time >= pd.to_datetime("09:15:00").time()) &
                (df_work.index.time <= pd.to_datetime("15:30:00").time())
            )
            df_work = df_work[time_filter]

        if df_work.empty:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

        tf_rule = cls.SUPPORTED_TIMEFRAMES.get(target_timeframe.lower())
        if not tf_rule or target_timeframe.lower() == "1m":
            res = df_work[["Open", "High", "Low", "Close", "Volume"]].copy()
            res.reset_index(inplace=True)
            return res

        # Resample daily session by session to prevent cross-day bar contamination
        grouped_days = []
        for _, day_df in df_work.groupby(df_work.index.date):
            resampled = day_df.resample(
                tf_rule,
                origin="start_day",
                offset="15min",  # Align to Indian market open (09:15)
                closed="left",
                label="left",
            ).agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
            }).dropna(subset=["Close"])
            grouped_days.append(resampled)

        if not grouped_days:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

        result_df = pd.concat(grouped_days).sort_index()

        # Filter bars within session (exclude bars starting at or after 15:30)
        if session_only:
            result_df = result_df[result_df.index.time < pd.to_datetime("15:30:00").time()]

        result_df.reset_index(inplace=True)
        return result_df
