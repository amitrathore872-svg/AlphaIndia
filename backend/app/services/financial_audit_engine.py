"""
Alpha India Financial Audit Engine
Sprint 31.5.2-C.1
Version: v1.0.1
"""

import threading
import time
import traceback

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.financial_repair_service import FinancialRepairService
from app.services.financial_audit_service import FinancialAuditService


class FinancialAuditEngine:
    """
    Background engine that audits imported companies and populates
    financial_import_audit.
    """

    running = False
    worker_thread = None

    # ------------------------------------------------------
    # Background Worker
    # ------------------------------------------------------
    @classmethod
    def _worker(cls, batch_size: int, sleep_seconds: int):

        db = SessionLocal()

        try:
            while cls.running:

                companies = (
                    db.query(Company)
                    .join(
                        QuarterlyResult,
                        QuarterlyResult.company_id == Company.id,
                    )
                    .distinct()
                    .order_by(Company.symbol.asc())
                    .limit(batch_size)
                    .all()
                )

                if not companies:
                    print("Financial Audit Engine completed.")
                    cls.running = False
                    break

                print(f"Auditing batch of {len(companies)} companies...")

                for company in companies:

                    if not cls.running:
                        break

                    try:
                        FinancialRepairService.audit_company(
                            db,
                            company.symbol,
                        )

                    except Exception as e:
                        print(f"AUDIT FAILED : {company.symbol}")
                        print(e)

                db.commit()

                if cls.running:
                    time.sleep(sleep_seconds)

        except Exception:
            print("=" * 70)
            print("FINANCIAL AUDIT ENGINE CRASHED")
            print("=" * 70)
            traceback.print_exc()

        finally:
            cls.running = False
            db.close()

    # ------------------------------------------------------
    # Start Engine
    # ------------------------------------------------------
    @classmethod
    def start(cls, batch_size: int = 100, sleep_seconds: int = 1):

        if cls.running:
            return {
                "running": True,
                "message": "Audit engine already running.",
            }

        cls.running = True

        cls.worker_thread = threading.Thread(
            target=cls._worker,
            kwargs={
                "batch_size": batch_size,
                "sleep_seconds": sleep_seconds,
            },
            daemon=True,
        )

        cls.worker_thread.start()

        return {
            "running": True,
            "batch_size": batch_size,
            "sleep_seconds": sleep_seconds,
        }

    # ------------------------------------------------------
    # Stop Engine
    # ------------------------------------------------------
    @classmethod
    def stop(cls):

        cls.running = False

        return {
            "running": False,
            "message": "Audit engine stopped.",
        }

    # ------------------------------------------------------
    # Engine Status
    # ------------------------------------------------------
    @classmethod
    def status(cls, db):

        summary = FinancialAuditService.warehouse_summary(db)

        return {
            "engine": {
                "running": cls.running,
                "thread_alive": (
                    cls.worker_thread.is_alive()
                    if cls.worker_thread
                    else False
                ),
            },
            "audit_summary": summary["audit"],
            "warehouse": summary["warehouse"],
        }