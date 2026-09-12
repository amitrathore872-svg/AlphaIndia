from sqlalchemy import text
import sys

sys.path.append(".")

from app.db.database import engine

print("=" * 70)
print("ALPHA INDIA — IMPORT PROGRESS TABLE MIGRATION")
print("=" * 70)

SQL = """
CREATE TABLE IF NOT EXISTS financial_import_progress (

    id SERIAL PRIMARY KEY,

    status VARCHAR(20) DEFAULT 'IDLE',

    processed INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,

    current_symbol VARCHAR(30),

    started_at TIMESTAMP,
    updated_at TIMESTAMP,

    eta_minutes DOUBLE PRECISION DEFAULT 0
);
"""

with engine.begin() as conn:
    conn.execute(text(SQL))

print("\nSUCCESS — financial_import_progress created.")