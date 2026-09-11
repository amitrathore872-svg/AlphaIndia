"""
Alpha India Yahoo Import Service Test
Sprint 30.1
"""

import sys
from pathlib import Path

# Add backend folder to Python path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.db.database import SessionLocal
from app.services.yahoo_import_service import YahooImportService

print("=" * 70)
print("ALPHA INDIA — YAHOO IMPORT TEST")
print("=" * 70)

db = SessionLocal()

try:
    result = YahooImportService.import_company(db, "KTKBANK")

    print("\nImport Result")
    print("-" * 70)
    for k, v in result.items():
        print(f"{k}: {v}")

finally:
    db.close()

print("\nYahoo Import Service Test Passed.")