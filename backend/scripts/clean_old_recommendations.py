"""
Alpha India — Clean Old Recommendations & Catalysts (> 3 Months)
Sprint 35 Maintenance Script

Removes outdated recommendation and catalyst records older than 90 days:
1. AnnouncementRadar (Exchange catalyst recommendations: STRONG_BUY, TACTICAL_BUY, ACCUMULATE, PRICED_IN)
2. MFAccumulationSignal (Institutional MF accumulation trade recommendations)
3. Any legacy Athena / VCP recommendations older than 90 days
"""

import sys
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import desc

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.models.mf_models import MFAccumulationSignal
from app.models.athena_models import AthenaOmegaFiling, AthenaConvictionFlash
from app.models.vcp_models import VCPAIScore, BreakoutSignal

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CleanOldRecommendations")


def clean_recommendations(retention_days: int = 90, dry_run: bool = False):
    db = SessionLocal()
    now_utc = datetime.now(timezone.utc)
    cutoff_dt = now_utc - timedelta(days=retention_days)
    cutoff_date = cutoff_dt.date()

    print("=" * 80)
    print(f"ALPHA INDIA — RECOMMENDATION DATA CLEANUP")
    print(f"Current Date: {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Retention Period: {retention_days} Days")
    print(f"Cutoff Threshold: {cutoff_dt.strftime('%Y-%m-%d %H:%M:%S UTC')} (Date: {cutoff_date})")
    print(f"Mode: {'DRY RUN (No changes)' if dry_run else 'LIVE PURGE'}")
    print("=" * 80)

    stats = {
        "announcement_radar_deleted": 0,
        "mf_signals_deleted": 0,
        "athena_flashes_deleted": 0,
        "vcp_scores_deleted": 0,
    }

    try:
        # -------------------------------------------------------------
        # 1. Announcement Radar (Catalyst Recommendations)
        # -------------------------------------------------------------
        ar_query = db.query(AnnouncementRadar).filter(AnnouncementRadar.announcement_date < cutoff_dt)
        ar_count = ar_query.count()
        total_ar_before = db.query(AnnouncementRadar).count()
        print(f"\n[1] Announcement Radar Catalysts:")
        print(f"    - Total records: {total_ar_before}")
        print(f"    - Older than {retention_days} days (announcement_date < {cutoff_date}): {ar_count}")

        if ar_count > 0 and not dry_run:
            deleted = ar_query.delete(synchronize_session=False)
            stats["announcement_radar_deleted"] = deleted
            print(f"    -> Successfully purged {deleted} outdated announcement recommendations.")

        # -------------------------------------------------------------
        # 2. Mutual Fund Accumulation Signals
        # -------------------------------------------------------------
        mf_query = db.query(MFAccumulationSignal).filter(MFAccumulationSignal.signal_date < cutoff_date)
        mf_count = mf_query.count()
        total_mf_before = db.query(MFAccumulationSignal).count()
        print(f"\n[2] Mutual Fund Trade Setup Recommendations:")
        print(f"    - Total records: {total_mf_before}")
        print(f"    - Older than {retention_days} days (signal_date < {cutoff_date}): {mf_count}")

        if mf_count > 0 and not dry_run:
            deleted = mf_query.delete(synchronize_session=False)
            stats["mf_signals_deleted"] = deleted
            print(f"    -> Successfully purged {deleted} outdated MF trade recommendations.")

        # -------------------------------------------------------------
        # 3. Athena Conviction Flashes & Filings
        # -------------------------------------------------------------
        ath_query = db.query(AthenaOmegaFiling).filter(AthenaOmegaFiling.detected_at < cutoff_dt)
        ath_count = ath_query.count()
        total_ath_before = db.query(AthenaOmegaFiling).count()
        print(f"\n[3] Athena Flash Decisions:")
        print(f"    - Total records: {total_ath_before}")
        print(f"    - Older than {retention_days} days: {ath_count}")

        if ath_count > 0 and not dry_run:
            deleted = ath_query.delete(synchronize_session=False)
            stats["athena_flashes_deleted"] = deleted
            print(f"    -> Successfully purged {deleted} outdated Athena filing records.")

        # -------------------------------------------------------------
        # 4. VCP Breakout Scores
        # -------------------------------------------------------------
        vcp_query = db.query(VCPAIScore).filter(VCPAIScore.scan_date < cutoff_date)
        vcp_count = vcp_query.count()
        total_vcp_before = db.query(VCPAIScore).count()
        print(f"\n[4] VCP Breakout AI Recommendations:")
        print(f"    - Total records: {total_vcp_before}")
        print(f"    - Older than {retention_days} days: {vcp_count}")

        if vcp_count > 0 and not dry_run:
            deleted = vcp_query.delete(synchronize_session=False)
            stats["vcp_scores_deleted"] = deleted
            print(f"    -> Successfully purged {deleted} outdated VCP AI score records.")

        if not dry_run:
            db.commit()
            print("\n" + "=" * 80)
            print("COMMITTED: Database transaction successfully finalized.")
        else:
            print("\n" + "=" * 80)
            print("DRY RUN COMPLETE: No rows were deleted.")

        # Summary of remaining fresh records
        print("\nREMAINING FRESH RECOMMENDATION LEDGER:")
        print(f"  * Announcement Radar Catalysts: {db.query(AnnouncementRadar).count()} active (< 90 days)")
        print(f"  * MF Trade Recommendations:     {db.query(MFAccumulationSignal).count()} active (< 90 days)")
        print(f"  * Athena FLASH Decisions:       {db.query(AthenaConvictionFlash).count()} active (< 90 days)")
        print(f"  * VCP Breakout AI Setups:       {db.query(VCPAIScore).count()} active (< 90 days)")
        print("=" * 80)

    except Exception as e:
        db.rollback()
        logger.error(f"Error during recommendation cleanup: {e}", exc_info=True)
        raise
    finally:
        db.close()

    return stats


if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    clean_recommendations(retention_days=90, dry_run=is_dry)
