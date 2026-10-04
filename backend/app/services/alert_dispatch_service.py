"""
Alpha India Alert Dispatch & Notification Service
Sprint 34 — Institutional Alerts & Multi-Channel Broadcasting
"""

import os
import logging
import threading
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import requests
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.notification import SystemNotification, AlertChannelConfig, AlertDispatchLog

logger = logging.getLogger("alpha_india.alerts")


class AlertDispatchService:
    """
    Central service for internal notifications and external alert dispatching
    (Telegram Bot API & WhatsApp).
    """

    _recent_dispatches: Dict[str, float] = {}
    _dispatch_lock = threading.Lock()

    @staticmethod
    def get_dedup_cutoff(hours: int = 18) -> datetime:
        """
        Returns the cutoff datetime (UTC) for deduplicating opportunity alerts.
        Compares:
        1) Rolling window (e.g. 18 hours ago)
        2) Midnight of current UTC calendar day
        3) Midnight of current IST (Indian Standard Time) trading session converted to UTC
        Takes the earliest timestamp among them so that night scans across UTC/IST
        midnight boundaries never falsely re-alert the same symbols.
        """
        now_utc = datetime.utcnow()
        rolling_cutoff = now_utc - timedelta(hours=hours)
        today_utc_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # IST is UTC + 5:30. Midnight IST in UTC is 18:30 UTC of previous UTC day
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now_utc + ist_offset
        today_ist_midnight = (now_ist.replace(hour=0, minute=0, second=0, microsecond=0)) - ist_offset
        
        return min(rolling_cutoff, today_utc_start, today_ist_midnight)

    # ==========================================================
    # 1. Telegram Dispatch & Verification
    # ==========================================================
    @staticmethod
    def verify_telegram_bot(bot_token: str) -> Dict[str, Any]:
        """
        Tests Telegram bot token validity via getMe endpoint.
        """
        if not bot_token or not bot_token.strip():
            return {"valid": False, "error": "Bot token is required."}

        url = f"https://api.telegram.org/bot{bot_token.strip()}/getMe"
        try:
            resp = requests.get(url, timeout=10)
            data = resp.json()
            if data.get("ok"):
                result = data.get("result", {})
                return {
                    "valid": True,
                    "bot_name": result.get("first_name"),
                    "bot_username": result.get("username"),
                    "bot_id": result.get("id"),
                }
            else:
                return {
                    "valid": False,
                    "error": data.get("description", "Telegram API returned an error"),
                }
        except Exception as e:
            logger.error(f"Telegram verify failed: {e}")
            return {"valid": False, "error": str(e)}

    @staticmethod
    def detect_telegram_chats(bot_token: str) -> Dict[str, Any]:
        """
        Polls getUpdates to discover chats, channels, or user conversations
        that recently interacted with the bot.
        """
        if not bot_token or not bot_token.strip():
            return {"ok": False, "error": "Bot token is required."}

        clean_token = bot_token.strip()
        url = f"https://api.telegram.org/bot{clean_token}/getUpdates"
        try:
            resp = requests.get(url, timeout=12)
            data = resp.json()
            if not data.get("ok"):
                return {"ok": False, "error": data.get("description", "Failed to retrieve updates from Telegram.")}

            updates = data.get("result", [])
            discovered_chats = {}

            for u in updates:
                chat = None
                if "message" in u and "chat" in u["message"]:
                    chat = u["message"]["chat"]
                elif "channel_post" in u and "chat" in u["channel_post"]:
                    chat = u["channel_post"]["chat"]
                elif "my_chat_member" in u and "chat" in u["my_chat_member"]:
                    chat = u["my_chat_member"]["chat"]

                if chat and "id" in chat:
                    cid = str(chat["id"])
                    discovered_chats[cid] = {
                        "id": cid,
                        "type": chat.get("type", "unknown"),
                        "title": chat.get("title") or chat.get("username") or f"{chat.get('first_name', '')} {chat.get('last_name', '')}".strip() or "Unnamed Chat",
                        "username": chat.get("username"),
                    }

            return {
                "ok": True,
                "count": len(discovered_chats),
                "chats": list(discovered_chats.values()),
            }
        except Exception as e:
            logger.error(f"Error checking telegram updates: {e}")
            return {"ok": False, "error": str(e)}

    @staticmethod
    def dispatch_telegram(
        bot_token: str,
        chat_id: str,
        text: str,
        parse_mode: str = "Markdown",
    ) -> Dict[str, Any]:
        """
        Dispatches institutional alert message to a Telegram chat, group, or channel.
        """
        if not bot_token or not chat_id:
            return {"success": False, "error": "Missing bot token or chat ID."}

        url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
        payload = {
            "chat_id": chat_id.strip(),
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        try:
            resp = requests.post(url, json=payload, timeout=12)
            data = resp.json()
            if data.get("ok"):
                return {
                    "success": True,
                    "message_id": data.get("result", {}).get("message_id"),
                    "chat_title": data.get("result", {}).get("chat", {}).get("title"),
                }

            # If Markdown parsing failed due to unescaped characters, retry as plain text fallback
            desc = data.get("description", "")
            if "can't parse entities" in desc.lower() or "entity" in desc.lower():
                payload_fallback = dict(payload)
                payload_fallback.pop("parse_mode", None)
                resp_fb = requests.post(url, json=payload_fallback, timeout=12)
                data_fb = resp_fb.json()
                if data_fb.get("ok"):
                    return {
                        "success": True,
                        "message_id": data_fb.get("result", {}).get("message_id"),
                        "chat_title": data_fb.get("result", {}).get("chat", {}).get("title"),
                    }
                return {"success": False, "error": data_fb.get("description", desc)}

            return {
                "success": False,
                "error": desc or "Telegram dispatch failed",
            }
        except Exception as e:
            logger.error(f"Failed to dispatch to Telegram: {e}")
            return {"success": False, "error": str(e)}

    # ==========================================================
    # 2. WhatsApp Dispatch & Click-to-Chat Generation
    # ==========================================================
    @staticmethod
    def generate_whatsapp_click_to_chat_url(text: str, phone: Optional[str] = None) -> str:
        """
        Generates an instant 1-click WhatsApp share URL for traders.
        If phone is provided, generates direct wa.me/phone?text=...
        Otherwise generates wa.me/?text=... for opening WhatsApp contact picker.
        """
        encoded_text = urllib.parse.quote(text)
        if phone and phone.strip():
            clean_phone = "".join(filter(str.isdigit, phone.strip()))
            return f"https://wa.me/{clean_phone}?text={encoded_text}"
        return f"https://wa.me/?text={encoded_text}"

    @staticmethod
    def dispatch_whatsapp_cloud(
        api_key: str,
        phone_number_id: str,
        recipient: str,
        text: str,
    ) -> Dict[str, Any]:
        """
        Dispatches message via WhatsApp Cloud API.
        """
        if not api_key or not phone_number_id or not recipient:
            return {
                "success": False,
                "error": "WhatsApp API Key, Phone Number ID, and recipient are required.",
            }

        url = f"https://graph.facebook.com/v18.0/{phone_number_id.strip()}/messages"
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": recipient.strip(),
            "type": "text",
            "text": {"body": text},
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=12)
            data = resp.json()
            if resp.status_code in [200, 201]:
                return {"success": True, "data": data}
            else:
                return {
                    "success": False,
                    "error": data.get("error", {}).get("message", "WhatsApp API error"),
                }
        except Exception as e:
            logger.error(f"WhatsApp Cloud dispatch failed: {e}")
            return {"success": False, "error": str(e)}

    # ==========================================================
    # 2.5 Common Helpers, Credentials & Deduplication Checks
    # ==========================================================
    @classmethod
    def get_telegram_config(cls, db: Session) -> Optional[Dict[str, Any]]:
        """
        Retrieves active Telegram credentials and rules with fallback to environment variables.
        Auto-populates DB if env vars are provided but DB is empty or missing credentials.
        """
        tg_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
        from app.core.config import settings
        env_token = getattr(settings, "TELEGRAM_BOT_TOKEN", None) or os.getenv("TELEGRAM_BOT_TOKEN")
        env_chat = getattr(settings, "TELEGRAM_DEFAULT_CHAT_ID", None) or os.getenv("TELEGRAM_DEFAULT_CHAT_ID")

        bot_token = (tg_cfg.bot_token if tg_cfg and tg_cfg.bot_token else None) or env_token
        chat_id = (tg_cfg.chat_id if tg_cfg and tg_cfg.chat_id else None) or env_chat
        is_enabled = tg_cfg.is_enabled if tg_cfg else True
        auto_rules = tg_cfg.auto_rules if tg_cfg and tg_cfg.auto_rules else {}

        # If DB had null but environment variables exist, heal the DB record
        if tg_cfg and (not tg_cfg.bot_token or not tg_cfg.chat_id) and (env_token or env_chat):
            try:
                if not tg_cfg.bot_token and env_token:
                    tg_cfg.bot_token = env_token
                if not tg_cfg.chat_id and env_chat:
                    tg_cfg.chat_id = env_chat
                db.commit()
            except Exception as e:
                db.rollback()
                logger.warning(f"Failed to auto-heal Telegram DB config from env: {e}")
        elif not tg_cfg and (env_token and env_chat):
            try:
                new_cfg = AlertChannelConfig(
                    channel="TELEGRAM",
                    bot_token=env_token,
                    chat_id=env_chat,
                    is_enabled=True,
                    auto_rules={},
                )
                db.add(new_cfg)
                db.commit()
            except Exception as e:
                db.rollback()
                logger.warning(f"Failed to auto-create Telegram DB config from env: {e}")

        if not bot_token or not chat_id:
            return None

        return {
            "bot_token": bot_token,
            "chat_id": chat_id,
            "is_enabled": is_enabled,
            "auto_rules": auto_rules,
        }

    @staticmethod
    def get_stock_urls(symbol: str) -> Dict[str, str]:
        clean = (symbol or "").strip().upper()
        for suffix in [".NS", ".BO"]:
            if clean.endswith(suffix):
                clean = clean[:-len(suffix)]
        base_url = os.getenv("FRONTEND_BASE_URL", "https://ipodesk.shop").rstrip("/")
        stock_url = f"{base_url}/stocks/{clean}" if clean else base_url
        screener_url = f"https://www.screener.in/company/{clean}/consolidated/" if clean else "https://www.screener.in"
        return {
            "clean_symbol": clean,
            "stock_360_url": stock_url,
            "screener_url": screener_url,
            "stock_360_md": f"[Alpha India Stock 360]({stock_url})",
            "screener_md": f"[Screener.in Financials]({screener_url})",
        }

    @classmethod
    def get_stock_links(cls, symbol: str) -> str:
        urls = cls.get_stock_urls(symbol)
        if not urls["clean_symbol"]:
            return ""
        return (
            f"🔗 *Research & Terminal Links:*\n"
            f"• 📱 {urls['stock_360_md']}\n"
            f"• 🌐 {urls['screener_md']}"
        )

    @classmethod
    def is_duplicate_dispatch(
        cls,
        db: Session,
        channel: str,
        symbol: str,
        recipient: Optional[str] = None,
        cooldown_hours: float = 4.0,
        trigger_tag: Optional[str] = None,
    ) -> bool:
        """
        Verifies if an alert for this symbol and channel was already dispatched
        successfully within the cooldown period (default: 4 hours).
        """
        cutoff = datetime.utcnow() - timedelta(hours=cooldown_hours)
        query = db.query(AlertDispatchLog).filter(
            AlertDispatchLog.channel == channel,
            AlertDispatchLog.symbol == symbol,
            AlertDispatchLog.status == "SUCCESS",
            AlertDispatchLog.dispatched_at >= cutoff,
        )
        if recipient:
            query = query.filter(AlertDispatchLog.recipient == recipient)
        if trigger_tag:
            query = query.filter(AlertDispatchLog.payload_preview.ilike(f"%{trigger_tag}%"))
        return query.first() is not None

    # ==========================================================
    # 3. Institutional Memo Formatters
    # ==========================================================
    @classmethod
    def format_pead_flash_alert(
        cls,
        symbol: str,
        company_name: str,
        signal: str,
        conviction_score: int,
        conviction_grade: str,
        revenue: float,
        pat: float,
        growth_pat: float,
        upside_pct: float,
        thesis: str,
        cmp: Optional[float] = None,
        buy_trigger: Optional[float] = None,
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
    ) -> str:
        cmp_val = cmp or 0.0
        trigger_val = buy_trigger or cmp_val
        t_val = target_price or (round(cmp_val * (1 + (upside_pct / 100)), 2) if (cmp_val and upside_pct) else (round(cmp_val * 1.15, 2) if cmp_val else 0.0))
        sl_val = stop_loss or (round(cmp_val * 0.93, 2) if cmp_val else 0.0)
        rr = round(abs(t_val - cmp_val) / max(0.01, abs(cmp_val - sl_val)), 1) if cmp_val > 0 else 2.1

        price_block = ""
        if cmp_val > 0:
            price_block = (
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 *Live CMP:* ₹{cmp_val:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{trigger_val:,.2f}\n"
                f"🚀 *Target Price:* ₹{t_val:,.2f} (+{upside_pct:+.1f}%)\n"
                f"🛑 *Stop Loss:* ₹{sl_val:,.2f} (-7.0%)\n"
                f"⚖️ *Risk:Reward:* 1:{rr:.1f}\n"
            )

        return (
            f"⚡ *ALPHA INDIA | ATHENA PEAD FLASH*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {conviction_score}/100 (Grade: {conviction_grade})\n"
            f"🎯 *Signal:* {signal.upper()}\n"
            f"📈 *QoQ/YoY Growth:*\n"
            f"   • PAT: ₹{pat:,.1f} Cr ({growth_pat:+.1f}% YoY)\n"
            f"   • Revenue: ₹{revenue:,.1f} Cr\n"
            f"{price_block}"
            f"💡 *Institutional Thesis:*\n{thesis}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @classmethod
    def format_catalyst_alert(
        cls,
        symbol: str,
        company_name: str,
        catalyst_type: str,
        headline: str,
        order_value_cr: Optional[float] = None,
        source_url: Optional[str] = None,
        cmp: Optional[float] = None,
        buy_trigger: Optional[float] = None,
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        score: Optional[float] = 85.0,
    ) -> str:
        cat_label = catalyst_type.replace("_", " ").upper()
        clean_headline = headline.replace("*", "").replace("`", "")
        value_str = f"\n💰 *Contract Value:* ₹{order_value_cr:,.1f} Cr" if order_value_cr else ""
        link_str = f"\n🔗 [Exchange Filing]({source_url})" if source_url else ""

        score_val = score or 85.0
        cmp_val = cmp or 0.0
        trigger_val = buy_trigger or cmp_val
        t_val = target_price or (round(cmp_val * 1.15, 2) if cmp_val else 0.0)
        sl_val = stop_loss or (round(cmp_val * 0.93, 2) if cmp_val else 0.0)
        rr = round(abs(t_val - cmp_val) / max(0.01, abs(cmp_val - sl_val)), 1) if cmp_val > 0 else 2.1

        price_block = ""
        if cmp_val > 0:
            price_block = (
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 *Live CMP:* ₹{cmp_val:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{trigger_val:,.2f}\n"
                f"🚀 *Target Price:* ₹{t_val:,.2f} (+15.0%)\n"
                f"🛑 *Stop Loss:* ₹{sl_val:,.2f} (-7.0%)\n"
                f"⚖️ *Risk:Reward:* 1:{rr:.1f}\n"
            )

        return (
            f"📡 *ALPHA INDIA | CATALYST RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {score_val:.0f}/100 (HIGH IMPACT)\n"
            f"⚡ *Catalyst:* {cat_label}{value_str}\n"
            f"📋 *Summary:* {clean_headline}{link_str}\n"
            f"{price_block}"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @classmethod
    def format_growth_breakout_alert(
        cls,
        symbol: str,
        company_name: str,
        pat_growth_yoy: float,
        rev_growth_yoy: float,
        opm: float,
        pe: Optional[float] = None,
        cmp: Optional[float] = None,
        buy_trigger: Optional[float] = None,
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        score: Optional[float] = 88.0,
    ) -> str:
        pe_str = f" | *P/E:* {pe:.1f}x" if pe else ""
        score_val = score or 88.0
        cmp_val = cmp or 0.0
        trigger_val = buy_trigger or cmp_val
        t_val = target_price or (round(cmp_val * 1.18, 2) if cmp_val else 0.0)
        sl_val = stop_loss or (round(cmp_val * 0.93, 2) if cmp_val else 0.0)
        rr = round(abs(t_val - cmp_val) / max(0.01, abs(cmp_val - sl_val)), 1) if cmp_val > 0 else 2.5

        price_block = ""
        if cmp_val > 0:
            price_block = (
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 *Live CMP:* ₹{cmp_val:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{trigger_val:,.2f}\n"
                f"🚀 *Target Price:* ₹{t_val:,.2f} (+18.0%)\n"
                f"🛑 *Stop Loss:* ₹{sl_val:,.2f} (-7.0%)\n"
                f"⚖️ *Risk:Reward:* 1:{rr:.1f}\n"
            )

        return (
            f"🚀 *ALPHA INDIA | GROWTH BREAKOUT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {score_val:.0f}/100 (GROWTH LEADER)\n"
            f"📈 *YoY PAT Growth:* +{pat_growth_yoy:.1f}%\n"
            f"📊 *YoY Revenue Growth:* +{rev_growth_yoy:.1f}%\n"
            f"🛡️ *Operating Margin:* {opm:.1f}%{pe_str}\n"
            f"{price_block}"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @classmethod
    def format_vcp_breakout_alert(
        cls,
        symbol: str,
        company_name: str,
        vcp_stage: str,
        pivot_price: float,
        cmp: float,
        entry_zone: str,
        stop_loss: float,
        target_1: float,
        target_2: float,
        target_3: Optional[float] = None,
        reward_risk: float = 3.0,
        total_score: float = 92.0,
        breakout_volume_ratio: float = 2.5,
        dryup_pct: int = 60,
        thesis: Optional[str] = None,
        why_selected: Optional[List[str]] = None,
        action_url: str = "http://localhost:3000/vcp-discovery",
    ) -> str:
        verdict = "ELITE SETUP (≥95)" if total_score >= 95.0 else "HIGH CONVICTION"
        t3_str = f" | *T3:* ₹{target_3:,.1f}" if target_3 else ""
        bullets = ""
        if why_selected and len(why_selected) > 0:
            bullets = "\n" + "\n".join([f"   • {b}" for b in why_selected[:3]])
        elif thesis:
            bullets = f"\n   • {thesis}"

        t1_pct = round(((target_1 - cmp) / max(0.01, cmp)) * 100, 1) if (target_1 and cmp) else 10.0
        sl_pct = round(((cmp - stop_loss) / max(0.01, cmp)) * 100, 1) if (stop_loss and cmp) else 5.0

        return (
            f"🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {total_score:.1f}/100 — {verdict}\n"
            f"📐 *Pattern Archetype:* {vcp_stage} (Supply Dry-Up: {dryup_pct}%)\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{pivot_price:,.2f} (Pivot Point)\n"
            f"🚪 *Entry Zone:* {entry_zone}\n"
            f"🚀 *Targets:* *T1:* ₹{target_1:,.2f} (+{t1_pct}%) | *T2:* ₹{target_2:,.2f}{t3_str}\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f} (-{sl_pct}%)\n"
            f"⚖️ *Risk/Reward:* {reward_risk:.1f}x | *Breakout Vol:* {breakout_volume_ratio:.1f}x 20DMA\n"
            f"💡 *Institutional Edge:*{bullets}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_prebreakout_alert(
        cls,
        symbol: str,
        company_name: str,
        conviction_score: int,
        setup_tier: str,
        cmp: float,
        cheat_entry: float,
        stop_loss: float,
        target_1: float,
        target_2: float,
        risk_reward: float,
        primary_pattern: str,
        vdu_ratio: float,
        action_url: str = "http://localhost:3000/pre-breakout-radar",
    ) -> str:
        t1_pct = round(((target_1 - cmp) / max(0.01, cmp)) * 100, 1) if (target_1 and cmp) else 9.0
        sl_pct = round(((cmp - stop_loss) / max(0.01, cmp)) * 100, 1) if (stop_loss and cmp) else 4.5

        return (
            f"⚡ *ALPHA INDIA | PRE-BREAKOUT RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {conviction_score}/100 ({setup_tier})\n"
            f"📐 *Base Pattern:* {primary_pattern} (VDU: {vdu_ratio:.2f}x)\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{cheat_entry:,.2f} (Cheat Entry)\n"
            f"🚀 *Target 1:* ₹{target_1:,.2f} (+{t1_pct}%) | *Target 2:* ₹{target_2:,.2f}\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f} (-{sl_pct}%)\n"
            f"⚖️ *Risk/Reward:* {risk_reward:.1f}x\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_breakout_triggered_alert(
        cls,
        symbol: str,
        company_name: str,
        sector: str,
        conviction_score: int,
        setup_tier: str,
        pattern_tag: str,
        cmp: float,
        trigger_price: float,
        buy_zone_max: float,
        stop_loss: float,
        target_1: float,
        target_2: float,
        risk_reward: float,
        volume_pace_ratio: float,
        action_url: str = "http://localhost:3000/pre-breakout-radar",
    ) -> str:
        risk_pct = round(((trigger_price - stop_loss) / max(0.01, trigger_price)) * 100.0, 2)
        t1_pct = round(((target_1 - trigger_price) / max(0.01, trigger_price)) * 100.0, 1)

        return (
            f"🚨 *ALPHA INDIA | BREAKOUT EXECUTION TRIGGERED!*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`) • {sector}\n"
            f"⚡ *STATUS:* `BUY ZONE ACTIVE — TAKE ENTRY NOW`\n"
            f"⭐ *Institutional Score:* {conviction_score} PTS ({setup_tier})\n"
            f"📐 *Base Pattern:* {pattern_tag}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{trigger_price:,.2f} (Buy Zone: ₹{trigger_price:,.2f} – ₹{buy_zone_max:,.2f})\n"
            f"🚀 *Target 1:* ₹{target_1:,.2f} (+{t1_pct}%)\n"
            f"🚀 *Target 2:* ₹{target_2:,.2f} (+18.0%)\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f} (Risk: -{risk_pct}%)\n"
            f"⚖️ *Risk/Reward:* {risk_reward:.1f}:1\n"
            f"📊 *Volume Pace:* {volume_pace_ratio:.2f}x 20-DMA\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *Execution Rule:* Never chase past ₹{buy_zone_max:,.2f}. Book 50% at Target 1 and trail stop on 10 EMA.\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Open Live Cockpit:* {action_url}"
        )

    @classmethod
    def format_momentum_radar_alert(
        cls,
        symbol: str,
        company_name: str,
        match_count: int,
        conviction_score: int,
        cmp: float,
        entry_trigger: float,
        stop_loss: float,
        target_1: float,
        target_2: float,
        risk_reward: float,
        daily_rsi: float,
        weekly_rsi: float,
        vol_surge: float,
        action_url: str = "http://localhost:3000/momentum-radar",
        market_cap_cr: Optional[float] = None,
        turnover_lakhs: Optional[float] = None,
        scan_source: Optional[str] = None,
    ) -> str:
        header = "🚀 *ALPHA INDIA | MOMENTUM RADAR*"
        if scan_source == "FULL_UNIVERSE":
            header = "🌐 *ALPHA INDIA | MOMENTUM RADAR (FULL UNIVERSE)*"
        elif scan_source == "LIVE_BREAKOUT":
            header = "🔥 *ALPHA INDIA | LIVE MOMENTUM BREAKOUT*"

        extra_depth = ""
        if market_cap_cr is not None or turnover_lakhs is not None:
            mcap_str = f"₹{int(market_cap_cr):,} Cr" if market_cap_cr else "N/A"
            to_str = f"₹{int(turnover_lakhs):,}L" if turnover_lakhs else "N/A"
            extra_depth = f"🏦 *Depth:* Mcap {mcap_str} | 20D Turnover {to_str}\n"

        return (
            f"{header}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {conviction_score} PTS ({match_count}/10 Confluence)\n"
            f"{extra_depth}"
            f"📊 *Triple RSI:* Daily {daily_rsi:.1f} | Weekly {weekly_rsi:.1f}\n"
            f"📈 *Volume Surge:* {vol_surge:.2f}x 20DMA\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{entry_trigger:,.2f}\n"
            f"🚀 *Target 1:* ₹{target_1:,.2f} (+8.0%)\n"
            f"🚀 *Target 2:* ₹{target_2:,.2f} (+16.0%)\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f}\n"
            f"⚖️ *Risk/Reward:* {risk_reward:.1f}x\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_order_win_alert(
        cls,
        symbol: str,
        company_name: str,
        deal_value_cr: Optional[float],
        significance_score: float,
        significance_tier: str,
        client_counterparty: Optional[str] = None,
        rev_pct_ttm: Optional[float] = None,
        execution_months: Optional[int] = None,
        quarterly_rev_cr: Optional[float] = None,
        earnings_impact_cr: Optional[float] = None,
        cmp: Optional[float] = None,
        buy_trigger: Optional[float] = None,
        target_price: Optional[float] = None,
        upside_pct: Optional[float] = None,
        stop_loss: Optional[float] = None,
        upside_prob_pct: Optional[float] = None,
        headline: Optional[str] = None,
        thesis: Optional[str] = None,
        source_url: Optional[str] = None,
        action_url: str = "http://localhost:3000/announcements?catalyst_type=ORDER_WIN",
    ) -> str:
        tier_clean = (significance_tier or "HIGH_IMPACT").replace("_", " ").upper()
        deal_str = f"₹{deal_value_cr:,.1f} Cr" if deal_value_cr else "Undisclosed Size"
        if rev_pct_ttm:
            deal_str += f" (+{rev_pct_ttm:.1f}% TTM Sales)"

        client_line = f"\n🏛️ *Client/Agency:* {client_counterparty}" if client_counterparty else ""

        runway_parts = []
        if execution_months:
            runway_parts.append(f"{execution_months} Months")
        if quarterly_rev_cr:
            runway_parts.append(f"~₹{quarterly_rev_cr:,.1f} Cr/Quarter")
        runway_str = f"\n⏱️ *Runway:* {' • '.join(runway_parts)}" if runway_parts else ""

        pat_line = f"\n📈 *Annualized PAT Impact:* +₹{earnings_impact_cr:,.1f} Cr" if earnings_impact_cr else ""

        cmp_val = cmp or 0.0
        trigger_val = buy_trigger or cmp_val
        t_val = target_price or (round(cmp_val * 1.15, 2) if cmp_val else 0.0)
        sl_val = stop_loss or (round(cmp_val * 0.93, 2) if cmp_val else 0.0)

        price_block = ""
        if cmp_val > 0:
            up_str = f" (+{upside_pct:.1f}%)" if upside_pct else f" (+{round(((t_val - cmp_val)/cmp_val)*100, 1)}%)"
            price_block = (
                f"\n━━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 *Live CMP:* ₹{cmp_val:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{trigger_val:,.2f}\n"
                f"🚀 *Target Price:* ₹{t_val:,.2f}{up_str}\n"
                f"🛑 *Stop Loss:* ₹{sl_val:,.2f}"
            )

        prob_line = f"\n🎲 *Win Probability:* {upside_prob_pct:.1f}%" if upside_prob_pct else ""

        thesis_line = ""
        if thesis:
            clean_th = thesis.replace("*", "").replace("`", "").strip()
            thesis_line = f"\n💡 *Quant Thesis:*\n{clean_th}"
        elif headline:
            clean_hl = headline.replace("*", "").replace("`", "").strip()
            thesis_line = f"\n📋 *Filing:* {clean_hl[:120]}"

        link_line = f"\n🔗 [Exchange Filing]({source_url})" if source_url else ""

        return (
            f"🏆 *ALPHA INDIA | ORDER WIN RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {significance_score:.1f}/100 — {tier_clean}\n"
            f"💰 *Order Value:* {deal_str}"
            f"{client_line}"
            f"{runway_str}"
            f"{pat_line}"
            f"{price_block}"
            f"{prob_line}"
            f"{thesis_line}"
            f"{link_line}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_techno_funda_alert(
        cls,
        symbol: str,
        company_name: str,
        setup_score: float,
        cmp: float,
        pivot_price: float,
        distance_to_pivot_pct: float,
        sector: str = "Diversified",
        health_score: float = 70.0,
        signal: str = "PRE_BREAKOUT",
        pattern: str = "VCP Base",
        action_url: str = "http://localhost:3000/techno-funda",
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
    ) -> str:
        t_val = target_price or round(pivot_price * 1.15, 2)
        sl_val = stop_loss or round(cmp * 0.93, 2)
        rr = round(abs(t_val - cmp) / max(0.01, abs(cmp - sl_val)), 1) if cmp > 0 else 2.1

        return (
            f"🎯 *ALPHA INDIA | TECHNO-FUNDA RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`) • {sector}\n"
            f"⭐ *Institutional Score:* {setup_score:.1f}/100 | *Health:* {health_score:.1f}/100\n"
            f"⚡ *Signal:* `{signal}` | *Pattern:* {pattern}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{pivot_price:,.2f} (Distance: {distance_to_pivot_pct:+.2f}%)\n"
            f"🚀 *Target Price:* ₹{t_val:,.2f} (+15.0%)\n"
            f"🛑 *Stop Loss:* ₹{sl_val:,.2f} (-7.0%)\n"
            f"⚖️ *Risk:Reward:* 1:{rr:.1f}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_ipo_radar_alert(
        cls,
        symbol: str,
        company_name: str,
        setup_type: str,
        setup_label: str,
        setup_status: str,
        conviction_score: float,
        cmp: float,
        pivot_price: float,
        stop_loss: float,
        target_1: float,
        target_2: float,
        risk_pct: float,
        day1_high: float,
        days_since_listing: int,
        rvol: float = 1.0,
        anchor_days_left: Optional[int] = None,
        rationale: Optional[str] = None,
        action_url: str = "http://localhost:3000/ipo-radar",
    ) -> str:
        anchor_line = ""
        if anchor_days_left is not None and -5 <= anchor_days_left <= 10:
            if anchor_days_left > 0:
                anchor_line = f"\n🔒 *SEBI 30D Anchor Cliff:* In {anchor_days_left} Days (50% Float Unlock)"
            elif anchor_days_left == 0:
                anchor_line = "\n🔒 *SEBI 30D Anchor Cliff:* UNLOCKS TODAY (Morning Block Deals Active)"
            else:
                anchor_line = f"\n✅ *SEBI 30D Anchor Cliff:* Cleared {abs(anchor_days_left)}d Ago (Float Absorbed)"

        clean_rat = f"\n💡 *Edge:* {rationale}" if rationale else ""

        return (
            f"🚀 *ALPHA INDIA | MAINBOARD IPO RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Institutional Score:* {conviction_score:.1f}/100 ({setup_status})\n"
            f"⚡ *Setup:* {setup_label} | *Age:* {days_since_listing}d post-listing\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{pivot_price:,.2f} (Model Pivot)\n"
            f"📐 *Day 1 High:* ₹{day1_high:,.2f} | *RelVol:* {rvol:.2f}x\n"
            f"🚀 *Target 1:* ₹{target_1:,.2f} (+15.0%) | *Target 2:* ₹{target_2:,.2f}\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f} (-{risk_pct:.1f}% risk)"
            f"{anchor_line}"
            f"{clean_rat}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *Rule:* Book 50% at Target 1 and trail remainder on 10 EMA with Breakeven Stop.\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Open Radar:* {action_url}"
        )

    @classmethod
    def format_delivery_breakout_alert(
        cls,
        symbol: str,
        company_name: str,
        delivery_per: float,
        delivery_spike_x: float,
        cmp: float,
        setup_type: str = "50D_BREAKOUT",
        conviction_score: float = 85.0,
        sector: str = "Diversified",
        tier: str = "ACTIVE_SWING",
        deliv_flow_20d: float = 1.5,
        target_1: Optional[float] = None,
        target_2: Optional[float] = None,
        breakeven_trigger: Optional[float] = None,
        stop_loss: Optional[float] = None,
        risk_pct: float = 3.5,
        risk_reward: str = "1:3.1",
        win_rate_expectation: str = "60% - 63%",
        trail_rule: Optional[str] = None,
        action_url: str = "http://localhost:3000/delivery-radar",
        target_price: Optional[float] = None,
    ) -> str:
        t1_val = target_1 or target_price or (cmp * 1.055)
        t2_val = target_2 or (cmp * 1.11)
        sl_val = stop_loss or (cmp * 0.965)
        be_val = breakeven_trigger or (cmp * 1.02)
        tier_tag = "🎯 APEX SNIPER (70%+ WR)" if tier == "APEX_SNIPER" else ("⚡ ACTIVE SWING (62% WR)" if tier == "ACTIVE_SWING" else "📡 BASE WATCHLIST")
        rule_str = f"\n⚠️ *Protocol:* {trail_rule}" if trail_rule else ""

        return (
            f"⚡ *ALPHA INDIA | DELIVERY BREAKOUT RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`) • {sector}\n"
            f"⭐ *Institutional Score:* {conviction_score:.0f} PTS (`{tier_tag}`)\n"
            f"🏆 *Model Win Rate:* {win_rate_expectation} | *R:R:* {risk_reward}\n"
            f"📦 *Delivery Absorption:* {delivery_per:.1f}% Float | *Surge:* {delivery_spike_x:.2f}x 10-DMA\n"
            f"🌊 *20D Net Flow (D-A/D):* {deliv_flow_20d:.2f}x Net Accumulation\n"
            f"📐 *Setup Structure:* {setup_type.replace('_', ' ')}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"🎯 *Buy Trigger Price:* ₹{cmp:,.2f} (Suggested Entry)\n"
            f"🚀 *Target 1:* ₹{t1_val:,.2f} (+5.0%) [Book 50% Profit]\n"
            f"🚀 *Target 2:* ₹{t2_val:,.2f} (+10.0%) [Apex Runner]\n"
            f"🛑 *Initial Stop Loss:* ₹{sl_val:,.2f} (-{risk_pct:.1f}%)\n"
            f"🔒 *Breakeven Lock Trigger:* ₹{be_val:,.2f} (+2.0%){rule_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @classmethod
    def format_institutional_mf_alert(
        cls,
        symbol: str,
        company_name: str,
        smart_money_score: float,
        schemes_count: int,
        net_shares_change_pct: float,
        sector: str = "Diversified",
        latest_month: str = "Latest Month",
        action_url: str = "http://localhost:3000/institutional-radar/fresh-entries",
        cmp: Optional[float] = None,
        buy_trigger: Optional[float] = None,
        target_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
    ) -> str:
        cmp_val = cmp or 0.0
        trigger_val = buy_trigger or cmp_val
        t_val = target_price or (round(cmp_val * 1.15, 2) if cmp_val else 0.0)
        sl_val = stop_loss or (round(cmp_val * 0.93, 2) if cmp_val else 0.0)

        price_block = ""
        if cmp_val > 0:
            price_block = (
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 *Live CMP:* ₹{cmp_val:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{trigger_val:,.2f}\n"
                f"🚀 *Target Price:* ₹{t_val:,.2f} (+15.0%)\n"
                f"🛑 *Stop Loss:* ₹{sl_val:,.2f} (-7.0%)\n"
            )

        return (
            f"🏛️ *ALPHA INDIA | INSTITUTIONAL MF RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`) • {sector}\n"
            f"⭐ *Institutional Score:* {smart_money_score:.1f}/100 (SMART MONEY ACCUMULATION)\n"
            f"💼 *Fresh AMC Position Initiations:* {schemes_count} Schemes\n"
            f"📊 *Net Holding Change:* {net_shares_change_pct:+.1f}%\n"
            f"⏱️ *Filing Cycle:* {latest_month}\n"
            f"{price_block}"
            f"💡 *Institutional Edge:*\n"
            f"Multiple top mutual fund asset managers aggressively accumulating equity float.\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Live Radar:* {action_url}"
        )

    # ==========================================================
    # 4. In-App Notification & Audit Logging
    # ==========================================================
    @staticmethod
    def create_in_app_notification(
        db: Session,
        title: str,
        message: str,
        category: str,
        severity: str = "info",
        action_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SystemNotification:
        """
        Persists a new internal notification for the in-app drawer.
        """
        notification = SystemNotification(
            title=title,
            message=message,
            category=category,
            severity=severity,
            action_url=action_url,
            metadata_json=metadata or {},
            is_read=False,
            is_archived=False,
            created_at=datetime.utcnow(),
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def log_dispatch(
        db: Session,
        channel: str,
        payload_preview: str,
        recipient: Optional[str] = None,
        symbol: Optional[str] = None,
        status: str = "SENT",
        error_message: Optional[str] = None,
    ) -> AlertDispatchLog:
        """
        Records an audit log entry in alert_dispatch_logs.
        """
        log = AlertDispatchLog(
            channel=channel,
            recipient=recipient,
            symbol=symbol,
            payload_preview=payload_preview[:1000],
            status=status,
            error_message=error_message,
            dispatched_at=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @classmethod
    def trigger_vcp_opportunity_alert(
        cls,
        db: Session,
        pick: Dict[str, Any],
        auto_broadcast: bool = True,
    ) -> Optional[SystemNotification]:
        """
        Triggers an institutional in-app notification and automated Telegram/WhatsApp broadcast
        for a newly discovered Mark Minervini VCP opportunity.
        Includes multi-layer deduplication so the same stock isn't alerted multiple times.
        """
        sym = pick.get("symbol", "").strip().upper()
        if not sym:
            return None

        # 1. Thread-safe in-memory rate-limit check (18-hour cooldown)
        now_ts = time.time()
        cache_key = f"VCP:{sym}"
        with cls._dispatch_lock:
            # Clean expired keys older than 18 hours (64,800s)
            cls._recent_dispatches = {k: v for k, v in cls._recent_dispatches.items() if now_ts - v < 64800}
            last_ts = cls._recent_dispatches.get(cache_key)
            if last_ts and (now_ts - last_ts < 64800):
                logger.info(f"VCP alert for {sym} throttled in-memory ({int(now_ts - last_ts)}s ago); skipping duplicate.")
                return None

        cutoff_time = cls.get_dedup_cutoff(hours=18)

        # 2. In-app notification deduplication check (timezone-proof session window)
        existing = (
            db.query(SystemNotification)
            .filter(
                SystemNotification.category == "VCP_BREAKOUT",
                SystemNotification.created_at >= cutoff_time,
                or_(
                    SystemNotification.title.like(f"%: {sym} %"),
                    SystemNotification.title.like(f"%: {sym}(%"),
                    SystemNotification.title.like(f"% {sym} %"),
                    SystemNotification.title.like(f"%{sym}%"),
                ),
            )
            .first()
        )
        if existing:
            with cls._dispatch_lock:
                cls._recent_dispatches[cache_key] = now_ts
            logger.info(f"VCP alert for {sym} already dispatched (id={existing.id} at {existing.created_at}); skipping duplicate.")
            return existing

        total_score = float(pick.get("final_ai_score", pick.get("total_score", 90.0)))
        is_elite = bool(pick.get("is_elite", total_score >= 95.0))
        company_name = pick.get("company_name", sym)
        pivot_price = float(pick.get("pivot_price", 0.0))
        cmp_price = float(pick.get("cmp", pivot_price))
        entry_zone = pick.get("entry_zone", f"₹{pivot_price*0.998:.1f}–{pivot_price*1.015:.1f}")
        stop_loss = float(pick.get("stop_loss", 0.0))
        target_1 = float(pick.get("target_1", 0.0))
        target_2 = float(pick.get("target_2", 0.0))
        target_3 = float(pick.get("target_3", 0.0)) if pick.get("target_3") else None
        rr_raw = pick.get("reward_risk", "1:3.0")
        try:
            # reward_risk may be stored as "1:3.8" (string) or as a float
            reward_risk = float(str(rr_raw).split(":")[-1]) if rr_raw else 3.0
        except (ValueError, TypeError):
            reward_risk = 3.0
        vcp_stage = pick.get("vcp_stage", "3-Stage VCP")
        vol_ratio = float(pick.get("volume_breakout_ratio", 2.5))
        dryup_pct = int(pick.get("volume_dryup_pct", 60))
        why_selected = pick.get("why_selected", [])
        verdict = pick.get("verdict", "Elite VCP Breakout" if is_elite else "High Conviction Breakout")

        severity = "critical" if is_elite else "warning"
        title = f"🎯 VCP BREAKOUT: {sym} (Score {total_score:.1f} — {verdict})"
        message = (
            f"Minervini {vcp_stage} pivot at ₹{pivot_price:,.1f}. "
            f"Entry Zone: {entry_zone}, SL: ₹{stop_loss:,.1f}. "
            f"Target: ₹{target_1:,.1f}–₹{target_2:,.1f} (R:R {reward_risk:.1f}x). "
            f"Breakout volume {vol_ratio:.1f}x 20DMA with {dryup_pct}% supply contraction."
        )

        metadata = {
            "symbol": sym,
            "company_name": company_name,
            "final_ai_score": total_score,
            "pivot_price": pivot_price,
            "cmp": cmp_price,
            "entry_zone": entry_zone,
            "stop_loss": stop_loss,
            "target_1": target_1,
            "target_2": target_2,
            "target_3": target_3,
            "reward_risk": reward_risk,
            "vcp_stage": vcp_stage,
            "volume_breakout_ratio": vol_ratio,
            "volume_dryup_pct": dryup_pct,
            "is_elite": is_elite,
            "action_url": "/vcp-discovery",
        }

        notif = cls.create_in_app_notification(
            db=db,
            title=title,
            message=message,
            category="VCP_BREAKOUT",
            severity=severity,
            action_url="/vcp-discovery",
            metadata=metadata,
        )

        # Mark in-memory rate-limit
        with cls._dispatch_lock:
            cls._recent_dispatches[cache_key] = now_ts

        # Automated Broadcast to Telegram / WhatsApp if auto-rules permit
        if auto_broadcast:
            try:
                memo = cls.format_vcp_breakout_alert(
                    symbol=sym,
                    company_name=company_name,
                    vcp_stage=vcp_stage,
                    pivot_price=pivot_price,
                    cmp=cmp_price,
                    entry_zone=entry_zone,
                    stop_loss=stop_loss,
                    target_1=target_1,
                    target_2=target_2,
                    target_3=target_3,
                    reward_risk=reward_risk,
                    total_score=total_score,
                    breakout_volume_ratio=vol_ratio,
                    dryup_pct=dryup_pct,
                    why_selected=why_selected,
                    action_url="http://localhost:3000/vcp-discovery",
                )

                # Check Telegram
                tg_cfg_dict = cls.get_telegram_config(db)
                if tg_cfg_dict and tg_cfg_dict.get("is_enabled", True):
                    auto_rules = tg_cfg_dict.get("auto_rules") or {}
                    vcp_enabled = auto_rules.get("vcp_enabled", True)
                    min_score = float(auto_rules.get("vcp_min_score", 90.0))
                    elite_only = bool(auto_rules.get("vcp_elite_only", False))

                    if vcp_enabled and total_score >= min_score and (not elite_only or is_elite):
                        # Strict check in AlertDispatchLog to prevent duplicate Telegram broadcasts
                        already_dispatched_tg = (
                            db.query(AlertDispatchLog)
                            .filter(
                                AlertDispatchLog.channel == "TELEGRAM",
                                AlertDispatchLog.symbol == sym,
                                AlertDispatchLog.status == "SUCCESS",
                                AlertDispatchLog.dispatched_at >= cutoff_time,
                            )
                            .first()
                        )
                        if already_dispatched_tg:
                            logger.info(f"Telegram alert for {sym} already logged SUCCESS at {already_dispatched_tg.dispatched_at}; skipping duplicate external broadcast.")
                        else:
                            tg_res = cls.dispatch_telegram(
                                bot_token=tg_cfg_dict["bot_token"],
                                chat_id=tg_cfg_dict["chat_id"],
                                text=memo,
                            )
                            cls.log_dispatch(
                                db=db,
                                channel="TELEGRAM",
                                recipient=tg_cfg_dict["chat_id"],
                                symbol=sym,
                                payload_preview=memo,
                                status="SUCCESS" if tg_res.get("success") else "FAILED",
                                error_message=tg_res.get("error"),
                            )
                            logger.info(f"Broadcast VCP alert for {sym} to Telegram: {tg_res.get('success')}")

                # Check WhatsApp Cloud API
                wa_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "WHATSAPP").first()
                if wa_cfg and wa_cfg.is_enabled and wa_cfg.api_key and wa_cfg.phone_number_id and wa_cfg.target_recipient:
                    auto_rules = wa_cfg.auto_rules or {}
                    vcp_enabled = auto_rules.get("vcp_enabled", True)
                    min_score = float(auto_rules.get("vcp_min_score", 90.0))
                    elite_only = bool(auto_rules.get("vcp_elite_only", False))

                    if vcp_enabled and total_score >= min_score and (not elite_only or is_elite):
                        already_dispatched_wa = (
                            db.query(AlertDispatchLog)
                            .filter(
                                AlertDispatchLog.channel == "WHATSAPP",
                                AlertDispatchLog.symbol == sym,
                                AlertDispatchLog.status == "SUCCESS",
                                AlertDispatchLog.dispatched_at >= cutoff_time,
                            )
                            .first()
                        )
                        if already_dispatched_wa:
                            logger.info(f"WhatsApp alert for {sym} already logged SUCCESS at {already_dispatched_wa.dispatched_at}; skipping duplicate.")
                        else:
                            wa_res = cls.dispatch_whatsapp_cloud(
                                api_key=wa_cfg.api_key,
                                phone_number_id=wa_cfg.phone_number_id,
                                recipient=wa_cfg.target_recipient,
                                text=memo,
                            )
                            cls.log_dispatch(
                                db=db,
                                channel="WHATSAPP",
                                recipient=wa_cfg.target_recipient,
                                symbol=sym,
                                payload_preview=memo,
                                status="SUCCESS" if wa_res.get("success") else "FAILED",
                                error_message=wa_res.get("error"),
                            )
                            logger.info(f"Broadcast VCP alert for {sym} to WhatsApp Cloud: {wa_res.get('success')}")

            except Exception as e:
                logger.error(f"Error executing automated broadcast for VCP pick {sym}: {e}", exc_info=True)

        return notif

    @classmethod
    def dispatch_breakout_execution_alert(
        cls,
        db: Session,
        candidate: Any,
    ) -> Dict[str, Any]:
        """
        Formats and broadcasts a breakout trigger event across configured channels (Telegram & WhatsApp).
        """
        sym = getattr(candidate, "symbol", "").strip().upper()
        if not sym:
            return {"success": False, "error": "No symbol provided."}

        company_name = getattr(candidate, "company_name", sym) or sym
        sector = getattr(candidate, "sector", "Diversified") or "Diversified"
        conviction_score = int(getattr(candidate, "conviction_score", 75) or 75)
        setup_tier = getattr(candidate, "setup_tier", "A+ SUPER COIL") or "A+ SUPER COIL"
        pattern_tag = getattr(candidate, "pattern_tag", "SUPER_COIL") or "SUPER_COIL"
        cmp_val = float(getattr(candidate, "current_cmp", 0.0) or 0.0)
        trigger = float(getattr(candidate, "trigger_price", 0.0) or 0.0)
        buy_max = float(getattr(candidate, "buy_zone_max", round(trigger * 1.015, 2)) or round(trigger * 1.015, 2))
        stop = float(getattr(candidate, "stop_loss", round(trigger * 0.968, 2)) or round(trigger * 0.968, 2))
        t1 = float(getattr(candidate, "target_1", round(trigger * 1.09, 2)) or round(trigger * 1.09, 2))
        t2 = float(getattr(candidate, "target_2", round(trigger * 1.18, 2)) or round(trigger * 1.18, 2))
        rr = float(getattr(candidate, "risk_reward", 3.0) or 3.0)
        vol_pace = float(getattr(candidate, "volume_pace_ratio", 1.0) or 1.0)

        memo = cls.format_breakout_triggered_alert(
            symbol=sym,
            company_name=company_name,
            sector=sector,
            conviction_score=conviction_score,
            setup_tier=setup_tier,
            pattern_tag=pattern_tag,
            cmp=cmp_val,
            trigger_price=trigger,
            buy_zone_max=buy_max,
            stop_loss=stop,
            target_1=t1,
            target_2=t2,
            risk_reward=rr,
            volume_pace_ratio=vol_pace,
            action_url="http://localhost:3000/pre-breakout-radar",
        )

        results = {"symbol": sym, "telegram": None, "whatsapp": None}

        # 1. Telegram Dispatch
        try:
            tg_cfg_dict = cls.get_telegram_config(db)
            if tg_cfg_dict and tg_cfg_dict.get("is_enabled", True):
                tg_res = cls.dispatch_telegram(
                    bot_token=tg_cfg_dict["bot_token"],
                    chat_id=tg_cfg_dict["chat_id"],
                    text=memo,
                )
                cls.log_dispatch(
                    db=db,
                    channel="TELEGRAM",
                    recipient=tg_cfg_dict["chat_id"],
                    symbol=sym,
                    payload_preview=memo,
                    status="SUCCESS" if tg_res.get("success") else "FAILED",
                    error_message=tg_res.get("error"),
                )
                results["telegram"] = tg_res
                logger.info(f"Broadcast Breakout Trigger for {sym} to Telegram: {tg_res.get('success')}")
            else:
                logger.debug("Telegram channel not enabled or missing credentials.")
        except Exception as e:
            logger.error(f"Error dispatching breakout telegram alert for {sym}: {e}", exc_info=True)
            results["telegram"] = {"success": False, "error": str(e)}

        # 2. WhatsApp Dispatch (if configured)
        try:
            wa_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "WHATSAPP").first()
            if wa_cfg and wa_cfg.is_enabled and wa_cfg.api_key and wa_cfg.phone_number_id and wa_cfg.target_recipient:
                wa_res = cls.dispatch_whatsapp_cloud(
                    api_key=wa_cfg.api_key,
                    phone_number_id=wa_cfg.phone_number_id,
                    recipient=wa_cfg.target_recipient,
                    text=memo,
                )
                cls.log_dispatch(
                    db=db,
                    channel="WHATSAPP",
                    recipient=wa_cfg.target_recipient,
                    symbol=sym,
                    payload_preview=memo,
                    status="SUCCESS" if wa_res.get("success") else "FAILED",
                    error_message=wa_res.get("error"),
                )
                results["whatsapp"] = wa_res
        except Exception as e:
            logger.debug(f"WhatsApp dispatch skipped or error: {e}")

        return results

    @classmethod
    def format_transformational_multibagger_alert(
        cls,
        symbol: str,
        company_name: str,
        opportunity_class: str,
        catalyst_headline: str,
        catalyst_category: str,
        guidance_change: Optional[str],
        conviction_score: float,
        cmp: float,
        dma_50: Optional[float],
        dma_200: Optional[float],
        action_verdict: str,
        entry_corridor: Optional[str] = None,
        stop_loss: Optional[float] = None,
        leadership_quote: Optional[str] = None,
        action_url: str = "http://localhost:3000/investor-intelligence",
    ) -> str:
        """
        Formats an institutional-grade alert for an equity exhibiting transformational
        guidance/execution aligned with technical stage analysis.
        """
        is_ready = "READY_TO_BUY" in opportunity_class.upper() or "STAGE_2" in opportunity_class.upper()
        header_icon = "🟢" if is_ready else "🟡"
        class_label = "READY TO BUY (STAGE 2 CONFIRMED)" if is_ready else "INFLECTION RADAR (200 DMA BASE)"
        
        guidance_text = "📈 *Guidance:* Upward Revision / Target Raised" if guidance_change == "UPWARD_REVISION" else "📊 *Guidance:* Reaffirmed / Solid Execution Runway"
        
        dma_str = ""
        if dma_50 and dma_200:
            dma_str = f"📐 *Technicals:* 50 DMA: ₹{dma_50:,.2f} | 200 DMA: ₹{dma_200:,.2f}\n"
        elif dma_50:
            dma_str = f"📐 *Technicals:* 50 DMA: ₹{dma_50:,.2f}\n"

        quote_block = ""
        if leadership_quote:
            clean_q = leadership_quote[:200].replace("*", "").replace("_", "")
            quote_block = f"🗣️ *Management:* \"_{clean_q}..._\"\n"

        entry_block = ""
        if entry_corridor:
            entry_block = f"🎯 *Action Corridor:* {entry_corridor}\n"
        if stop_loss:
            entry_block += f"🛑 *Invalidation Floor:* ₹{stop_loss:,.2f}\n"

        return (
            f"🚀 *ALPHA INDIA | TRANSFORMATIONAL MULTIBAGGER RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"{header_icon} *Status:* *{class_label}*\n"
            f"⭐ *Senior Buy-Side Conviction:* {conviction_score:.1f}/100\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚡ *Catalyst:* {catalyst_headline}\n"
            f"🏷️ *Category:* `{catalyst_category.replace('_', ' ')}`\n"
            f"{guidance_text}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
            f"{dma_str}"
            f"🧭 *Verdict:* *{action_verdict}*\n"
            f"{entry_block}"
            f"{quote_block}"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{cls.get_stock_links(symbol)}\n"
            f"📡 *Deep Forensic Memo:* {action_url}"
        )

    @classmethod
    def broadcast_multibagger_opportunity(
        cls,
        db: Session,
        symbol: str,
        company_name: str,
        opportunity_class: str,
        catalyst_headline: str,
        catalyst_category: str,
        guidance_change: Optional[str],
        conviction_score: float,
        cmp: float,
        dma_50: Optional[float],
        dma_200: Optional[float],
        action_verdict: str,
        entry_corridor: Optional[str] = None,
        stop_loss: Optional[float] = None,
        leadership_quote: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches transformational multibagger opportunity alert across Telegram and WhatsApp.
        """
        memo = cls.format_transformational_multibagger_alert(
            symbol=symbol,
            company_name=company_name,
            opportunity_class=opportunity_class,
            catalyst_headline=catalyst_headline,
            catalyst_category=catalyst_category,
            guidance_change=guidance_change,
            conviction_score=conviction_score,
            cmp=cmp,
            dma_50=dma_50,
            dma_200=dma_200,
            action_verdict=action_verdict,
            entry_corridor=entry_corridor,
            stop_loss=stop_loss,
            leadership_quote=leadership_quote,
        )

        results = {"symbol": symbol, "telegram": None, "whatsapp": None}
        try:
            tg_cfg_dict = cls.get_telegram_config(db)
            if tg_cfg_dict and tg_cfg_dict.get("is_enabled", True):
                tg_res = cls.dispatch_telegram(
                    bot_token=tg_cfg_dict["bot_token"],
                    chat_id=tg_cfg_dict["chat_id"],
                    text=memo,
                )
                cls.log_dispatch(
                    db=db,
                    channel="TELEGRAM",
                    recipient=tg_cfg_dict["chat_id"],
                    symbol=symbol,
                    payload_preview=memo,
                    status="SUCCESS" if tg_res.get("success") else "FAILED",
                    error_message=tg_res.get("error"),
                )
                results["telegram"] = tg_res
                logger.info(f"Broadcast Multibagger Opportunity for {symbol} to Telegram: {tg_res.get('success')}")
        except Exception as e:
            logger.error(f"Error dispatching multibagger telegram alert for {symbol}: {e}", exc_info=True)
            results["telegram"] = {"success": False, "error": str(e)}

        return results

