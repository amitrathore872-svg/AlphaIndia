"""
Alpha India - Multi-Timeframe VCP + 5-Minute VCB Research Strategy
Sprint 43 — Production-Grade MTF Quantitative Engine

Hierarchical Multi-Timeframe Structure:
1. Market Regime Gate (NIFTY EMA20/50 Trend & Slope)
2. Weekly VCP Structure (Prior Advance, Base, Progressive Contractions T1..T4, Volume/Volatility Contraction, Pivot Proximity)
3. Daily Confirmation (Daily Close > EMA20, EMA20 > EMA50, Positive Slope, Low Volatility)
4. Optional 15-Minute Intraday Confirmation (VWAP Alignment, 15m Trend & Compression)
5. Relative Strength Gate (Stock vs NIFTY 20d/60d Outperformance)
6. Sector Strength Gate (Sector Leadership / Tailwinds)
7. Exact 5-Minute VCB Breakout Trigger (All 9 Strict Baseline Rules)

STRICT NO-LOOKAHEAD GUARANTEE:
At bar t (5-minute candle):
- Weekly filter evaluates ONLY the last completed weekly bar.
- Daily filter evaluates ONLY the last completed daily bar (prior trading day).
- 15m filter evaluates ONLY the last completed 15m bar.
- Signals evaluate strictly at close of bar t; entry at t close / t+1 open.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.services.backtest.strategy_interface import BaseStrategy, StrategySignal
from app.services.backtest.vcp_detector import VCPDetector, VCPDetectionResult
from app.services.backtest.daily_confirmation import DailyConfirmationEngine, DailyConfirmationResult
from app.services.backtest.intraday_confirmation import IntradayConfirmationEngine, IntradayConfirmationResult
from app.services.backtest.relative_strength import RelativeStrengthCalculator, RelativeStrengthResult
from app.services.backtest.market_regime import MarketRegimeEngine as MarketRegimeClassifier
from app.services.backtest.vcb_strategy import VCBBreakoutStrategy

logger = logging.getLogger("alpha_india.backtest.mtf_vcp_vcb")


class MTFVCPVCBStrategy(BaseStrategy):
    """
    Multi-Timeframe VCP + 5-Minute VCB Research Strategy.
    Every filter layer is independently configurable and evaluated.
    """

    def __init__(
        self,
        parameters: Optional[Dict[str, Any]] = None,
        # Layer Enable/Disable Toggles
        enable_weekly_vcp: bool = True,
        enable_daily_confirmation: bool = True,
        enable_15m_confirmation: bool = False,
        enable_relative_strength: bool = False,
        enable_sector_strength: bool = False,
        enable_market_regime: bool = False,
        # Thresholds
        min_vcp_score: float = 65.0,
        min_daily_score: float = 65.0,
        min_15m_score: float = 60.0,
        min_rs_score: float = 60.0,
        min_sector_score: float = 55.0,
        min_market_score: float = 50.0,
        min_final_setup_score: float = 65.0,
        # VCP Specific Parameters
        min_prior_gain_pct: float = 20.0,
        max_base_depth_pct: float = 40.0,
        max_distance_to_pivot_pct: float = 5.0,
        min_contractions: int = 2,
        # Baseline 5m VCB Parameters
        vcb_resistance_lookback: int = 12,
        vcb_volume_mult: float = 2.0,
        vcb_compression_pct: float = 0.02,
        vcb_atr_ratio: float = 0.70,
        vcb_volume_contraction_ratio: float = 0.80,
        vcb_max_extension_pct: float = 0.01,
        # External High-Timeframe Data Containers (injected per symbol)
        daily_df: Optional[pd.DataFrame] = None,
        weekly_df: Optional[pd.DataFrame] = None,
        candles_15m: Optional[pd.DataFrame] = None,
        benchmark_daily_df: Optional[pd.DataFrame] = None,
        sector_name: Optional[str] = None,
        **kwargs,
    ):
        p = parameters or {}
        self.enable_weekly_vcp = p.get("enable_weekly_vcp", enable_weekly_vcp)
        self.enable_daily_confirmation = p.get("enable_daily_confirmation", enable_daily_confirmation)
        self.enable_15m_confirmation = p.get("enable_15m_confirmation", enable_15m_confirmation)
        self.enable_relative_strength = p.get("enable_relative_strength", enable_relative_strength)
        self.enable_sector_strength = p.get("enable_sector_strength", enable_sector_strength)
        self.enable_market_regime = p.get("enable_market_regime", enable_market_regime)

        self.min_vcp_score = float(p.get("min_vcp_score", min_vcp_score))
        self.min_daily_score = float(p.get("min_daily_score", min_daily_score))
        self.min_15m_score = float(p.get("min_15m_score", min_15m_score))
        self.min_rs_score = float(p.get("min_rs_score", min_rs_score))
        self.min_sector_score = float(p.get("min_sector_score", min_sector_score))
        self.min_market_score = float(p.get("min_market_score", min_market_score))
        self.min_final_setup_score = float(p.get("min_final_setup_score", min_final_setup_score))

        self.vcp_detector = VCPDetector(
            min_prior_gain_pct=min_prior_gain_pct,
            max_base_depth_pct=max_base_depth_pct,
            max_distance_to_pivot_pct=max_distance_to_pivot_pct,
            min_contractions=min_contractions,
            min_vcp_score=min_vcp_score,
        )

        self.vcb_baseline = VCBBreakoutStrategy(
            parameters={
                "resistance_bars": vcb_resistance_lookback,
                "volume_expansion_factor": vcb_volume_mult,
                "compression_range_pct": vcb_compression_pct,
                "atr_compression_ratio": vcb_atr_ratio,
                "volume_contraction_ratio": vcb_volume_contraction_ratio,
                "max_extension_pct": vcb_max_extension_pct,
            }
        )

        self.daily_df = daily_df
        self.weekly_df = weekly_df
        self.candles_15m = candles_15m
        self.benchmark_daily_df = benchmark_daily_df
        self.sector_name = sector_name

    def strategy_metadata(self) -> Dict[str, Any]:
        return {
            "name": "MTF_VCP_VCB",
            "timeframe": "5m (Multi-Timeframe Gated)",
            "description": "Multi-Timeframe VCP (Weekly) + Daily Confirmation + 15m + Relative Strength + 5m VCB Breakout",
            "layers": [
                "Weekly VCP Structure (Prior Advance, Base, T1..T4 Contractions)",
                "Daily Confirmation (EMA20/50 alignment, slope, controlled volatility)",
                "15-Minute Confirmation (VWAP, 15m trend & compression)",
                "Relative Strength (Stock vs NIFTY 20d/60d excess return)",
                "Sector Strength (Sector leadership score)",
                "Market Regime (NIFTY 20/50 EMA market trend)",
                "5-Minute VCB Breakout (Exact 9 baseline rules)",
            ],
        }

    def set_higher_timeframe_data(
        self,
        daily_df: Optional[pd.DataFrame] = None,
        weekly_df: Optional[pd.DataFrame] = None,
        candles_15m: Optional[pd.DataFrame] = None,
        benchmark_daily_df: Optional[pd.DataFrame] = None,
        sector_name: Optional[str] = None,
    ):
        """Injects symbol-specific higher-timeframe datasets."""
        self.daily_df = daily_df
        self.weekly_df = weekly_df
        self.candles_15m = candles_15m
        self.benchmark_daily_df = benchmark_daily_df
        self.sector_name = sector_name

    def prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepares 5-minute candles using baseline VCB engine."""
        return self.vcb_baseline.prepare_data(df)

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculates indicators on 5-minute candles using baseline VCB engine."""
        return self.vcb_baseline.calculate_indicators(df)

    def generate_signals(self, df: pd.DataFrame, symbol: str = "EQUITY", **kwargs) -> List[StrategySignal]:
        """
        Generates signals enforcing multi-timeframe gating before 5m VCB trigger.
        """
        # First, run 5m VCB baseline signal generator
        baseline_signals = self.vcb_baseline.generate_signals(df, symbol=symbol)
        if not baseline_signals:
            return []

        qualified_signals: List[StrategySignal] = []

        # Standardize dates on higher timeframe data if available
        d_df = self.daily_df.copy() if self.daily_df is not None else None
        if d_df is not None and not d_df.empty:
            if "Datetime" in d_df.columns:
                d_df["Date"] = pd.to_datetime(d_df["Datetime"]).dt.date
            elif isinstance(d_df.index, pd.DatetimeIndex):
                d_df["Date"] = d_df.index.date

        w_df = self.weekly_df.copy() if self.weekly_df is not None else None
        if w_df is not None and not w_df.empty:
            if "Datetime" in w_df.columns:
                w_df["Date"] = pd.to_datetime(w_df["Datetime"]).dt.date
            elif isinstance(w_df.index, pd.DatetimeIndex):
                w_df["Date"] = w_df.index.date

        # Evaluate every baseline breakout signal against MTF gates
        for sig in baseline_signals:
            sig_ts = sig.timestamp
            sig_date = sig_ts.date() if hasattr(sig_ts, "date") else pd.to_datetime(sig_ts).date()

            # Diagnostic Score Trackers
            vcp_res = VCPDetectionResult(is_valid_vcp=True, vcp_score=75.0)
            daily_res = DailyConfirmationResult(pass_daily=True, daily_score=75.0)
            intraday_res = IntradayConfirmationResult(pass_15m=True, intraday_score=75.0)
            rs_res = RelativeStrengthResult(pass_rs=True, pass_sector=True, stock_rs_score=70.0, sector_score=70.0)
            market_score = 70.0
            pass_market = True

            # ---------------------------------------------------------
            # GATE 1: Market Regime (NIFTY EMA trend)
            # ---------------------------------------------------------
            if self.enable_market_regime and self.benchmark_daily_df is not None:
                # Strictly completed daily benchmark bars prior to sig_date
                b_df = self.benchmark_daily_df.copy()
                if "Datetime" in b_df.columns:
                    b_df["Date"] = pd.to_datetime(b_df["Datetime"]).dt.date
                comp_bench = b_df[b_df["Date"] < sig_date] if "Date" in b_df.columns else b_df
                if not comp_bench.empty and len(comp_bench) >= 20:
                    b_closes = comp_bench["Close"].values
                    b_ema20 = float(pd.Series(b_closes).ewm(span=20, adjust=False).mean().iloc[-1])
                    b_ema50 = float(pd.Series(b_closes).ewm(span=min(50, len(b_closes)), adjust=False).mean().iloc[-1])
                    b_curr = float(b_closes[-1])
                    if b_curr >= b_ema20 and b_ema20 >= b_ema50:
                        market_score = 90.0  # Strong Bullish
                    elif b_curr >= b_ema50:
                        market_score = 75.0  # Bullish
                    elif b_curr >= b_ema20:
                        market_score = 60.0  # Neutral
                    else:
                        market_score = 35.0  # Bearish
                    pass_market = (market_score >= self.min_market_score)
                else:
                    pass_market = True
            if not pass_market:
                continue

            # ---------------------------------------------------------
            # GATE 2: Weekly VCP Structure
            # ---------------------------------------------------------
            if self.enable_weekly_vcp and w_df is not None and not w_df.empty:
                # NO-LOOKAHEAD: Only weekly candles ending strictly before the current week
                start_of_current_week = sig_date - timedelta(days=sig_date.weekday())
                comp_weekly = w_df[w_df["Date"] < start_of_current_week]
                if len(comp_weekly) >= 15:
                    vcp_res = self.vcp_detector.detect(comp_weekly)
                    if not vcp_res.is_valid_vcp or vcp_res.vcp_score < self.min_vcp_score:
                        continue
                else:
                    # If insufficient weekly history, reject when gate is strictly enabled
                    continue

            # ---------------------------------------------------------
            # GATE 3: Daily Confirmation
            # ---------------------------------------------------------
            if self.enable_daily_confirmation and d_df is not None and not d_df.empty:
                # NO-LOOKAHEAD: Strictly completed daily candles prior to current trading date
                comp_daily = d_df[d_df["Date"] < sig_date]
                if len(comp_daily) >= 20:
                    pivot = vcp_res.pivot_price if vcp_res.pivot_price > 0 else None
                    daily_res = DailyConfirmationEngine.evaluate(comp_daily, pivot_price=pivot, min_score=self.min_daily_score)
                    if not daily_res.pass_daily:
                        continue
                else:
                    continue

            # ---------------------------------------------------------
            # GATE 4: 15-Minute Confirmation (Optional)
            # ---------------------------------------------------------
            if self.enable_15m_confirmation and self.candles_15m is not None and not self.candles_15m.empty:
                # NO-LOOKAHEAD: Strictly 15m candles completed before current 5m bar timestamp
                fifteen_df = self.candles_15m.copy()
                fifteen_dt = pd.to_datetime(fifteen_df["Datetime"])
                comp_15m = fifteen_df[fifteen_dt < pd.to_datetime(sig_ts)]
                if len(comp_15m) >= 6:
                    intraday_res = IntradayConfirmationEngine.evaluate(comp_15m, current_5m_price=sig.entry_price, min_score=self.min_15m_score)
                    if not intraday_res.pass_15m:
                        continue
                else:
                    continue

            # ---------------------------------------------------------
            # GATE 5 & 6: Relative Strength & Sector Strength (Optional)
            # ---------------------------------------------------------
            if (self.enable_relative_strength or self.enable_sector_strength) and d_df is not None and not d_df.empty:
                comp_daily = d_df[d_df["Date"] < sig_date]
                comp_bench = None
                if self.benchmark_daily_df is not None:
                    b_df = self.benchmark_daily_df.copy()
                    if "Datetime" in b_df.columns:
                        b_df["Date"] = pd.to_datetime(b_df["Datetime"]).dt.date
                    comp_bench = b_df[b_df["Date"] < sig_date] if "Date" in b_df.columns else b_df

                rs_res = RelativeStrengthCalculator.evaluate(
                    stock_daily_df=comp_daily,
                    benchmark_daily_df=comp_bench,
                    sector_name=self.sector_name,
                    min_rs_score=self.min_rs_score,
                    min_sector_score=self.min_sector_score,
                )

                if self.enable_relative_strength and not rs_res.pass_rs:
                    continue
                if self.enable_sector_strength and not rs_res.pass_sector:
                    continue

            # ---------------------------------------------------------
            # Compute Final MTF Setup Score (0-100)
            # ---------------------------------------------------------
            # Weighted average across enabled dimensions
            weights = {
                "vcp": 0.35 if self.enable_weekly_vcp else 0.0,
                "daily": 0.25 if self.enable_daily_confirmation else 0.0,
                "15m": 0.15 if self.enable_15m_confirmation else 0.0,
                "rs": 0.15 if self.enable_relative_strength else 0.0,
                "sector": 0.05 if self.enable_sector_strength else 0.0,
                "market": 0.05 if self.enable_market_regime else 0.0,
            }
            total_w = sum(weights.values())
            if total_w > 0:
                final_score = (
                    vcp_res.vcp_score * weights["vcp"] +
                    daily_res.daily_score * weights["daily"] +
                    intraday_res.intraday_score * weights["15m"] +
                    rs_res.stock_rs_score * weights["rs"] +
                    rs_res.sector_score * weights["sector"] +
                    market_score * weights["market"]
                ) / total_w
            else:
                final_score = 80.0

            if final_score < self.min_final_setup_score:
                continue

            # Augment signal metadata with forensic MTF diagnostics
            sig.strategy = "MTF_VCP_VCB"
            sig.metadata["vcp_score"] = float(round(vcp_res.vcp_score, 1))
            sig.metadata["vcp_quality_bucket"] = vcp_res.quality_bucket
            sig.metadata["daily_score"] = float(round(daily_res.daily_score, 1))
            sig.metadata["intraday_score"] = float(round(intraday_res.intraday_score, 1))
            sig.metadata["rs_score"] = float(round(rs_res.stock_rs_score, 1))
            sig.metadata["sector_score"] = float(round(rs_res.sector_score, 1))
            sig.metadata["market_score"] = float(round(market_score, 1))
            sig.metadata["final_setup_score"] = float(round(final_score, 1))

            # VCP Geometry
            sig.metadata["vcp_contractions"] = int(vcp_res.geometry.contraction_count)
            sig.metadata["t1_depth_pct"] = float(vcp_res.geometry.t1_depth_pct)
            sig.metadata["t2_depth_pct"] = float(vcp_res.geometry.t2_depth_pct)
            sig.metadata["t3_depth_pct"] = float(vcp_res.geometry.t3_depth_pct)
            sig.metadata["t4_depth_pct"] = float(vcp_res.geometry.t4_depth_pct)
            sig.metadata["vcp_tightening_ratio"] = float(vcp_res.geometry.tightening_ratio)
            sig.metadata["pivot_price"] = float(vcp_res.pivot_price)
            sig.metadata["distance_to_pivot_pct"] = float(vcp_res.distance_to_pivot_pct)

            qualified_signals.append(sig)

        return qualified_signals
