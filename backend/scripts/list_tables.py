import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")).fetchall()
    print("Tables:", [t[0] for t in tables])
