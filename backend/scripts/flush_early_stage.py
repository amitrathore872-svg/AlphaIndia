"""Flush all early stage candidates and run a clean pipeline pass."""
import sys, logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.disable(logging.CRITICAL)

from app.db.database import SessionLocal
from sqlalchemy import text

# Clear all candidates to start fresh with improved NER
db = SessionLocal()
deleted = db.execute(text("DELETE FROM early_stage_candidate")).rowcount
db.execute(text("DELETE FROM early_stage_temp_cache"))
db.commit()
db.close()
print(f"Cleared {deleted} stale candidates and cache. Ready for clean run.")
