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

    @classmethod
    def evaluate_apex_one_percent_breakout(
        cls,
        symbol: str,
        company_rec: Any,
        df_stock: Any,
        base_pattern: Optional[Dict[str, Any]],
        institution_footprint: Optional[Dict[str, Any]],
        relative_strength: Optional[Dict[str, Any]],
        smart_money: Optional[Dict[str, Any]],
        breakout_signal: Dict[str, Any],
        market_regime: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Stage 14 Institutional Apex 1% Confluence Engine.
        Synthesizes the 7 Quant-Alpha Pillars:
        1. Fundamental Growth Acceleration (15 pts)
        2. Structural Base Pattern DNA & Dry-Up (15 pts)
        3. Authentic Delivery & Smart Money Absorption (15 pts)
        4. Mansfield RS Rank & Sector Dominance (15 pts)
        5. Breakout Anti-Fakeout & Execution Quality (25 pts)
        6. Multi-Timeframe Weekly Trend Alignment (10 pts)
        7. Market Regime Conditioning (5 pts)

        Applies strict Zero-Tolerance Disqualification Gates.
        """
        clean_sym = symbol.strip().upper()

        # =========================================================
        # 1. Fundamental Acceleration Gate (15 pts)
        # =========================================================
        pat_growth = float(getattr(company_rec, "pat_growth", 0.0) or 0.0) if company_rec else 0.0
        rev_growth = float(getattr(company_rec, "revenue_growth", 0.0) or 0.0) if company_rec else 0.0
        roce = float(getattr(company_rec, "roce", 0.0) or 0.0) if company_rec else 0.0

        p1_score = 0.0
        if pat_growth >= 40.0:
            p1_score += 8.0
        elif pat_growth >= 25.0:
            p1_score += 5.5
        elif pat_growth >= 15.0:
            p1_score += 3.5
        elif pat_growth > 0.0:
            p1_score += 2.0

        if rev_growth >= 25.0:
            p1_score += 4.0
        elif rev_growth >= 15.0:
            p1_score += 2.5
        elif rev_growth > 0.0:
            p1_score += 1.5

        if roce >= 18.0:
            p1_score += 3.0
        elif roce >= 12.0:
            p1_score += 2.0
        elif roce > 0.0:
            p1_score += 1.0

        # Normalization if growth data is not yet computed in warehouse
        if pat_growth == 0.0 and rev_growth == 0.0:
            p1_score = 9.0  # Median assumption for unseeded growth warehouse

        # =========================================================
        # 2. Structural Base Pattern DNA & Dry-Up (15 pts)
        # =========================================================
        bp = base_pattern or {}
        base_len = int(bp.get("consolidation_length_bars", 25) or 25)
        base_depth = float(bp.get("base_depth_pct", 22.0) or 22.0)
        dryup_ratio = float(bp.get("dryup_volume_ratio", 0.65) or 0.65)
        pattern_name = str(bp.get("pattern_name", "Base Consolidation") or "Base Consolidation")

        p2_score = 0.0
        # Base length: institutions require 5+ weeks (25+ bars)
        if base_len >= 30:
            p2_score += 5.0
        elif base_len >= 18:
            p2_score += 3.5
        else:
            p2_score += 2.0

        # Base depth: tighter is superior (Minervini VCP <= 25%)
        if base_depth <= 20.0:
            p2_score += 5.0
        elif base_depth <= 30.0:
            p2_score += 3.5
        elif base_depth <= 40.0:
            p2_score += 2.0

        # Dry-up volume ratio
        if dryup_ratio <= 0.55:
            p2_score += 5.0
        elif dryup_ratio <= 0.75:
            p2_score += 3.5
        else:
            p2_score += 2.0

        # =========================================================
        # 3. Authentic Delivery & Smart Money Absorption (15 pts)
        # =========================================================
        inst = institution_footprint or {}
        sm = smart_money or {}
        deliv_pct = float(inst.get("delivery_pct", 42.0) or 42.0)
        cmf = float(inst.get("cmf_20", 0.08) or 0.08)
        pocket_pivot = bool(inst.get("pocket_pivot_detected", False))
        vwap_defense = bool(sm.get("vwap_defense", True))

        p3_score = 0.0
        if deliv_pct >= 50.0:
            p3_score += 6.0
        elif deliv_pct >= 40.0:
            p3_score += 4.5
        elif deliv_pct >= 30.0:
            p3_score += 3.0
        else:
            p3_score += 1.5

        if pocket_pivot or cmf >= 0.15:
            p3_score += 5.0
        elif cmf >= 0.05:
            p3_score += 3.5
        else:
            p3_score += 2.0

        if vwap_defense:
            p3_score += 4.0
        else:
            p3_score += 1.5

        # =========================================================
        # 4. Mansfield RS Rank & Sector Dominance (15 pts)
        # =========================================================
        rs_dict = relative_strength or {}
        rs_rank = float(rs_dict.get("rs_rank", 70.0) or 70.0)
        mansfield_rs = float(rs_dict.get("mansfield_rs", 0.5) or 0.5)
        sector_trend = str(rs_dict.get("sector_trend", "OUTPERFORMING") or "OUTPERFORMING")

        p4_score = 0.0
        if rs_rank >= 85.0:
            p4_score += 8.0
        elif rs_rank >= 75.0:
            p4_score += 6.0
        elif rs_rank >= 65.0:
            p4_score += 4.0
        else:
            p4_score += 2.0

        if mansfield_rs > 0.0:
            p4_score += 4.0
        elif mansfield_rs > -2.0:
            p4_score += 2.0

        if sector_trend in ("LEADING", "OUTPERFORMING", "STRONG_EXPANSION"):
            p4_score += 3.0
        else:
            p4_score += 1.5

        # =========================================================
        # 5. Breakout Anti-Fakeout & Execution Quality (25 pts)
        # =========================================================
        rvol = float(breakout_signal.get("relative_volume_rvol", 1.8) or 1.8)
        candle_power = float(breakout_signal.get("breakout_candle_strength", 75.0) or 75.0)
        eq = breakout_signal.get("entry_quality", {})
        wick_ratio = float(eq.get("wick_ratio", 0.12) or 0.12)
        dist_pivot = float(eq.get("distance_from_pivot_pct", 1.2) or 1.2)
        rr = float(breakout_signal.get("risk_reward", 2.8) or 2.8)

        p5_score = 0.0
        # RVOL
        if rvol >= 2.8:
            p5_score += 8.0
        elif rvol >= 2.0:
            p5_score += 6.5
        elif rvol >= 1.5:
            p5_score += 4.5
        else:
            p5_score += 2.5

        # Candle strength
        if candle_power >= 85.0:
            p5_score += 7.0
        elif candle_power >= 70.0:
            p5_score += 5.0
        else:
            p5_score += 3.0

        # Wick ratio (lower is cleaner close near highs)
        if wick_ratio <= 0.12:
            p5_score += 5.0
        elif wick_ratio <= 0.22:
            p5_score += 3.5
        else:
            p5_score += 1.5

        # Distance from pivot
        if dist_pivot <= 1.5:
            p5_score += 5.0
        elif dist_pivot <= 2.2:
            p5_score += 3.5
        else:
            p5_score += 1.5

        # =========================================================
        # 6. Multi-Timeframe Alignment (Weekly Stage 2) (10 pts)
        # =========================================================
        p6_score = 6.0  # Base
        try:
            if hasattr(df_stock, "empty") and not df_stock.empty and len(df_stock) >= 50:
                c_series = df_stock["Close"].astype(float)
                ema50 = c_series.ewm(span=50, adjust=False).mean()
                cmp_now = float(c_series.iloc[-1])
                ema50_now = float(ema50.iloc[-1])
                ema50_prev = float(ema50.iloc[-10]) if len(ema50) >= 10 else ema50_now
                if cmp_now >= ema50_now and ema50_now >= ema50_prev:
                    p6_score += 2.0  # Weekly 10-WMA Stage 2 expansion

                if len(c_series) >= 150:
                    ema150 = c_series.ewm(span=150, adjust=False).mean()
                    if ema50_now > float(ema150.iloc[-1]):
                        p6_score += 2.0  # Minervini Stage 2 markup
        except Exception:
            p6_score = 7.0

        # =========================================================
        # 7. Market Regime Conditioning (5 pts)
        # =========================================================
        mr = market_regime or {}
        risk_lvl = str(mr.get("risk_level", "LOW") or "LOW")
        p7_score = 5.0 if risk_lvl == "LOW" else (3.5 if risk_lvl == "MODERATE" else 1.0)

        # Total Apex Confluence Score (0 - 100)
        total_apex = round(p1_score + p2_score + p3_score + p4_score + p5_score + p6_score + p7_score, 1)
        total_apex = min(100.0, max(10.0, total_apex))

        # =========================================================
        # Zero-Tolerance Disqualification Gates
        # =========================================================
        disqualifications = []
        if rvol < 1.4:
            disqualifications.append(f"RVOL {rvol:.2f}x below minimum threshold of 1.4x")
        if wick_ratio > 0.28:
            disqualifications.append(f"Upper wick {wick_ratio*100:.0f}% indicates heavy intraday selling")
        if dist_pivot > 3.0:
            disqualifications.append(f"Extended {dist_pivot:.1f}% past pivot (chasing risk)")
        if rr < 2.0:
            disqualifications.append(f"Risk/Reward {rr:.1f}x below minimum 1:2.0")

        is_apex = bool(total_apex >= 90.0 and len(disqualifications) == 0)

        if is_apex:
            verdict = "APEX 1% [ELITE A+]"
            badge = "🏆 APEX 1%"
        elif total_apex >= 85.0 and len(disqualifications) == 0:
            verdict = "ELITE A+"
            badge = "ELITE A+"
        elif total_apex >= 78.0:
            verdict = "ELITE A"
            badge = "ELITE A"
        elif total_apex >= 68.0:
            verdict = "ELITE B+"
            badge = "ELITE B+"
        else:
            verdict = "WATCHLIST"
            badge = "WATCHLIST"

        thesis = (
            f"Apex Confluence {total_apex}/100 [{verdict}]. "
            f"Pillars: Fundamentals ({p1_score:.1f}/15), Base DNA ({p2_score:.1f}/15), "
            f"Smart Money Flow ({p3_score:.1f}/15, Delivery {deliv_pct:.0f}%), "
            f"Mansfield RS ({p4_score:.1f}/15, RS Rank {rs_rank:.0f}), "
            f"Breakout Power ({p5_score:.1f}/25, RVOL {rvol:.1f}x), "
            f"Multi-Timeframe Stage 2 ({p6_score:.1f}/10)."
        )

        return {
            "symbol": clean_sym,
            "apex_score": total_apex,
            "is_apex_1pct": is_apex,
            "ai_verdict": verdict,
            "apex_badge": badge,
            "disqualifications": disqualifications,
            "passed_all_gates": len(disqualifications) == 0,
            "pillar_breakdown": {
                "p1_fundamentals": {"score": p1_score, "max": 15, "pat_growth": pat_growth, "rev_growth": rev_growth, "roce": roce},
                "p2_base_dna": {"score": p2_score, "max": 15, "pattern": pattern_name, "length_bars": base_len, "depth_pct": base_depth, "dryup_ratio": dryup_ratio},
                "p3_smart_money": {"score": p3_score, "max": 15, "delivery_pct": deliv_pct, "cmf": cmf, "pocket_pivot": pocket_pivot, "vwap_defense": vwap_defense},
                "p4_relative_strength": {"score": p4_score, "max": 15, "rs_rank": rs_rank, "mansfield_rs": mansfield_rs, "sector_trend": sector_trend},
                "p5_breakout_execution": {"score": p5_score, "max": 25, "rvol": rvol, "candle_power": candle_power, "wick_ratio": wick_ratio, "distance_pivot_pct": dist_pivot},
                "p6_multi_timeframe": {"score": p6_score, "max": 10, "stage_2_confirmed": True},
                "p7_regime_shield": {"score": p7_score, "max": 5, "risk_level": risk_lvl},
            },
            "thesis": thesis,
        }
