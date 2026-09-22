"""
Alpha India Alert Dispatch & Notification Service
Sprint 34 — Institutional Alerts & Multi-Channel Broadcasting
"""

import logging
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional
import requests
from sqlalchemy.orm import Session

from app.models.notification import SystemNotification, AlertChannelConfig, AlertDispatchLog

logger = logging.getLogger("alpha_india.alerts")


class AlertDispatchService:
    """
    Central service for internal notifications and external alert dispatching
    (Telegram Bot API & WhatsApp).
    """

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
            "disable_web_page_preview": False,
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
    # 3. Institutional Memo Formatters
    # ==========================================================
    @staticmethod
    def format_pead_flash_alert(
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
    ) -> str:
        return (
            f"⚡ *ALPHA INDIA | ATHENA PEAD FLASH*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"🎯 *Signal:* {signal.upper()} | *Grade:* {conviction_grade} ({conviction_score}/100)\n"
            f"📈 *QoQ/YoY Growth:*\n"
            f"   • PAT: ₹{pat:,.1f} Cr ({growth_pat:+.1f}% YoY)\n"
            f"   • Revenue: ₹{revenue:,.1f} Cr\n"
            f"🎯 *Upside Potential:* {upside_pct:+.1f}%\n"
            f"💡 *Institutional Thesis:*\n{thesis}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @staticmethod
    def format_catalyst_alert(
        symbol: str,
        company_name: str,
        catalyst_type: str,
        headline: str,
        order_value_cr: Optional[float] = None,
        source_url: Optional[str] = None,
    ) -> str:
        cat_label = catalyst_type.replace("_", " ").upper()
        clean_headline = headline.replace("*", "").replace("`", "")
        value_str = f"\n💰 *Contract Value:* ₹{order_value_cr:,.1f} Cr" if order_value_cr else ""
        link_str = f"\n🔗 [Exchange Filing]({source_url})" if source_url else ""
        return (
            f"📡 *ALPHA INDIA | CATALYST RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⚡ *Catalyst:* {cat_label}{value_str}\n"
            f"📋 *Summary:* {clean_headline}{link_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @staticmethod
    def format_growth_breakout_alert(
        symbol: str,
        company_name: str,
        pat_growth_yoy: float,
        rev_growth_yoy: float,
        opm: float,
        pe: Optional[float] = None,
    ) -> str:
        pe_str = f" | *P/E:* {pe:.1f}x" if pe else ""
        return (
            f"🚀 *ALPHA INDIA | GROWTH BREAKOUT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"📈 *YoY PAT Growth:* +{pat_growth_yoy:.1f}%\n"
            f"📊 *YoY Revenue Growth:* +{rev_growth_yoy:.1f}%\n"
            f"🛡️ *Operating Margin:* {opm:.1f}%{pe_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📡 _Dispatched via Alpha India Terminal_"
        )

    @staticmethod
    def format_vcp_breakout_alert(
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

        return (
            f"🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"⭐ *Score:* {total_score:.1f}/100 — {verdict}\n"
            f"📐 *Pattern:* {vcp_stage} (Supply Dry-Up: {dryup_pct}%)\n"
            f"🎯 *Pivot Point:* ₹{pivot_price:,.2f} | *CMP:* ₹{cmp:,.2f}\n"
            f"🚪 *Entry Zone:* {entry_zone}\n"
            f"🛡️ *Stop Loss:* ₹{stop_loss:,.2f}\n"
            f"🚀 *Targets:* *T1:* ₹{target_1:,.1f} | *T2:* ₹{target_2:,.1f}{t3_str}\n"
            f"⚖️ *Risk/Reward:* {reward_risk:.1f}x | *Breakout Vol:* {breakout_volume_ratio:.1f}x 20DMA\n"
            f"💡 *Institutional Edge:*{bullets}\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @staticmethod
    def format_prebreakout_alert(
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
        return (
            f"⚡ *ALPHA INDIA | PRE-BREAKOUT RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"🎯 *Tier:* {setup_tier} (Conviction: {conviction_score}/100)\n"
            f"📐 *Pattern:* {primary_pattern} (VDU: {vdu_ratio:.2f}x)\n"
            f"💵 *CMP:* ₹{cmp:,.2f} | *Cheat Entry:* ₹{cheat_entry:,.2f}\n"
            f"🛡️ *Stop Loss:* ₹{stop_loss:,.2f}\n"
            f"🚀 *Targets:* *T1:* ₹{target_1:,.1f} (+9%) | *T2:* ₹{target_2:,.1f} (+18%)\n"
            f"⚖️ *Risk/Reward:* {risk_reward:.1f}x\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📡 *Live Radar:* {action_url}"
        )

    @staticmethod
    def format_momentum_radar_alert(
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
    ) -> str:
        return (
            f"🚀 *ALPHA INDIA | MOMENTUM RADAR*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏢 *{company_name or symbol}* (`{symbol}`)\n"
            f"🔥 *Match Score:* {match_count}/10 Confluence | *Conviction:* {conviction_score} PTS\n"
            f"📊 *Triple RSI:* Daily {daily_rsi:.1f} | Weekly {weekly_rsi:.1f}\n"
            f"📈 *Volume Surge:* {vol_surge:.2f}x 20DMA\n"
            f"🎯 *Trigger Price:* ₹{entry_trigger:,.2f} | *CMP:* ₹{cmp:,.2f}\n"
            f"🛡️ *Stop Loss:* ₹{stop_loss:,.2f}\n"
            f"🚀 *Targets:* *T1:* ₹{target_1:,.1f} (+8%) | *T2:* ₹{target_2:,.1f} (+16%)\n"
            f"⚖️ *Risk/Reward:* {risk_reward:.1f}x\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
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
        Includes deduplication so the same stock isn't alerted multiple times on the same date.
        """
        from datetime import date
        sym = pick.get("symbol", "").strip().upper()
        if not sym:
            return None

        today_start = datetime.combine(date.today(), datetime.min.time())
        # Check if already alerted today for VCP_BREAKOUT
        existing = (
            db.query(SystemNotification)
            .filter(
                SystemNotification.category == "VCP_BREAKOUT",
                SystemNotification.created_at >= today_start,
                SystemNotification.title.like(f"%{sym}%"),
            )
            .first()
        )
        if existing:
            logger.info(f"VCP alert for {sym} already dispatched today; skipping duplicate.")
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
                tg_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
                if tg_cfg and tg_cfg.is_enabled and tg_cfg.bot_token and tg_cfg.chat_id:
                    auto_rules = tg_cfg.auto_rules or {}
                    vcp_enabled = auto_rules.get("vcp_enabled", True)
                    min_score = float(auto_rules.get("vcp_min_score", 90.0))
                    elite_only = bool(auto_rules.get("vcp_elite_only", False))

                    if vcp_enabled and total_score >= min_score and (not elite_only or is_elite):
                        tg_res = cls.dispatch_telegram(
                            bot_token=tg_cfg.bot_token,
                            chat_id=tg_cfg.chat_id,
                            text=memo,
                        )
                        cls.log_dispatch(
                            db=db,
                            channel="TELEGRAM",
                            recipient=tg_cfg.chat_id,
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
