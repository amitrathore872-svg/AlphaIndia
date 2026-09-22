"""
Alpha India Screener.in Import Worker
Parallel Architecture - Isolated background importer with polite rate limiting,
incremental upserts, live telemetry emission, and batch lifecycle management.
"""

from datetime import datetime
import logging
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.screener_import_run import ScreenerImportRun
from app.services.screener_client import ScreenerClient
from app.services.screener_telemetry_service import ScreenerTelemetryService

logger = logging.getLogger(__name__)


class ScreenerImportWorker:
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _lock = threading.Lock()

    @classmethod
    def is_running(cls) -> bool:
        with cls._lock:
            return cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def start(
        cls,
        batch_size: int = 50,
        delay_seconds: float = 0.8,
        symbols_override: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        with cls._lock:
            if cls._thread is not None and cls._thread.is_alive():
                return {"status": "ALREADY_RUNNING", "message": "Screener import worker is already running."}

            cls._stop_event.clear()
            run_id = f"run_{uuid.uuid4().hex[:10]}"
            cls._thread = threading.Thread(
                target=cls._run_loop,
                args=(run_id, batch_size, delay_seconds, symbols_override),
                daemon=True,
                name="ScreenerImportWorkerThread",
            )
            cls._thread.start()

            ScreenerTelemetryService.set_running(run_id)
            ScreenerTelemetryService.emit_event(
                event_type="JOB_START",
                message=f"Started Screener.in import run {run_id} (Target: {batch_size} companies, delay: {delay_seconds}s)",
                level="INFO",
                run_id=run_id,
            )

            return {"status": "STARTED", "run_id": run_id}

    @classmethod
    def stop(cls) -> Dict[str, Any]:
        with cls._lock:
            if cls._thread is None or not cls._thread.is_alive():
                return {"status": "NOT_RUNNING", "message": "Screener worker is not currently active."}

            cls._stop_event.set()
            ScreenerTelemetryService.emit_event(
                event_type="JOB_STOPPING",
                message="Stop signal received. Halting import worker gracefully...",
                level="WARNING",
            )
            return {"status": "STOPPING", "message": "Stop signal sent to worker."}

    @classmethod
    def _run_loop(
        cls,
        run_id: str,
        batch_size: int,
        delay_seconds: float,
        symbols_override: Optional[List[str]],
    ):
        db: Session = SessionLocal()
        start_time = datetime.utcnow()

        run_record = ScreenerImportRun(
            run_id=run_id,
            status="RUNNING",
            start_time=start_time,
            total_target=batch_size,
        )
        db.add(run_record)
        db.commit()

        imported_count = 0
        updated_count = 0
        failed_count = 0
        skipped_count = 0

        try:
            # 1. Resolve symbols to import incrementally
            targets: List[Tuple[str, Optional[str]]] = []
            if symbols_override:
                targets = [(s.strip().upper(), None) for s in symbols_override[:batch_size]]
            else:
                # Incremental Target Resolution:
                # Priority 1: Unimported companies first (screener_growth_records.symbol is NULL), ordered by highest market cap.
                # Priority 2: Once all companies have an initial record, rotate stalest first (oldest last_updated).
                unimported_count = (
                    db.query(Company.id)
                    .outerjoin(
                        ScreenerGrowthRecord,
                        Company.symbol == ScreenerGrowthRecord.symbol,
                    )
                    .filter(
                        Company.is_growth_eligible.is_(True),
                        ScreenerGrowthRecord.symbol.is_(None),
                    )
                    .count()
                )

                companies = (
                    db.query(Company.symbol, Company.company)
                    .outerjoin(
                        ScreenerGrowthRecord,
                        Company.symbol == ScreenerGrowthRecord.symbol,
                    )
                    .filter(Company.is_growth_eligible.is_(True))
                    .order_by(
                        ScreenerGrowthRecord.last_updated.asc().nullsfirst(),
                        Company.market_cap.desc().nullslast(),
                    )
                    .limit(batch_size)
                    .all()
                )
                targets = [(c[0], c[1]) for c in companies]

                logger.info(
                    f"ScreenerImportWorker resolved {len(targets)} incremental targets (Unimported remaining: {unimported_count})."
                )

            run_record.total_target = len(targets)
            db.commit()

            # 2. Iterate through symbols with polite delay
            for idx, (sym, name_hint) in enumerate(targets):
                if cls._stop_event.is_set():
                    logger.info("ScreenerImportWorker stop event detected. Aborting batch loop.")
                    ScreenerTelemetryService.emit_event(
                        event_type="JOB_ABORTED",
                        message=f"Import run aborted by user at item {idx}/{len(targets)}.",
                        level="WARNING",
                        run_id=run_id,
                    )
                    break

                ScreenerTelemetryService.set_current_symbol(sym)
                ScreenerTelemetryService.emit_event(
                    event_type="FETCHING",
                    message=f"[{idx+1}/{len(targets)}] Fetching fundamental profile for {sym}...",
                    level="INFO",
                    symbol=sym,
                    run_id=run_id,
                )

                # Fetch full profile with single polite retry on failure
                profile = ScreenerClient.fetch_full_profile(sym)
                if not profile:
                    time.sleep(1.5)
                    profile = ScreenerClient.fetch_full_profile(sym)

                if not profile:
                    failed_count += 1
                    ScreenerTelemetryService.emit_event(
                        event_type="ERROR",
                        message=f"Failed to fetch profile or parse HTML for {sym} after retry.",
                        level="ERROR",
                        symbol=sym,
                        run_id=run_id,
                    )
                    # Mark symbol as attempted with last_updated so it does not block subsequent incremental batches
                    existing_stub = (
                        db.query(ScreenerGrowthRecord)
                        .filter(ScreenerGrowthRecord.symbol == sym)
                        .first()
                    )
                    if existing_stub:
                        existing_stub.last_updated = datetime.utcnow()
                    else:
                        stub = ScreenerGrowthRecord(
                            symbol=sym,
                            company_name=name_hint or sym,
                            import_source="screener.in (unavailable)",
                            data_completeness_score=0.0,
                            last_updated=datetime.utcnow(),
                        )
                        db.add(stub)
                    db.commit()
                    time.sleep(delay_seconds)
                    continue

                ScreenerTelemetryService.emit_event(
                    event_type="PARSED",
                    message=f"Parsed {sym}: CMP ₹{profile.get('current_price')}, ROCE {profile.get('roce')}%, 3Y Sales {profile.get('sales_growth_3yr')}%",
                    level="INFO",
                    symbol=sym,
                    run_id=run_id,
                    response_time_ms=profile.get("response_time_ms"),
                    parse_time_ms=profile.get("parse_time_ms"),
                )

                # Upsert into screener_growth_records
                w0 = time.perf_counter()
                existing = (
                    db.query(ScreenerGrowthRecord)
                    .filter(ScreenerGrowthRecord.symbol == sym)
                    .first()
                )

                if existing:
                    is_new = False
                    for k, v in profile.items():
                        if hasattr(existing, k) and k not in ("id", "import_timestamp", "quarters_history"):
                            setattr(existing, k, v)
                    existing.last_updated = datetime.utcnow()
                    updated_count += 1
                else:
                    is_new = True
                    clean_data = {
                        k: v
                        for k, v in profile.items()
                        if hasattr(ScreenerGrowthRecord, k) and k not in ("id", "quarters_history")
                    }
                    if not clean_data.get("company_name"):
                        clean_data["company_name"] = name_hint or sym
                    rec = ScreenerGrowthRecord(**clean_data)
                    db.add(rec)
                    imported_count += 1

                # Upsert historical quarters into quarterly_results & sync Company master
                company = db.query(Company).filter(Company.symbol == sym).first()
                quarters_imported_count = 0
                if company:
                    quarters_history = profile.get("quarters_history", [])
                    for q in quarters_history:
                        period_end = q.get("period_end")
                        q_label = q.get("quarter")
                        if not period_end or not q_label:
                            continue

                        existing_q = (
                            db.query(QuarterlyResult)
                            .filter(
                                QuarterlyResult.company_id == company.id,
                                (QuarterlyResult.period_end == period_end) | (QuarterlyResult.quarter == q_label),
                            )
                            .first()
                        )
                        if existing_q:
                            existing_q.quarter = q_label
                            existing_q.fiscal_period = q.get("fiscal_period") or q_label
                            existing_q.period_end = period_end
                            existing_q.result_date = period_end
                            existing_q.revenue = q.get("revenue")
                            existing_q.operating_income = q.get("operating_income")
                            existing_q.net_profit = q.get("net_profit")
                            existing_q.eps = q.get("eps")
                            existing_q.interest_expense = q.get("interest_expense")
                            existing_q.revenue_growth = q.get("revenue_growth")
                            existing_q.pat_growth = q.get("pat_growth")
                            existing_q.source = "SCREENER.IN"
                            existing_q.imported_at = datetime.utcnow()
                        else:
                            new_q = QuarterlyResult(
                                company_id=company.id,
                                quarter=q_label,
                                fiscal_period=q.get("fiscal_period") or q_label,
                                period_end=period_end,
                                result_date=period_end,
                                revenue=q.get("revenue"),
                                operating_income=q.get("operating_income"),
                                net_profit=q.get("net_profit"),
                                eps=q.get("eps"),
                                interest_expense=q.get("interest_expense"),
                                revenue_growth=q.get("revenue_growth"),
                                pat_growth=q.get("pat_growth"),
                                source="SCREENER.IN",
                                imported_at=datetime.utcnow(),
                            )
                            db.add(new_q)
                        quarters_imported_count += 1

                    # Update Company master metrics
                    if profile.get("market_cap") is not None:
                        company.market_cap = profile.get("market_cap")
                    if profile.get("quarterly_sales_yoy") is not None:
                        company.revenue_growth = profile.get("quarterly_sales_yoy")
                    elif profile.get("sales_growth_ttm") is not None:
                        company.revenue_growth = profile.get("sales_growth_ttm")
                    if profile.get("quarterly_pat_yoy") is not None:
                        company.pat_growth = profile.get("quarterly_pat_yoy")
                    elif profile.get("profit_growth_ttm") is not None:
                        company.pat_growth = profile.get("profit_growth_ttm")
                    if profile.get("roce") is not None:
                        company.roce = profile.get("roce")
                    if profile.get("health_score") is not None:
                        company.health_score = profile.get("health_score")
                    company.updated_at = datetime.utcnow()

                db.commit()
                w1 = time.perf_counter()
                db_write_ms = round((w1 - w0) * 1000, 2)

                action_label = "Added new" if is_new else "Updated"
                ScreenerTelemetryService.emit_event(
                    event_type="SAVED",
                    message=f"{action_label} {sym} ({quarters_imported_count} quarters synced, Write: {db_write_ms}ms).",
                    level="SUCCESS",
                    symbol=sym,
                    run_id=run_id,
                    response_time_ms=profile.get("response_time_ms"),
                    parse_time_ms=profile.get("parse_time_ms"),
                    db_write_time_ms=db_write_ms,
                )

                time.sleep(delay_seconds)

        except Exception as e:
            logger.error(f"Fatal error in ScreenerImportWorker run {run_id}: {e}", exc_info=True)
            run_record.status = "FAILED"
            run_record.error_summary = str(e)
            ScreenerTelemetryService.set_failed(str(e))
        finally:
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            run_record.end_time = end_time
            run_record.duration_seconds = round(duration, 1)
            run_record.imported_count = imported_count
            run_record.updated_count = updated_count
            run_record.failed_count = failed_count
            run_record.skipped_count = skipped_count

            total_processed = imported_count + updated_count + failed_count
            rate = round(((imported_count + updated_count) / total_processed) * 100, 1) if total_processed > 0 else 0.0
            run_record.success_rate_percent = rate

            if run_record.status != "FAILED":
                if cls._stop_event.is_set():
                    run_record.status = "ABORTED"
                elif failed_count > 0 and (imported_count + updated_count) > 0:
                    run_record.status = "PARTIAL"
                else:
                    run_record.status = "SUCCESS"

            final_status = run_record.status
            db.commit()
            db.close()

            ScreenerTelemetryService.set_idle(success=(final_status in ("SUCCESS", "PARTIAL")))
            ScreenerTelemetryService.emit_event(
                event_type="JOB_COMPLETE",
                message=f"Import run {run_id} completed: {imported_count} new, {updated_count} updated, {failed_count} failed in {round(duration, 1)}s.",
                level="INFO" if final_status in ("SUCCESS", "PARTIAL") else "ERROR",
                run_id=run_id,
            )
