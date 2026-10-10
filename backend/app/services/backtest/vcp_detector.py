"""
Alpha India - Institutional Weekly VCP Detector
Sprint 43 — Multi-Timeframe VCP Research Engine

Implements Mark Minervini Volatility Contraction Pattern (VCP) detection on completed WEEKLY candles:
1. Prior Advance Detection (20-40% prior uptrend)
2. Base / Consolidation Detection (15-50 weekly candles)
3. Progressive Contractions (T1 > T2 > T3 > T4, supporting 2 to 5 waves)
4. Volume Contraction across successive waves
5. Volatility Contraction (ATR14 vs SMA(ATR, 50))
6. Pivot / Resistance Identification & Proximity
7. Transparent Weighted VCP Score (0-100) & Quality Buckets (A+, A, B, C, Reject)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class VCPWaveGeometry:
    contraction_count: int = 0
    t1_depth_pct: float = 0.0
    t2_depth_pct: float = 0.0
    t3_depth_pct: float = 0.0
    t4_depth_pct: float = 0.0
    t5_depth_pct: float = 0.0
    tightening_ratio: float = 0.0
    is_progressively_tightening: bool = False
    swing_highs: List[float] = field(default_factory=list)
    swing_lows: List[float] = field(default_factory=list)
    wave_volumes: List[float] = field(default_factory=list)


@dataclass
class VCPDetectionResult:
    is_valid_vcp: bool = False
    vcp_score: float = 0.0
    quality_bucket: str = "REJECT"  # A+, A, B, C, REJECT
    prior_advance_score: float = 0.0
    base_score: float = 0.0
    contraction_score: float = 0.0
    volume_score: float = 0.0
    volatility_score: float = 0.0
    pivot_proximity_score: float = 0.0
    
    # Structural Metrics
    prior_gain_pct: float = 0.0
    base_depth_pct: float = 0.0
    base_length_bars: int = 0
    pivot_price: float = 0.0
    current_price: float = 0.0
    distance_to_pivot_pct: float = 0.0
    geometry: VCPWaveGeometry = field(default_factory=VCPWaveGeometry)
    rejection_reasons: List[str] = field(default_factory=list)


class VCPDetector:
    """
    Forensic Mark Minervini VCP Detector operating on completed Weekly candles.
    """

    def __init__(
        self,
        min_prior_gain_pct: float = 20.0,
        prior_lookback_bars: int = 20,
        min_base_length: int = 8,
        max_base_length: int = 50,
        max_base_depth_pct: float = 45.0,
        max_distance_to_pivot_pct: float = 20.0,
        min_contractions: int = 2,
        max_contractions: int = 5,
        min_vcp_score: float = 60.0,
    ):
        self.min_prior_gain_pct = min_prior_gain_pct
        self.prior_lookback_bars = prior_lookback_bars
        self.min_base_length = min_base_length
        self.max_base_length = max_base_length
        self.max_base_depth_pct = max_base_depth_pct
        self.max_distance_to_pivot_pct = max_distance_to_pivot_pct
        self.min_contractions = min_contractions
        self.max_contractions = max_contractions
        self.min_vcp_score = min_vcp_score

    def detect(self, weekly_df: pd.DataFrame) -> VCPDetectionResult:
        """
        Evaluates a sequence of completed weekly candles.
        weekly_df must contain ['Open', 'High', 'Low', 'Close', 'Volume'].
        """
        result = VCPDetectionResult()
        rejections: List[str] = []

        if weekly_df is None or len(weekly_df) < (self.min_base_length + 2):
            rejections.append(f"Insufficient weekly bars ({len(weekly_df) if weekly_df is not None else 0}; need at least {self.min_base_length + 2})")
            result.rejection_reasons = rejections
            return result

        df = weekly_df.copy().dropna(subset=["Close", "High", "Low", "Volume"])
        n = len(df)
        closes = df["Close"].values
        highs = df["High"].values
        lows = df["Low"].values
        volumes = df["Volume"].values

        current_price = float(closes[-1])
        result.current_price = current_price

        # -------------------------------------------------------------
        # 1. Base Detection
        # -------------------------------------------------------------
        # Look back over base window (e.g. 15-35 bars)
        base_len = min(self.max_base_length, max(self.min_base_length, int(n * 0.6)))
        base_start = n - base_len
        base_highs = highs[base_start:]
        base_lows = lows[base_start:]
        base_vols = volumes[base_start:]

        base_high = float(np.max(base_highs))
        base_low = float(np.min(base_lows))
        base_depth_pct = ((base_high - base_low) / max(0.01, base_high)) * 100.0

        result.base_length_bars = base_len
        result.base_depth_pct = round(base_depth_pct, 2)
        result.pivot_price = round(base_high, 2)

        # Base depth scoring: Ideal base depth is 10% - 30%
        if base_depth_pct <= 25.0:
            base_score = 95.0
        elif base_depth_pct <= 35.0:
            base_score = 80.0
        elif base_depth_pct <= self.max_base_depth_pct:
            base_score = 65.0
        else:
            base_score = 40.0
            rejections.append(f"Base depth {base_depth_pct:.1f}% exceeds max {self.max_base_depth_pct}%")

        result.base_score = round(base_score, 1)

        # -------------------------------------------------------------
        # 2. Prior Advance Detection
        # -------------------------------------------------------------
        # Check trend prior to the start of the base
        prior_window = min(self.prior_lookback_bars, base_start)
        if prior_window >= 5:
            prior_low = float(np.min(lows[base_start - prior_window : base_start]))
            prior_high = float(np.max(highs[base_start - prior_window : base_start + 4]))
            prior_gain_pct = ((prior_high - prior_low) / max(0.01, prior_low)) * 100.0
        else:
            # Fallback if history starts close to base
            prior_low = float(np.min(lows[:max(5, base_start)]))
            prior_gain_pct = ((base_high - prior_low) / max(0.01, prior_low)) * 100.0

        result.prior_gain_pct = round(prior_gain_pct, 1)

        if prior_gain_pct >= 40.0:
            advance_score = 95.0
        elif prior_gain_pct >= 30.0:
            advance_score = 85.0
        elif prior_gain_pct >= self.min_prior_gain_pct:
            advance_score = 75.0
        elif prior_gain_pct >= 10.0:
            advance_score = 55.0
        else:
            advance_score = 30.0
            rejections.append(f"Prior advance {prior_gain_pct:.1f}% below threshold {self.min_prior_gain_pct}%")

        result.prior_advance_score = round(advance_score, 1)

        # -------------------------------------------------------------
        # 3. Progressive Contraction Detection (T1 > T2 > T3 > T4)
        # -------------------------------------------------------------
        geometry = self._detect_contractions(highs[base_start:], lows[base_start:], volumes[base_start:])
        result.geometry = geometry

        # Contraction Scoring
        c_count = geometry.contraction_count
        if c_count < self.min_contractions:
            contraction_score = 35.0
            rejections.append(f"Only {c_count} contractions detected (min required: {self.min_contractions})")
        else:
            # Score based on count and progressive tightening
            base_c_score = 70.0 + min(20.0, (c_count - 2) * 10.0)
            if geometry.is_progressively_tightening:
                base_c_score += 10.0
            contraction_score = min(100.0, base_c_score)

        result.contraction_score = round(contraction_score, 1)

        # -------------------------------------------------------------
        # 4. Volume Contraction Across Waves
        # -------------------------------------------------------------
        vol_score = 65.0
        if len(geometry.wave_volumes) >= 2:
            first_vol = geometry.wave_volumes[0]
            last_vol = geometry.wave_volumes[-1]
            vol_ratio = (last_vol / max(1.0, first_vol))
            if vol_ratio < 0.70:
                vol_score = 95.0
            elif vol_ratio < 0.85:
                vol_score = 85.0
            elif vol_ratio <= 1.05:
                vol_score = 75.0
            else:
                vol_score = 50.0
        else:
            # Fallback: check 5-bar vs 20-bar volume
            v5 = float(np.mean(volumes[-5:]))
            v20 = float(np.mean(volumes[-min(20, len(volumes)):]))
            if v5 < v20 * 0.8:
                vol_score = 85.0
            elif v5 < v20:
                vol_score = 75.0

        result.volume_score = round(vol_score, 1)

        # -------------------------------------------------------------
        # 5. Volatility Contraction (ATR14 vs SMA(ATR, 50))
        # -------------------------------------------------------------
        tr = np.maximum(highs[1:] - lows[1:], np.abs(highs[1:] - closes[:-1]))
        tr = np.maximum(tr, np.abs(lows[1:] - closes[:-1]))
        atr_14 = pd.Series(tr).rolling(14).mean().dropna().values

        if len(atr_14) >= 20:
            atr_current = float(atr_14[-1])
            atr_sma50 = float(np.mean(atr_14[-min(50, len(atr_14)):]))
            atr_ratio = atr_current / max(0.01, atr_sma50)
            if atr_ratio < 0.70:
                volat_score = 95.0
            elif atr_ratio < 0.85:
                volat_score = 85.0
            elif atr_ratio <= 1.00:
                volat_score = 70.0
            else:
                volat_score = 50.0
        else:
            volat_score = 70.0

        result.volatility_score = round(volat_score, 1)

        # -------------------------------------------------------------
        # 6. Pivot Proximity
        # -------------------------------------------------------------
        dist_to_pivot_pct = ((base_high - current_price) / max(0.01, base_high)) * 100.0
        result.distance_to_pivot_pct = round(dist_to_pivot_pct, 2)

        if -1.0 <= dist_to_pivot_pct <= 2.0:
            pivot_score = 95.0
        elif dist_to_pivot_pct <= 3.5:
            pivot_score = 85.0
        elif dist_to_pivot_pct <= self.max_distance_to_pivot_pct:
            pivot_score = 70.0
        elif dist_to_pivot_pct < -1.0:
            # Overextended past pivot
            pivot_score = 50.0
            rejections.append(f"Price is {-dist_to_pivot_pct:.1f}% above pivot (overextended)")
        else:
            pivot_score = 40.0
            rejections.append(f"Distance to pivot {dist_to_pivot_pct:.1f}% exceeds max {self.max_distance_to_pivot_pct}%")

        result.pivot_proximity_score = round(pivot_score, 1)

        # -------------------------------------------------------------
        # 7. Overall Weighted VCP Score & Quality Bucket
        # -------------------------------------------------------------
        # Transparent weights: Contraction (30%), Base (20%), Prior Advance (15%), Pivot (15%), Volume (10%), Volatility (10%)
        total_score = (
            result.contraction_score * 0.30 +
            result.base_score * 0.20 +
            result.prior_advance_score * 0.15 +
            result.pivot_proximity_score * 0.15 +
            result.volume_score * 0.10 +
            result.volatility_score * 0.10
        )
        result.vcp_score = round(total_score, 1)

        # Assign Quality Bucket
        if result.vcp_score >= 90.0:
            result.quality_bucket = "A+"
        elif result.vcp_score >= 80.0:
            result.quality_bucket = "A"
        elif result.vcp_score >= 70.0:
            result.quality_bucket = "B"
        elif result.vcp_score >= 60.0:
            result.quality_bucket = "C"
        else:
            result.quality_bucket = "REJECT"

        result.is_valid_vcp = (
            result.vcp_score >= self.min_vcp_score and
            geometry.contraction_count >= self.min_contractions and
            dist_to_pivot_pct <= self.max_distance_to_pivot_pct
        )
        result.rejection_reasons = rejections

        return result

    def _detect_contractions(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        volumes: np.ndarray,
    ) -> VCPWaveGeometry:
        """
        Detects multiple contraction waves (T1, T2, T3, T4...) from swing points.
        """
        geom = VCPWaveGeometry()
        m = len(highs)
        if m < 8:
            return geom

        # Find rolling local extrema with window 2
        peaks: List[Tuple[int, float]] = []
        troughs: List[Tuple[int, float]] = []

        window = 2
        for i in range(window, m - window):
            if highs[i] == np.max(highs[i - window : i + window + 1]):
                peaks.append((i, float(highs[i])))
            if lows[i] == np.min(lows[i - window : i + window + 1]):
                troughs.append((i, float(lows[i])))

        # Segment fallback if peaks/troughs are sparse
        if len(peaks) < 2 or len(troughs) < 2:
            segments = 4
            seg_len = m // segments
            peaks = []
            troughs = []
            for s in range(segments):
                st = s * seg_len
                en = min(m, (s + 1) * seg_len)
                if en > st:
                    p_i = st + int(np.argmax(highs[st:en]))
                    t_i = st + int(np.argmin(lows[st:en]))
                    peaks.append((p_i, float(highs[p_i])))
                    troughs.append((t_i, float(lows[t_i])))

        # Pair contractions
        waves: List[float] = []
        wave_vols: List[float] = []
        sw_highs: List[float] = []
        sw_lows: List[float] = []

        pairs_count = min(len(peaks), len(troughs))
        for p in range(pairs_count):
            pk_i, pk_val = peaks[p]
            tr_i, tr_val = troughs[p]
            if pk_val > 0 and pk_val > tr_val:
                pullback_pct = ((pk_val - tr_val) / pk_val) * 100.0
                if 0.5 <= pullback_pct <= 45.0:
                    waves.append(round(pullback_pct, 1))
                    sw_highs.append(round(pk_val, 2))
                    sw_lows.append(round(tr_val, 2))
                    st_bar = min(pk_i, tr_i)
                    en_bar = max(pk_i, tr_i)
                    wave_vols.append(float(np.mean(volumes[st_bar : en_bar + 1])))

        # Cap to 5 most recent waves
        if len(waves) > 5:
            waves = waves[-5:]
            sw_highs = sw_highs[-5:]
            sw_lows = sw_lows[-5:]
            wave_vols = wave_vols[-5:]

        geom.contraction_count = len(waves)
        geom.swing_highs = sw_highs
        geom.swing_lows = sw_lows
        geom.wave_volumes = wave_vols

        if len(waves) >= 1:
            geom.t1_depth_pct = waves[0]
        if len(waves) >= 2:
            geom.t2_depth_pct = waves[1]
        if len(waves) >= 3:
            geom.t3_depth_pct = waves[2]
        if len(waves) >= 4:
            geom.t4_depth_pct = waves[3]
        if len(waves) >= 5:
            geom.t5_depth_pct = waves[4]

        # Progressive tightening check: each wave tighter than prior (with 1.5% margin for noise)
        tightening = True
        for i in range(1, len(waves)):
            if waves[i] > (waves[i - 1] + 1.5):
                tightening = False
                break
        geom.is_progressively_tightening = tightening

        if len(waves) >= 2 and waves[0] > 0:
            geom.tightening_ratio = round(waves[-1] / waves[0], 2)
        else:
            geom.tightening_ratio = 1.0

        return geom
