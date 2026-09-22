"""
Alpha India — Direct Chat ID Seeder
Seeds chat_id=8349099576 directly (confirmed by user from /start response).
"""

import sys
sys.path.insert(0, ".")

from app.db.database import SessionLocal
from app.models.notification import AlertChannelConfig
from app.services.alert_dispatch_service import AlertDispatchService

BOT_TOKEN = "8864485951:AAG7HHDh0KOQ-GXFo9N51CwVxvQ7_g4UPks"
CHAT_ID = "8349099576"


def main():
    db = SessionLocal()
    try:
        # Step 1: Verify token
        print("[1/3] Verifying bot token...")
        v = AlertDispatchService.verify_telegram_bot(BOT_TOKEN)
        if not v.get("valid"):
            print(f"  ERROR: {v.get('error')}")
            sys.exit(1)
        print(f"  OK @{v['bot_username']} verified (id={v['bot_id']})")

        # Step 2: Upsert DB with correct chat_id
        print(f"[2/3] Seeding DB with chat_id={CHAT_ID}...")
        cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
        if not cfg:
            cfg = AlertChannelConfig(channel="TELEGRAM")
            db.add(cfg)
            print("  Created new TELEGRAM row.")
        else:
            print(f"  Found existing row (was chat_id={cfg.chat_id}) -> updating.")

        cfg.bot_token = BOT_TOKEN
        cfg.chat_id = CHAT_ID
        cfg.is_enabled = True
        cfg.auto_rules = cfg.auto_rules or {
            "pead_min_conviction": 80,
            "catalyst_min_cr": 1000,
            "growth_min_pat_pct": 50,
            "vcp_enabled": True,
            "vcp_min_score": 90,
            "vcp_elite_only": False,
        }
        db.commit()
        db.refresh(cfg)
        print(f"  OK DB saved: chat_id={cfg.chat_id}, enabled={cfg.is_enabled}")

        # Step 3: Send live test ping
        print("[3/3] Sending live institutional test alert...")
        test_msg = (
            "*ALPHA INDIA - BOT ACTIVATED*\n"
            "-----------------------------------\n"
            "Bot: @Alphaindia2026bot\n"
            "Chat ID: 8349099576\n"
            "Status: LIVE & CONNECTED\n"
            "-----------------------------------\n"
            "Alert Engine: ARMED\n"
            "VCP Breakout Alerts: ON\n"
            "PEAD Flash Alerts: ON\n"
            "Growth Breakout Alerts: ON\n"
            "-----------------------------------\n"
            "Alpha India AI Growth Scanner v2.3.1"
        )

        result = AlertDispatchService.dispatch_telegram(
            bot_token=BOT_TOKEN,
            chat_id=CHAT_ID,
            text=test_msg,
        )

        AlertDispatchService.log_dispatch(
            db=db,
            channel="TELEGRAM",
            recipient=CHAT_ID,
            symbol="SYSTEM_ACTIVATE",
            payload_preview=test_msg,
            status="SUCCESS" if result.get("success") else "FAILED",
            error_message=result.get("error"),
        )
        db.commit()

        print()
        if result.get("success"):
            print("=" * 50)
            print("  SUCCESS! Check your Telegram now.")
            print(f"  Message ID: {result.get('message_id')}")
            print(f"  Chat ID:    {CHAT_ID}")
            print("  Alpha India is now LIVE on @Alphaindia2026bot")
            print("=" * 50)
        else:
            print("=" * 50)
            print(f"  FAILED: {result.get('error')}")
            print("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    main()
