"""
Alpha India — Early Stage Discovery Scheduler  (Phase 2 + Phase 5)
Runs the three discovery collectors (news, social, YouTube) on safe intervals
and the nightly archive/cleanup job.
Guarded by the 'early_stage_enabled' feature flag in system_settings.
- News      : every 30 min
- Social    : every 60 min
- YouTube   : every 120 min
- Archive   : daily at 02:00 UTC
- Summary   : daily at 23:55 UTC (aggregates daily mention counts)
"""

import logging
import threading
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Intervals in seconds
NEWS_INTERVAL_SECONDS    = 30 * 60   # 30 min
SOCIAL_INTERVAL_SECONDS  = 60 * 60   # 60 min
YOUTUBE_INTERVAL_SECONDS = 120 * 60  # 120 min

# Nightly jobs
ARCHIVE_UTC_HOUR  = 2   # run archiver at 02:00 UTC
SUMMARY_UTC_HOUR  = 23  # aggregate daily summary at 23:55 UTC
SUMMARY_UTC_MIN   = 55


def _is_feature_enabled() -> bool:
    """
    Reads the feature flag from system_settings.
    Returns True only when setting_value == 'true'.
    Always returns False safely on any DB error.
    """
    try:
        from app.db.database import SessionLocal
        db = SessionLocal()
        try:
            from sqlalchemy import text
            row = db.execute(
                text(
                    "SELECT setting_value FROM system_settings "
                    "WHERE setting_key = 'early_stage_enabled' LIMIT 1"
                )
            ).fetchone()
            return row is not None and row[0].lower() == "true"
        finally:
            db.close()
    except Exception as exc:
        logger.warning(f"[EarlyStageScheduler] Feature flag check failed: {exc}")
        return False


class EarlyStageScheduler:
    """
    Daemon scheduler that runs all three discovery collectors on separate timers.
    Thread-safe singleton: call EarlyStageScheduler.start() once on app startup.
    The scheduler respects the early_stage_enabled feature flag — it runs its
    internal loop but skips collector execution when the flag is false.
    """

    _thread: threading.Thread | None = None
    _stop_event = threading.Event()
    _lock = threading.Lock()

    @classmethod
    def start(cls):
        with cls._lock:
            if cls._thread is not None and cls._thread.is_alive():
                logger.info("[EarlyStageScheduler] Already running.")
                return

            cls._stop_event.clear()
            cls._thread = threading.Thread(
                target=cls._scheduler_loop,
                daemon=True,
                name="EarlyStageSchedulerThread",
            )
            cls._thread.start()
            logger.info("[EarlyStageScheduler] Started.")

    @classmethod
    def stop(cls):
        with cls._lock:
            cls._stop_event.set()
            logger.info("[EarlyStageScheduler] Stopped.")

    @classmethod
    def _run_news(cls):
        try:
            from app.collectors.news_discovery_collector import collect_news
            from app.services.cache_eviction_service import evict_stale_cache
            logger.info("[EarlyStageScheduler] Running news collector...")
            summary = collect_news()
            logger.info(f"[EarlyStageScheduler] News done: {summary}")
            evict_stale_cache()
        except Exception as exc:
            logger.error(f"[EarlyStageScheduler] News collector error: {exc}")

    @classmethod
    def _run_social(cls):
        try:
            from app.collectors.social_discovery_collector import collect_social
            logger.info("[EarlyStageScheduler] Running social collector...")
            summary = collect_social()
            logger.info(f"[EarlyStageScheduler] Social done: {summary}")
        except Exception as exc:
            logger.error(f"[EarlyStageScheduler] Social collector error: {exc}")

    @classmethod
    def _run_youtube(cls):
        try:
            from app.collectors.youtube_discovery_collector import collect_youtube
            logger.info("[EarlyStageScheduler] Running YouTube collector...")
            summary = collect_youtube()
            logger.info(f"[EarlyStageScheduler] YouTube done: {summary}")
        except Exception as exc:
            logger.error(f"[EarlyStageScheduler] YouTube collector error: {exc}")

    @classmethod
    def _run_archive(cls):
        """Nightly archiver: move stale candidates to archive table."""
        try:
            from app.services.early_stage_archiver import run_archive_job
            logger.info("[EarlyStageScheduler] Running nightly archive job...")
            result = run_archive_job()
            logger.info(f"[EarlyStageScheduler] Archive done: {result}")
        except Exception as exc:
            logger.error(f"[EarlyStageScheduler] Archive job error: {exc}")

    @classmethod
    def _run_daily_summary(cls):
        """Aggregate today's mention counts into early_stage_daily_summary."""
        try:
            from app.db.database import SessionLocal
            from sqlalchemy import text
            from datetime import date
            db = SessionLocal()
            try:
                db.execute(text("""
                    INSERT INTO early_stage_daily_summary (candidate_id, date, mention_count, trend_score)
                    SELECT id, CURRENT_DATE, mention_count, trend_score
                    FROM early_stage_candidate
                    ON CONFLICT (candidate_id, date)
                    DO UPDATE SET
                        mention_count = EXCLUDED.mention_count,
                        trend_score   = EXCLUDED.trend_score
                """))
                db.commit()
                logger.info("[EarlyStageScheduler] Daily summary aggregation done.")
            finally:
                db.close()
        except Exception as exc:
            logger.error(f"[EarlyStageScheduler] Daily summary error: {exc}")

    @classmethod
    def _scheduler_loop(cls):
        now = datetime.utcnow()
        next_news    = now + timedelta(seconds=20)
        next_social  = now + timedelta(seconds=40)
        next_youtube = now + timedelta(seconds=60)
        _archive_ran_today:  set = set()
        _summary_ran_today:  set = set()

        while not cls._stop_event.is_set():
            now     = datetime.utcnow()
            today   = now.date()
            enabled = _is_feature_enabled()

            if enabled and now >= next_news:
                threading.Thread(target=cls._run_news, daemon=True).start()
                next_news = datetime.utcnow() + timedelta(seconds=NEWS_INTERVAL_SECONDS)

            if enabled and now >= next_social:
                threading.Thread(target=cls._run_social, daemon=True).start()
                next_social = datetime.utcnow() + timedelta(seconds=SOCIAL_INTERVAL_SECONDS)

            if enabled and now >= next_youtube:
                threading.Thread(target=cls._run_youtube, daemon=True).start()
                next_youtube = datetime.utcnow() + timedelta(seconds=YOUTUBE_INTERVAL_SECONDS)

            # Nightly archive — runs once per day at ARCHIVE_UTC_HOUR
            if (
                enabled
                and now.hour == ARCHIVE_UTC_HOUR
                and now.minute < 5  # 5-minute window to catch the tick
                and today not in _archive_ran_today
            ):
                threading.Thread(target=cls._run_archive, daemon=True).start()
                _archive_ran_today.add(today)

            # Daily summary aggregation — runs once per day at 23:55 UTC
            if (
                enabled
                and now.hour == SUMMARY_UTC_HOUR
                and now.minute >= SUMMARY_UTC_MIN
                and today not in _summary_ran_today
            ):
                threading.Thread(target=cls._run_daily_summary, daemon=True).start()
                _summary_ran_today.add(today)

            time.sleep(5)
