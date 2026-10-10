"""
Alpha India - Market Data Quality Engine
Sprint 43.1 Forensic Validation & Integrity Auditing

Validates intraday candlestick data before ingestion and backtesting:
- Structural OHLC inequalities: High >= Open, High >= Close, Low <= Open, Low <= Close, High >= Low
- Zero or negative pricing
- Volume anomalies & non-negativity
- Timestamp chronological monotonicity & deduplication
- Regular session boundary compliance (09:15 to 15:30 Asia/Kolkata)
- Trading calendar session continuity & gap tracking
Generates formal Data Quality Reports without silently mutating raw corrupted records.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import pytz

IST = pytz.timezone("Asia/Kolkata")
SESSION_START = dtime(9, 15)
SESSION_END = dtime(15, 30)


@dataclass
class CandleValidationIssue:
    row_index: int
    timestamp: str
    symbol: str
    issue_type: str
    description: str
    raw_values: Dict[str, Any]


@dataclass
class DataQualityReport:
    symbol: str
    timeframe: str
    total_candles: int = 0
    valid_candles: int = 0
    invalid_candles: int = 0
    duplicate_candles: int = 0
    missing_candles_estimated: int = 0
    session_out_of_bounds: int = 0
    coverage_pct: float = 100.0
    affected_dates: List[str] = field(default_factory=list)
    issues: List[CandleValidationIssue] = field(default_factory=list)
    is_acceptable: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "total_candles": self.total_candles,
            "valid_candles": self.valid_candles,
            "invalid_candles": self.invalid_candles,
            "duplicate_candles": self.duplicate_candles,
            "missing_candles_estimated": self.missing_candles_estimated,
            "session_out_of_bounds": self.session_out_of_bounds,
            "coverage_pct": round(self.coverage_pct, 2),
            "affected_dates": self.affected_dates[:50],
            "total_issues_logged": len(self.issues),
            "sample_issues": [
                {
                    "row": iss.row_index,
                    "timestamp": iss.timestamp,
                    "type": iss.issue_type,
                    "desc": iss.description,
                    "values": iss.raw_values,
                }
                for iss in self.issues[:20]
            ],
            "is_acceptable": self.is_acceptable,
        }


class DataQualityEngine:
    """
    Forensic market-data validation and integrity auditing engine.
    """

    EXPECTED_BARS_PER_DAY = {
        "1m": 375,
        "3m": 125,
        "5m": 75,
        "15m": 25,
        "30m": 12,  # or 13 depending on boundary
        "60m": 6,
    }

    @classmethod
    def validate_dataframe(
        cls,
        df: pd.DataFrame,
        symbol: str,
        timeframe: str = "5m",
        max_invalid_tolerance_pct: float = 2.0,
    ) -> Tuple[pd.DataFrame, DataQualityReport]:
        """
        Validates OHLCV dataframe.
        Returns:
            clean_valid_df: Filtered valid dataframe without corrupt rows
            report: Detailed forensic DataQualityReport
        """
        report = DataQualityReport(symbol=symbol, timeframe=timeframe)

        if df.empty:
            report.is_acceptable = False
            report.coverage_pct = 0.0
            return df, report

        work_df = df.copy()

        # Check required columns
        req_cols = ["Open", "High", "Low", "Close", "Volume"]
        col_map = {c: c.capitalize() for c in work_df.columns}
        work_df.rename(columns=col_map, inplace=True)

        if "Datetime" in work_df.columns:
            work_df["Datetime"] = pd.to_datetime(work_df["Datetime"])
        elif isinstance(work_df.index, pd.DatetimeIndex):
            work_df["Datetime"] = work_df.index
        else:
            report.is_acceptable = False
            report.issues.append(
                CandleValidationIssue(
                    row_index=-1,
                    timestamp="N/A",
                    symbol=symbol,
                    issue_type="MISSING_DATETIME",
                    description="No valid Datetime column or DatetimeIndex found.",
                    raw_values={},
                )
            )
            return pd.DataFrame(), report

        # Ensure Asia/Kolkata timezone
        if work_df["Datetime"].dt.tz is None:
            work_df["Datetime"] = work_df["Datetime"].dt.tz_localize(IST)
        else:
            work_df["Datetime"] = work_df["Datetime"].dt.tz_convert(IST)

        report.total_candles = len(work_df)

        # 1. Deduplication check
        dup_mask = work_df.duplicated(subset=["Datetime"], keep="first")
        num_duplicates = int(dup_mask.sum())
        report.duplicate_candles = num_duplicates

        if num_duplicates > 0:
            dup_rows = work_df[dup_mask]
            for idx, r in dup_rows.head(10).iterrows():
                report.issues.append(
                    CandleValidationIssue(
                        row_index=int(idx),
                        timestamp=str(r["Datetime"]),
                        symbol=symbol,
                        issue_type="DUPLICATE_TIMESTAMP",
                        description=f"Duplicate timestamp encountered for {symbol}",
                        raw_values={"Datetime": str(r["Datetime"])},
                    )
                )

        # Drop duplicates for further checks
        work_df = work_df[~dup_mask].copy()

        # 2. Chronological Monotonicity Check
        work_df.sort_values(by="Datetime", ascending=True, inplace=True)

        valid_mask = pd.Series(True, index=work_df.index)
        affected_dates_set = set()

        for idx, row in work_df.iterrows():
            ts = row["Datetime"]
            ts_str = str(ts)
            d_str = ts.strftime("%Y-%m-%d")
            t_time = ts.time()

            o = float(row.get("Open", 0.0))
            h = float(row.get("High", 0.0))
            l = float(row.get("Low", 0.0))
            c = float(row.get("Close", 0.0))
            v = float(row.get("Volume", 0.0))

            row_has_error = False

            # Session boundary check (09:15:00 <= time <= 15:30:00)
            if t_time < SESSION_START or t_time > SESSION_END:
                report.session_out_of_bounds += 1
                row_has_error = True
                report.issues.append(
                    CandleValidationIssue(
                        row_index=int(idx),
                        timestamp=ts_str,
                        symbol=symbol,
                        issue_type="OUT_OF_SESSION",
                        description=f"Candle at {t_time} outside regular market session (09:15-15:30)",
                        raw_values={"time": str(t_time)},
                    )
                )

            # Price positivity check
            if o <= 0.0 or h <= 0.0 or l <= 0.0 or c <= 0.0:
                row_has_error = True
                report.issues.append(
                    CandleValidationIssue(
                        row_index=int(idx),
                        timestamp=ts_str,
                        symbol=symbol,
                        issue_type="NON_POSITIVE_PRICE",
                        description=f"Zero or negative price detected (O:{o}, H:{h}, L:{l}, C:{c})",
                        raw_values={"Open": o, "High": h, "Low": l, "Close": c},
                    )
                )

            # Volume negativity check
            if v < 0.0:
                row_has_error = True
                report.issues.append(
                    CandleValidationIssue(
                        row_index=int(idx),
                        timestamp=ts_str,
                        symbol=symbol,
                        issue_type="NEGATIVE_VOLUME",
                        description=f"Negative volume detected ({v})",
                        raw_values={"Volume": v},
                    )
                )

            # Strict OHLC relationship checks:
            # High >= Open, High >= Close, Low <= Open, Low <= Close, High >= Low
            if not (h >= o and h >= c and l <= o and l <= c and h >= l):
                row_has_error = True
                report.issues.append(
                    CandleValidationIssue(
                        row_index=int(idx),
                        timestamp=ts_str,
                        symbol=symbol,
                        issue_type="INVALID_OHLC_RELATIONSHIP",
                        description=f"Violated High/Low boundary rules: H={h}, L={l}, O={o}, C={c}",
                        raw_values={"Open": o, "High": h, "Low": l, "Close": c},
                    )
                )

            if row_has_error:
                valid_mask.loc[idx] = False
                affected_dates_set.add(d_str)

        # 3. Missing Candles Estimation per Trading Session
        expected_bars = cls.EXPECTED_BARS_PER_DAY.get(timeframe.lower(), 75)
        for d, grp in work_df.groupby(work_df["Datetime"].dt.date):
            cnt = len(grp)
            if cnt < expected_bars:
                diff = expected_bars - cnt
                report.missing_candles_estimated += diff
                affected_dates_set.add(str(d))

        valid_df = work_df[valid_mask].copy()

        report.valid_candles = len(valid_df)
        report.invalid_candles = int((~valid_mask).sum())
        report.affected_dates = sorted(list(affected_dates_set))

        # Coverage %
        expected_total = max(report.total_candles, report.valid_candles + report.missing_candles_estimated)
        if expected_total > 0:
            report.coverage_pct = (report.valid_candles / expected_total) * 100.0
        else:
            report.coverage_pct = 0.0

        # Acceptance threshold
        invalid_pct = (report.invalid_candles / max(1, report.total_candles)) * 100.0
        if invalid_pct > max_invalid_tolerance_pct or report.valid_candles < 20:
            report.is_acceptable = False
        else:
            report.is_acceptable = True

        return valid_df, report
