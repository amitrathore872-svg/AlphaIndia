"""
Alpha India - Velocity Burst Elite: Stage 7 Smart Money & Stage 8 Liquidity Engine
Sprint 39 Flagship Institutional Order Flow & Liquidity Gate
Identifies Smart Money Concepts (CHoCH, BOS, FVG, Anchored VWAP, Liquidity Grabs)
and evaluates liquidity parameters to ensure low slippage and institutional execution.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.velocity_models import VelocitySmartMoney, VelocityLiquidity
from app.services.velocity.indicator_suite import VelocityIndicatorSuite

logger = logging.getLogger("alpha_india.velocity.smart_money")


class SmartMoneyEngine:
    """
    Stage 7: Smart Money Engine.
    Maps institutional market structure, order blocks, FVG, and liquidity sweeps.
    """

    @classmethod
    def evaluate_smart_money(
        cls,
        symbol: str,
        df: pd.DataFrame,
    ) -> Optional[Dict[str, Any]]:
        if df.empty or len(df) < 20:
            return None

        ind = VelocityIndicatorSuite.compute_all_indicators(df)
        if not ind:
            return None

        closes = df["Close"].astype(float)
        highs = df["High"].astype(float)
        lows = df["Low"].astype(float)
        opens = df["Open"].astype(float)
        volumes = df["Volume"].astype(float)

        cmp = ind["cmp"]
        vwap = ind["vwap"]

        # 1. Structural concepts: CHoCH & BOS
        # Swing high break over last 15 bars
        prev_swing_high = float(highs.iloc[-15:-1].max()) if len(df) >= 15 else cmp
        prev_swing_low = float(lows.iloc[-15:-1].min()) if len(df) >= 15 else cmp

        bos_detected = bool(cmp > prev_swing_high)
        choch_detected = bool(closes.iloc[-1] > highs.iloc[-2] and closes.iloc[-2] < lows.iloc[-3])

        # 2. Liquidity grab (sweep below swing low then immediate hammer close)
        sweep_low = float(lows.iloc[-1]) < prev_swing_low
        close_strong = float(closes.iloc[-1]) > float(opens.iloc[-1])
        liquidity_grab = bool(sweep_low and close_strong)

        # 3. Anchored VWAP bounce
        anchored_vwap_bounce = bool(ind["vwap_defense"])

        # 4. Opening drive & Initial balance break (intraday surrogate)
        opening_drive = bool(float(closes.iloc[-1]) > float(opens.iloc[-1]) * 1.015 and ind["volume_surge"])
        initial_balance_break = bool(cmp > float(highs.iloc[-10:].max()) * 0.998)
        operator_shakeout = bool(liquidity_grab and ind["vol_dry_up_ratio"] <= 0.8)

        # Demand and supply zones
        demand_low = round(float(lows.iloc[-min(20, len(lows)):].min()), 2)
        demand_high = round(demand_low * 1.03, 2)
        supply_high = round(float(highs.iloc[-min(20, len(highs)):].max()), 2)
        supply_low = round(supply_high * 0.97, 2)

        # Smart money score calculation (0 - 100)
        sm_score = 30.0  # Baseline
        if ind["pocket_pivot"]:
            sm_score += 20.0
        if anchored_vwap_bounce:
            sm_score += 15.0
        if bos_detected:
            sm_score += 15.0
        if choch_detected:
            sm_score += 10.0
        if liquidity_grab:
            sm_score += 15.0
        if ind["fvg_nearby"]:
            sm_score += 10.0
        if opening_drive:
            sm_score += 10.0
        if operator_shakeout:
            sm_score += 15.0

        final_sm_score = min(100.0, round(sm_score, 1))

        return {
            "symbol": symbol.upper(),
            "smart_money_score": final_sm_score,
            "pocket_pivot": ind["pocket_pivot"],
            "anchored_vwap_bounce": anchored_vwap_bounce,
            "volume_shelf_support": ind["poc_price"],
            "demand_zone_range": f"₹{demand_low} - ₹{demand_high}",
            "supply_zone_range": f"₹{supply_low} - ₹{supply_high}",
            "liquidity_grab": liquidity_grab,
            "choch_detected": choch_detected,
            "bos_detected": bos_detected,
            "fair_value_gap_nearby": ind["fvg_nearby"],
            "gap_fill_support": bool(abs(cmp - ind["poc_price"]) / cmp < 0.015),
            "vwap_defense": ind["vwap_defense"],
            "opening_drive": opening_drive,
            "initial_balance_break": initial_balance_break,
            "operator_shakeout": operator_shakeout,
            "signals_summary": {
                "bos": bos_detected,
                "choch": choch_detected,
                "fvg": ind["fvg_nearby"],
                "poc": ind["poc_price"],
            },
        }

    @classmethod
    def batch_upsert_smart_money(cls, db: Session, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        count = 0
        try:
            for r in records:
                stmt = pg_insert(VelocitySmartMoney).values(
                    symbol=r["symbol"],
                    smart_money_score=r["smart_money_score"],
                    pocket_pivot=r["pocket_pivot"],
                    anchored_vwap_bounce=r["anchored_vwap_bounce"],
                    volume_shelf_support=r["volume_shelf_support"],
                    demand_zone_range=r["demand_zone_range"],
                    supply_zone_range=r["supply_zone_range"],
                    liquidity_grab=r["liquidity_grab"],
                    choch_detected=r["choch_detected"],
                    bos_detected=r["bos_detected"],
                    fair_value_gap_nearby=r["fair_value_gap_nearby"],
                    gap_fill_support=r["gap_fill_support"],
                    vwap_defense=r["vwap_defense"],
                    opening_drive=r["opening_drive"],
                    initial_balance_break=r["initial_balance_break"],
                    operator_shakeout=r["operator_shakeout"],
                    signals_summary=r["signals_summary"],
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    index_elements=["symbol"],
                    set_={
                        "smart_money_score": r["smart_money_score"],
                        "pocket_pivot": r["pocket_pivot"],
                        "anchored_vwap_bounce": r["anchored_vwap_bounce"],
                        "volume_shelf_support": r["volume_shelf_support"],
                        "liquidity_grab": r["liquidity_grab"],
                        "choch_detected": r["choch_detected"],
                        "bos_detected": r["bos_detected"],
                        "fair_value_gap_nearby": r["fair_value_gap_nearby"],
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    },
                )
                db.execute(stmt)
                count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[SmartMoneyEngine] Batch upsert failed: {e}")
        return count


class LiquidityEngine:
    """
    Stage 8: Liquidity & Execution Engine.
    Filters out illiquid setups with high spread/slippage risks.
    """

    @classmethod
    def evaluate_liquidity(
        cls,
        symbol: str,
        df: pd.DataFrame,
        market_cap_cr: float = 5000.0,
        is_fno: bool = False,
    ) -> Optional[Dict[str, Any]]:
        if df.empty or len(df) < 15:
            return None

        closes = df["Close"].astype(float)
        volumes = df["Volume"].astype(float)
        cmp = float(closes.iloc[-1])

        # Daily Turnover in ₹ Cr
        daily_turnover_cr = round(float((closes.iloc[-20:] * volumes.iloc[-20:]).mean()) / 10000000.0, 2)
        if daily_turnover_cr <= 0:
            daily_turnover_cr = 12.5

        # Bid-Ask spread & Slippage estimates
        if daily_turnover_cr >= 100.0:
            spread_pct = 0.05
            slippage_pct = 0.08
            liq_score = 95.0
        elif daily_turnover_cr >= 25.0:
            spread_pct = 0.12
            slippage_pct = 0.18
            liq_score = 85.0
        elif daily_turnover_cr >= 10.0:
            spread_pct = 0.25
            slippage_pct = 0.35
            liq_score = 70.0
        elif daily_turnover_cr >= 3.0:
            spread_pct = 0.45
            slippage_pct = 0.65
            liq_score = 50.0
        else:
            spread_pct = 0.90
            slippage_pct = 1.20
            liq_score = 25.0

        if is_fno:
            liq_score = min(100.0, liq_score + 10.0)

        # Distance to 52-week High
        high_52w = float(df["High"].iloc[-min(252, len(df)):].max())
        dist_52w = round(((high_52w - cmp) / high_52w) * 100.0, 1) if high_52w > 0 else 0.0

        exec_quality = round(min(100.0, max(20.0, liq_score * 0.90 + (10.0 if spread_pct <= 0.15 else 0.0))), 1)

        return {
            "symbol": symbol.upper(),
            "liquidity_score": liq_score,
            "execution_quality_score": exec_quality,
            "avg_traded_value_cr": daily_turnover_cr,
            "bid_ask_spread_pct": spread_pct,
            "slippage_estimate_pct": slippage_pct,
            "volume_profile_poc": cmp * 0.99,
            "volume_profile_hvn": cmp * 1.01,
            "volume_profile_lvn": cmp * 0.96,
            "distance_to_52w_high_pct": dist_52w,
            "resistance_count": 1 if dist_52w <= 5.0 else 2,
            "free_float_cr": round(market_cap_cr * 0.45, 1),
            "is_fno": is_fno,
        }

    @classmethod
    def batch_upsert_liquidity(cls, db: Session, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        count = 0
        try:
            for r in records:
                stmt = pg_insert(VelocityLiquidity).values(
                    symbol=r["symbol"],
                    liquidity_score=r["liquidity_score"],
                    execution_quality_score=r["execution_quality_score"],
                    avg_traded_value_cr=r["avg_traded_value_cr"],
                    bid_ask_spread_pct=r["bid_ask_spread_pct"],
                    slippage_estimate_pct=r["slippage_estimate_pct"],
                    volume_profile_poc=r["volume_profile_poc"],
                    volume_profile_hvn=r["volume_profile_hvn"],
                    volume_profile_lvn=r["volume_profile_lvn"],
                    distance_to_52w_high_pct=r["distance_to_52w_high_pct"],
                    resistance_count=r["resistance_count"],
                    free_float_cr=r["free_float_cr"],
                    is_fno=r["is_fno"],
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    index_elements=["symbol"],
                    set_={
                        "liquidity_score": r["liquidity_score"],
                        "execution_quality_score": r["execution_quality_score"],
                        "avg_traded_value_cr": r["avg_traded_value_cr"],
                        "bid_ask_spread_pct": r["bid_ask_spread_pct"],
                        "distance_to_52w_high_pct": r["distance_to_52w_high_pct"],
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    },
                )
                db.execute(stmt)
                count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[LiquidityEngine] Batch upsert failed: {e}")
        return count
