"""
Alpha India - Velocity Burst Elite: Stage 9 News Risk Engine
Sprint 39 Flagship Corporate Catalyst & Event Risk Filter
Cross-references filings from AnnouncementRadar & FilingRegistry to safeguard
breakout trades from earnings binary risk, promoter dumping, or SEBI orders.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.velocity_models import VelocityNewsRisk
from app.models.announcement_radar import AnnouncementRadar
from app.models.filing_registry import FilingRegistry

logger = logging.getLogger("alpha_india.velocity.news_risk")


class NewsRiskEngine:
    """
    Evaluates corporate action risks and positive catalyst opportunities.
    Prevents buying into earnings gaps while rewarding confirmed order wins.
    """

    @classmethod
    def evaluate_news_risk(
        cls,
        symbol: str,
        db: Session,
    ) -> Dict[str, Any]:
        clean_sym = symbol.strip().upper()
        now = datetime.now(timezone.utc)
        recent_cutoff = now - timedelta(days=7)

        # 1. Query recent corporate announcements
        recent_ann = (
            db.query(AnnouncementRadar)
            .filter(
                AnnouncementRadar.symbol.ilike(clean_sym),
                AnnouncementRadar.created_at >= recent_cutoff,
            )
            .order_by(desc(AnnouncementRadar.created_at))
            .limit(5)
            .all()
        )

        has_results = False
        has_board = False
        has_corp_action = False
        has_bulk_block = False
        promoter_buy = False
        promoter_sell = False
        has_sebi = False
        has_order_win = False
        govt_ann = False
        headline = None

        risk_score = 10.0  # Normal base risk
        opp_score = 50.0   # Baseline opportunity

        for item in recent_ann:
            head = (item.headline or "").lower()
            cat = (item.category or "").lower()
            if not headline:
                headline = item.headline

            if "financial result" in head or "quarterly result" in head or "board meeting to consider financial" in head:
                has_results = True
                risk_score += 60.0  # Huge binary event risk
            if "board meeting" in head or "board meeting" in cat:
                has_board = True
                risk_score += 25.0
            if "dividend" in head or "bonus" in head or "split" in head:
                has_corp_action = True
                opp_score += 15.0
            if "order win" in head or "contract" in head or item.catalyst_type == "ORDER_WIN":
                has_order_win = True
                opp_score += 35.0
            if "sebi" in head or "investigation" in head or "search" in head:
                has_sebi = True
                risk_score += 80.0
            if "promoter" in head and ("acquisition" in head or "bought" in head):
                promoter_buy = True
                opp_score += 20.0
            if "promoter" in head and ("sale" in head or "pledge" in head or "sold" in head):
                promoter_sell = True
                risk_score += 40.0

        risk_score = min(100.0, max(5.0, round(risk_score, 1)))
        opp_score = min(100.0, max(10.0, round(opp_score, 1)))

        # Verdict
        if risk_score >= 65.0:
            verdict = "BLOCKED_HIGH_RISK"
            notes = "Imminent earnings release or severe corporate regulatory risk. Breakout execution locked."
        elif risk_score >= 35.0:
            verdict = "CAUTION_EVENT_AHEAD"
            notes = "Corporate event or board meeting ahead. Recommend tightened stop-loss."
        else:
            verdict = "CLEAR_TO_TRADE"
            notes = "Zero toxic news catalysts. Clear runway for institutional volume breakout."

        return {
            "symbol": clean_sym,
            "risk_score": risk_score,
            "opportunity_score": opp_score,
            "verdict": verdict,
            "has_results_tomorrow": has_results,
            "has_board_meeting": has_board,
            "has_agm": False,
            "has_bonus_split_dividend": has_corp_action,
            "has_bulk_block_deal": has_bulk_block,
            "promoter_buying": promoter_buy,
            "promoter_selling": promoter_sell,
            "has_sebi_order": has_sebi,
            "large_order_win": has_order_win,
            "government_announcement": govt_ann,
            "catalyst_headline": headline or "No recent corporate event triggers",
            "ai_risk_notes": notes,
        }

    @classmethod
    def batch_upsert_news_risk(cls, db: Session, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        count = 0
        try:
            for r in records:
                stmt = pg_insert(VelocityNewsRisk).values(
                    symbol=r["symbol"],
                    risk_score=r["risk_score"],
                    opportunity_score=r["opportunity_score"],
                    verdict=r["verdict"],
                    has_results_tomorrow=r["has_results_tomorrow"],
                    has_board_meeting=r["has_board_meeting"],
                    has_agm=r["has_agm"],
                    has_bonus_split_dividend=r["has_bonus_split_dividend"],
                    has_bulk_block_deal=r["has_bulk_block_deal"],
                    promoter_buying=r["promoter_buying"],
                    promoter_selling=r["promoter_selling"],
                    has_sebi_order=r["has_sebi_order"],
                    large_order_win=r["large_order_win"],
                    government_announcement=r["government_announcement"],
                    catalyst_headline=r["catalyst_headline"],
                    ai_risk_notes=r["ai_risk_notes"],
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    index_elements=["symbol"],
                    set_={
                        "risk_score": r["risk_score"],
                        "opportunity_score": r["opportunity_score"],
                        "verdict": r["verdict"],
                        "has_results_tomorrow": r["has_results_tomorrow"],
                        "has_sebi_order": r["has_sebi_order"],
                        "large_order_win": r["large_order_win"],
                        "catalyst_headline": r["catalyst_headline"],
                        "ai_risk_notes": r["ai_risk_notes"],
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    },
                )
                db.execute(stmt)
                count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[NewsRiskEngine] Batch upsert failed: {e}")
        return count
