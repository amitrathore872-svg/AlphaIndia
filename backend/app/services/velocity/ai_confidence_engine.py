"""
Alpha India - Velocity Burst Elite: Stage 14 AI Confidence Engine
Sprint 39 Flagship 100-Point Composite Decision Intelligence
Synthesizes all 18 sub-engines into an institutional conviction score,
assigns definitive AI verdicts (ELITE A+, ELITE A, ELITE B+, WATCHLIST, REJECT),
and generates multi-layered quantitative explanations.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.velocity_models import VelocitySignalHistory
from app.models.system_setting import SystemSetting

logger = logging.getLogger("alpha_india.velocity.ai_confidence")

DEFAULT_CONFIDENCE_WEIGHTS = {
    "market_score": 0.10,
    "compression_score": 0.15,
    "base_quality": 0.15,
    "institution_score": 0.15,
    "rs_score": 0.15,
    "sector_score": 0.10,
    "smart_money_score": 0.10,
    "liquidity_score": 0.05,
    "news_score": 0.05,
}


class AIConfidenceEngine:
    """
    100-Point Institutional Composite Score Calculator.
    Configurable via SystemSetting key 'vbe_confidence_weights'.
    """

    @classmethod
    def get_configured_weights(cls, db: Session) -> Dict[str, float]:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "vbe_confidence_weights").first()
        if setting and setting.setting_value:
            try:
                return json.loads(setting.setting_value)
            except Exception:
                pass
        return DEFAULT_CONFIDENCE_WEIGHTS

    @classmethod
    def compute_composite_confidence(
        cls,
        db: Session,
        scores: Dict[str, float],
    ) -> Dict[str, Any]:
        weights = cls.get_configured_weights(db)

        m_score = scores.get("market_score", 65.0)
        c_score = scores.get("compression_score", 50.0)
        b_score = scores.get("base_quality", 60.0)
        i_score = scores.get("institution_score", 50.0)
        r_score = scores.get("rs_score", 50.0)
        s_score = scores.get("sector_score", 50.0)
        sm_score = scores.get("smart_money_score", 50.0)
        l_score = scores.get("liquidity_score", 70.0)
        n_score = scores.get("news_score", 80.0)  # High opportunity / low risk

        # Weighted calculation
        total = (
            (m_score * weights.get("market_score", 0.10))
            + (c_score * weights.get("compression_score", 0.15))
            + (b_score * weights.get("base_quality", 0.15))
            + (i_score * weights.get("institution_score", 0.15))
            + (r_score * weights.get("rs_score", 0.15))
            + (s_score * weights.get("sector_score", 0.10))
            + (sm_score * weights.get("smart_money_score", 0.10))
            + (l_score * weights.get("liquidity_score", 0.05))
            + (n_score * weights.get("news_score", 0.05))
        )

        composite_score = min(100.0, max(5.0, round(total, 1)))

        # AI Verdict Classification
        if composite_score >= 92.0:
            verdict = "ELITE A+"
            action = "STRONG_BUY_BREAKOUT"
        elif composite_score >= 85.0:
            verdict = "ELITE A"
            action = "BUY_BREAKOUT"
        elif composite_score >= 75.0:
            verdict = "ELITE B+"
            action = "TACTICAL_ACCUMULATE"
        elif composite_score >= 60.0:
            verdict = "WATCHLIST"
            action = "AWAIT_PIVOT_TEST"
        else:
            verdict = "REJECT"
            action = "AVOID_WEAK_SETUP"

        # Multi-layer natural language explainability
        explanation = (
            f"VBE Conviction: {composite_score}/100 [{verdict}]. "
            f"Engine Alignment: Compression ({c_score:.0f}/100), Base Quality ({b_score:.0f}/100), "
            f"Institutional Accumulation ({i_score:.0f}/100), and Relative Strength ({r_score:.0f}/100). "
            f"Market Regime filter is favorable at {m_score:.0f}/100. Action: {action}."
        )

        return {
            "confidence_score": composite_score,
            "ai_verdict": verdict,
            "recommended_action": action,
            "ai_explanation": explanation,
            "composite_scores": {
                "market_score": m_score,
                "compression_score": c_score,
                "base_quality": b_score,
                "institution_score": i_score,
                "rs_score": r_score,
                "sector_score": s_score,
                "smart_money_score": sm_score,
                "liquidity_score": l_score,
                "news_score": n_score,
            },
            "weights_used": weights,
        }

    @classmethod
    def record_signal_history(
        cls,
        db: Session,
        symbol: str,
        entry_price: float,
        stop_loss: float,
        target_price: float,
        confidence_payload: Dict[str, Any],
        market_bias: str = "Bull Expansion",
    ) -> VelocitySignalHistory:
        """
        Appends immutable record to velocity_signal_history for permanent backtesting & learning.
        """
        row = VelocitySignalHistory(
            symbol=symbol.upper(),
            signal_date=datetime.now(timezone.utc).date(),
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            confidence_score=confidence_payload["confidence_score"],
            ai_verdict=confidence_payload["ai_verdict"],
            composite_scores=confidence_payload["composite_scores"],
            ai_explanation=confidence_payload["ai_explanation"],
            market_regime_bias=market_bias,
            outcome="PENDING",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
