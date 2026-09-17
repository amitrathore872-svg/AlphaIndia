"""Enable early_stage_enabled feature flag."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("UPDATE system_settings SET setting_value='true', updated_at=NOW() WHERE setting_key='early_stage_enabled'"))
db.commit()
row = db.execute(text("SELECT setting_value FROM system_settings WHERE setting_key='early_stage_enabled'")).fetchone()
print(f"early_stage_enabled = {row[0]}")
db.close()
