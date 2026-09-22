"""
Alpha India — Dispatch Top High-Conviction Picks for Tomorrow to Telegram
Sprint 38.3
"""

import sys
import os
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.notification import AlertChannelConfig, AlertDispatchLog, SystemNotification
from app.services.alert_dispatch_service import AlertDispatchService
from app.services.intraday_opportunity_service import IntradayOpportunityService


def send_tomorrow_picks_telegram():
    db = SessionLocal()
    try:
        # 1. Resolve Telegram Configuration
        tg_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
        bot_token = (tg_cfg.bot_token if tg_cfg and tg_cfg.bot_token else None) or "8864485951:AAG7HHDh0KOQ-GXFo9N51CwVxvQ7_g4UPks"
        chat_id = (tg_cfg.chat_id if tg_cfg and tg_cfg.chat_id else None) or "8349099576"

        print(f"[*] Telegram Target: Chat ID={chat_id}")

        # 2. Get Deep Dive Opportunities
        print("[*] Retrieving High-Conviction Intraday/Tomorrow opportunities...")
        res = IntradayOpportunityService.get_deep_dive_opportunities(db=db, force_refresh=False)
        picks = res.get("elite_candidates", [])[:3]

        if not picks:
            print("[!] No elite candidates found, falling back to all_bullish_mtf...")
            picks = res.get("all_bullish_mtf", [])[:3]

        if not picks:
            print("[!] No picks available to dispatch.")
            return

        nifty = res.get("nifty_benchmark", {})
        nifty_cmp = nifty.get("cmp", "N/A")
        nifty_regime = nifty.get("regime", "NEUTRAL")

        # 3. Format Telegram Message
        now_ist = datetime.now(timezone.utc).strftime("%d %b %Y | %H:%M UTC")

        msg_lines = [
            "*ALPHA INDIA — TOMORROW 5%+ RADAR*",
            f"*Session Scan:* {now_ist}",
            f"*NIFTY 50:* {nifty_cmp} ({nifty_regime})",
            "---------------------------------------",
            "*TOP HIGH-CONVICTION PICKS*",
            ""
        ]

        for idx, p in enumerate(picks, 1):
            sym = p.get("symbol")
            company = p.get("company_name", sym)
            sector = p.get("sector", "Diversified")
            score = p.get("conviction_score", 85)
            tier = p.get("conviction_tier", "A HIGH CONVICTION")
            cmp_val = p.get("cmp", 0)
            trigger = p.get("entry_trigger", cmp_val)
            t1 = p.get("target_1") or p.get("target_price", 0)
            sl = p.get("stop_loss", 0)
            exp_move = p.get("expected_move_pct", 5.0)
            rr = p.get("risk_reward", 1.6)

            patterns = []
            if p.get("is_nr7"):
                patterns.append("NR7 COIL")
            if p.get("is_inside_day"):
                patterns.append("INSIDE DAY")
            rs = p.get("rs_score", 0)
            if rs is not None:
                patterns.append(f"RS: {'+' if rs >= 0 else ''}{rs}% vs Nifty")
            pattern_str = " • ".join(patterns) if patterns else "MTF Confluence"

            msg_lines.extend([
                f"*{idx}. {sym}* — {company}",
                f"• *Sector:* {sector}",
                f"• *Conviction:* `{score}/100` ({tier})",
                f"• *CMP:* ₹{cmp_val} | *Buy Trigger:* ₹{trigger}",
                f"• *Target 1:* ₹{t1} (+{exp_move}%) | *Stop Loss:* ₹{sl}",
                f"• *Risk:Reward:* `1:{rr}`",
                f"• *Setup:* {pattern_str}",
                ""
            ])

        msg_lines.extend([
            "---------------------------------------",
            "*Execution Protocol:*",
            "1. Check 9:15-9:30 AM gap: Enter only if opening gap is between +0.2% and +1.2%.",
            "2. Buy above trigger after 9:30 AM with strict SL.",
            "3. Book 60% profit at Target 1 and trail SL to cost.",
            "",
            "View live terminal: [Alpha India Radar](http://localhost:3000/intraday-radar)"
        ])

        telegram_text = "\n".join(msg_lines)

        # 4. Dispatch Telegram Message
        print("[*] Dispatching Telegram message...")
        dispatch_res = AlertDispatchService.dispatch_telegram(
            bot_token=bot_token,
            chat_id=chat_id,
            text=telegram_text,
            parse_mode="Markdown",
        )

        print(f"[*] Telegram Dispatch Result: {dispatch_res}")

        # 5. Log in DB
        success = dispatch_res.get("success", False)
        top_symbols = ", ".join([p["symbol"] for p in picks])
        
        log_entry = AlertDispatchLog(
            channel="TELEGRAM",
            recipient=chat_id,
            symbol=top_symbols,
            payload_preview=telegram_text[:250],
            status="SUCCESS" if success else "FAILED",
            error_message=dispatch_res.get("error") if not success else None,
            dispatched_at=datetime.utcnow()
        )
        db.add(log_entry)

        # Also create In-App SystemNotification
        notif = SystemNotification(
            title=f"Tomorrow High-Conviction Radar: {top_symbols}",
            message=f"Dispatched Top {len(picks)} setups coiling for tomorrow breakout ({top_symbols}) to Telegram.",
            category="SYSTEM_ALERT",
            severity="info",
            action_url="/intraday-radar",
            metadata_json={"symbols": [p["symbol"] for p in picks]},
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notif)
        db.commit()

        print("[+] Logged alert and system notification in database.")
        print(f"[+] All done. Success = {success}")

    except Exception as e:
        print(f"[-] Error dispatching alert: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    send_tomorrow_picks_telegram()
