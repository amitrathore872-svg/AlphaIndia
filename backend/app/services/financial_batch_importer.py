"""
Alpha India Financial Batch Importer
Sprint 31.4.2
"""

from sqlalchemy.orm import Session

from app.services.financial_import_worker import FinancialImportWorker
from app.services.financial_progress_service import FinancialProgressService


class FinancialBatchImporter:

    @classmethod
    def run_batch(cls, db: Session, limit: int = 25):

        FinancialProgressService.start(db)

        imported = []
        failed = []

        for _ in range(limit):

            result = FinancialImportWorker.run_next(db)

            if result.get("message"):
                break

            if result["success"]:
                imported.append(result["symbol"])
                FinancialProgressService.update(
                    db,
                    result["symbol"],
                    True,
                )

            else:
                failed.append(
                    {
                        "symbol": result["symbol"],
                        "error": result["error"],
                    }
                )

                FinancialProgressService.update(
                    db,
                    result["symbol"],
                    False,
                )

        FinancialProgressService.finish(db)

        return {
            "requested": limit,
            "imported": len(imported),
            "failed": len(failed),
            "symbols_imported": imported,
            "symbols_failed": failed,
            "progress": FinancialProgressService.summary(db),
        }