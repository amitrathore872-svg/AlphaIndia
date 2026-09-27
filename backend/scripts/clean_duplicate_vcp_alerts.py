"""
Clean up duplicate VCP notifications and redundant dispatch logs
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.notification import SystemNotification, AlertDispatchLog

def run():
    db = SessionLocal()
    try:
        # 1. Clean SystemNotification duplicates
        notifs = (
            db.query(SystemNotification)
            .filter(SystemNotification.category == "VCP_BREAKOUT")
            .order_by(SystemNotification.created_at.asc())
            .all()
        )
        seen_syms = set()
        to_delete_notifs = []
        for n in notifs:
            sym = (n.metadata_json or {}).get("symbol")
            if not sym and ":" in n.title:
                sym = n.title.split(":")[1].split("(")[0].strip()
            key = sym or n.title
            if key in seen_syms:
                to_delete_notifs.append(n.id)
            else:
                seen_syms.add(key)

        print(f"Found {len(to_delete_notifs)} duplicate VCP notifications to delete.")
        if to_delete_notifs:
            db.query(SystemNotification).filter(SystemNotification.id.in_(to_delete_notifs)).delete(synchronize_session=False)
            db.commit()

        # 2. Clean AlertDispatchLog duplicates for VCP
        logs = (
            db.query(AlertDispatchLog)
            .filter(AlertDispatchLog.symbol.isnot(None))
            .order_by(AlertDispatchLog.dispatched_at.asc())
            .all()
        )
        seen_logs = set()
        to_delete_logs = []
        for l in logs:
            if not ("VCP" in (l.payload_preview or "") or l.symbol in ("KMCSHIL", "SOMANYCERA")):
                continue
            date_str = l.dispatched_at.date().isoformat() if l.dispatched_at else "unknown"
            key = (l.channel, l.symbol, date_str)
            if key in seen_logs:
                to_delete_logs.append(l.id)
            else:
                seen_logs.add(key)

        print(f"Found {len(to_delete_logs)} duplicate dispatch logs to delete.")
        if to_delete_logs:
            db.query(AlertDispatchLog).filter(AlertDispatchLog.id.in_(to_delete_logs)).delete(synchronize_session=False)
            db.commit()

        vcp_remaining = db.query(SystemNotification).filter(SystemNotification.category == "VCP_BREAKOUT").count()
        logs_remaining = db.query(AlertDispatchLog).count()
        print(f"Clean complete. Remaining VCP notifications: {vcp_remaining}, Remaining dispatch logs: {logs_remaining}")

    finally:
        db.close()

if __name__ == "__main__":
    run()
