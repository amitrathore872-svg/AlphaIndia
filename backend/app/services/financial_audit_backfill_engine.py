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

        # If not actively running in-memory worker, read actual database audit statistics
        if not cls._running and cls._stats["processed"] == 0:
            db = SessionLocal()
            try:
                from sqlalchemy import func
                from app.models.financial_import_audit import FinancialImportAudit
                from app.models.financial_import_queue import FinancialImportQueue

                total_completed_queue = (
                    db.query(func.count(FinancialImportQueue.id))
                    .filter(FinancialImportQueue.status == "COMPLETED")
                    .scalar()
                    or 0
                )
                total_audits = (
                    db.query(func.count(FinancialImportAudit.id)).scalar() or 0
                )
                passed = (
                    db.query(func.count(FinancialImportAudit.id))
                    .filter(FinancialImportAudit.status == "PASS")
                    .scalar()
                    or 0
                )
                warning = (
                    db.query(func.count(FinancialImportAudit.id))
                    .filter(FinancialImportAudit.status == "WARNING")
                    .scalar()
                    or 0
                )
                failed = (
                    db.query(func.count(FinancialImportAudit.id))
                    .filter(FinancialImportAudit.status == "FAIL")
                    .scalar()
                    or 0
                )

                latest_audit = (
                    db.query(FinancialImportAudit)
                    .order_by(
                        FinancialImportAudit.updated_at.desc().nullslast(),
                        FinancialImportAudit.id.desc(),
                    )
                    .first()
                )
                last_symbol = latest_audit.symbol if latest_audit else None

                effective_total = (
                    total_completed_queue
                    if total_completed_queue > 0
                    else (total_audits or 1)
                )
                progress = (
                    round((total_audits / effective_total) * 100, 1)
                    if effective_total
                    else 0.0
                )

                return {
                    "running": False,
                    "thread_alive": False,
                    "progress_percent": min(progress, 100.0),
                    "processed": total_audits,
                    "passed": passed,
                    "warning": warning,
                    "failed": failed,
                    "total": effective_total,
                    "started_at": cls._stats.get("started_at"),
                    "last_symbol": last_symbol,
                    "last_error": None,
                }
            except Exception:
                pass
            finally:
                db.close()

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