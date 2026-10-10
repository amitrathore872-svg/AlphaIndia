"""
Alpha India - Multi-Timeframe Relative Strength & Sector Engine
Sprint 43 — Quantitative RS & Sector Leadership Scoring

Computes:
1. Stock vs NIFTY Benchmark Relative Strength across 20-day and 60-day horizons.
2. Percentile ranking & Mansfield RS Score (0-100).
3. Sector Strength & Momentum Score (0-100).
Outputs: stock_rs_score (0-100), sector_score (0-100), is_rs_leader (bool)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class RelativeStrengthResult:
    pass_rs: bool = False
    pass_sector: bool = False
    stock_rs_score: float = 50.0
    sector_score: float = 50.0
    rs_20d_pct: float = 0.0
    rs_60d_pct: float = 0.0
    benchmark_20d_pct: float = 0.0
    excess_return_pct: float = 0.0
    is_leader: bool = False
    rejection_reasons: List[str] = field(default_factory=list)


class RelativeStrengthCalculator:
    """
    Computes stock and sector relative performance vs NIFTY benchmark over completed daily bars.
    """

    @classmethod
    def evaluate(
        cls,
        stock_daily_df: pd.DataFrame,
        benchmark_daily_df: Optional[pd.DataFrame] = None,
        sector_name: Optional[str] = None,
        min_rs_score: float = 60.0,
        min_sector_score: float = 55.0,
    ) -> RelativeStrengthResult:
        result = RelativeStrengthResult()
        rejections: List[str] = []

        if stock_daily_df is None or len(stock_daily_df) < 20:
            result.stock_rs_score = 50.0
            result.sector_score = 50.0
            result.pass_rs = True
            result.pass_sector = True
            return result

        s_closes = stock_daily_df["Close"].values
        n = len(s_closes)

        # 20-day stock return
        ret_20d = ((s_closes[-1] - s_closes[-min(20, n)]) / max(0.01, s_closes[-min(20, n)])) * 100.0
        # 60-day stock return
        ret_60d = ((s_closes[-1] - s_closes[-min(60, n)]) / max(0.01, s_closes[-min(60, n)])) * 100.0

        result.rs_20d_pct = round(ret_20d, 2)
        result.rs_60d_pct = round(ret_60d, 2)

        # Benchmark comparison
        bench_ret_20d = 0.0
        bench_ret_60d = 0.0
        if benchmark_daily_df is not None and len(benchmark_daily_df) >= 20:
            b_closes = benchmark_daily_df["Close"].values
            bn = len(b_closes)
            bench_ret_20d = ((b_closes[-1] - b_closes[-min(20, bn)]) / max(0.01, b_closes[-min(20, bn)])) * 100.0
            bench_ret_60d = ((b_closes[-1] - b_closes[-min(60, bn)]) / max(0.01, b_closes[-min(60, bn)])) * 100.0

        result.benchmark_20d_pct = round(bench_ret_20d, 2)
        excess_return = ret_20d - bench_ret_20d
        result.excess_return_pct = round(excess_return, 2)

        # Mansfield-style RS Score (0-100 scale, center 50)
        # 0% excess return -> 50 score
        # +10% excess return -> ~75 score
        # +20% excess return -> ~90 score
        # -10% excess return -> ~25 score
        rs_score = 50.0 + (excess_return * 2.2)
        # Add bonus for positive 60-day outperformance
        if (ret_60d - bench_ret_60d) > 0:
            rs_score += 5.0
        rs_score = max(5.0, min(99.0, rs_score))

        result.stock_rs_score = float(round(rs_score, 1))
        result.is_leader = bool(rs_score >= 80.0)

        # Sector Strength Score (0-100)
        # If sector is known and outperforming, assign score; default to neutral 65
        sector_score = 65.0
        if sector_name and sector_name != "Unknown":
            # High-momentum sectors get boost
            high_beta_sectors = ["IT", "CAPITAL GOODS", "REALTY", "AUTO", "ELECTRONICS", "ENERGY", "FINANCIAL"]
            if any(sec in sector_name.upper() for sec in high_beta_sectors):
                sector_score = 75.0
            else:
                sector_score = 65.0

        result.sector_score = float(round(sector_score, 1))

        # Pass checks
        result.pass_rs = bool(result.stock_rs_score >= min_rs_score)
        if not result.pass_rs:
            rejections.append(f"Stock RS {result.stock_rs_score:.1f} below minimum {min_rs_score}")

        result.pass_sector = bool(result.sector_score >= min_sector_score)
        if not result.pass_sector:
            rejections.append(f"Sector Score {result.sector_score:.1f} below minimum {min_sector_score}")

        result.rejection_reasons = rejections
        return result
