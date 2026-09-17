"""
Alpha India — Sprint 23 Live Pipeline Runner
Runs the full discovery cycle manually:
  1. Collect news (7 RSS feeds)
  2. Collect Reddit (4 subreddits, 2-sec safe intervals)
  3. Run NLP extraction + candidate upsert
  4. Evict processed cache
  5. Print final stats

Usage:  python -m scripts.run_early_stage_pipeline
"""
import sys, logging, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s  %(message)s",
)

SEP = "=" * 58

print(SEP)
print("  ALPHA INDIA — EARLY STAGE DISCOVERY PIPELINE")
print(f"  Live Run  |  {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(SEP)

# ── Step 1: News collector ────────────────────────────────
print("\n[1/4]  Collecting news RSS feeds...")
from app.collectors.news_discovery_collector import collect_news, NEWS_FEEDS
t0 = time.time()
news_summary = collect_news()
print(f"       Done in {time.time()-t0:.1f}s")
for src, cnt in news_summary.items():
    bar = "#" * min(cnt, 40)
    print(f"       {src:<25} {cnt:>3} articles  {bar}")

# ── Step 2: Reddit collector ──────────────────────────────
print("\n[2/4]  Collecting Reddit posts (4 subreddits)...")
from app.collectors.social_discovery_collector import (
    _fetch_reddit_subreddit, REDDIT_SUBREDDITS, REDDIT_HEADERS
)
from app.db.database import SessionLocal
from app.models.early_stage_temp_cache import EarlyStageTempCache
from datetime import datetime, timezone

db = SessionLocal()
reddit_total = 0
try:
    for sub in REDDIT_SUBREDDITS:
        posts = _fetch_reddit_subreddit(sub)
        source_key = f"Reddit_r/{sub}"
        if posts:
            db.add(EarlyStageTempCache(
                source=source_key,
                payload={"fetched_at": datetime.now(timezone.utc).isoformat(), "posts": posts},
            ))
        reddit_total += len(posts)
        print(f"       r/{sub:<25} {len(posts):>3} posts")
        time.sleep(2)   # safe rate
    db.commit()
finally:
    db.close()

# ── Step 3: NLP extraction ────────────────────────────────
print(f"\n[3/4]  Running NLP extraction pipeline...")
from app.services.early_stage_discovery_service import run_extraction_pipeline
t0 = time.time()
result = run_extraction_pipeline()
elapsed = time.time() - t0
print(f"       Done in {elapsed:.1f}s")
print(f"       Texts processed : {result['texts_processed']}")
print(f"       Candidates new  : {result['candidates_created']}")
print(f"       Candidates upd  : {result['candidates_updated']}")

# ── Step 4: DB Stats ──────────────────────────────────────
print("\n[4/4]  Database snapshot...")
from sqlalchemy import text
db2 = SessionLocal()
try:
    total = db2.execute(text("SELECT COUNT(*) FROM early_stage_candidate")).fetchone()[0]
    by_status = db2.execute(text("SELECT status, COUNT(*) FROM early_stage_candidate GROUP BY status")).fetchall()
    top = db2.execute(text(
        "SELECT company_name, source, mention_count, trend_score, sentiment "
        "FROM early_stage_candidate "
        "WHERE status='suggested' "
        "ORDER BY trend_score DESC LIMIT 15"
    )).fetchall()
    cache_left = db2.execute(text("SELECT COUNT(*) FROM early_stage_temp_cache")).fetchone()[0]
finally:
    db2.close()

print(f"       Total candidates : {total}")
for s, c in by_status:
    print(f"       {s:<12}: {c}")
print(f"       Cache rows left  : {cache_left}  (evicted after extraction)")

print(f"\n{'─'*58}")
print("  TOP 15 CANDIDATES BY TREND SCORE")
print(f"{'─'*58}")
print(f"  {'Company':<30} {'Score':>6}  {'Mentions':>8}  {'Sentiment':<10}  Source")
print(f"  {'─'*28} {'─'*6}  {'─'*8}  {'─'*10}  {'─'*15}")
for row in top:
    name, src, mentions, score, sent = row
    src_short = src.replace("Reddit_r/", "r/")[:15]
    print(f"  {name[:30]:<30} {score:>6.1f}  {mentions:>8}  {sent:<10}  {src_short}")

print(f"\n{SEP}")
print("  PIPELINE COMPLETE — Check /early-stage in the frontend")
print(SEP)
