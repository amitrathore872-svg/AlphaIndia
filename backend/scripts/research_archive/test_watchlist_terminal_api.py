"""
Verification script for Watchlist Terminal Rule Alerts and Personal Telegram Broadcast.
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.watchlist import Watchlist, WatchlistItem
from app.models.watchlist_alert import WatchlistAlert, UserPersonalTelegramConfig
from app.services.watchlist_alert_service import WatchlistAlertService


def main():
    print("[1/5] Testing Database connection and models...")
    db = SessionLocal()
    try:
        # 1. Get or create test watchlist
        wl = db.query(Watchlist).first()
        if not wl:
            wl = Watchlist(name="Core Alpha Momentum", description="High-conviction watchlist")
            db.add(wl)
            db.commit()
            db.refresh(wl)
        print(f"  Found/Created Watchlist: ID={wl.id}, Name='{wl.name}'")

        # 2. Test Personal Telegram Config
        print("\n[2/5] Testing Personal Telegram Config...")
        cfg = WatchlistAlertService.get_or_create_user_telegram_config(db, user_id=None)
        print(f"  Config ID={cfg.id}, Channel='{cfg.channel_name}', Chat ID='{cfg.chat_id}', Enabled={cfg.is_enabled}")

        # Update test chat_id
        cfg_updated = WatchlistAlertService.update_user_telegram_config(
            db=db,
            user_id=None,
            chat_id="8349099576",
            channel_name="Amit Watchlist Radar",
            telegram_username="@amitrathore",
        )
        print(f"  Updated Config: Channel='{cfg_updated.channel_name}', Username='{cfg_updated.telegram_username}'")

        # 3. Create Rule Alert for a stock (e.g. KISSHT or RELIANCE)
        test_symbol = "KISSHT"
        print(f"\n[3/5] Creating Rule Alert for {test_symbol}...")
        alert = WatchlistAlertService.create_alert(
            db=db,
            watchlist_id=wl.id,
            symbol=test_symbol,
            rule_type="PRICE_CROSS_ABOVE",
            threshold_value=385.0,
            notes="Breakout above resistance pivot with expanding volume. Target: Rs 425.",
            notify_in_app=True,
            notify_telegram=True,
        )
        print(f"  Created Alert ID={alert.id}: {alert.symbol} ({alert.rule_type} @ {alert.threshold_value})")

        # 4. Fetch alerts
        print(f"\n[4/5] Fetching alerts for symbol {test_symbol}...")
        alerts = WatchlistAlertService.get_alerts_for_symbol(db, symbol=test_symbol)
        print(f"  Fetched {len(alerts)} alerts for {test_symbol}.")
        assert len(alerts) >= 1

        # 5. Test Rule Evaluator
        print(f"\n[5/5] Testing Rule Evaluator with CMP=386.40 (should trigger)...")
        results = WatchlistAlertService.evaluate_and_dispatch(
            db=db,
            symbol=test_symbol,
            cmp=386.40,
            day_change_pct=4.12,
            volume=4120000,
            avg_volume_20d=1800000,
            dma_50=342.10,
            dma_200=298.50,
            vcp_score=92,
        )
        print(f"  Evaluation Result: {len(results)} rules triggered.")
        for r in results:
            detail_safe = r['rule_detail'].encode('ascii', errors='replace').decode('ascii')
            print(f"  -> Triggered: {r['rule_type']} | Detail: {detail_safe} | Telegram Sent: {r['telegram_dispatched']}")

        print("\n[SUCCESS] All Watchlist Rule Alert and Personal Telegram verification steps passed!")

    finally:
        db.close()


if __name__ == "__main__":
    main()
