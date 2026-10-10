"""
Alpha India External Alert Center API
Sprint 34 — Multi-Channel Dispatch (Telegram & WhatsApp)
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.models.notification import AlertChannelConfig, AlertDispatchLog
from app.services.alert_dispatch_service import AlertDispatchService

router = APIRouter(prefix="/alerts", tags=["Alert Center"])


# ---------------- Schemas ----------------
class TelegramConfigRequest(BaseModel):
    bot_token: str
    chat_id: str
    is_enabled: bool = True
    auto_rules: Optional[Dict[str, Any]] = None


class WhatsAppConfigRequest(BaseModel):
    api_key: Optional[str] = None
    phone_number_id: Optional[str] = None
    target_recipient: Optional[str] = None
    is_enabled: bool = True
    auto_rules: Optional[Dict[str, Any]] = None


class BroadcastRequest(BaseModel):
    channels: List[str]  # ["TELEGRAM", "WHATSAPP"]
    symbol: Optional[str] = None
    title: str
    message: str
    recipient_override: Optional[str] = None


class GenerateBriefRequest(BaseModel):
    alert_type: str  # "PEAD", "CATALYST", "GROWTH", "CUSTOM"
    symbol: str
    company_name: Optional[str] = None
    data: Dict[str, Any]
    target_phone: Optional[str] = None


# ==========================================================
# 1. Channel Configurations
# ==========================================================
@router.get("/channels")
def get_channel_configs(db: Session = Depends(get_db)):
    """
    Returns configured alert channels with masked secrets.
    """
    configs = db.query(AlertChannelConfig).all()
    config_map = {cfg.channel: cfg.to_dict(mask_secrets=True) for cfg in configs}

    # Ensure Telegram credentials fallback to env vars if DB is empty
    tg_resolved = AlertDispatchService.get_telegram_config(db)
    if tg_resolved and "TELEGRAM" in config_map:
        if not config_map["TELEGRAM"].get("bot_token") and tg_resolved.get("bot_token"):
            tok = tg_resolved["bot_token"]
            config_map["TELEGRAM"]["bot_token"] = f"{tok[:6]}...{tok[-4:]}" if len(tok) > 10 else tok
        if not config_map["TELEGRAM"].get("chat_id") and tg_resolved.get("chat_id"):
            config_map["TELEGRAM"]["chat_id"] = tg_resolved["chat_id"]

    # Ensure defaults exist in response
    if "TELEGRAM" not in config_map:
        config_map["TELEGRAM"] = {
            "channel": "TELEGRAM",
            "is_enabled": False,
            "bot_token": None,
            "chat_id": None,
            "auto_rules": {
                "pead_enabled": True,
                "pead_min_conviction": 80,
                "catalyst_enabled": True,
                "catalyst_min_cr": 1000,
                "growth_enabled": True,
                "growth_min_pat_pct": 50,
                "vcp_enabled": True,
                "vcp_min_score": 90,
                "vcp_elite_only": False,
                "prebreakout_a_plus_enabled": True,
                "prebreakout_min_conviction": 80,
                "momentum_match_9_enabled": True,
                "momentum_min_matches": 9,
                "momentum_conviction_79_enabled": True,
                "momentum_min_conviction": 79,
                "momentum_universe_enabled": True,
                "momentum_min_mcap_cr": 1000.0,
                "tomorrow_radar_enabled": True,
                "tomorrow_min_conviction": 90,
                "order_win_enabled": True,
                "order_win_min_significance": 65,
                "order_win_min_deal_cr": 25,
                "techno_funda_enabled": True,
                "techno_funda_min_score": 85,
                "techno_funda_max_pivot_dist": 4.0,
                "delivery_breakout_enabled": True,
                "delivery_tier": "ACTIVE_SWING",
                "delivery_min_spike": 1.6,
                "delivery_min_pct": 55.0,
                "delivery_min_flow_20d": 1.15,
                "institutional_mf_enabled": True,
                "institutional_min_schemes": 3,
                "institutional_min_smart_money_score": 80,
                "growth_screener_enabled": True,
                "growth_min_sales_pct": 25,
                "breakout_execution_enabled": True,
            },
        }

    if "WHATSAPP" not in config_map:
        config_map["WHATSAPP"] = {
            "channel": "WHATSAPP",
            "is_enabled": True,
            "api_key": None,
            "phone_number_id": None,
            "target_recipient": None,
            "auto_rules": {
                "pead_enabled": True,
                "pead_min_conviction": 85,
                "catalyst_enabled": True,
                "catalyst_min_cr": 2000,
                "vcp_enabled": True,
                "vcp_min_score": 90,
                "vcp_elite_only": False,
                "order_win_enabled": True,
                "order_win_min_significance": 70,
                "techno_funda_enabled": True,
                "delivery_breakout_enabled": True,
            },
        }

    return config_map


@router.post("/channels/telegram")
def save_telegram_config(req: TelegramConfigRequest, db: Session = Depends(get_db)):
    """
    Saves or updates Telegram Bot API credentials and rules.
    """
    cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
    if not cfg:
        cfg = AlertChannelConfig(channel="TELEGRAM")
        db.add(cfg)

    # If the user passed an unmasked token, update it
    if req.bot_token and "..." not in req.bot_token:
        cfg.bot_token = req.bot_token.strip()

    if req.chat_id:
        c_chat = req.chat_id.strip()
        if "web.telegram.org" in c_chat and "#" in c_chat:
            c_chat = c_chat.split("#")[-1].strip()
        elif c_chat.startswith("https://t.me/"):
            c_chat = "@" + c_chat.replace("https://t.me/", "").strip().lstrip("@")
        cfg.chat_id = c_chat
    else:
        cfg.chat_id = None

    cfg.is_enabled = req.is_enabled
    if req.auto_rules is not None:
        cfg.auto_rules = req.auto_rules

    db.commit()
    db.refresh(cfg)
    return {"status": "ok", "config": cfg.to_dict(mask_secrets=True)}


@router.post("/channels/whatsapp")
def save_whatsapp_config(req: WhatsAppConfigRequest, db: Session = Depends(get_db)):
    """
    Saves or updates WhatsApp Cloud API / Webhook configuration.
    """
    cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "WHATSAPP").first()
    if not cfg:
        cfg = AlertChannelConfig(channel="WHATSAPP")
        db.add(cfg)

    if req.api_key and "..." not in req.api_key:
        cfg.api_key = req.api_key.strip()

    cfg.phone_number_id = req.phone_number_id.strip() if req.phone_number_id else None
    cfg.target_recipient = req.target_recipient.strip() if req.target_recipient else None
    cfg.is_enabled = req.is_enabled
    if req.auto_rules is not None:
        cfg.auto_rules = req.auto_rules

    db.commit()
    db.refresh(cfg)
    return {"status": "ok", "config": cfg.to_dict(mask_secrets=True)}


# ==========================================================
# 2. Test Ping Endpoints
# ==========================================================
@router.post("/test/telegram")
def test_telegram_connection(
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Validates the Telegram bot token and dispatches an institutional test alert message.
    """
    tg_resolved = AlertDispatchService.get_telegram_config(db)
    token_to_use = bot_token or (tg_resolved["bot_token"] if tg_resolved else None)
    chat_to_use = chat_id or (tg_resolved["chat_id"] if tg_resolved else None)

    if not token_to_use:
        raise HTTPException(status_code=400, detail="No Telegram bot token provided or configured.")

    # 1. Verify Bot Token
    verify_res = AlertDispatchService.verify_telegram_bot(token_to_use)
    if not verify_res.get("valid"):
        return {
            "status": "error",
            "step": "bot_verification",
            "error": verify_res.get("error", "Invalid bot token."),
        }

    # 2. If chat_id is provided, send test ping
    send_res = None
    if chat_to_use:
        clean_chat = chat_to_use.strip()
        if "web.telegram.org" in clean_chat and "#" in clean_chat:
            clean_chat = clean_chat.split("#")[-1].strip()
        elif clean_chat.startswith("https://t.me/"):
            clean_chat = "@" + clean_chat.replace("https://t.me/", "").strip().lstrip("@")

        bot_id_str = str(verify_res.get("bot_id", ""))
        bot_user_str = str(verify_res.get("bot_username", "")).lower()

        # Check if user accidentally entered the Bot's own user ID or username
        if clean_chat == bot_id_str or clean_chat.lower().lstrip("@") == bot_user_str:
            err_msg = (
                f"'{chat_to_use}' is the Bot's own ID (@{verify_res.get('bot_username')}). "
                f"Telegram bots cannot send messages to themselves. "
                f"To receive alerts: "
                f"1) For Direct PM alerts: Open https://t.me/{verify_res.get('bot_username')} and click START, then click 'Auto-Detect'. "
                f"2) For Channel alerts: Add @{verify_res.get('bot_username')} as an Admin with Post Messages rights to your Channel/Group, and enter the @ChannelName or -100 ID."
            )
            return {
                "status": "error",
                "step": "chat_validation",
                "bot_info": verify_res,
                "error": err_msg,
                "dispatch_result": {"success": False, "error": err_msg},
            }

        test_msg = (
            f"⚡ *ALPHA INDIA TEST DISPATCH*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🤖 *Bot:* @{verify_res.get('bot_username')}\n"
            f"📡 *Channel:* Institutional Growth Terminal\n"
            f"✅ *Status:* Connection Verified Successfully\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"Alpha India Alert Engine is now connected."
        )
        send_res = AlertDispatchService.dispatch_telegram(
            bot_token=token_to_use,
            chat_id=clean_chat,
            text=test_msg,
        )

        AlertDispatchService.log_dispatch(
            db=db,
            channel="TELEGRAM",
            recipient=clean_chat,
            symbol="SYSTEM_TEST",
            payload_preview=test_msg,
            status="SUCCESS" if send_res.get("success") else "FAILED",
            error_message=send_res.get("error"),
        )

        if not send_res.get("success"):
            return {
                "status": "error",
                "step": "message_dispatch",
                "bot_info": verify_res,
                "dispatch_result": send_res,
                "error": f"Telegram error: {send_res.get('error')}. Please ensure the bot is added as an Administrator to your channel or you have clicked /start in the bot chat.",
            }

    return {
        "status": "ok",
        "bot_info": verify_res,
        "dispatch_result": send_res,
    }


@router.get("/test/telegram/detect-chats")
def detect_telegram_chats(
    bot_token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Polls getUpdates to discover chats, channels, or user conversations
    that recently interacted with the bot.
    """
    cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
    token_to_use = bot_token or (cfg.bot_token if cfg else None)

    if not token_to_use:
        raise HTTPException(status_code=400, detail="No Telegram bot token provided or configured.")

    verify_res = AlertDispatchService.verify_telegram_bot(token_to_use)
    if not verify_res.get("valid"):
        return {"ok": False, "error": verify_res.get("error", "Invalid bot token.")}

    result = AlertDispatchService.detect_telegram_chats(token_to_use)
    bot_name = verify_res.get("bot_username")

    if result.get("ok") and len(result.get("chats", [])) == 0:
        result["instructions"] = (
            f"No recent messages received by @{bot_name}. "
            f"To detect your chat ID: 1) Open https://t.me/{bot_name} and click START, OR "
            f"2) Add @{bot_name} as an Admin to your Telegram channel and post any message in the channel. "
            f"Then click 'Auto-Detect' again."
        )
    return result


@router.post("/generate-brief")
def generate_brief_and_links(req: GenerateBriefRequest):
    """
    Generates institutional memo text and WhatsApp Click-to-Chat link
    for instant 1-click sharing by research analysts.
    """
    if req.alert_type == "PEAD":
        d = req.data
        memo = AlertDispatchService.format_pead_flash_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            signal=d.get("signal", "BUY"),
            conviction_score=d.get("conviction_score", 90),
            conviction_grade=d.get("conviction_grade", "AAA"),
            revenue=d.get("revenue", 0.0),
            pat=d.get("pat", 0.0),
            growth_pat=d.get("growth_pat", 0.0),
            upside_pct=d.get("upside_pct", 0.0),
            thesis=d.get("thesis", "Earnings acceleration with margin expansion."),
        )
    elif req.alert_type in ["ORDER_WIN", "ORDER_WIN_RADAR"]:
        d = req.data
        memo = AlertDispatchService.format_order_win_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            deal_value_cr=d.get("deal_value_cr"),
            significance_score=float(d.get("significance_score", d.get("order_significance_score", 85.0))),
            significance_tier=d.get("significance_tier", d.get("order_significance_tier", "HIGH_IMPACT")),
            client_counterparty=d.get("client_counterparty", d.get("order_client_counterparty")),
            rev_pct_ttm=d.get("rev_pct_ttm", d.get("synergy_rev_pct_ttm")),
            execution_months=d.get("execution_months", d.get("order_execution_months")),
            quarterly_rev_cr=d.get("quarterly_rev_cr", d.get("order_quarterly_rev_cr")),
            earnings_impact_cr=d.get("earnings_impact_cr", d.get("order_earnings_impact_cr")),
            cmp=d.get("cmp", d.get("current_price")),
            target_price=d.get("target_price"),
            upside_pct=d.get("upside_pct"),
            stop_loss=d.get("stop_loss"),
            upside_prob_pct=d.get("upside_prob_pct", d.get("order_upside_prob_pct")),
            headline=d.get("headline"),
            thesis=d.get("thesis", d.get("buy_thesis")),
            source_url=d.get("source_url"),
        )
    elif req.alert_type == "CATALYST":
        d = req.data
        memo = AlertDispatchService.format_catalyst_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            catalyst_type=d.get("catalyst_type", "ORDER_WIN"),
            headline=d.get("headline", "Major corporate development filing."),
            order_value_cr=d.get("order_value_cr"),
            source_url=d.get("source_url"),
        )
    elif req.alert_type == "GROWTH":
        d = req.data
        memo = AlertDispatchService.format_growth_breakout_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            pat_growth_yoy=d.get("pat_growth_yoy", 50.0),
            rev_growth_yoy=d.get("rev_growth_yoy", 25.0),
            opm=d.get("opm", 20.0),
            pe=d.get("pe"),
        )
    elif req.alert_type in ["VCP", "VCP_BREAKOUT"]:
        d = req.data
        pivot_val = float(d.get("pivot_price", 0.0))
        memo = AlertDispatchService.format_vcp_breakout_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            vcp_stage=d.get("vcp_stage", "3-Stage VCP"),
            pivot_price=pivot_val,
            cmp=float(d.get("cmp", pivot_val)),
            entry_zone=d.get("entry_zone", f"₹{pivot_val*0.998:.1f}–{pivot_val*1.015:.1f}"),
            stop_loss=float(d.get("stop_loss", 0.0)),
            target_1=float(d.get("target_1", 0.0)),
            target_2=float(d.get("target_2", 0.0)),
            target_3=float(d.get("target_3", 0.0)) if d.get("target_3") else None,
            reward_risk=float(d.get("reward_risk", 3.0)),
            total_score=float(d.get("final_ai_score", d.get("total_score", 92.0))),
            breakout_volume_ratio=float(d.get("volume_breakout_ratio", 2.5)),
            dryup_pct=int(d.get("volume_dryup_pct", 60)),
            thesis=d.get("thesis", "Tight volatility compression with institutional volume expansion."),
            why_selected=d.get("why_selected", []),
            action_url="http://localhost:3000/vcp-discovery",
        )
    elif req.alert_type in ["TECHNO_FUNDA", "TECHNO"]:
        d = req.data
        memo = AlertDispatchService.format_techno_funda_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            setup_score=float(d.get("setup_score", 88.0)),
            cmp=float(d.get("cmp", d.get("current_price", 0.0))),
            pivot_price=float(d.get("pivot_price", d.get("model_pivot", 0.0))),
            distance_to_pivot_pct=float(d.get("distance_to_pivot_pct", 2.5)),
            sector=d.get("sector", "Diversified"),
            health_score=float(d.get("health_score", 75.0)),
            signal=d.get("signal", "PRE_BREAKOUT"),
            pattern=d.get("pattern", "VCP Base"),
        )
    elif req.alert_type in ["DELIVERY", "DELIVERY_BREAKOUT"]:
        d = req.data
        memo = AlertDispatchService.format_delivery_breakout_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            delivery_per=float(d.get("delivery_per", 72.0)),
            delivery_spike_x=float(d.get("delivery_spike_x", 3.2)),
            cmp=float(d.get("cmp", d.get("current_price", 0.0))),
            setup_type=d.get("setup_type", "50D_BREAKOUT"),
            conviction_score=float(d.get("conviction_score", 85.0)),
            sector=d.get("sector", "Diversified"),
            target_price=float(d.get("target_price", 0.0)) if d.get("target_price") else None,
            stop_loss=float(d.get("stop_loss", 0.0)) if d.get("stop_loss") else None,
        )
    elif req.alert_type in ["INSTITUTIONAL", "INSTITUTIONAL_MF", "SMART_MONEY"]:
        d = req.data
        memo = AlertDispatchService.format_institutional_mf_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            smart_money_score=float(d.get("smart_money_score", 84.0)),
            schemes_count=int(d.get("schemes_count", d.get("mf_count", 4))),
            net_shares_change_pct=float(d.get("net_shares_change_pct", 18.5)),
            sector=d.get("sector", "Diversified"),
        )
    elif req.alert_type in ["IPO", "IPO_RADAR"]:
        d = req.data
        memo = AlertDispatchService.format_ipo_radar_alert(
            symbol=req.symbol,
            company_name=req.company_name or req.symbol,
            setup_type=d.get("setup_type", "LDH_BREAKOUT"),
            setup_label=d.get("setup_label", "Blue-Sky Breakout"),
            setup_status=d.get("setup_status", "READY"),
            conviction_score=float(d.get("conviction_score", 90.0)),
            cmp=float(d.get("cmp", d.get("current_price", 0.0))),
            pivot_price=float(d.get("pivot_price", 0.0)),
            stop_loss=float(d.get("stop_loss", 0.0)),
            target_1=float(d.get("target_1", 0.0)),
            target_2=float(d.get("target_2", 0.0)),
            risk_pct=float(d.get("risk_pct", 5.0)),
            day1_high=float(d.get("day1_high", 0.0)),
            days_since_listing=int(d.get("days_since_listing", 15)),
            rvol=float(d.get("rvol", 1.5)),
            anchor_days_left=d.get("anchor_30d_days_left"),
            rationale=d.get("rationale"),
        )
    else:
        memo = f"⚡ *ALPHA INDIA ALERT | {req.symbol}*\n\n{req.data.get('message', '')}"

    whatsapp_url = AlertDispatchService.generate_whatsapp_click_to_chat_url(
        text=memo,
        phone=req.target_phone,
    )

    return {
        "symbol": req.symbol,
        "memo_text": memo,
        "whatsapp_url": whatsapp_url,
    }


# ==========================================================
# 3. Manual Broadcast
# ==========================================================
@router.post("/dispatch/broadcast")
def broadcast_alert(req: BroadcastRequest, db: Session = Depends(get_db)):
    """
    Dispatches a manual institutional alert to selected external channels.
    """
    results = {}

    # 1. Telegram Dispatch
    if "TELEGRAM" in req.channels:
        cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
        if cfg and cfg.is_enabled and cfg.bot_token and cfg.chat_id:
            chat_id = req.recipient_override or cfg.chat_id
            tg_res = AlertDispatchService.dispatch_telegram(
                bot_token=cfg.bot_token,
                chat_id=chat_id,
                text=req.message,
            )
            results["telegram"] = tg_res
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=chat_id,
                symbol=req.symbol,
                payload_preview=req.message,
                status="SUCCESS" if tg_res.get("success") else "FAILED",
                error_message=tg_res.get("error"),
            )
        else:
            results["telegram"] = {
                "success": False,
                "error": "Telegram channel is not configured or disabled.",
            }

    # 2. WhatsApp Dispatch
    if "WHATSAPP" in req.channels:
        cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "WHATSAPP").first()
        if cfg and cfg.is_enabled and cfg.api_key and cfg.phone_number_id:
            recipient = req.recipient_override or cfg.target_recipient
            wa_res = AlertDispatchService.dispatch_whatsapp_cloud(
                api_key=cfg.api_key,
                phone_number_id=cfg.phone_number_id,
                recipient=recipient or "",
                text=req.message,
            )
            results["whatsapp"] = wa_res
            AlertDispatchService.log_dispatch(
                db=db,
                channel="WHATSAPP",
                recipient=recipient,
                symbol=req.symbol,
                payload_preview=req.message,
                status="SUCCESS" if wa_res.get("success") else "FAILED",
                error_message=wa_res.get("error"),
            )
        else:
            # WhatsApp Click-to-chat fallback link
            wa_url = AlertDispatchService.generate_whatsapp_click_to_chat_url(
                text=req.message,
                phone=req.recipient_override or (cfg.target_recipient if cfg else None),
            )
            results["whatsapp"] = {
                "success": True,
                "mode": "click_to_chat",
                "url": wa_url,
                "note": "WhatsApp Cloud API credentials not configured; generated 1-click share URL.",
            }
            AlertDispatchService.log_dispatch(
                db=db,
                channel="WHATSAPP",
                recipient=req.recipient_override or "CLICK_TO_CHAT",
                symbol=req.symbol,
                payload_preview=req.message,
                status="SUCCESS",
            )

    return {
        "status": "completed",
        "symbol": req.symbol,
        "results": results,
    }


# ==========================================================
# 4. Dispatch Audit History Logs
# ==========================================================
@router.get("/logs")
def get_dispatch_logs(
    channel: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns audit trail of dispatched alerts across Telegram and WhatsApp.
    """
    query = db.query(AlertDispatchLog)
    if channel:
        query = query.filter(AlertDispatchLog.channel == channel.upper())

    logs = query.order_by(desc(AlertDispatchLog.dispatched_at)).limit(limit).all()
    return {
        "count": len(logs),
        "logs": [log.to_dict() for log in logs],
    }


# ==========================================================
# 5. On-Demand VCP Discovery Alert Trigger
# ==========================================================
@router.post("/trigger-vcp-scan-alerts", summary="Trigger Alerts for Today's Top VCP Breakouts")
def trigger_vcp_scan_alerts(
    force_broadcast: bool = Query(True, description="Broadcast to enabled external channels"),
    db: Session = Depends(get_db),
):
    """
    Scans or loads today's top VCP discovery picks and generates/broadcasts
    institutional notifications for any pending or fresh opportunities.
    """
    from datetime import date
    from app.models.vcp_models import VCPAIScore, VCPPattern, VolumeAnalysis, BreakoutSignal
    scan_date = date.today()

    scores = (
        db.query(VCPAIScore)
        .filter(VCPAIScore.scan_date == scan_date, VCPAIScore.total_score >= 90.0)
        .order_by(desc(VCPAIScore.total_score))
        .limit(3)
        .all()
    )

    if not scores:
        # If no scores for today, load latest available top scores
        latest_date = db.query(VCPAIScore.scan_date).order_by(desc(VCPAIScore.scan_date)).first()
        if latest_date and latest_date[0]:
            scores = (
                db.query(VCPAIScore)
                .filter(VCPAIScore.scan_date == latest_date[0], VCPAIScore.total_score >= 90.0)
                .order_by(desc(VCPAIScore.total_score))
                .limit(3)
                .all()
            )

    dispatched = []
    for sc in scores:
        pattern = db.query(VCPPattern).filter(VCPPattern.symbol == sc.symbol, VCPPattern.scan_date == sc.scan_date).first()
        vol = db.query(VolumeAnalysis).filter(VolumeAnalysis.symbol == sc.symbol, VolumeAnalysis.scan_date == sc.scan_date).first()
        brk = db.query(BreakoutSignal).filter(BreakoutSignal.symbol == sc.symbol, BreakoutSignal.breakout_date == sc.scan_date).first()

        pick = {
            "symbol": sc.symbol,
            "company_name": pattern.company_name if pattern else sc.symbol,
            "final_ai_score": sc.total_score,
            "is_elite": sc.is_elite,
            "cmp": sc.cmp,
            "pivot_price": sc.pivot_price,
            "entry_zone": sc.entry_zone or f"₹{sc.pivot_price * 0.998:.1f}–{sc.pivot_price * 1.015:.1f}",
            "stop_loss": sc.stop_loss,
            "target_1": sc.target_1,
            "target_2": sc.target_2,
            "target_3": sc.target_3,
            "reward_risk": sc.reward_risk,
            "vcp_stage": pattern.vcp_stage if pattern else "3-Stage VCP",
            "volume_breakout_ratio": brk.breakout_volume_ratio if brk else 2.5,
            "volume_dryup_pct": int((1.0 - (vol.dryup_ratio if vol else 0.4)) * 100),
            "why_selected": sc.why_selected or [],
            "verdict": sc.verdict,
        }

        notif = AlertDispatchService.trigger_vcp_opportunity_alert(
            db=db,
            pick=pick,
            auto_broadcast=force_broadcast,
        )
        if notif:
            dispatched.append(notif.to_dict())

    return {
        "status": "ok",
        "count": len(dispatched),
        "notifications": dispatched,
    }


@router.post("/trigger-order-win-scan-alerts", summary="Trigger Alerts for Top Active Order Wins")
def trigger_order_win_scan_alerts(
    force_broadcast: bool = Query(True, description="Broadcast to enabled external channels"),
    min_score: float = Query(65.0, description="Minimum significance score (65=High Impact, 80=Transformational)"),
    db: Session = Depends(get_db),
):
    """
    Scans and broadcasts top active Order Win contracts to Telegram and in-app notifications.
    """
    rules = OpportunityAlertService.get_opportunity_thresholds(db)
    rules["order_win_enabled"] = True
    rules["order_win_min_significance"] = min_score
    if not force_broadcast:
        rules["auto_broadcast_telegram"] = False
        rules["auto_broadcast_whatsapp"] = False

    dispatched = OpportunityAlertService.scan_order_win_radar_alerts(db=db, rules=rules, force_top_recent=True)
    return {
        "status": "ok",
        "count": len(dispatched),
        "alerts": dispatched,
    }


@router.post("/trigger-ipo-scan-alerts", summary="Trigger Alerts for Top Mainboard IPO Setups")
def trigger_ipo_scan_alerts(
    force_broadcast: bool = Query(True, description="Broadcast to enabled external channels"),
    min_score: float = Query(85.0, description="Minimum conviction score (0-100)"),
    db: Session = Depends(get_db),
):
    """
    Scans Mainboard IPO Radar and broadcasts top active setups (Blue-Sky, Base Cheat, Anchor Spring)
    to Telegram, WhatsApp, and in-app System Notifications.
    """
    rules = OpportunityAlertService.get_opportunity_thresholds(db)
    rules["ipo_radar_enabled"] = True
    rules["ipo_min_conviction"] = min_score
    if not force_broadcast:
        rules["auto_broadcast_telegram"] = False
        rules["auto_broadcast_whatsapp"] = False

    dispatched = OpportunityAlertService.scan_ipo_radar_alerts(db=db, rules=rules, force_top_recent=True)
    return {
        "status": "ok",
        "count": len(dispatched),
        "alerts": dispatched,
    }


@router.post("/trigger-pead-scan-alerts", summary="Trigger Alerts for Top PEAD Drift Radar Setups")
def trigger_pead_scan_alerts(
    force_broadcast: bool = Query(True, description="Broadcast to enabled external channels"),
    min_score: float = Query(70.0, description="Minimum PEAD Score (0-100)"),
    db: Session = Depends(get_db),
):
    """
    Scans PEAD Drift Radar setups and broadcasts top active flashes
    to Telegram, WhatsApp, and in-app System Notifications.
    """
    rules = OpportunityAlertService.get_opportunity_thresholds(db)
    rules["athena_pead_enabled"] = True
    rules["athena_min_shock_score"] = min_score
    if not force_broadcast:
        rules["auto_broadcast_telegram"] = False
        rules["auto_broadcast_whatsapp"] = False

    dispatched = OpportunityAlertService.scan_athena_pead_alerts(db=db, rules=rules, force_top_recent=True)
    return {
        "status": "ok",
        "count": len(dispatched),
        "alerts": dispatched,
    }


# ==========================================================
# 6. High-Conviction Opportunity Radar Alerts Engine
# ==========================================================
from app.services.opportunity_alert_service import OpportunityAlertService


class OpportunityRuleUpdateRequest(BaseModel):
    vcp_signals_enabled: Optional[bool] = None
    vcp_min_score: Optional[float] = None
    vcp_elite_only: Optional[bool] = None
    prebreakout_a_plus_enabled: Optional[bool] = None
    prebreakout_min_conviction: Optional[int] = None
    momentum_match_9_enabled: Optional[bool] = None
    momentum_min_matches: Optional[int] = None
    momentum_conviction_79_enabled: Optional[bool] = None
    momentum_min_conviction: Optional[int] = None
    momentum_universe_enabled: Optional[bool] = None
    momentum_min_mcap_cr: Optional[float] = None
    tomorrow_radar_enabled: Optional[bool] = None
    tomorrow_min_conviction: Optional[int] = None
    athena_pead_enabled: Optional[bool] = None
    athena_min_shock_score: Optional[float] = None
    catalysts_enabled: Optional[bool] = None
    catalysts_min_impact: Optional[float] = None
    order_win_enabled: Optional[bool] = None
    order_win_min_significance: Optional[float] = None
    order_win_min_deal_cr: Optional[float] = None
    techno_funda_enabled: Optional[bool] = None
    techno_funda_min_score: Optional[float] = None
    techno_funda_max_pivot_dist: Optional[float] = None
    delivery_breakout_enabled: Optional[bool] = None
    delivery_tier: Optional[str] = None
    delivery_min_spike: Optional[float] = None
    delivery_min_pct: Optional[float] = None
    delivery_min_flow_20d: Optional[float] = None
    institutional_mf_enabled: Optional[bool] = None
    institutional_min_schemes: Optional[int] = None
    institutional_min_smart_money_score: Optional[float] = None
    growth_screener_enabled: Optional[bool] = None
    growth_min_pat_pct: Optional[float] = None
    growth_min_sales_pct: Optional[float] = None
    breakout_execution_enabled: Optional[bool] = None
    ipo_radar_enabled: Optional[bool] = None
    ipo_min_conviction: Optional[float] = None
    ipo_blue_sky_only: Optional[bool] = None
    # Tab 2 backwards-compatibility aliases
    pead_enabled: Optional[bool] = None
    pead_min_conviction: Optional[int] = None
    catalyst_enabled: Optional[bool] = None
    catalyst_min_cr: Optional[float] = None
    growth_enabled: Optional[bool] = None
    smart_money_enabled: Optional[bool] = None
    system_alerts_enabled: Optional[bool] = None
    vcp_enabled: Optional[bool] = None
    auto_broadcast_telegram: Optional[bool] = None
    auto_broadcast_whatsapp: Optional[bool] = None


@router.post("/scan-opportunities", summary="Scan and Dispatch Alerts for High-Conviction Opportunities")
def scan_and_dispatch_opportunities(
    force_scan: bool = Query(False, description="Force fresh recalculation across radar services"),
    db: Session = Depends(get_db),
):
    """
    Evaluates 4 high-conviction opportunity engines:
    1. /vcp-signals — Minervini VCP Breakouts
    2. /pre-breakout-radar — Conviction Tier A+ (A+ Super Coil or conviction >= 80)
    3. /momentum-radar — Match Score >= 9 / 10
    4. /momentum-radar — Conviction Score >= 79 pts
    Deduplicates daily and broadcasts to in-app notification center and external channels.
    """
    return OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db=db, force_scan=force_scan)


@router.get("/rules/opportunity-thresholds", summary="Get Opportunity Alert Rule Thresholds")
def get_opportunity_rules(db: Session = Depends(get_db)):
    """
    Returns current configuration for the 4 opportunity radar rules.
    """
    return OpportunityAlertService.get_opportunity_thresholds(db=db)


@router.put("/rules/opportunity-thresholds", summary="Update Opportunity Alert Rule Thresholds")
def update_opportunity_rules(
    req: OpportunityRuleUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Updates configuration and toggle states for the 4 opportunity radar rules.
    """
    updates = req.model_dump(exclude_unset=True)
    return OpportunityAlertService.update_opportunity_thresholds(db=db, updated_rules=updates)


@router.get("/recent-opportunities", summary="Get Recent Opportunity Radar Notifications")
def get_recent_opportunity_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns recent notifications for VCP_BREAKOUT, PRE_BREAKOUT, and MOMENTUM_RADAR.
    """
    return OpportunityAlertService.get_recent_opportunity_alerts(db=db, limit=limit)

