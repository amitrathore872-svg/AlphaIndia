from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.models.monitoring_heartbeat import MonitoringHeartbeat


db = SessionLocal()

heartbeat = db.query(MonitoringHeartbeat).first()

if heartbeat is None:
    heartbeat = MonitoringHeartbeat(
        engine_status="RUNNING",
        current_session="NON_MARKET",
        companies_scanned_today=0,
        results_found_today=0,
        parser_failures_today=0,
    )
    db.add(heartbeat)
    db.commit()
    print("Monitoring heartbeat initialized.")
else:
    print("Heartbeat already exists.")

db.close()