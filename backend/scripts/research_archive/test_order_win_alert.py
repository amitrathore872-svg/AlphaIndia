import sys
import os

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.db.database import SessionLocal
from app.services.opportunity_alert_service import OpportunityAlertService
from app.services.alert_dispatch_service import AlertDispatchService
from app.models.notification import SystemNotification, AlertChannelConfig, AlertDispatchLog
from app.models.announcement_radar import AnnouncementRadar

def main():
    print("=" * 60)
    print("Testing Alpha India Order Win Radar Alerts")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Check rules threshold
        rules = OpportunityAlertService.get_opportunity_thresholds(db)
        print(f"\n1. Loaded Rules:")
        print(f"   order_win_enabled: {rules.get('order_win_enabled')}")
        print(f"   order_win_min_significance: {rules.get('order_win_min_significance')}")
        print(f"   order_win_min_deal_cr: {rules.get('order_win_min_deal_cr')}")
        print(f"   auto_broadcast_telegram: {rules.get('auto_broadcast_telegram')}")

        # 2. Check Order Win candidates in DB
        top_orders = (
            db.query(AnnouncementRadar)
            .filter(
                (AnnouncementRadar.catalyst_type == "ORDER_WIN") | (AnnouncementRadar.order_significance_score.isnot(None)),
                AnnouncementRadar.order_significance_score >= 65.0,
            )
            .order_by(AnnouncementRadar.order_significance_score.desc())
            .limit(3)
            .all()
        )
        print(f"\n2. Top Order Win candidates in DB ({len(top_orders)} found):")
        for o in top_orders:
            print(f"   • {o.symbol} | Score: {o.order_significance_score} | Tier: {o.order_significance_tier} | ₹{o.deal_value_cr} Cr | {o.company_name}")

        # 3. Test format_order_win_alert
        if top_orders:
            sample = top_orders[0]
            memo = AlertDispatchService.format_order_win_alert(
                symbol=sample.symbol or "PURVA",
                company_name=sample.company_name,
                deal_value_cr=sample.deal_value_cr,
                significance_score=sample.order_significance_score or 90.0,
                significance_tier=sample.order_significance_tier or "TRANSFORMATIONAL",
                client_counterparty=sample.order_client_counterparty or "Goregaon West Mumbai Redevelopment",
                rev_pct_ttm=sample.synergy_rev_pct_ttm or 72.5,
                execution_months=sample.order_execution_months or 18,
                quarterly_rev_cr=sample.order_quarterly_rev_cr or 433.3,
                earnings_impact_cr=sample.order_earnings_impact_cr or 429.0,
                cmp=sample.current_price or 212.0,
                target_price=sample.target_price or 339.2,
                upside_pct=sample.upside_pct or 60.0,
                stop_loss=sample.stop_loss or 190.8,
                upside_prob_pct=sample.order_upside_prob_pct or 79.8,
                headline=sample.headline,
                thesis=sample.buy_thesis or sample.ai_insight,
                source_url=sample.source_url,
            )
            print(f"\n3. Formatted Institutional Memo Preview:\n{memo}\n")

        # 4. Run scan_order_win_radar_alerts with force_top_recent=True
        print("\n4. Running scan_order_win_radar_alerts(force_top_recent=True)...")
        alerts = OpportunityAlertService.scan_order_win_radar_alerts(db=db, rules=rules, force_top_recent=True)
        print(f"   Alerts dispatched: {len(alerts)}")
        for a in alerts:
            print(f"   -> {a}")

        # 5. Check in-app notification creation
        recent_notifs = (
            db.query(SystemNotification)
            .filter(SystemNotification.category == "ORDER_WIN_RADAR")
            .order_by(SystemNotification.created_at.desc())
            .limit(3)
            .all()
        )
        print(f"\n5. Recent In-App Notifications for ORDER_WIN_RADAR ({len(recent_notifs)}):")
        for n in recent_notifs:
            print(f"   • [{n.id}] {n.title} (Severity: {n.severity})")

        # 6. Check Telegram dispatch log
        recent_tg = (
            db.query(AlertDispatchLog)
            .filter(AlertDispatchLog.channel == "TELEGRAM")
            .order_by(AlertDispatchLog.dispatched_at.desc())
            .limit(3)
            .all()
        )
        print(f"\n6. Latest Telegram Dispatch Logs:")
        for log in recent_tg:
            print(f"   • [{log.dispatched_at}] Symbol: {log.symbol} | Status: {log.status} | Error: {log.error_message}")

        print("\n" + "=" * 60)
        print("ALL ORDER WIN ALERT TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    main()
