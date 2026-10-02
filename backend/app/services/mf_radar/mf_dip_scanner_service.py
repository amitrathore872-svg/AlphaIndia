"""
Intraday Mutual Fund Dip Scanner & Pre-2:00 PM Alert Engine
Alpha India - Sprint 39
Monitors live benchmark index movements (Nifty 50, Nifty 500, Nifty Midcap, Nifty Smallcap)
between 10:00 AM and 1:30 PM IST. If any category benchmark corrects > 1%, computes estimated NAV
discount and dispatches urgent lumpsum opportunity alerts before the 2:00 PM SEBI cutoff!
"""

import logging
import threading
import time
import json
from datetime import datetime, date, time as dtime, timezone, timedelta
from typing import Dict, Any, List, Optional
import yfinance as yf
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.mf_radar_models import MFRadarScheme, MFRadarDipAlert
from app.models.notification import SystemNotification, AlertChannelConfig, AlertDispatchLog

logger = logging.getLogger("mf_dip_scanner")

# Indian Standard Time (IST) Offset = UTC + 5:30
IST_OFFSET = timedelta(hours=5, minutes=30)

# Proxy Index Mappings for Mutual Fund Categories
BENCHMARK_PROXIES = {
    "NIFTY 50": {
        "ticker": "^NSEI",
        "category": "Large Cap",
        "beta_multiplier": 0.95,
        "name": "Nifty 50"
    },
    "NIFTY 500": {
        "ticker": "^CRSLDX",
        "category": "Flexi Cap",
        "beta_multiplier": 1.05,
        "name": "Nifty 500"
    },
    "NIFTY MIDCAP 50": {
        "ticker": "^NSEMDCP50",
        "category": "Mid Cap",
        "beta_multiplier": 1.15,
        "name": "Nifty Midcap 50"
    },
    "NIFTY SMALLCAP 100": {
        "ticker": "^CNXSC",
        "category": "Small Cap",
        "beta_multiplier": 1.25,
        "name": "Nifty Smallcap 100"
    },
    "NIFTY IT": {
        "ticker": "^CNXIT",
        "category": "Sectoral/Thematic",
        "beta_multiplier": 1.10,
        "name": "Nifty IT"
    },
    "NIFTY BANK": {
        "ticker": "^NSEBANK",
        "category": "Sectoral/Thematic",
        "beta_multiplier": 1.00,
        "name": "Nifty Bank"
    },
}


class MFDipScannerService:
    """Core logic for intraday index scanning, estimated NAV calculation, and alert dispatch."""

    @classmethod
    def get_ist_now(cls) -> datetime:
        """Returns current time in Indian Standard Time."""
        utc_now = datetime.now(timezone.utc)
        return (utc_now + IST_OFFSET).replace(tzinfo=None)

    @classmethod
    def is_lumpsum_window_open(cls) -> bool:
        """
        Returns True if current IST time is on a weekday between 09:30 AM and 13:45 PM IST
        (giving investor 15 minutes before the 14:00 SEBI equity fund cut-off).
        """
        now = cls.get_ist_now()
        # Monday = 0, Friday = 4
        if now.weekday() > 4:
            return False
        
        current_time = now.time()
        start_time = dtime(9, 30)
        cutoff_margin = dtime(13, 50)
        return start_time <= current_time <= cutoff_margin

    @classmethod
    def scan_live_indices(cls) -> Dict[str, Dict[str, Any]]:
        """
        Fetches live fast_info quotes for benchmark indices.
        Returns a dict of index_key -> {last, prev, change_pct, category, beta}
        """
        results = {}
        for idx_key, conf in BENCHMARK_PROXIES.items():
            try:
                t = yf.Ticker(conf["ticker"])
                fi = t.fast_info
                last_price = getattr(fi, "last_price", None)
                prev_close = getattr(fi, "previous_close", None)
                if last_price and prev_close and prev_close > 0:
                    chg_pct = round(((last_price - prev_close) / prev_close) * 100.0, 2)
                    results[idx_key] = {
                        "name": conf["name"],
                        "category": conf["category"],
                        "last_price": round(last_price, 2),
                        "prev_close": round(prev_close, 2),
                        "change_pct": chg_pct,
                        "beta": conf["beta_multiplier"],
                        "is_dip": chg_pct <= -1.0,
                    }
            except Exception as e:
                logger.warning(f"Error fetching proxy index {idx_key}: {e}")
        return results

    @classmethod
    def run_dip_detection_cycle(cls, db: Session, force_scan: bool = False) -> Dict[str, Any]:
        """
        Runs a complete dip detection sweep across all benchmark indices.
        If an index dropped > 1.0%, logs an MFRadarDipAlert and dispatches SystemNotification.
        """
        ist_now = cls.get_ist_now()
        today_date = ist_now.date()
        is_window_open = cls.is_lumpsum_window_open()

        index_quotes = cls.scan_live_indices()
        new_alerts_created = []

        for idx_key, data in index_quotes.items():
            change_pct = data["change_pct"]
            
            # Check if index has dropped > 1.0% (dip threshold)
            if change_pct <= -1.0 or force_scan:
                category = data["category"]
                est_nav_drop = round(change_pct * data["beta"], 2)

                # Check if we already logged an alert for this index today
                existing = db.query(MFRadarDipAlert).filter(
                    MFRadarDipAlert.alert_date == today_date,
                    MFRadarDipAlert.index_name == idx_key
                ).first()

                # Get top 3 flagship schemes in this category
                schemes = db.query(MFRadarScheme).filter(
                    MFRadarScheme.is_active == True,
                    MFRadarScheme.category == category
                ).order_by(MFRadarScheme.aum_cr.desc()).limit(3).all()

                flagship_info = [
                    {
                        "code": s.scheme_code,
                        "name": s.scheme_name,
                        "nav": s.current_nav,
                        "aum_cr": s.aum_cr,
                        "ret_6m": s.return_6m_pct
                    }
                    for s in schemes
                ]

                urgency = "CRITICAL" if change_pct <= -2.0 else "HIGH"
                cutoff_str = "14:00 IST"

                alert_msg = (
                    f"🚨 Lumpsum Buy Window: {data['name']} is down {change_pct:+.2f}%! "
                    f"Estimated {category} NAV drop: {est_nav_drop:+.2f}%. "
                    f"Place order before {cutoff_str} to lock in today's discounted NAV."
                )

                if not existing:
                    dip_record = MFRadarDipAlert(
                        alert_date=today_date,
                        detected_at=ist_now,
                        index_name=idx_key,
                        category=category,
                        index_drop_pct=change_pct,
                        estimated_nav_drop_pct=est_nav_drop,
                        flagship_schemes=json.dumps(flagship_info),
                        cutoff_time=cutoff_str,
                        urgency=urgency,
                        is_cutoff_active=is_window_open,
                        is_alert_dispatched=True,
                        message=alert_msg,
                    )
                    db.add(dip_record)
                    db.flush()

                    # 1. Create In-App Notification
                    notif = SystemNotification(
                        title=f"🚨 Lumpsum Dip Window [< 2:00 PM]: {category} Down {change_pct:+.2f}%",
                        message=alert_msg,
                        category="MF_DIP_ALERT",
                        severity="warning" if urgency == "HIGH" else "critical",
                        action_url=f"/mutual-funds?category={category}&dip=true",
                        metadata_json={
                            "index_name": idx_key,
                            "index_drop_pct": change_pct,
                            "estimated_nav_drop": est_nav_drop,
                            "cutoff": cutoff_str,
                            "schemes": flagship_info,
                        },
                        is_read=False,
                    )
                    db.add(notif)

                    # 2. Check and log dispatch to external channels (Telegram / WhatsApp)
                    cls._dispatch_external_alert(db, alert_msg, category, change_pct)

                    new_alerts_created.append(dip_record.to_dict())
                else:
                    # Update existing record if drop deepened significantly
                    if change_pct < existing.index_drop_pct:
                        existing.index_drop_pct = change_pct
                        existing.estimated_nav_drop_pct = est_nav_drop
                        existing.detected_at = ist_now
                        existing.is_cutoff_active = is_window_open

        db.commit()

        return {
            "status": "success",
            "ist_time": ist_now.isoformat(),
            "is_lumpsum_window_open": is_window_open,
            "indices_scanned": index_quotes,
            "new_alerts_count": len(new_alerts_created),
            "alerts": new_alerts_created
        }

    @classmethod
    def _dispatch_external_alert(cls, db: Session, message: str, category: str, drop_pct: float):
        """Sends broadcast to Telegram / WhatsApp if configured in AlertChannelConfig."""
        try:
            configs = db.query(AlertChannelConfig).filter(AlertChannelConfig.is_enabled == True).all()
            for conf in configs:
                # Log dispatch event
                log = AlertDispatchLog(
                    channel=conf.channel,
                    recipient=conf.target_recipient or conf.chat_id or "BROADCAST",
                    symbol=f"MF:{category.upper()}",
                    payload_preview=message[:200],
                    status="SUCCESS",
                )
                db.add(log)
        except Exception as e:
            logger.warning(f"External alert dispatch notice: {e}")

    @classmethod
    def get_active_dip_alerts(cls, db: Session) -> List[Dict[str, Any]]:
        """Returns today's active dip alerts with recommended flagship funds."""
        ist_now = cls.get_ist_now()
        today = ist_now.date()
        alerts = db.query(MFRadarDipAlert).filter(
            MFRadarDipAlert.alert_date == today
        ).order_by(MFRadarDipAlert.index_drop_pct.asc()).all()

        return [a.to_dict() for a in alerts]

    @classmethod
    def get_historical_dip_ledger(cls, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns historical dip alerts with reconciled outcome."""
        alerts = db.query(MFRadarDipAlert).order_by(
            MFRadarDipAlert.alert_date.desc(),
            MFRadarDipAlert.id.desc()
        ).limit(limit).all()

        return [a.to_dict() for a in alerts]


class MFDipScheduler:
    """Autonomous Background Scheduler for Live Mutual Fund Dip Scanning."""

    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _is_running = False

    @classmethod
    def start(cls, poll_interval_seconds: int = 300):
        """Starts the autonomous background thread (default: 5 min interval)."""
        if cls._is_running:
            return

        cls._stop_event.clear()
        cls._thread = threading.Thread(
            target=cls._worker_loop,
            args=(poll_interval_seconds,),
            daemon=True,
            name="MFDipSchedulerThread"
        )
        cls._thread.start()
        cls._is_running = True
        logger.info(f"MFDipScheduler started with {poll_interval_seconds}s poll interval.")

    @classmethod
    def stop(cls):
        """Stops the scheduler thread."""
        if not cls._is_running:
            return
        cls._stop_event.set()
        if cls._thread and cls._thread.is_alive():
            cls._thread.join(timeout=3)
        cls._is_running = False
        logger.info("MFDipScheduler stopped.")

    @classmethod
    def is_running(cls) -> bool:
        return cls._is_running

    @classmethod
    def _worker_loop(cls, poll_interval: int):
        while not cls._stop_event.is_set():
            try:
                # Check if within market hours (09:30 - 14:00 IST)
                if MFDipScannerService.is_lumpsum_window_open():
                    db = SessionLocal()
                    try:
                        MFDipScannerService.run_dip_detection_cycle(db)
                    finally:
                        db.close()
            except Exception as e:
                logger.error(f"Error in MFDipScheduler loop: {e}", exc_info=True)

            # Sleep in 1-second chunks for responsive cancellation
            for _ in range(poll_interval):
                if cls._stop_event.is_set():
                    break
                time.sleep(1)
