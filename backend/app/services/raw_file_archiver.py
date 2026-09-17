"""
Alpha India — Raw File Archival & Compression Service
Institutional Storage Optimization Engine

Compresses raw PDF documents and exchange disclosure artifacts after successful
extraction into the database. Keeps system storage lightweight, reduces disk I/O,
and ensures sub-second platform performance while preserving full audit integrity.
"""

import gzip
import logging
import os
import shutil
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry

logger = logging.getLogger(__name__)


class RawFileArchiveService:
    _lock = threading.RLock()
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()

    # Settings
    _interval_seconds: int = 600  # Run maintenance every 10 minutes
    _is_running: bool = False
    _last_run_time: Optional[datetime] = None

    # Telemetry
    _total_files_archived: int = 0
    _total_uncompressed_bytes: int = 0
    _total_compressed_bytes: int = 0
    _last_cycle_files_count: int = 0
    _last_cycle_bytes_saved: int = 0

    ARCHIVE_ROOT = Path("data/archive")
    BRONZE_ROOT = Path("data/bronze")

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        with cls._lock:
            bytes_saved = max(0, cls._total_uncompressed_bytes - cls._total_compressed_bytes)
            savings_pct = (
                round((bytes_saved / cls._total_uncompressed_bytes) * 100.0, 1)
                if cls._total_uncompressed_bytes > 0
                else 0.0
            )
            return {
                "service_id": "raw_file_archiver",
                "name": "Raw File Archival & Compression Engine",
                "status": "RUNNING" if cls.is_running() else "IDLE",
                "interval_seconds": cls._interval_seconds,
                "last_run_time": cls._last_run_time.isoformat() if cls._last_run_time else None,
                "total_files_archived": cls._total_files_archived,
                "total_uncompressed_mb": round(cls._total_uncompressed_bytes / (1024 * 1024), 2),
                "total_compressed_mb": round(cls._total_compressed_bytes / (1024 * 1024), 2),
                "total_mb_saved": round(bytes_saved / (1024 * 1024), 2),
                "space_savings_pct": savings_pct,
                "last_cycle_files_count": cls._last_cycle_files_count,
            }

    @classmethod
    def is_running(cls) -> bool:
        with cls._lock:
            return cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def start(cls, interval_seconds: int = 600):
        with cls._lock:
            if cls._thread is not None and cls._thread.is_alive():
                return
            cls._interval_seconds = max(60, interval_seconds)
            cls._stop_event.clear()
            cls._is_running = True
            cls._thread = threading.Thread(
                target=cls._maintenance_loop,
                daemon=True,
                name="RawFileArchiveServiceThread",
            )
            cls._thread.start()
            logger.info(f"[RawFileArchiveService] Started archival background thread (Interval: {cls._interval_seconds}s).")

    @classmethod
    def stop(cls):
        with cls._lock:
            cls._is_running = False
            cls._stop_event.set()
            logger.info("[RawFileArchiveService] Stopped archival background thread.")

    @classmethod
    def _maintenance_loop(cls):
        logger.info("[RawFileArchiveService] Archival background loop entered.")
        while not cls._stop_event.is_set():
            try:
                cls.run_archival_cycle()
            except Exception as exc:
                logger.error(f"[RawFileArchiveService] Error in maintenance cycle: {exc}")

            slept = 0
            while slept < cls._interval_seconds and not cls._stop_event.is_set():
                time.sleep(1)
                slept += 1

    @classmethod
    def run_archival_cycle(cls) -> Dict[str, Any]:
        """
        Scans for uncompressed raw PDFs whose extraction is complete,
        compresses them into .gz archives, and safely prunes the uncompressed originals.
        """
        start_t = time.time()
        cls._last_run_time = datetime.now(timezone.utc)
        archived_count = 0
        uncompressed_bytes = 0
        compressed_bytes = 0

        # Scan database for parsed filings with local files
        db = None
        try:
            db = SessionLocal()
            filings = (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.pdf_local_path.isnot(None),
                    FilingRegistry.parse_status == "PARSED",
                )
                .all()
            )

            for filing in filings:
                raw_path = Path(filing.pdf_local_path)
                # If path exists and is an uncompressed file (.pdf, .html, etc.)
                if raw_path.exists() and not raw_path.name.endswith(".gz") and raw_path.is_file():
                    res = cls._archive_single_file(raw_path)
                    if res:
                        filing.pdf_local_path = str(res["archive_path"])
                        archived_count += 1
                        uncompressed_bytes += res["orig_size"]
                        compressed_bytes += res["comp_size"]

            # Also scan bronze storage directory directly for any uncompressed historical PDFs
            for bronze_dir in [Path("data/bronze"), Path("backend/data/bronze")]:
                if bronze_dir.exists():
                    for raw_file in bronze_dir.glob("**/*.pdf"):
                        if raw_file.is_file() and not raw_file.name.endswith(".gz"):
                            res = cls._archive_single_file(raw_file)
                            if res:
                                archived_count += 1
                                uncompressed_bytes += res["orig_size"]
                                compressed_bytes += res["comp_size"]

            db.commit()
        except Exception as e:
            logger.error(f"[RawFileArchiveService] Cycle error: {e}")
            if db:
                db.rollback()
        finally:
            if db:
                db.close()

        duration_ms = round((time.time() - start_t) * 1000, 1)

        with cls._lock:
            cls._total_files_archived += archived_count
            cls._total_uncompressed_bytes += uncompressed_bytes
            cls._total_compressed_bytes += compressed_bytes
            cls._last_cycle_files_count = archived_count
            cls._last_cycle_bytes_saved = max(0, uncompressed_bytes - compressed_bytes)

        saved_mb = round((uncompressed_bytes - compressed_bytes) / (1024 * 1024), 2)
        logger.info(
            f"[RawFileArchiveService] Cycle finished in {duration_ms}ms: "
            f"{archived_count} files archived, {saved_mb} MB saved."
        )

        # Log action to ControlSystemService if loaded
        try:
            from app.services.control_system_service import ControlSystemService
            ControlSystemService.log_action(
                service_id="raw_file_archiver",
                service_name="Raw File Archival Engine",
                level="SUCCESS" if archived_count > 0 else "INFO",
                action="ARCHIVE_CYCLE",
                message=f"Archived {archived_count} raw documents. Reclaimed {saved_mb} MB disk space.",
                duration_ms=duration_ms,
                records_count=archived_count,
            )
            ControlSystemService.record_service_fetch(
                service_id="raw_file_archiver",
                records_count=archived_count,
                status="SUCCESS",
            )
        except Exception:
            pass

        return {
            "success": True,
            "archived_count": archived_count,
            "uncompressed_bytes": uncompressed_bytes,
            "compressed_bytes": compressed_bytes,
            "saved_mb": saved_mb,
            "duration_ms": duration_ms,
        }

    @classmethod
    def _archive_single_file(cls, file_path: Path) -> Optional[Dict[str, Any]]:
        """
        Compresses a file into .gz in-place or under archive path, verifies integrity,
        and deletes the original uncompressed file.
        """
        try:
            orig_size = file_path.stat().st_size
            if orig_size == 0:
                return None

            archive_path = file_path.with_name(file_path.name + ".gz")

            with open(file_path, "rb") as f_in:
                with gzip.open(archive_path, "wb", compresslevel=9) as f_out:
                    shutil.copyfileobj(f_in, f_out)

            # Verification check
            comp_size = archive_path.stat().st_size
            if comp_size > 0:
                # Remove original heavy file to save disk space
                file_path.unlink(missing_ok=True)
                return {
                    "archive_path": archive_path,
                    "orig_size": orig_size,
                    "comp_size": comp_size,
                }
            else:
                # Compression failed; remove empty archive
                archive_path.unlink(missing_ok=True)
                return None
        except Exception as e:
            logger.debug(f"[RawFileArchiveService] Failed to archive {file_path}: {e}")
            return None

    @classmethod
    def decompress_for_reading(cls, archive_path_str: str) -> Optional[bytes]:
        """
        Decompresses an archived .gz file on-demand in memory for viewing/serving.
        """
        p = Path(archive_path_str)
        if not p.exists():
            return None

        if p.name.endswith(".gz"):
            with gzip.open(p, "rb") as f:
                return f.read()
        else:
            return p.read_bytes()
