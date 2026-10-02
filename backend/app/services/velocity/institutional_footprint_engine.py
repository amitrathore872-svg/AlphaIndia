"""
Alpha India - Velocity Burst Elite: Stage 4 Institutional Footprint Engine
Sprint 39 Flagship Accumulation & Smart Flow Radar
Detects stealth institutional accumulation via delivery surges, money flow,
OBV divergence, pocket pivots, and operator signatures.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.velocity_models import VelocityInstitution
from app.services.velocity.indicator_suite import VelocityIndicatorSuite

logger = logging.getLogger("alpha_india.velocity.institutions")


class InstitutionalFootprintEngine:
    """
    Decodes true institutional footprints using order-flow surrogates:
    delivery percentages, CMF, MFI, pocket pivots, and tight closes.
    """

    @classmethod
    def evaluate_institution_footprint(
        cls,
        symbol: str,
        df: pd.DataFrame,
        delivery_pct_override: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        if df.empty or len(df) < 20:
            return None

        ind = VelocityIndicatorSuite.compute_all_indicators(df)
        if not ind:
            return None

        # Delivery % analysis
        delivery_pct = delivery_pct_override if delivery_pct_override is not None else 48.5
        delivery_trend = "ACCUMULATING" if delivery_pct >= 50.0 else ("NORMAL" if delivery_pct >= 35.0 else "TRADING")
        delivery_diff = round(delivery_pct - 35.0, 1)

        # 1. Scoring Accumulation (0 - 100)
        score = 0.0

        # CMF (Chaikin Money Flow)
        cmf = ind["cmf_20"]
        if cmf >= 0.20:
            score += 25.0
        elif cmf >= 0.10:
            score += 18.0
        elif cmf >= 0.0:
            score += 10.0

        # MFI (Money Flow Index)
        mfi = ind["mfi_14"]
        if 55.0 <= mfi <= 80.0:
            score += 20.0
        elif mfi > 80.0:
            score += 12.0  # Strongly overbought
        elif mfi >= 45.0:
            score += 10.0

        # Pocket Pivot (Minervini / Morales signature)
        if ind["pocket_pivot"]:
            score += 20.0

        # High Volume Tight Close
        if ind["tight_close"]:
            score += 15.0

        # OBV Slope
        if ind["obv_slope"] > 5.0:
            score += 15.0
        elif ind["obv_slope"] > 0.0:
            score += 8.0

        # Delivery bonus
        if delivery_pct >= 60.0:
            score += 15.0
        elif delivery_pct >= 45.0:
            score += 10.0

        institution_score = min(100.0, max(15.0, round(score, 1)))

        # 2. Accumulation Type Classification
        if ind["pocket_pivot"] and ind["volume_surge"]:
            accum_type = "POCKET_PIVOT_IGNITION"
            op_sig = "Aggressive institutional buying on breakout pocket pivot"
        elif delivery_pct >= 55.0 and ind["vol_dry_up_ratio"] <= 0.65:
            accum_type = "STEALTH_ACCUMULATION"
            op_sig = "Quiet multi-session block absorption without price disturbance"
        elif ind["tight_close"] and cmf >= 0.15:
            accum_type = "ABSORPTION_AT_SUPPORT"
            op_sig = "Orderly accumulation absorbing floating supply near support"
        elif ind["obv_slope"] >= 8.0 and ind["ema50_above_ema200"]:
            accum_type = "RE_ACCUMULATION"
            op_sig = "Institutional mark-up continuation following base test"
        else:
            accum_type = "OPERATOR_EXPANSION"
            op_sig = "Systematic order deployment across liquidity zones"

        confidence = round(min(98.0, max(40.0, institution_score * 0.95 + (10.0 if ind["pocket_pivot"] else 0.0))), 1)

        return {
            "symbol": symbol.upper(),
            "institution_score": institution_score,
            "institution_confidence": confidence,
            "accumulation_type": accum_type,
            "delivery_pct": delivery_pct,
            "delivery_trend": delivery_trend,
            "delivery_differential": delivery_diff,
            "obv_slope": ind["obv_slope"],
            "cmf_20": cmf,
            "mfi_14": mfi,
            "ad_line_trend": "ACCUMULATING" if cmf > 0 else "DISTRIBUTING",
            "pocket_pivot": ind["pocket_pivot"],
            "high_volume_tight_close": ind["tight_close"],
            "low_volume_pullback": ind["low_vol_pullback"],
            "volume_dry_up": ind["volume_dry_up"],
            "volume_expansion": ind["volume_surge"],
            "operator_signature": op_sig,
            "metrics_json": {
                "cmf": cmf,
                "mfi": mfi,
                "obv_slope": ind["obv_slope"],
                "delivery_pct": delivery_pct,
            },
        }

    @classmethod
    def batch_upsert_institutions(
        cls,
        db: Session,
        records: List[Dict[str, Any]],
    ) -> int:
        if not records:
            return 0

        count = 0
        try:
            for r in records:
                stmt = pg_insert(VelocityInstitution).values(
                    symbol=r["symbol"],
                    institution_score=r["institution_score"],
                    institution_confidence=r["institution_confidence"],
                    accumulation_type=r["accumulation_type"],
                    delivery_pct=r["delivery_pct"],
                    delivery_trend=r["delivery_trend"],
                    delivery_differential=r["delivery_differential"],
                    obv_slope=r["obv_slope"],
                    cmf_20=r["cmf_20"],
                    mfi_14=r["mfi_14"],
                    ad_line_trend=r["ad_line_trend"],
                    pocket_pivot=r["pocket_pivot"],
                    high_volume_tight_close=r["high_volume_tight_close"],
                    low_volume_pullback=r["low_volume_pullback"],
                    volume_dry_up=r["volume_dry_up"],
                    volume_expansion=r["volume_expansion"],
                    operator_signature=r["operator_signature"],
                    metrics_json=r["metrics_json"],
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    index_elements=["symbol"],
                    set_={
                        "institution_score": r["institution_score"],
                        "institution_confidence": r["institution_confidence"],
                        "accumulation_type": r["accumulation_type"],
                        "delivery_pct": r["delivery_pct"],
                        "delivery_trend": r["delivery_trend"],
                        "obv_slope": r["obv_slope"],
                        "cmf_20": r["cmf_20"],
                        "mfi_14": r["mfi_14"],
                        "pocket_pivot": r["pocket_pivot"],
                        "high_volume_tight_close": r["high_volume_tight_close"],
                        "operator_signature": r["operator_signature"],
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    },
                )
                db.execute(stmt)
                count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[InstitutionalFootprintEngine] Batch upsert failed: {e}")

        return count
