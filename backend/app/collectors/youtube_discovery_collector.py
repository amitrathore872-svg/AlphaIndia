"""
Alpha India — YouTube Discovery Collector  (Phase 2)
Fetches video titles + descriptions from finance-focused YouTube channels
via the YouTube Data API v3 (free tier: 10,000 units/day).
Env var: YOUTUBE_API_KEY — if not set, the collector is silently skipped.
Polling interval: 2 hours (each search costs ~100 units; 12 calls/day = 1,200 units, well within quota).
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests

from app.db.database import SessionLocal
from app.models.early_stage_temp_cache import EarlyStageTempCache

logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

# ---------------------------------------------------------------------------
# Finance channels to monitor (channel IDs).
# These are well-known public Indian finance YouTube channels.
# ---------------------------------------------------------------------------
YOUTUBE_CHANNELS: List[Dict[str, str]] = [
    {"name": "CA Rachana Ranade",   "channel_id": "UCsvqVGtbbyHaMoevxPAq9Fg"},
    {"name": "Pranjal Kamra",       "channel_id": "UCFHFRfyHsMOH2gTUmwpBV-Q"},
    {"name": "Akshat Shrivastava",  "channel_id": "UCqW8jxh4tH1Z1sWPbkGWL4g"},
    {"name": "Shankar Nath",        "channel_id": "UCMx0xmLDkBb7mfLbk6PXWSA"},
    {"name": "Market Mojo",         "channel_id": "UCdBjHQPPCBTnSsJg4G5WRAA"},
]

YOUTUBE_MAX_RESULTS = 10   # videos per channel per run (cost: 100 units each search)
YOUTUBE_TIMEOUT     = 8


def _fetch_channel_videos(channel: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Search for the most recent videos from a channel using the YouTube Data API.
    Returns a list of dicts with title, description, video_id, published_at.
    """
    if not YOUTUBE_API_KEY:
        return []

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "key":        YOUTUBE_API_KEY,
        "channelId":  channel["channel_id"],
        "part":       "snippet",
        "order":      "date",
        "maxResults": YOUTUBE_MAX_RESULTS,
        "type":       "video",
    }
    try:
        resp = requests.get(url, params=params, timeout=YOUTUBE_TIMEOUT)
        resp.raise_for_status()
        data   = resp.json()
        videos = []
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            videos.append({
                "video_id":     item.get("id", {}).get("videoId", ""),
                "title":        snippet.get("title", ""),
                "description":  snippet.get("description", "")[:500],
                "published_at": snippet.get("publishedAt", ""),
            })
        logger.info(f"[YouTubeCollector] {channel['name']}: {len(videos)} videos.")
        return videos
    except Exception as exc:
        logger.warning(f"[YouTubeCollector] {channel['name']} failed: {exc}")
        return []


def collect_youtube() -> Dict[str, int]:
    """
    Main entry point called by the early-stage scheduler.
    Returns per-channel video counts.
    """
    if not YOUTUBE_API_KEY:
        logger.info("[YouTubeCollector] YOUTUBE_API_KEY not set — skipping.")
        return {}

    db = SessionLocal()
    summary: Dict[str, int] = {}

    try:
        for channel in YOUTUBE_CHANNELS:
            videos = _fetch_channel_videos(channel)
            source_key = f"YouTube_{channel['name'].replace(' ', '')}"

            if videos:
                db.add(EarlyStageTempCache(
                    source=source_key,
                    payload={
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "channel":    channel["name"],
                        "videos":     videos,
                    },
                ))
            summary[source_key] = len(videos)

        db.commit()
        logger.info(f"[YouTubeCollector] Run complete. Summary: {summary}")
    except Exception as exc:
        db.rollback()
        logger.error(f"[YouTubeCollector] DB commit failed: {exc}")
    finally:
        db.close()

    return summary
