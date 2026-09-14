"""
Alpha India — Early Stage Discovery Service  (Phase 3)
Reads raw payloads from early_stage_temp_cache, runs NLP extraction,
deduplicates by (company_name, source), updates mention_count and trend_score
in early_stage_candidate, then triggers cache eviction.

Called by:
  - EarlyStageScheduler (automatically, after each collector run)
  - POST /early-stage/run   (manually, for testing)
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.early_stage_temp_cache import EarlyStageTempCache
from app.models.early_stage_candidate import EarlyStageCandidate
from app.models.early_stage_daily import EarlyStageDaily
from app.services.named_entity_extractor import extract_companies
from app.services.candidate_scoring_service import compute_trend_score
from app.services.cache_eviction_service import evict_stale_cache

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify_sentiment(text: str) -> str:
    """
    Simple keyword-based sentiment classifier (fast, zero-dependency).
    Returns 'positive', 'neutral', or 'negative'.
    """
    text_lower = text.lower()
    positive_words = {
        "growth", "profit", "surge", "record", "expand", "acquisition",
        "milestone", "revenue", "launch", "ipo", "invest", "fund", "rally",
        "rise", "gain", "win", "breakthrough", "innovation", "partnership",
    }
    negative_words = {
        "fraud", "scam", "loss", "decline", "slump", "crash", "default",
        "penalty", "fine", "resign", "layoff", "debt", "bankrupt", "recall",
        "probe", "investigation", "sebi", "violation", "fail", "drop",
    }
    pos = sum(1 for w in positive_words if w in text_lower)
    neg = sum(1 for w in negative_words if w in text_lower)
    if pos > neg:
        return "positive"
    elif neg > pos:
        return "negative"
    return "neutral"


def _get_yesterday_count(db: Session, company_name: str) -> int:
    """Return yesterday's mention count from early_stage_daily_summary."""
    from datetime import date, timedelta
    yesterday = date.today() - timedelta(days=1)
    row = (
        db.query(EarlyStageDaily.mention_count)
        .filter(
            EarlyStageDaily.candidate_id.in_(
                db.query(EarlyStageCandidate.id).filter(
                    EarlyStageCandidate.company_name == company_name
                )
            ),
            EarlyStageDaily.date == yesterday,
        )
        .first()
    )
    return row[0] if row else 0


def _extract_text_from_payload(payload: dict, source: str) -> List[str]:
    """
    Pull text fields from a raw cache payload depending on source type.
    Returns a flat list of text strings for NER processing.
    """
    texts = []
    if "articles" in payload:          # news
        for a in payload["articles"]:
            texts.append(f"{a.get('title', '')} {a.get('summary', '')}")
    elif "posts" in payload:           # reddit
        for p in payload["posts"]:
            texts.append(f"{p.get('title', '')} {p.get('selftext', '')}")
    elif "tweets" in payload:          # twitter
        for t in payload["tweets"]:
            texts.append(t.get("text", ""))
    elif "videos" in payload:          # youtube
        for v in payload["videos"]:
            texts.append(f"{v.get('title', '')} {v.get('description', '')}")
    return [t for t in texts if len(t.strip()) >= 20]


# ---------------------------------------------------------------------------
# Main extraction pipeline
# ---------------------------------------------------------------------------

def run_extraction_pipeline() -> Dict[str, int]:
    """
    Full Phase 3 pipeline:
      1. Read all rows from early_stage_temp_cache.
      2. For each payload, extract company mentions with NER.
      3. Upsert into early_stage_candidate (deduplicate by company_name+source).
      4. Update mention_count, sentiment, and trend_score.
      5. Evict processed cache rows.

    Returns a summary dict:
      {"candidates_created": int, "candidates_updated": int, "texts_processed": int}
    """
    db = SessionLocal()
    created = updated = texts_processed = 0

    try:
        cache_rows = db.query(EarlyStageTempCache).all()
        if not cache_rows:
            logger.info("[Discovery] No cache rows to process.")
            return {"candidates_created": 0, "candidates_updated": 0, "texts_processed": 0}

        logger.info(f"[Discovery] Processing {len(cache_rows)} cache rows...")

        # Aggregate: company_name -> {source, mentions, sentiment_votes}
        aggregate: Dict[str, Dict] = {}

        for row in cache_rows:
            source   = row.source
            payload  = row.payload or {}
            texts    = _extract_text_from_payload(payload, source)
            texts_processed += len(texts)

            for text in texts:
                entities = extract_companies(text)
                sentiment = _classify_sentiment(text)

                for ent in entities:
                    name = ent["company_name"].strip()
                    if not name:
                        continue
                    key = f"{name}||{source}"
                    if key not in aggregate:
                        aggregate[key] = {
                            "company_name": name,
                            "source": source,
                            "mention_count": 0,
                            "sentiment_votes": {"positive": 0, "neutral": 0, "negative": 0},
                        }
                    aggregate[key]["mention_count"] += 1
                    aggregate[key]["sentiment_votes"][sentiment] += 1

        # Upsert into early_stage_candidate
        now = datetime.now(timezone.utc)
        for key, data in aggregate.items():
            company_name = data["company_name"]
            source       = data["source"]
            mentions     = data["mention_count"]

            # Dominant sentiment
            votes     = data["sentiment_votes"]
            sentiment = max(votes, key=votes.get)

            # Check existing candidate
            existing = (
                db.query(EarlyStageCandidate)
                .filter(
                    EarlyStageCandidate.company_name == company_name,
                    EarlyStageCandidate.source == source,
                )
                .first()
            )

            yesterday_count = _get_yesterday_count(db, company_name)
            score = compute_trend_score(
                mention_count=mentions,
                yesterday_count=yesterday_count,
                sentiment=sentiment,
                sector=None,  # sector resolved in Phase 5 (import)
            )

            if existing:
                existing.mention_count += mentions
                existing.last_seen      = now
                existing.sentiment      = sentiment
                existing.trend_score    = score
                updated += 1
            else:
                db.add(EarlyStageCandidate(
                    company_name=company_name,
                    source=source,
                    mention_count=mentions,
                    sentiment=sentiment,
                    trend_score=score,
                    status="suggested",
                    first_seen=now,
                    last_seen=now,
                ))
                created += 1

        db.commit()
        logger.info(
            f"[Discovery] Pipeline done. "
            f"Created={created} Updated={updated} Texts={texts_processed}"
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"[Discovery] Pipeline error: {exc}")
    finally:
        db.close()

    # Always evict processed cache
    evict_stale_cache(minutes=0)  # evict everything (we just processed it all)

    return {
        "candidates_created": created,
        "candidates_updated": updated,
        "texts_processed":    texts_processed,
    }
