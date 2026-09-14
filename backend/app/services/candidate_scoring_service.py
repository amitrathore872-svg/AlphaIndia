"""
Alpha India — Candidate Scoring Service  (Phase 3)
Computes a trend_score (0-100) for each early_stage_candidate using a
weighted combination of signals. All weights are configurable via system_settings.

Default weights:
  - mention_volume   : 40%   (log-scaled count across all sources)
  - daily_growth_rate: 30%   (Δ mentions vs yesterday)
  - sentiment        : 20%   (positive=+1, neutral=0, negative=-1 scaled)
  - sector_relevance : 10%   (bonus if sector matches user watchlist)
"""

import logging
import math
from typing import Dict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default weights — override via system_settings key early_stage_scoring_weights
# ---------------------------------------------------------------------------
DEFAULT_WEIGHTS: Dict[str, float] = {
    "mention_volume":    0.40,
    "daily_growth_rate": 0.30,
    "sentiment":         0.20,
    "sector_relevance":  0.10,
}

SENTIMENT_VALUES = {
    "positive":  1.0,
    "neutral":   0.0,
    "negative": -1.0,
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_weights() -> Dict[str, float]:
    """
    Read weights from system_settings if available, else use defaults.
    Expected JSON string value for key 'early_stage_scoring_weights'.
    """
    try:
        import json
        from app.db.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    "SELECT setting_value FROM system_settings "
                    "WHERE setting_key = 'early_stage_scoring_weights' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                weights = json.loads(row[0])
                # Validate all keys present
                if all(k in weights for k in DEFAULT_WEIGHTS):
                    return weights
        finally:
            db.close()
    except Exception as exc:
        logger.debug(f"[Scoring] Could not load custom weights: {exc}")
    return DEFAULT_WEIGHTS


def _volume_score(mention_count: int) -> float:
    """
    Log-scale mention volume to 0-100.
    log10(1) = 0, log10(1000) ≈ 3 → normalise by dividing by 3 and capping at 1.
    """
    if mention_count <= 0:
        return 0.0
    return min(math.log10(mention_count + 1) / 3.0, 1.0) * 100.0


def _growth_score(mention_count: int, yesterday_count: int) -> float:
    """
    Day-over-day growth rate as a 0-100 score.
    0% growth = 0, ≥100% growth = 100.
    """
    if yesterday_count <= 0:
        return 50.0  # no baseline yet → neutral score
    growth = (mention_count - yesterday_count) / yesterday_count
    return min(max(growth, 0.0), 1.0) * 100.0


def _sentiment_score(sentiment: str) -> float:
    """Convert sentiment enum to 0-100."""
    val = SENTIMENT_VALUES.get(sentiment, 0.0)
    return (val + 1.0) / 2.0 * 100.0  # maps -1→0, 0→50, +1→100


def _sector_score(sector: str | None) -> float:
    """
    Simple sector relevance: +100 if sector is non-null, 50 otherwise.
    Future: compare against user's watchlist sectors.
    """
    return 80.0 if sector else 50.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_trend_score(
    mention_count: int,
    yesterday_count: int,
    sentiment: str,
    sector: str | None,
) -> float:
    """
    Compute a 0-100 trend_score for a candidate.
    Returns a float rounded to 2 decimal places.
    """
    weights = _get_weights()

    vol   = _volume_score(mention_count)   * weights["mention_volume"]
    grow  = _growth_score(mention_count, yesterday_count) * weights["daily_growth_rate"]
    sent  = _sentiment_score(sentiment)    * weights["sentiment"]
    sect  = _sector_score(sector)          * weights["sector_relevance"]

    score = vol + grow + sent + sect
    return round(min(max(score, 0.0), 100.0), 2)
