"""
Alpha India Yahoo Finance Market Intelligence Worker
Sprint 35 — Market Intelligence & Growth Screener PRO
Background worker that fetches live market metrics and populates company_market_metrics.
"""

from datetime import datetime
import threading
import time
import traceback
from typing import Optional

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics
from app.models.quarterly_result import QuarterlyResult
from app.services.yahoo_client import YahooClient


class YahooImportWorker:
    """
    Background worker for bulk Yahoo Finance market intelligence enrichment.
    """

    _thread: Optional[threading.Thread] = None
    _running: bool = False

    _stats = {
        "processed": 0,
        "successful": 0,
        "failed": 0,
        "total": 0,
        "started_at": None,
        "last_symbol": None,
        "last_error": None,
    }

    @classmethod
    def upsert_company_metrics(cls, db: Session, company: Company) -> bool:
        """
        Fetches and upserts market metrics for a single company.
        """
        metrics = YahooClient.fetch_market_metrics(
            symbol=company.symbol,
            exchange=getattr(company, "exchange", "NSE") or "NSE",
            bse_code=getattr(company, "bse_code", None),
        )

        if not metrics:
            return False

        # Calculate ROCE and OPM from latest quarterly result if available
        latest_qr = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == company.id)
            .order_by(QuarterlyResult.result_date.desc(), QuarterlyResult.id.desc())
            .first()
        )

        opm = None
        roce = None
        if latest_qr:
            if getattr(latest_qr, "operating_income", None) and getattr(latest_qr, "revenue", None):
                if latest_qr.revenue != 0:
                    opm = round((latest_qr.operating_income / latest_qr.revenue) * 100.0, 2)

            if getattr(latest_qr, "roce", None) is not None:
                roce = round(float(latest_qr.roce), 2)

        # Check existing record
        record = (
            db.query(CompanyMarketMetrics)
            .filter(CompanyMarketMetrics.company_id == company.id)
            .first()
        )

        if not record:
            record = CompanyMarketMetrics(
                company_id=company.id,
                symbol=company.symbol,
            )
            db.add(record)

        # Update market metrics fields
        record.cmp = metrics.get("cmp")
        record.market_cap = metrics.get("market_cap")
        record.market_cap_category = metrics.get("market_cap_category")
        record.pe_ratio = metrics.get("pe_ratio")
        record.pb_ratio = metrics.get("pb_ratio")
        record.peg_ratio = metrics.get("peg_ratio")
        record.roe = metrics.get("roe")
        record.book_value = metrics.get("book_value")
        record.dividend_yield = metrics.get("dividend_yield")
        record.fifty_two_week_high = metrics.get("fifty_two_week_high")
        record.fifty_two_week_low = metrics.get("fifty_two_week_low")
        record.sector = metrics.get("sector") or getattr(company, "sector", None)
        record.industry = metrics.get("industry") or getattr(company, "industry", None)
        record.exchange = getattr(company, "exchange", "NSE") or "NSE"
        record.last_updated = datetime.utcnow()

        if opm is not None:
            record.opm = opm
        if roce is not None:
            record.roce = roce

        # Sync back to company master for consistent filters
        if metrics.get("sector"):
            company.sector = metrics["sector"]
        if metrics.get("industry"):
            company.industry = metrics["industry"]
        if metrics.get("market_cap"):
            company.market_cap = str(metrics["market_cap"])
        if metrics.get("market_cap_category"):
            company.market_cap_category = metrics["market_cap_category"]

        db.commit()
        return True

    @classmethod
    def _worker_loop(cls, batch_size: int, sleep_seconds: float):
        db = SessionLocal()
        try:
            while cls._running:
                # Prioritize companies that have quarterly results first
                companies = (
                    db.query(Company)
                    .join(QuarterlyResult, QuarterlyResult.company_id == Company.id)
                    .outerjoin(CompanyMarketMetrics, CompanyMarketMetrics.company_id == Company.id)
                    .filter(CompanyMarketMetrics.id.is_(None))
                    .distinct()
                    .order_by(Company.id.asc())
                    .limit(batch_size)
                    .all()
                )

                if not companies:
                    # Fallback to remaining companies
                    companies = (
                        db.query(Company)
                        .outerjoin(CompanyMarketMetrics, CompanyMarketMetrics.company_id == Company.id)
                        .filter(CompanyMarketMetrics.id.is_(None))
                        .order_by(Company.id.asc())
                        .limit(batch_size)
                        .all()
                    )

                if not companies:
                    print("✅ Market Intelligence sync completed for all companies.")
                    cls._running = False
                    break

                for company in companies:
                    if not cls._running:
                        break

                    cls._stats["last_symbol"] = company.symbol
                    try:
                        success = cls.upsert_company_metrics(db, company)
                        cls._stats["processed"] += 1
                        if success:
                            cls._stats["successful"] += 1
                        else:
                            cls._stats["failed"] += 1
                    except Exception as e:
                        cls._stats["failed"] += 1
                        cls._stats["last_error"] = str(e)

                    time.sleep(sleep_seconds)

        except Exception as e:
            cls._stats["last_error"] = str(e)
            traceback.print_exc()
        finally:
            cls._running = False
            db.close()

    @classmethod
    def start(cls, batch_size: int = 50, sleep_seconds: float = 0.2):
        if cls._running:
            return {"running": True, "message": "Worker is already active."}

        db = SessionLocal()
        total_companies = db.query(Company).count()
        db.close()

        cls._stats = {
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "total": total_companies,
            "started_at": datetime.utcnow().isoformat(),
            "last_symbol": None,
            "last_error": None,
        }

        cls._running = True
        cls._thread = threading.Thread(
            target=cls._worker_loop,
            args=(batch_size, sleep_seconds),
            daemon=True,
        )
        cls._thread.start()

        return {
            "running": True,
            "message": "Market Intelligence worker started.",
            "total_companies": total_companies,
        }

    @classmethod
    def stop(cls):
        cls._running = False
        return {"running": False, "message": "Market Intelligence worker stopping."}

    @classmethod
    def status(cls):
        db = SessionLocal()
        try:
            enriched_count = db.query(CompanyMarketMetrics).count()
            total_companies = db.query(Company).count()
            return {
                "running": cls._running,
                "thread_alive": cls._thread.is_alive() if cls._thread else False,
                "enriched_count": enriched_count,
                "total_companies": total_companies,
                "progress_percent": round((enriched_count / total_companies) * 100, 2) if total_companies else 0.0,
                **cls._stats,
            }
        finally:
            db.close()
