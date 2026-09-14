"""
Alpha India — Social Discovery Collector  (Phase 2)
Collects posts from Reddit (r/IndiaInvestments, r/DalalStreetTalks, r/IndianStockMarket)
and Twitter/X public search using their free-tier APIs.
Stores raw payloads to early_stage_temp_cache for downstream NLP extraction.
Polling interval: 60 min (safe rate for Reddit free API, Twitter Basic).
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests

from app.db.database import SessionLocal
from app.models.early_stage_temp_cache import EarlyStageTempCache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Reddit — uses unauthenticated public JSON endpoint (.json suffix).
# Rate limit: 1 request per 2 seconds. We fetch ~25 hot posts per subreddit.
# ---------------------------------------------------------------------------
REDDIT_SUBREDDITS = [
    "IndiaInvestments",
    "DalalStreetTalks",
    "IndianStockMarket",
    "IndiaStocks",
]

REDDIT_HEADERS = {
    "User-Agent": "AlphaIndia-Discovery/1.0 (research bot; contact: admin@alphaindia.in)"
}
REDDIT_MAX_POSTS = 25
REDDIT_TIMEOUT   = 8


def _fetch_reddit_subreddit(subreddit: str) -> List[Dict[str, Any]]:
    """Fetch hot posts from a subreddit via public JSON API."""
    url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={REDDIT_MAX_POSTS}"
    try:
        resp = requests.get(url, headers=REDDIT_HEADERS, timeout=REDDIT_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        posts = []
        for child in data.get("data", {}).get("children", []):
            p = child.get("data", {})
            posts.append({
                "title":    p.get("title", ""),
                "selftext": p.get("selftext", "")[:500],  # truncate to keep payloads light
                "url":      p.get("url", ""),
                "score":    p.get("score", 0),
                "created":  p.get("created_utc", ""),
            })
        logger.info(f"[SocialCollector] Reddit r/{subreddit}: {len(posts)} posts.")
        return posts
    except Exception as exc:
        logger.warning(f"[SocialCollector] Reddit r/{subreddit} failed: {exc}")
        return []


# ---------------------------------------------------------------------------
# Twitter/X — uses Bearer token (Basic tier, free search v2).
# Env var: TWITTER_BEARER_TOKEN.  If not set, this source is silently skipped.
# ---------------------------------------------------------------------------
TWITTER_BEARER   = os.environ.get("TWITTER_BEARER_TOKEN", "")
TWITTER_QUERIES  = [
    "NSE BSE stock India lang:en -is:retweet",
    "smallcap midcap India stock lang:en -is:retweet",
    "Indian IPO startup listing lang:en -is:retweet",
]
TWITTER_MAX_RESULTS = 20
TWITTER_TIMEOUT     = 8


def _fetch_twitter(query: str) -> List[Dict[str, Any]]:
    """Fetch recent tweets matching a query via Twitter v2 API."""
    if not TWITTER_BEARER:
        return []
    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {TWITTER_BEARER}"}
    params  = {
        "query":       query,
        "max_results": TWITTER_MAX_RESULTS,
        "tweet.fields": "created_at,text,author_id",
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=TWITTER_TIMEOUT)
        resp.raise_for_status()
        data  = resp.json()
        tweets = [
            {"text": t.get("text", ""), "created_at": t.get("created_at", "")}
            for t in data.get("data", [])
        ]
        logger.info(f"[SocialCollector] Twitter '{query[:40]}': {len(tweets)} tweets.")
        return tweets
    except Exception as exc:
        logger.warning(f"[SocialCollector] Twitter failed for query '{query[:40]}': {exc}")
        return []


def collect_social() -> Dict[str, int]:
    """
    Main entry point called by the early-stage scheduler.
    Returns per-source article/post counts.
    """
    import time

    db = SessionLocal()
    summary: Dict[str, int] = {}

    try:
        # -- Reddit -------------------------------------------------------
        for sub in REDDIT_SUBREDDITS:
            posts = _fetch_reddit_subreddit(sub)
            source_key = f"Reddit_r/{sub}"
            if posts:
                db.add(EarlyStageTempCache(
                    source=source_key,
                    payload={
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "posts": posts,
                    },
                ))
            summary[source_key] = len(posts)
            time.sleep(2)  # 2-second pause between Reddit requests (rate-limit safe)

        # -- Twitter/X ----------------------------------------------------
        if TWITTER_BEARER:
            all_tweets: List[Dict] = []
            for q in TWITTER_QUERIES:
                all_tweets.extend(_fetch_twitter(q))
                time.sleep(1)

            if all_tweets:
                db.add(EarlyStageTempCache(
                    source="Twitter",
                    payload={
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "tweets": all_tweets,
                    },
                ))
            summary["Twitter"] = len(all_tweets)
        else:
            logger.info("[SocialCollector] TWITTER_BEARER_TOKEN not set — skipping Twitter.")

        db.commit()
        logger.info(f"[SocialCollector] Run complete. Summary: {summary}")
    except Exception as exc:
        db.rollback()
        logger.error(f"[SocialCollector] DB commit failed: {exc}")
    finally:
        db.close()

    return summary
