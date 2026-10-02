"""Smoke test for news_discovery_collector — fetches first 2 RSS feeds."""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.basicConfig(level=logging.WARNING)

from app.collectors.news_discovery_collector import _fetch_feed, NEWS_FEEDS

for feed in NEWS_FEEDS[:2]:
    articles = _fetch_feed(feed["source"], feed["url"])
    title_preview = articles[0]["title"][:60] if articles else "NO ARTICLES"
    print(f'{feed["source"]}: {len(articles)} articles | "{title_preview}"')

print("Smoke test DONE")
