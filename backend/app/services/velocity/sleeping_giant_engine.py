"""
Alpha India - Velocity Burst Elite: Stage 1 Sleeping Giant & Stage 2 Compression Intelligence
Sprint 39 Flagship Volatility Contraction Scanner
Detects massive institutional coiling BEFORE price explosion.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.velocity_models import VelocitySleepingGiant, VelocityCompression
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.company import Company
from app.services.velocity.indicator_suite import VelocityIndicatorSuite

logger = logging.getLogger("alpha_india.velocity.sleeping_giants")


class SleepingGiantEngine:
    """
    Identifies stocks exhibiting extreme volatility contraction,
    multi-week squeeze duration, narrowest-range bars, and dry volume.
    """

    @classmethod
    def analyze_stock_compression(
        cls,
        symbol: str,
        df: pd.DataFrame,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Executes granular compression analysis on a single symbol's price series.
        """
        if df.empty or len(df) < 20:
            return None

        ind = VelocityIndicatorSuite.compute_all_indicators(df)
        if not ind:
            return None

        cmp = ind["cmp"]
        # Basic liquidity check
        if cmp < 50.0:
            return None

        # 1. Calculate Multi-Factor Compression Score (0 - 100)
        score = 0.0

        # Bollinger bandwidth percentile (lower is better, e.g. < 15 is elite)
        bb_p = ind["bb_width_percentile"]
        if bb_p <= 10.0:
            score += 25.0
        elif bb_p <= 20.0:
            score += 20.0
        elif bb_p <= 35.0:
            score += 12.0

        # TTM Squeeze & Keltner
        if ind["ttm_squeeze_active"]:
            score += 20.0
            # Bonus for prolonged squeeze duration
            duration = ind["squeeze_duration_bars"]
            if duration >= 10:
                score += 10.0
            elif duration >= 5:
                score += 5.0

        # Narrow Range Day (NR5, NR7, NR10)
        if ind["is_nr10"]:
            score += 15.0
        elif ind["is_nr7"]:
            score += 12.0
        elif ind["is_nr5"]:
            score += 8.0

        # Inside bar clusters
        inside_count = ind["inside_bar_count"]
        if inside_count >= 3:
            score += 15.0
        elif inside_count == 2:
            score += 10.0
        elif inside_count == 1:
            score += 5.0

        # Volume Dry Up
        if ind["volume_dry_up"]:
            score += 15.0
        elif ind["vol_dry_up_ratio"] <= 0.75:
            score += 8.0

        # Trend alignment (healthy base is above rising 200 EMA)
        if ind["ema200_trend"] == "RISING":
            score += 10.0
        if ind["ema20_above_ema50"]:
            score += 5.0

        final_compression_score = min(100.0, round(score, 1))

        # 2. Stage 2: Compression Quality & Explosive Potential
        if final_compression_score >= 85.0:
            compression_quality = "ELITE"
            explosive_potential = 95.0
            expansion_window = 3   # 1-3 days to fire
            expected_holding = 10  # 10 days momentum run
        elif final_compression_score >= 70.0:
            compression_quality = "HIGH"
            explosive_potential = 80.0
            expansion_window = 5
            expected_holding = 15
        elif final_compression_score >= 50.0:
            compression_quality = "MEDIUM"
            explosive_potential = 60.0
            expansion_window = 8
            expected_holding = 20
        else:
            compression_quality = "LOW"
            explosive_potential = 35.0
            expansion_window = 15
            expected_holding = 25

        nr_cluster_name = "NR10" if ind["is_nr10"] else ("NR7" if ind["is_nr7"] else ("NR5" if ind["is_nr5"] else f"INSIDE_{inside_count}"))

        return {
            "symbol": symbol.upper(),
            "company_name": meta.get("company_name", symbol) if meta else symbol,
            "sector": meta.get("sector", "General") if meta else "General",
            "market_cap": meta.get("market_cap", 0.0) if meta else 0.0,
            "current_price": cmp,
            # Sleeping Giant row data
            "compression_score": final_compression_score,
            "ttm_squeeze_active": ind["ttm_squeeze_active"],
            "bollinger_width_percentile": ind["bb_width_percentile"],
            "keltner_squeeze_active": ind["keltner_squeeze_active"],
            "atr_compression_score": ind["atr_percentile"],
            "adr_compression_score": ind["adr_percentile"],
            "is_nr5": ind["is_nr5"],
            "is_nr7": ind["is_nr7"],
            "is_nr10": ind["is_nr10"],
            "inside_bar_count": inside_count,
            "volume_dry_up": ind["volume_dry_up"],
            "volume_dry_up_ratio": ind["vol_dry_up_ratio"],
            "ema20_structure": "ABOVE_50" if ind["ema20_above_ema50"] else "BELOW_50",
            "ema50_structure": "ABOVE_200" if ind["ema50_above_ema200"] else "BELOW_200",
            "ema200_trend": ind["ema200_trend"],
            "squeeze_duration_bars": ind["squeeze_duration_bars"],
            # Compression Intelligence row data
            "compression_quality": compression_quality,
            "explosive_potential": explosive_potential,
            "expected_expansion_window_days": expansion_window,
            "expected_holding_days": expected_holding,
            "nr_cluster": nr_cluster_name,
            "atr_lowest_percentile": ind["atr_percentile"],
            "adr_lowest_percentile": ind["adr_percentile"],
            "volatility_percentile": ind["bb_width_percentile"],
            "candle_body_compression": round(ind["atr14"] / max(0.1, cmp) * 100.0, 2),
            "volume_compression": ind["vol_dry_up_ratio"],
            "time_in_compression_bars": ind["squeeze_duration_bars"],
            "raw_indicators": ind,
        }

    @classmethod
    def batch_upsert_candidates(
        cls,
        db: Session,
        candidates: List[Dict[str, Any]],
    ) -> Tuple[int, int]:
        """
        Batch UPSERT candidates into velocity_sleeping_giants and velocity_compression.
        """
        if not candidates:
            return 0, 0

        today = datetime.now(timezone.utc).date()
        sg_upsert_count = 0
        comp_upsert_count = 0

        try:
            for item in candidates:
                # 1. Upsert into velocity_sleeping_giants
                stmt_sg = pg_insert(VelocitySleepingGiant).values(
                    symbol=item["symbol"],
                    company_name=item["company_name"],
                    sector=item["sector"],
                    market_cap=item["market_cap"],
                    current_price=item["current_price"],
                    compression_score=item["compression_score"],
                    ttm_squeeze_active=item["ttm_squeeze_active"],
                    bollinger_width_percentile=item["bollinger_width_percentile"],
                    keltner_squeeze_active=item["keltner_squeeze_active"],
                    atr_compression_score=item["atr_compression_score"],
                    adr_compression_score=item["adr_compression_score"],
                    is_nr5=item["is_nr5"],
                    is_nr7=item["is_nr7"],
                    is_nr10=item["is_nr10"],
                    inside_bar_count=item["inside_bar_count"],
                    volume_dry_up=item["volume_dry_up"],
                    volume_dry_up_ratio=item["volume_dry_up_ratio"],
                    ema20_structure=item["ema20_structure"],
                    ema50_structure=item["ema50_structure"],
                    ema200_trend=item["ema200_trend"],
                    squeeze_duration_bars=item["squeeze_duration_bars"],
                    scan_date=today,
                ).on_conflict_do_update(
                    constraint="uq_sleeping_giant_sym_date",
                    set_={
                        "compression_score": item["compression_score"],
                        "current_price": item["current_price"],
                        "ttm_squeeze_active": item["ttm_squeeze_active"],
                        "bollinger_width_percentile": item["bollinger_width_percentile"],
                        "volume_dry_up": item["volume_dry_up"],
                        "volume_dry_up_ratio": item["volume_dry_up_ratio"],
                        "inside_bar_count": item["inside_bar_count"],
                        "squeeze_duration_bars": item["squeeze_duration_bars"],
                    },
                )
                db.execute(stmt_sg)
                sg_upsert_count += 1

                # 2. Upsert into velocity_compression
                stmt_comp = pg_insert(VelocityCompression).values(
                    symbol=item["symbol"],
                    compression_score=item["compression_score"],
                    compression_quality=item["compression_quality"],
                    explosive_potential=item["explosive_potential"],
                    expected_expansion_window_days=item["expected_expansion_window_days"],
                    expected_holding_days=item["expected_holding_days"],
                    bollinger_width_percentile=item["bollinger_width_percentile"],
                    ttm_active=item["ttm_squeeze_active"],
                    keltner_compression=item["keltner_squeeze_active"],
                    nr_cluster=item["nr_cluster"],
                    atr_lowest_percentile=item["atr_lowest_percentile"],
                    adr_lowest_percentile=item["adr_lowest_percentile"],
                    volatility_percentile=item["volatility_percentile"],
                    candle_body_compression=item["candle_body_compression"],
                    volume_compression=item["volume_compression"],
                    time_in_compression_bars=item["time_in_compression_bars"],
                    details={"squeeze_bars": item["squeeze_duration_bars"], "adr": item.get("adr_compression_score")},
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    index_elements=["symbol"],
                    set_={
                        "compression_score": item["compression_score"],
                        "compression_quality": item["compression_quality"],
                        "explosive_potential": item["explosive_potential"],
                        "expected_expansion_window_days": item["expected_expansion_window_days"],
                        "expected_holding_days": item["expected_holding_days"],
                        "bollinger_width_percentile": item["bollinger_width_percentile"],
                        "ttm_active": item["ttm_squeeze_active"],
                        "keltner_compression": item["keltner_squeeze_active"],
                        "nr_cluster": item["nr_cluster"],
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    },
                )
                db.execute(stmt_comp)
                comp_upsert_count += 1

            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[SleepingGiantEngine] Batch upsert failed: {e}")

        return sg_upsert_count, comp_upsert_count

    @classmethod
    def get_top_sleeping_giants(
        cls,
        db: Session,
        min_score: float = 60.0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top sleeping giant candidates ranked by compression score.
        """
        rows = (
            db.query(VelocitySleepingGiant)
            .filter(VelocitySleepingGiant.compression_score >= min_score)
            .order_by(desc(VelocitySleepingGiant.compression_score))
            .limit(limit)
            .all()
        )

        return [
            {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name,
                "sector": r.sector,
                "market_cap": r.market_cap,
                "current_price": r.current_price,
                "compression_score": r.compression_score,
                "ttm_squeeze_active": r.ttm_squeeze_active,
                "bollinger_width_percentile": r.bollinger_width_percentile,
                "inside_bar_count": r.inside_bar_count,
                "volume_dry_up": r.volume_dry_up,
                "volume_dry_up_ratio": r.volume_dry_up_ratio,
                "squeeze_duration_bars": r.squeeze_duration_bars,
                "is_nr7": r.is_nr7,
                "is_nr10": r.is_nr10,
                "scan_date": str(r.scan_date),
            }
            for r in rows
        ]
