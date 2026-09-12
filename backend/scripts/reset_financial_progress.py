"""
Reset Alpha India Financial Import Progress
Sprint 31.4
"""

import sys
from pathlib import Path

# Make backend/app importable
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.models.financial_import_progress import FinancialImportProgress


db = SessionLocal()

try:
    progress = db.query(FinancialImportProgress).first()

    if progress is None:
        progress = FinancialImportProgress()
        db.add(progress)

    progress.status = "IDLE"
    progress.processed = 0
    progress.completed = 0
    progress.failed = 0
    progress.current_symbol = None
    progress.started_at = None
    progress.updated_at = None
    progress.eta_minutes = None

    db.commit()

    print("SUCCESS — Financial progress reset.")

finally:
    db.close()