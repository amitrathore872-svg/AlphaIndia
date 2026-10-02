"""
Alpha India - Watchlist Alert Service
Handles rule trigger evaluation, in-app alert lifecycle,
and personalized Telegram broadcast channel delivery.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import utc_now
from app.models.watchlist import Watchlist, WatchlistItem
from app.models.watchlist_alert import WatchlistAlert, UserPersonalTelegramConfig
from app.models.notification import AlertChannelConfig, AlertDispatchLog
from app.services.alert_dispatch_service import AlertDispatchService

logger = logging.getLogger(__name__)

# Fallback bot token if user doesn't provide their own bot
DEFAULT_PLATFORM_BOT_TOKEN = "8864485951:AAG7HHDh0KOQ-GXFo9N51CwVxvQ7_g4UPks"


class WatchlistAlertService:
    # -------------------------------------------------------------
    # 1. Alert CRUD Operations
    # -------------------------------------------------------------
    @classmethod
    def create_alert(
        cls,
        db: Session,
        watchlist_id: int,
        symbol: str,
        rule_type: str,
        threshold_value: Optional[float] = None,
        user_id: Optional[int] = None,
        timeframe: str = "1D",
        notes: Optional[str] = None,
        notify_in_app: bool = True,
        notify_telegram: bool = True,
    ) -> WatchlistAlert:
        clean_symbol = symbol.strip().upper()
        alert = WatchlistAlert(
            watchlist_id=watchlist_id,
            user_id=user_id,
            symbol=clean_symbol,
            rule_type=rule_type,
            threshold_value=threshold_value,
            timeframe=timeframe,
            notes=notes,
            notify_in_app=notify_in_app,
            notify_telegram=notify_telegram,
            is_active=True,
            status="ACTIVE",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        logger.info(f"[WatchlistAlert] Created alert id={alert.id} for {clean_symbol} ({rule_type} @ {threshold_value})")
        return alert

    @classmethod
    def get_alerts_for_symbol(
        cls,
        db: Session,
        symbol: str,
        watchlist_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> List[WatchlistAlert]:
        clean_symbol = symbol.strip().upper()
        query = db.query(WatchlistAlert).filter(WatchlistAlert.symbol == clean_symbol)
        if watchlist_id:
            query = query.filter(WatchlistAlert.watchlist_id == watchlist_id)
        if user_id:
            query = query.filter(or_(WatchlistAlert.user_id == user_id, WatchlistAlert.user_id.is_(None)))
        return query.order_by(WatchlistAlert.created_at.desc()).all()

    @classmethod
    def get_alerts_for_watchlist(
        cls,
        db: Session,
        watchlist_id: int,
        user_id: Optional[int] = None,
    ) -> List[WatchlistAlert]:
        query = db.query(WatchlistAlert).filter(WatchlistAlert.watchlist_id == watchlist_id)
        if user_id:
            query = query.filter(or_(WatchlistAlert.user_id == user_id, WatchlistAlert.user_id.is_(None)))
        return query.order_by(WatchlistAlert.created_at.desc()).all()

    @classmethod
    def update_alert_status(
        cls,
        db: Session,
        alert_id: int,
        status: str,
    ) -> Optional[WatchlistAlert]:
        alert = db.query(WatchlistAlert).filter(WatchlistAlert.id == alert_id).first()
        if not alert:
            return None
        alert.status = status
        alert.is_active = (status == "ACTIVE")
        alert.updated_at = utc_now()
        db.commit()
        db.refresh(alert)
        return alert

    @classmethod
    def delete_alert(cls, db: Session, alert_id: int) -> bool:
        alert = db.query(WatchlistAlert).filter(WatchlistAlert.id == alert_id).first()
        if not alert:
            return False
        db.delete(alert)
        db.commit()
        return True

    # -------------------------------------------------------------
    # 2. Personalized User Telegram Configuration
    # -------------------------------------------------------------
    @classmethod
    def get_or_create_user_telegram_config(
        cls,
        db: Session,
        user_id: Optional[int] = None,
    ) -> UserPersonalTelegramConfig:
        query = db.query(UserPersonalTelegramConfig)
        if user_id:
            cfg = query.filter(UserPersonalTelegramConfig.user_id == user_id).first()
        else:
            cfg = query.filter(UserPersonalTelegramConfig.user_id.is_(None)).first()

        if not cfg:
            # Fallback to system AlertChannelConfig chat_id if available
            sys_tg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
            default_chat_id = sys_tg.chat_id if sys_tg else "8349099576"

            cfg = UserPersonalTelegramConfig(
                user_id=user_id,
                channel_name="Personal Watchlist Alerts",
                bot_token=None,  # Uses platform bot by default
                chat_id=default_chat_id,
                is_enabled=True,
                notify_price_cross=True,
                notify_dma_reclaim=True,
                notify_vcp_breakout=True,
                notify_volume_surge=True,
                notify_target_stop=True,
            )
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
        return cfg

    @classmethod
    def update_user_telegram_config(
        cls,
        db: Session,
        user_id: Optional[int],
        chat_id: str,
        channel_name: Optional[str] = None,
        bot_token: Optional[str] = None,
        telegram_username: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        notify_price_cross: Optional[bool] = None,
        notify_dma_reclaim: Optional[bool] = None,
        notify_vcp_breakout: Optional[bool] = None,
        notify_volume_surge: Optional[bool] = None,
        notify_target_stop: Optional[bool] = None,
        notify_portfolio_buy: Optional[bool] = None,
        notify_portfolio_sell: Optional[bool] = None,
        notify_portfolio_rebalance: Optional[bool] = None,
        notify_watchlist_buy: Optional[bool] = None,
        notify_watchlist_sell: Optional[bool] = None,
        min_conviction_score: Optional[int] = None,
    ) -> UserPersonalTelegramConfig:
        cfg = cls.get_or_create_user_telegram_config(db, user_id)
        if chat_id is not None:
            clean_chat = chat_id.strip()
            if "web.telegram.org" in clean_chat and "#" in clean_chat:
                clean_chat = clean_chat.split("#")[-1].strip()
            elif clean_chat.startswith("https://t.me/"):
                clean_chat = "@" + clean_chat.replace("https://t.me/", "").strip().lstrip("@")
            cfg.chat_id = clean_chat

        if channel_name is not None:
            cfg.channel_name = channel_name.strip()
        if bot_token is not None:
            cfg.bot_token = bot_token.strip() if bot_token.strip() else None
        if telegram_username is not None:
            cfg.telegram_username = telegram_username.strip()
        if is_enabled is not None:
            cfg.is_enabled = is_enabled
        if notify_price_cross is not None:
            cfg.notify_price_cross = notify_price_cross
        if notify_dma_reclaim is not None:
            cfg.notify_dma_reclaim = notify_dma_reclaim
        if notify_vcp_breakout is not None:
            cfg.notify_vcp_breakout = notify_vcp_breakout
        if notify_volume_surge is not None:
            cfg.notify_volume_surge = notify_volume_surge
        if notify_target_stop is not None:
            cfg.notify_target_stop = notify_target_stop
        if notify_portfolio_buy is not None:
            cfg.notify_portfolio_buy = notify_portfolio_buy
        if notify_portfolio_sell is not None:
            cfg.notify_portfolio_sell = notify_portfolio_sell
        if notify_portfolio_rebalance is not None:
            cfg.notify_portfolio_rebalance = notify_portfolio_rebalance
        if notify_watchlist_buy is not None:
            cfg.notify_watchlist_buy = notify_watchlist_buy
        if notify_watchlist_sell is not None:
            cfg.notify_watchlist_sell = notify_watchlist_sell
        if min_conviction_score is not None:
            cfg.min_conviction_score = min_conviction_score

        cfg.updated_at = utc_now()
        db.commit()
        db.refresh(cfg)
        return cfg

    @classmethod
    def send_test_ping(
        cls,
        db: Session,
        user_id: Optional[int] = None,
        custom_chat_id: Optional[str] = None,
        custom_bot_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        cfg = cls.get_or_create_user_telegram_config(db, user_id)
        target_chat_id = (custom_chat_id or cfg.chat_id or "").strip()
        token = (custom_bot_token or cfg.bot_token or DEFAULT_PLATFORM_BOT_TOKEN).strip()

        if not target_chat_id:
            return {"success": False, "error": "No Chat ID provided. Please set your Telegram Chat ID."}

        test_msg = (
            "🔔 *Alpha India | Personal Watchlist Channel Verified*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "⚡ *Status:* Connected & Live\n"
            f"👤 *Channel:* {cfg.channel_name}\n"
            f"🎯 *Chat ID:* `{target_chat_id}`\n\n"
            "🚀 *Rule-Based Alerts Armed:*\n"
            "• Price Crossing Above / Below Targets\n"
            "• 50 DMA Reclaim & 200 DMA Support Tests\n"
            "• Minervini VCP Breakouts & Volume Surges\n\n"
            f"🕒 _Pinged at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}_\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Alpha India Institutional Radar"
        )

        res = AlertDispatchService.dispatch_telegram(
            bot_token=token,
            chat_id=target_chat_id,
            text=test_msg,
            parse_mode="Markdown",
        )
        return res

    # -------------------------------------------------------------
    # 3. Rule Evaluation & Telegram Dispatch
    # -------------------------------------------------------------
    @classmethod
    def evaluate_and_dispatch(
        cls,
        db: Session,
        symbol: str,
        cmp: float,
        day_change_pct: float = 0.0,
        volume: Optional[float] = None,
        avg_volume_20d: Optional[float] = None,
        dma_50: Optional[float] = None,
        dma_200: Optional[float] = None,
        vcp_score: Optional[int] = None,
        momentum_matches: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        clean_symbol = symbol.strip().upper()
        active_alerts = (
            db.query(WatchlistAlert)
            .filter(
                WatchlistAlert.symbol == clean_symbol,
                WatchlistAlert.is_active.is_(True),
                WatchlistAlert.status == "ACTIVE",
            )
            .all()
        )

        if not active_alerts:
            return []

        triggered_results = []

        for alert in active_alerts:
            fired = False
            rule_detail = ""

            # Check rule conditions
            if alert.rule_type == "PRICE_CROSS_ABOVE" and alert.threshold_value:
                if cmp >= alert.threshold_value:
                    fired = True
                    rule_detail = f"Price crossed above ₹{alert.threshold_value:.2f}"

            elif alert.rule_type == "PRICE_CROSS_BELOW" and alert.threshold_value:
                if cmp <= alert.threshold_value:
                    fired = True
                    rule_detail = f"Price breached below ₹{alert.threshold_value:.2f}"

            elif alert.rule_type == "DMA_50_RECLAIM" and dma_50:
                if cmp >= dma_50:
                    fired = True
                    rule_detail = f"Price reclaimed 50 DMA (₹{dma_50:.2f})"

            elif alert.rule_type == "DMA_200_BOUNCE" and dma_200:
                if cmp >= dma_200 and cmp <= (dma_200 * 1.03):
                    fired = True
                    rule_detail = f"Price testing 200 DMA support (₹{dma_200:.2f})"

            elif alert.rule_type == "VOLUME_SPIKE_2X":
                if volume and avg_volume_20d and avg_volume_20d > 0:
                    multiplier = volume / avg_volume_20d
                    threshold = alert.threshold_value or 2.0
                    if multiplier >= threshold:
                        fired = True
                        rule_detail = f"Volume surge: {multiplier:.2f}x 20D Average"

            elif alert.rule_type == "VCP_PIVOT_BREAK":
                score = vcp_score or 0
                if score >= 85 and day_change_pct > 1.5:
                    fired = True
                    rule_detail = f"Minervini VCP Pivot breakout (Score: {score})"

            elif alert.rule_type == "MOMENTUM_MATCH_9":
                matches = momentum_matches or 0
                if matches >= 9:
                    fired = True
                    rule_detail = f"Momentum Radar match {matches}/10 conditions"

            elif alert.rule_type == "PERCENT_SURGE_3":
                threshold = alert.threshold_value or 3.0
                if day_change_pct >= threshold:
                    fired = True
                    rule_detail = f"Day change surge +{day_change_pct:.2f}% >= {threshold:.2f}%"

            if fired:
                # Update alert state in DB
                alert.status = "TRIGGERED"
                alert.is_active = False
                alert.trigger_count = (alert.trigger_count or 0) + 1
                alert.last_triggered_at = utc_now()
                alert.last_triggered_price = cmp
                db.commit()

                # Dispatch to user's personalized Telegram channel if enabled
                tg_dispatched = False
                if alert.notify_telegram:
                    tg_dispatched = cls.dispatch_personal_telegram(
                        db=db,
                        alert=alert,
                        cmp=cmp,
                        day_change_pct=day_change_pct,
                        rule_detail=rule_detail,
                        dma_50=dma_50,
                        dma_200=dma_200,
                        volume=volume,
                        avg_volume_20d=avg_volume_20d,
                    )

                triggered_results.append({
                    "alert_id": alert.id,
                    "symbol": alert.symbol,
                    "rule_type": alert.rule_type,
                    "rule_detail": rule_detail,
                    "cmp": cmp,
                    "telegram_dispatched": tg_dispatched,
                })

        return triggered_results

    @classmethod
    def dispatch_personal_telegram(
        cls,
        db: Session,
        alert: WatchlistAlert,
        cmp: float,
        day_change_pct: float,
        rule_detail: str,
        dma_50: Optional[float] = None,
        dma_200: Optional[float] = None,
        volume: Optional[float] = None,
        avg_volume_20d: Optional[float] = None,
        force: bool = False,
    ) -> bool:
        user_cfg = cls.get_or_create_user_telegram_config(db, alert.user_id)
        if not user_cfg.is_enabled or not user_cfg.chat_id:
            logger.warning(f"[WatchlistAlert] User telegram not enabled or missing chat_id for user_id={alert.user_id}")
            return False

        # Categorize BUY vs SELL trigger
        is_sell_rule = alert.rule_type in ["PRICE_CROSS_BELOW", "DMA_200_BOUNCE"]
        is_buy_rule = not is_sell_rule

        # Check toggles
        if is_buy_rule and not getattr(user_cfg, "notify_watchlist_buy", True):
            logger.info(f"[WatchlistAlert] Skipping BUY rule {alert.rule_type}: notify_watchlist_buy is disabled.")
            return False
        if is_sell_rule and not getattr(user_cfg, "notify_watchlist_sell", True):
            logger.info(f"[WatchlistAlert] Skipping SELL rule {alert.rule_type}: notify_watchlist_sell is disabled.")
            return False

        # -------------------------------------------------------------
        # Deduplication Check (4-hour cooldown per symbol + rule)
        # -------------------------------------------------------------
        if not force:
            cooldown_threshold = datetime.utcnow() - timedelta(hours=4)
            recent_log = (
                db.query(AlertDispatchLog)
                .filter(
                    AlertDispatchLog.channel == "TELEGRAM",
                    AlertDispatchLog.recipient == user_cfg.chat_id,
                    AlertDispatchLog.symbol == alert.symbol,
                    AlertDispatchLog.status == "SUCCESS",
                    AlertDispatchLog.dispatched_at >= cooldown_threshold,
                    AlertDispatchLog.payload_preview.ilike(f"%{alert.rule_type}%"),
                )
                .first()
            )
            if recent_log:
                logger.info(
                    f"[WatchlistAlert] Suppressing duplicate alert for {alert.symbol} ({alert.rule_type}): "
                    f"sent at {recent_log.dispatched_at}"
                )
                return False

        # Find watchlist conviction and thesis note
        wl_item = (
            db.query(WatchlistItem)
            .filter(
                WatchlistItem.watchlist_id == alert.watchlist_id,
                WatchlistItem.symbol == alert.symbol,
            )
            .first()
        )
        conf_stars_count = wl_item.confidence_score if wl_item and wl_item.confidence_score else 3
        conviction_stars = "⭐" * conf_stars_count
        score = conf_stars_count * 20
        score_tier = "ELITE" if score >= 90 else ("HIGH CONVICTION" if score >= 80 else "WATCHLIST SETUP")
        thesis_note = (alert.notes or (wl_item.comment if wl_item else "") or "High conviction watchlist setup.").strip()

        change_sign = "+" if day_change_pct >= 0 else ""
        vol_text = "N/A"
        if volume and avg_volume_20d and avg_volume_20d > 0:
            vol_mult = volume / avg_volume_20d
            vol_text = f"{vol_mult:.2f}x 20D Avg"

        header_icon = "🔴 *ALPHA INDIA | WATCHLIST SELL TRIGGER*" if is_sell_rule else "🟢 *ALPHA INDIA | WATCHLIST BUY TRIGGER*"
        trigger_label = "Exit Trigger Level" if is_sell_rule else "Buy Trigger Price"

        # Price Matrix Levels
        if alert.threshold_value:
            trigger_price = alert.threshold_value
        elif alert.rule_type == "DMA_50_RECLAIM" and dma_50:
            trigger_price = dma_50
        elif alert.rule_type == "DMA_200_BOUNCE" and dma_200:
            trigger_price = dma_200
        else:
            trigger_price = cmp

        target_price = round(cmp * 1.15, 2)
        stop_loss = round(cmp * 0.93, 2)
        upside_pct = round(((target_price - cmp) / max(0.01, cmp)) * 100, 1)
        downside_pct = round(((cmp - stop_loss) / max(0.01, cmp)) * 100, 1)
        risk_reward = round(abs(target_price - cmp) / max(0.01, abs(cmp - stop_loss)), 1)

        links_block = AlertDispatchService.get_stock_links(alert.symbol)

        msg = (
            f"{header_icon}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚡ *Rule Fired:* `{rule_detail}`\n"
            f"🏢 *Stock:* *{alert.symbol} (NSE)*\n"
            f"⭐ *Setup Score:* {score}/100 ({score_tier} {conviction_stars})\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 *Live CMP:* ₹{cmp:,.2f} ({change_sign}{day_change_pct:.2f}%)\n"
            f"🎯 *{trigger_label}:* ₹{trigger_price:,.2f}\n"
            f"🚀 *Target Price:* ₹{target_price:,.2f} (+{upside_pct}%)\n"
            f"🛑 *Stop Loss:* ₹{stop_loss:,.2f} (-{downside_pct}%)\n"
            f"⚖️ *Risk:Reward:* 1:{risk_reward:.1f}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📊 *Technical Parameters:*\n"
        )
        if dma_50:
            msg += f"• 50 DMA: ₹{dma_50:,.2f}\n"
        if dma_200:
            msg += f"• 200 DMA: ₹{dma_200:,.2f}\n"
        if vol_text != "N/A":
            msg += f"• Relative Volume: {vol_text}\n"

        msg += (
            f"\n📝 *Your Thesis Plan:*\n"
            f"_{thesis_note}_\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{links_block}\n\n"
            f"🔒 _Dispatched to Dedicated Portfolio & Watchlist Channel_\n"
            f"🕒 _{datetime.now().strftime('%H:%M:%S IST')} • Alpha India Radar_\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        )

        token = user_cfg.bot_token or DEFAULT_PLATFORM_BOT_TOKEN
        res = AlertDispatchService.dispatch_telegram(
            bot_token=token,
            chat_id=user_cfg.chat_id,
            text=msg,
            parse_mode="Markdown",
        )

        if res.get("success"):
            user_cfg.last_dispatched_at = utc_now()
            user_cfg.total_dispatched_count = (user_cfg.total_dispatched_count or 0) + 1
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=user_cfg.chat_id,
                symbol=alert.symbol,
                payload_preview=f"[{alert.rule_type}] {msg[:250]}",
                status="SUCCESS",
            )
            db.commit()
            logger.info(f"[WatchlistAlert] Dispatched personal Telegram alert for {alert.symbol} to chat_id={user_cfg.chat_id}")
            return True
        else:
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=user_cfg.chat_id,
                symbol=alert.symbol,
                payload_preview=f"[{alert.rule_type}] {msg[:250]}",
                status="FAILED",
                error_message=res.get("error"),
            )
            db.commit()
            logger.error(f"[WatchlistAlert] Personal Telegram dispatch failed: {res.get('error')}")
            return False
