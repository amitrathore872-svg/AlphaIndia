"""
Alpha India — News Discovery Collector  (Phase 2)
Fetches headlines from RSS feeds of major Indian financial news portals.
Stores raw payloads to early_stage_temp_cache for downstream NLP extraction.
Polling interval: 30 min (institutional safe-rate).
Sources: Moneycontrol, Economic Times, LiveMint, YourStory, TechCrunch India.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

import feedparser
import requests

from app.db.database import SessionLocal
from app.models.early_stage_temp_cache import EarlyStageTempCache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RSS feed registry — safe public feeds only, no authentication required.
# Polling at ≥30 min intervals stays well within every portal's bot policy.
# ---------------------------------------------------------------------------
NEWS_FEEDS: List[Dict[str, str]] = [
    {
        "source": "Moneycontrol",
        "url": "https://www.moneycontrol.com/rss/business.xml",
    },
    {
        "source": "EconomicTimes",
        "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    },
    {
        "source": "LiveMint",
        "url": "https://www.livemint.com/rss/markets",
    },
    {
        "source": "YourStory",
        "url": "https://yourstory.com/feed",
    },
    {
        "source": "TechCrunchIndia",
        "url": "https://techcrunch.com/tag/india/feed/",
    },
    {
        "source": "BusinessStandard",
        "url": "https://www.business-standard.com/rss/markets-106.rss",
    },
    {
        "source": "FinancialExpress",
        "url": "https://www.financialexpress.com/market/feed/",
    },
]

REQUEST_TIMEOUT = 10   # seconds per fetch
MAX_ENTRIES     = 50   # max articles per source per run


def _fetch_feed(source: str, url: str) -> List[Dict[str, Any]]:
    """Parse an RSS feed URL and return a list of article dicts."""
    try:
        # feedparser handles redirect and encoding automatically
        feed = feedparser.parse(url)
        entries = []
        for entry in feed.entries[:MAX_ENTRIES]:
            entries.append({
                "title":     entry.get("title", ""),
                "summary":   entry.get("summary", ""),
                "link":      entry.get("link", ""),
                "published": entry.get("published", ""),
            })
        logger.info(f"[NewsCollector] {source}: {len(entries)} articles fetched.")
        return entries
    except Exception as exc:
        logger.warning(f"[NewsCollector] {source} fetch failed: {exc}")
        return []


def collect_news() -> Dict[str, int]:
    """
    Main entry point called by the early-stage scheduler.
    Fetches all feeds and persists raw payloads to early_stage_temp_cache.
    Returns a summary dict with per-source article counts.
    """
    db = SessionLocal()
    summary: Dict[str, int] = {}

    try:
        for feed_cfg in NEWS_FEEDS:
            source = feed_cfg["source"]
            articles = _fetch_feed(source, feed_cfg["url"])
            if not articles:
                summary[source] = 0
                continue

            # Persist as a single JSONB payload row per source per run
            cache_row = EarlyStageTempCache(
                source=source,
                payload={"fetched_at": datetime.now(timezone.utc).isoformat(), "articles": articles},
            )
            db.add(cache_row)
            summary[source] = len(articles)

        db.commit()
        logger.info(f"[NewsCollector] Run complete. Summary: {summary}")
    except Exception as exc:
        db.rollback()
        logger.error(f"[NewsCollector] DB commit failed: {exc}")
    finally:
        db.close()

    return summary
