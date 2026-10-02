"""Print top 20 early stage candidates from DB."""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.disable(logging.CRITICAL)

from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
rows = db.execute(text("""
    SELECT company_name, source, mention_count, ROUND(trend_score::numeric, 1) as score, sentiment
    FROM early_stage_candidate
    WHERE status = 'suggested'
    ORDER BY trend_score DESC
    LIMIT 20
""")).fetchall()
total = db.execute(text("SELECT COUNT(*) FROM early_stage_candidate")).fetchone()[0]
by_status = db.execute(text("SELECT status, COUNT(*) FROM early_stage_candidate GROUP BY status")).fetchall()
db.close()

print(f"\nTotal candidates in DB: {total}")
for s, c in by_status:
    print(f"  {s}: {c}")

print(f"\nTOP 20 by Trend Score")
print(f"  {'#':<3} {'Company':<30} {'Score':>6}  {'Mentions':>4}  {'Sentiment':<10}  Source")
print(f"  {'-'*3} {'-'*30} {'-'*6}  {'-'*4}  {'-'*10}  {'-'*20}")
for i, row in enumerate(rows, 1):
    name, src, mentions, score, sent = row
    src_short = src.replace("Reddit_r/", "r/")[:20]
    print(f"  {i:<3} {name[:30]:<30} {score:>6}  {mentions:>4}  {sent:<10}  {src_short}")
