"""
Alpha India Financial Audit Backfill Engine
Sprint 32.7.2 (Production Version)

Audits every imported company in the Financial Warehouse.
"""

import threading
import time
import traceback

from app.db.database import SessionLocal
from app.models.financial_import_queue import FinancialImportQueue
from app.services.financial_audit_service import FinancialAuditService


class FinancialAuditBackfillEngine:

    _thread = None
    _running = False

    _stats = {
        "processed": 0,
        "passed": 0,
        "warning": 0,
        "failed": 0,
        "total": 0,
        "started_at": None,
        "last_symbol": None,
        "last_error": None,
    }

    # ==========================================================
    # Worker
    # ==========================================================
    @classmethod
    def _worker(cls, batch_size: int, sleep_seconds: int):

        db = SessionLocal()

        try:
            while cls._running:

                companies = (
                    db.query(FinancialImportQueue)
                    .filter(FinancialImportQueue.status == "COMPLETED")
                    .offset(cls._stats["processed"])
                    .limit(batch_size)
                    .all()
                )

                if len(companies) == 0:
                    print("✅ Financial audit completed.")
                    cls._running = False
                    break

                for item in companies:

                    if not cls._running:
                        break

                    try:
                        # Audit company
                        result = FinancialAuditService.audit_company(
                            db=db,
                            symbol=item.symbol,
                        )

                        cls._stats["processed"] += 1
                        cls._stats["last_symbol"] = item.symbol

                        status = result.get("status", "FAIL")

                        if status == "PASS":
                            cls._stats["passed"] += 1

                        elif status == "WARNING":
                            cls._stats["warning"] += 1

                        else:
                            cls._stats["failed"] += 1

                        print(
                            f"[AUDIT] {item.symbol} -> "
                            f"{status} ({cls._stats['processed']}/{cls._stats['total']})"
                        )

                    except Exception as e:
                        cls._stats["processed"] += 1
                        cls._stats["failed"] += 1
                        cls._stats["last_symbol"] = item.symbol
                        cls._stats["last_error"] = str(e)

                        print(f"❌ Audit failed for {item.symbol}")
                        traceback.print_exc()

                db.commit()
                time.sleep(sleep_seconds)

        finally:
            db.close()
            cls._running = False

    # ==========================================================
    # Start Engine
    # ==========================================================
    @classmethod
    def start(cls, batch_size: int = 100, sleep_seconds: int = 1):

        if cls._running:
            return {
                "running": True,
                "message": "Audit backfill engine already running.",
            }

        db = SessionLocal()

        total = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "COMPLETED")
            .count()
        )

        db.close()

        cls._stats = {
            "processed": 0,
            "passed": 0,
            "warning": 0,
            "failed": 0,
            "total": total,
            "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "last_symbol": None,
            "last_error": None,
        }

        cls._running = True

        cls._thread = threading.Thread(
            target=cls._worker,
            args=(batch_size, sleep_seconds),
            daemon=True,
        )

        cls._thread.start()

        return {
            "running": True,
            "batch_size": batch_size,
            "sleep_seconds": sleep_seconds,
            "total_companies": total,
        }

    # ==========================================================
    # Stop Engine
    # ==========================================================
    @classmethod
    def stop(cls):
        cls._running = False

        return {
            "running": False,
            "message": "Audit backfill engine stopped.",
        }

    # ==========================================================
    # Status
    # ==========================================================
    @classmethod
    def status(cls):

        total = cls._stats["total"] or 1

        return {
            "running": cls._running,
            "thread_alive": cls._thread.is_alive() if cls._thread else False,
            "progress_percent": round(
                cls._stats["processed"] / total * 100,
                2,
            ),
            **cls._stats,
        }