"""
Sprint 31.1 Financial Import Queue Migration
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 60)
print("CREATING FINANCIAL IMPORT QUEUE")
print("=" * 60)

SQL = """
CREATE TABLE IF NOT EXISTS financial_import_queue (

    id SERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL
        REFERENCES companies(id),

    symbol VARCHAR(20) UNIQUE NOT NULL,

    status VARCHAR(20) DEFAULT 'PENDING',

    attempts INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    imported_at TIMESTAMP,

    last_error VARCHAR(500)
);
"""

with engine.begin() as conn:
    conn.execute(text(SQL))

print("SUCCESS — financial_import_queue ready.")