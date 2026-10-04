"""
Alpha India - Watchlist Alert Service
Handles rule trigger evaluation, in-app alert lifecycle,
and personalized Telegram broadcast channel delivery.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import json
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import utc_now
from app.models.watchlist import Watchlist, WatchlistItem
from app.models.portfolio import Portfolio, PortfolioHolding
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.watchlist_alert import WatchlistAlert, UserPersonalTelegramConfig
from app.models.notification import AlertChannelConfig, AlertDispatchLog
from app.services.alert_dispatch_service import AlertDispatchService

logger = logging.getLogger(__name__)

# Fallback bot token if user doesn't provide their own bot
DEFAULT_PLATFORM_BOT_TOKEN = "8864485951:AAG7HHDh0KOQ-GXFo9N51CwVxvQ7_g4UPks"


class WatchlistAlertService:
    # -------------------------------------------------------------
    # 1. Alert CRUD & Scoped Operations
    # -------------------------------------------------------------
    @classmethod
    def create_scoped_alert(
        cls,
        db: Session,
        target_scope: str = "STOCK",  # "STOCK", "WATCHLIST", "PORTFOLIO", "ALL_SCREENERS"
        symbol: Optional[str] = None,
        watchlist_id: Optional[int] = None,
        portfolio_id: Optional[int] = None,
        target_name: Optional[str] = None,
        rule_type: str = "PRICE_CROSS_ABOVE",
        signal_direction: str = "BUY",
        threshold_value: Optional[float] = None,
        timeframe: str = "1D",
        notes: Optional[str] = None,
        notify_in_app: bool = True,
        notify_telegram: bool = True,
        user_id: Optional[int] = None,
    ) -> WatchlistAlert:
        clean_symbol = (symbol or ("ALL" if target_scope != "STOCK" else "TCS")).strip().upper()

        resolved_name = target_name
        if not resolved_name:
            if target_scope == "STOCK":
                resolved_name = clean_symbol
            elif target_scope == "WATCHLIST" and watchlist_id:
                wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
                resolved_name = f"Watchlist: {wl.name}" if wl else f"Watchlist #{watchlist_id}"
            elif target_scope == "PORTFOLIO" and portfolio_id:
                port = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
                resolved_name = f"Portfolio: {port.name}" if port else f"Portfolio #{portfolio_id}"
            elif target_scope == "ALL_SCREENERS":
                resolved_name = "All Institutional Screeners"
            else:
                resolved_name = clean_symbol

        alert = WatchlistAlert(
            target_scope=target_scope,
            watchlist_id=watchlist_id,
            portfolio_id=portfolio_id,
            target_name=resolved_name,
            user_id=user_id,
            symbol=clean_symbol,
            rule_type=rule_type,
            signal_direction=signal_direction.upper() if signal_direction else "BUY",
            threshold_value=threshold_value,
            timeframe=timeframe,
            notes=notes,
            notify_in_app=notify_in_app,
            notify_telegram=notify_telegram,
            is_active=True,
            status="ACTIVE",
            trigger_count=0,
            triggered_stocks="[]",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        logger.info(
            f"[WatchlistAlert] Created scoped alert id={alert.id} ({target_scope}:{resolved_name}) "
            f"{rule_type} [{signal_direction}]"
        )
        return alert

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
        """Legacy helper for single watchlist stock alert creation."""
        return cls.create_scoped_alert(
            db=db,
            target_scope="STOCK",
            symbol=symbol,
            watchlist_id=watchlist_id,
            rule_type=rule_type,
            signal_direction="SELL" if "BELOW" in rule_type or "STOP" in rule_type else "BUY",
            threshold_value=threshold_value,
            user_id=user_id,
            timeframe=timeframe,
            notes=notes,
            notify_in_app=notify_in_app,
            notify_telegram=notify_telegram,
        )

    @classmethod
    def get_all_alerts(
        cls,
        db: Session,
        user_id: Optional[int] = None,
        target_scope: Optional[str] = None,
        status: Optional[str] = None,
        signal_direction: Optional[str] = None,
        rule_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = db.query(WatchlistAlert)
        if user_id:
            query = query.filter(or_(WatchlistAlert.user_id == user_id, WatchlistAlert.user_id.is_(None)))
        if target_scope and target_scope != "ALL":
            query = query.filter(WatchlistAlert.target_scope == target_scope.upper())
        if status and status != "ALL":
            query = query.filter(WatchlistAlert.status == status.upper())
        if signal_direction and signal_direction != "ALL":
            query = query.filter(WatchlistAlert.signal_direction == signal_direction.upper())
        if rule_type:
            query = query.filter(WatchlistAlert.rule_type == rule_type)

        alerts = query.order_by(WatchlistAlert.created_at.desc()).all()

        total = len(alerts)
        active = sum(1 for a in alerts if a.is_active and a.status == "ACTIVE")
        buy_count = sum(1 for a in alerts if (a.signal_direction or "BUY") == "BUY")
        sell_count = sum(1 for a in alerts if a.signal_direction == "SELL")
        total_triggers = sum(a.trigger_count or 0 for a in alerts)

        # Collect unique triggered stocks & triggered records across alerts
        all_triggered_symbols = set()
        for a in alerts:
            if a.triggered_stocks:
                try:
                    for ev in json.loads(a.triggered_stocks):
                        if ev.get("symbol"):
                            all_triggered_symbols.add(ev["symbol"])
                except Exception:
                    pass

        return {
            "success": True,
            "count": total,
            "alerts": [a.to_dict() for a in alerts],
            "summary": {
                "total_alerts": total,
                "active_alerts": active,
                "buy_alerts_count": buy_count,
                "sell_alerts_count": sell_count,
                "total_triggers_fired": total_triggers,
                "unique_triggered_stocks_count": len(all_triggered_symbols),
                "unique_triggered_stocks": sorted(list(all_triggered_symbols)),
            },
        }

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
        dma_9: Optional[float] = None,
        dma_20: Optional[float] = None,
        dma_50: Optional[float] = None,
        dma_200: Optional[float] = None,
        vcp_score: Optional[int] = None,
        momentum_matches: Optional[int] = None,
        delivery_pct: Optional[float] = None,
        supertrend_direction: Optional[str] = None,
        supertrend_val: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        clean_symbol = symbol.strip().upper()

        # Auto-fill missing DMAs from screener records if available
        if (dma_50 is None or dma_200 is None) and clean_symbol:
            rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == clean_symbol).first()
            if rec:
                if dma_50 is None and rec.dma_50:
                    dma_50 = rec.dma_50
                if dma_200 is None and rec.dma_200:
                    dma_200 = rec.dma_200

        # 1. Direct stock alerts
        direct_alerts = (
            db.query(WatchlistAlert)
            .filter(
                WatchlistAlert.symbol == clean_symbol,
                WatchlistAlert.is_active.is_(True),
                WatchlistAlert.status == "ACTIVE",
            )
            .all()
        )

        # 2. Watchlist-scoped alerts
        wl_ids = [
            item.watchlist_id
            for item in db.query(WatchlistItem.watchlist_id)
            .filter(WatchlistItem.symbol == clean_symbol)
            .all()
        ]
        wl_alerts = []
        if wl_ids:
            wl_alerts = (
                db.query(WatchlistAlert)
                .filter(
                    WatchlistAlert.target_scope == "WATCHLIST",
                    WatchlistAlert.watchlist_id.in_(wl_ids),
                    WatchlistAlert.is_active.is_(True),
                    WatchlistAlert.status == "ACTIVE",
                )
                .all()
            )

        # 3. Portfolio-scoped alerts
        port_ids = [
            h.portfolio_id
            for h in db.query(PortfolioHolding.portfolio_id)
            .filter(PortfolioHolding.symbol == clean_symbol)
            .all()
        ]
        port_alerts = []
        if port_ids:
            port_alerts = (
                db.query(WatchlistAlert)
                .filter(
                    WatchlistAlert.target_scope == "PORTFOLIO",
                    WatchlistAlert.portfolio_id.in_(port_ids),
                    WatchlistAlert.is_active.is_(True),
                    WatchlistAlert.status == "ACTIVE",
                )
                .all()
            )

        # 4. Platform-wide screener alerts
        screener_alerts = (
            db.query(WatchlistAlert)
            .filter(
                WatchlistAlert.target_scope == "ALL_SCREENERS",
                WatchlistAlert.is_active.is_(True),
                WatchlistAlert.status == "ACTIVE",
            )
            .all()
        )

        # Combine deduplicated candidates
        candidates_map = {a.id: a for a in (direct_alerts + wl_alerts + port_alerts + screener_alerts)}
        active_alerts = list(candidates_map.values())

        if not active_alerts:
            return []

        triggered_results = []

        for alert in active_alerts:
            fired = False
            rule_detail = ""

            # Check rule conditions across all institutional screener, DMA, and Supertrend rules:
            # ─────────────────────────────────────────────────────────────
            # 🟢 BUY Signals (Reclaims, Bullish Crossovers, Supertrend UP)
            # ─────────────────────────────────────────────────────────────
            if alert.rule_type == "PRICE_CROSS_ABOVE" and alert.threshold_value:
                if cmp >= alert.threshold_value:
                    fired = True
                    rule_detail = f"Price crossed above target ₹{alert.threshold_value:,.2f}"

            # 9 DMA Reclaim (Down to Up)
            elif alert.rule_type in ("DMA_9_RECLAIM", "PRICE_CROSS_ABOVE_DMA_9"):
                thresh = alert.threshold_value or dma_9
                if thresh and cmp >= thresh:
                    fired = True
                    rule_detail = f"9-DMA Bullish Reclaim: price crossed above ₹{thresh:,.2f}"
                elif not thresh and day_change_pct >= 0.8:
                    fired = True
                    rule_detail = f"9-DMA Momentum Reclaim confirmed (+{day_change_pct:.2f}%)"

            # 20 DMA Reclaim (Down to Up)
            elif alert.rule_type in ("DMA_20_RECLAIM", "PRICE_CROSS_ABOVE_DMA_20"):
                thresh = alert.threshold_value or dma_20
                if thresh and cmp >= thresh:
                    fired = True
                    rule_detail = f"20-DMA Bullish Reclaim: price crossed above ₹{thresh:,.2f}"
                elif not thresh and day_change_pct >= 1.0:
                    fired = True
                    rule_detail = f"20-DMA Swing Base Reclaim confirmed (+{day_change_pct:.2f}%)"

            # 50 DMA Reclaim (Down to Up)
            elif alert.rule_type in ("DMA_50_RECLAIM", "PRICE_CROSS_ABOVE_DMA_50"):
                thresh = alert.threshold_value or dma_50
                if thresh and cmp >= thresh:
                    fired = True
                    rule_detail = f"50-DMA Institutional Reclaim: price crossed above ₹{thresh:,.2f}"
                elif not thresh and dma_50 and cmp >= dma_50:
                    fired = True
                    rule_detail = f"Bullish reclaim of 50-DMA (₹{dma_50:,.2f})"

            # 200 DMA Reclaim / Bounce (Down to Up)
            elif alert.rule_type in ("DMA_200_RECLAIM", "PRICE_CROSS_ABOVE_DMA_200", "DMA_200_BOUNCE"):
                thresh = alert.threshold_value or dma_200
                if thresh and cmp >= thresh:
                    fired = True
                    rule_detail = f"Macro 200-DMA regime reclaim & bounce (₹{thresh:,.2f})"

            # ── Moving Average vs Moving Average Bullish Crossovers (Down to Up) ──
            elif alert.rule_type in ("DMA_9_CROSS_ABOVE_20", "MA_9_20_BULLISH_CROSS"):
                if dma_9 and dma_20 and dma_9 >= dma_20:
                    fired = True
                    rule_detail = f"9-DMA (₹{dma_9:,.2f}) crossed ABOVE 20-DMA (₹{dma_20:,.2f}) [Fast Trend Spark]"
                elif day_change_pct >= 1.5:
                    fired = True
                    rule_detail = f"9/20 DMA Bullish Crossover triggered (+{day_change_pct:.2f}% day surge)"

            elif alert.rule_type in ("DMA_20_CROSS_ABOVE_50", "MA_20_50_BULLISH_CROSS"):
                if dma_20 and dma_50 and dma_20 >= dma_50:
                    fired = True
                    rule_detail = f"20-DMA (₹{dma_20:,.2f}) crossed ABOVE 50-DMA (₹{dma_50:,.2f}) [Medium-Term Bullish Pivot]"
                elif day_change_pct >= 2.0:
                    fired = True
                    rule_detail = f"20/50 DMA Bullish Trend Crossover triggered"

            elif alert.rule_type in ("GOLDEN_CROSS", "DMA_50_CROSS_ABOVE_200"):
                if dma_50 and dma_200 and dma_50 >= dma_200:
                    fired = True
                    rule_detail = f"Golden Cross: 50-DMA (₹{dma_50:,.1f}) crossed ABOVE 200-DMA (₹{dma_200:,.1f})"

            elif alert.rule_type in ("DMA_9_CROSS_ABOVE_50", "MA_9_50_BULLISH_CROSS"):
                if dma_9 and dma_50 and dma_9 >= dma_50:
                    fired = True
                    rule_detail = f"9-DMA (₹{dma_9:,.2f}) crossed ABOVE 50-DMA (₹{dma_50:,.2f}) [Momentum Reclaim]"
                elif day_change_pct >= 1.8:
                    fired = True
                    rule_detail = f"9/50 DMA Bullish Crossover triggered"

            # ── Supertrend Bullish / UP Signal (10, 3) ──
            elif alert.rule_type in ("SUPERTREND_BUY", "SUPERTREND_UP", "SUPERTREND_BULLISH_FLIP"):
                st_green = (
                    supertrend_direction in ("BUY", "UP", "BULLISH_GREEN", "1", 1)
                    or (supertrend_val and cmp >= supertrend_val)
                    or (day_change_pct >= 0.8)
                )
                if st_green:
                    fired = True
                    st_suffix = f" (ST Line: ₹{supertrend_val:,.2f})" if supertrend_val else ""
                    rule_detail = f"Supertrend (10, 3) turned Bullish Green at ₹{cmp:,.2f}{st_suffix}"

            # Institutional Screener setups
            elif alert.rule_type in ("VCP_PIVOT_BREAK", "MINERVINI_VCP"):
                score = vcp_score or 0
                threshold = alert.threshold_value or 85.0
                if score >= threshold:
                    fired = True
                    rule_detail = f"Minervini VCP breakout trigger (Institutional Score: {score}/100)"

            elif alert.rule_type in ("PRE_BREAKOUT_COIL", "PRE_BREAKOUT"):
                score = vcp_score or 0
                if score >= 80:
                    fired = True
                    rule_detail = f"Pre-Breakout A+ Super Coil cheat entry armed (Score: {score}/100)"

            elif alert.rule_type in ("MOMENTUM_CONFLUENCE", "MOMENTUM_MATCH_9"):
                matches = momentum_matches or 0
                threshold = int(alert.threshold_value) if alert.threshold_value else 8
                if matches >= threshold:
                    fired = True
                    rule_detail = f"Multi-timeframe Momentum Confluence: {matches}/10 conditions met"

            elif alert.rule_type in ("TOMORROW_5PCT_RADAR", "TOMORROW_RADAR"):
                score = vcp_score or 0
                if score >= 85 and day_change_pct > 0.3:
                    fired = True
                    rule_detail = f"Tomorrow 5%+ Move Radar ignition (NR7 squeeze coil)"

            elif alert.rule_type in ("TECHNO_FUNDA_PIVOT", "TECHNO_FUNDA"):
                score = vcp_score or 0
                if score >= 85:
                    fired = True
                    rule_detail = f"Techno-Funda growth breakout trigger (Score: {score}/100)"

            elif alert.rule_type in ("DELIVERY_SPIKE_BREAKOUT", "DELIVERY_SURGE"):
                deliv = delivery_pct or 0.0
                if deliv >= 50.0 and volume and avg_volume_20d and (volume / avg_volume_20d >= 1.8):
                    fired = True
                    rule_detail = f"High delivery float lock ({deliv:.1f}%) with {(volume / avg_volume_20d):.1f}x surge"

            elif alert.rule_type == "MF_SMART_MONEY":
                score = vcp_score or 85
                if score >= 80:
                    fired = True
                    rule_detail = f"Institutional mutual fund fresh accumulation detected"

            elif alert.rule_type == "PEAD_EARNINGS_SURPRISE":
                if day_change_pct >= 3.0:
                    fired = True
                    rule_detail = f"Athena PEAD earnings flash breakout (+{day_change_pct:.2f}% gap)"

            elif alert.rule_type == "ORDER_WIN_CATALYST":
                fired = True
                rule_detail = f"Institutional Order Win catalyst trigger"

            elif alert.rule_type == "VOLUME_SPIKE_2X":
                if volume and avg_volume_20d and avg_volume_20d > 0:
                    multiplier = volume / avg_volume_20d
                    threshold = alert.threshold_value or 2.0
                    if multiplier >= threshold:
                        fired = True
                        rule_detail = f"Volume surge: {multiplier:.2f}x 20D Average"

            elif alert.rule_type == "PERCENT_SURGE_3":
                threshold = alert.threshold_value or 3.0
                if day_change_pct >= threshold:
                    fired = True
                    rule_detail = f"Day change surge +{day_change_pct:.2f}% >= {threshold:.2f}%"

            # ─────────────────────────────────────────────────────────────
            # 🔴 SELL / Risk / Exit Signals (Breakdowns, Bearish Crossovers, Supertrend DOWN)
            # ─────────────────────────────────────────────────────────────
            elif alert.rule_type in ("PRICE_CROSS_BELOW", "STOP_LOSS_BREACH") and alert.threshold_value:
                if cmp <= alert.threshold_value:
                    fired = True
                    rule_detail = f"Stop-Loss breached: price fell below ₹{alert.threshold_value:,.2f}"

            elif alert.rule_type == "TRAILING_STOP_BREACH" and alert.threshold_value:
                if cmp <= alert.threshold_value:
                    fired = True
                    rule_detail = f"Trailing stop-loss breached at ₹{alert.threshold_value:,.2f}"

            elif alert.rule_type == "TARGET_PROFIT_BOOK" and alert.threshold_value:
                if cmp >= alert.threshold_value:
                    fired = True
                    rule_detail = f"Profit booking target reached: ₹{alert.threshold_value:,.2f}"

            # 9 DMA Breakdown (Up to Down)
            elif alert.rule_type in ("DMA_9_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_9"):
                thresh = alert.threshold_value or dma_9
                if thresh and cmp < thresh:
                    fired = True
                    rule_detail = f"9-DMA Breakdown: price dropped below ₹{thresh:,.2f}"
                elif not thresh and day_change_pct <= -1.2:
                    fired = True
                    rule_detail = f"9-DMA Fast Momentum Breakdown (-{abs(day_change_pct):.2f}%)"

            # 20 DMA Breakdown (Up to Down)
            elif alert.rule_type in ("DMA_20_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_20"):
                thresh = alert.threshold_value or dma_20
                if thresh and cmp < thresh:
                    fired = True
                    rule_detail = f"20-DMA Breakdown: price dropped below ₹{thresh:,.2f}"
                elif not thresh and day_change_pct <= -1.8:
                    fired = True
                    rule_detail = f"20-DMA Swing Support Floor Breakdown (-{abs(day_change_pct):.2f}%)"

            # 50 DMA Breakdown (Up to Down)
            elif alert.rule_type in ("DMA_50_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_50"):
                thresh = alert.threshold_value or dma_50
                if thresh and cmp < thresh:
                    fired = True
                    rule_detail = f"50-DMA Institutional Breakdown: price closed below ₹{thresh:,.2f}"
                elif not thresh and dma_50 and cmp < dma_50:
                    fired = True
                    rule_detail = f"50-DMA breakdown: price closed below ₹{dma_50:,.2f}"

            # 200 DMA Breakdown (Up to Down)
            elif alert.rule_type in ("DMA_200_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_200"):
                thresh = alert.threshold_value or dma_200
                if thresh and cmp < thresh:
                    fired = True
                    rule_detail = f"Macro 200-DMA Regime Breakdown: closed below ₹{thresh:,.2f}"

            # ── Moving Average vs Moving Average Bearish Crossovers (Up to Down) ──
            elif alert.rule_type in ("DMA_9_CROSS_BELOW_20", "MA_9_20_BEARISH_CROSS"):
                if dma_9 and dma_20 and dma_9 < dma_20:
                    fired = True
                    rule_detail = f"9-DMA (₹{dma_9:,.2f}) crossed BELOW 20-DMA (₹{dma_20:,.2f}) [Momentum Exit Pullback]"
                elif day_change_pct <= -1.5:
                    fired = True
                    rule_detail = f"9/20 DMA Bearish Pullback triggered (-{abs(day_change_pct):.2f}%)"

            elif alert.rule_type in ("DMA_20_CROSS_BELOW_50", "MA_20_50_BEARISH_CROSS"):
                if dma_20 and dma_50 and dma_20 < dma_50:
                    fired = True
                    rule_detail = f"20-DMA (₹{dma_20:,.2f}) crossed BELOW 50-DMA (₹{dma_50:,.2f}) [Medium-Term Trend Breakdown]"
                elif day_change_pct <= -2.0:
                    fired = True
                    rule_detail = f"20/50 DMA Bearish Breakdown triggered"

            elif alert.rule_type in ("DEATH_CROSS", "DMA_50_CROSS_BELOW_200"):
                if dma_50 and dma_200 and dma_50 < dma_200:
                    fired = True
                    rule_detail = f"Death Cross: 50-DMA (₹{dma_50:,.1f}) crossed BELOW 200-DMA (₹{dma_200:,.1f})"

            elif alert.rule_type in ("DMA_9_CROSS_BELOW_50", "MA_9_50_BEARISH_CROSS"):
                if dma_9 and dma_50 and dma_9 < dma_50:
                    fired = True
                    rule_detail = f"9-DMA (₹{dma_9:,.2f}) crossed BELOW 50-DMA (₹{dma_50:,.2f}) [Intermediate Breakdown]"
                elif day_change_pct <= -2.0:
                    fired = True
                    rule_detail = f"9/50 DMA Bearish Breakdown triggered"

            # ── Supertrend Bearish / DOWN Signal (10, 3) ──
            elif alert.rule_type in ("SUPERTREND_SELL", "SUPERTREND_DOWN", "SUPERTREND_BEARISH_FLIP"):
                st_red = (
                    supertrend_direction in ("SELL", "DOWN", "BEARISH_RED", "-1", -1)
                    or (supertrend_val and cmp < supertrend_val)
                    or (day_change_pct <= -1.5)
                )
                if st_red:
                    fired = True
                    st_suffix = f" (ST Line: ₹{supertrend_val:,.2f})" if supertrend_val else ""
                    rule_detail = f"Supertrend (10, 3) turned Bearish Red (Exit Signal at ₹{cmp:,.2f}){st_suffix}"

            elif alert.rule_type in ("DISTRIBUTION_DAY", "DISTRIBUTION_DAY_SPIKE"):
                if day_change_pct <= -1.8 and volume and avg_volume_20d and (volume / avg_volume_20d >= 1.8):
                    fired = True
                    rule_detail = f"Heavy distribution day: -{abs(day_change_pct):.2f}% on {(volume / avg_volume_20d):.1f}x vol"

            elif alert.rule_type == "PEAD_EARNINGS_MISS":
                if day_change_pct <= -3.5:
                    fired = True
                    rule_detail = f"PEAD earnings miss breakdown (-{abs(day_change_pct):.2f}%)"

            if fired:
                # Update alert state & triggered stocks history
                alert.trigger_count = (alert.trigger_count or 0) + 1
                alert.last_triggered_at = utc_now()
                alert.last_triggered_price = cmp

                # Append to triggered_stocks JSON history
                stocks_history = []
                if alert.triggered_stocks:
                    try:
                        stocks_history = json.loads(alert.triggered_stocks)
                    except Exception:
                        stocks_history = []
                
                stocks_history.insert(0, {
                    "symbol": clean_symbol,
                    "price": round(cmp, 2),
                    "rule_detail": rule_detail,
                    "triggered_at": datetime.utcnow().strftime("%d %b %Y, %H:%M UTC"),
                })
                alert.triggered_stocks = json.dumps(stocks_history[:40])

                # If single stock specific, mark TRIGGERED.
                # If Watchlist, Portfolio, or Platform Screener, keep ACTIVE so it monitors other stocks!
                if (alert.target_scope or "STOCK") == "STOCK":
                    alert.status = "TRIGGERED"
                    alert.is_active = False
                else:
                    alert.status = "ACTIVE"
                    alert.is_active = True

                db.commit()

                # Dispatch to user's personalized Telegram channel if enabled
                tg_dispatched = False
                if alert.notify_telegram:
                    tg_dispatched = cls.dispatch_personal_telegram(
                        db=db,
                        alert=alert,
                        symbol=clean_symbol,
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
                    "target_scope": alert.target_scope or "STOCK",
                    "target_name": alert.target_name,
                    "symbol": clean_symbol,
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
        symbol: str,
        cmp: float,
        day_change_pct: float,
        rule_detail: str,
        dma_9: Optional[float] = None,
        dma_20: Optional[float] = None,
        dma_50: Optional[float] = None,
        dma_200: Optional[float] = None,
        supertrend_val: Optional[float] = None,
        volume: Optional[float] = None,
        avg_volume_20d: Optional[float] = None,
        force: bool = False,
    ) -> bool:
        user_cfg = cls.get_or_create_user_telegram_config(db, alert.user_id)
        if not user_cfg.is_enabled or not user_cfg.chat_id:
            logger.warning(f"[WatchlistAlert] User telegram not enabled or missing chat_id for user_id={alert.user_id}")
            return False

        # Categorize BUY vs SELL trigger
        is_sell_rule = (alert.signal_direction == "SELL") or (
            alert.rule_type in [
                "PRICE_CROSS_BELOW", "STOP_LOSS_BREACH", "TRAILING_STOP_BREACH",
                "DMA_9_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_9",
                "DMA_20_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_20",
                "DMA_50_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_50",
                "DMA_200_BREAKDOWN", "PRICE_CROSS_BELOW_DMA_200",
                "DMA_9_CROSS_BELOW_20", "DMA_20_CROSS_BELOW_50",
                "DEATH_CROSS", "DMA_50_CROSS_BELOW_200", "DMA_9_CROSS_BELOW_50",
                "SUPERTREND_SELL", "SUPERTREND_DOWN", "SUPERTREND_BEARISH_FLIP",
                "DISTRIBUTION_DAY", "DISTRIBUTION_DAY_SPIKE", "PEAD_EARNINGS_MISS"
            ]
        )
        is_buy_rule = not is_sell_rule

        # Check toggles
        if is_buy_rule and not getattr(user_cfg, "notify_watchlist_buy", True):
            logger.info(f"[WatchlistAlert] Skipping BUY rule {alert.rule_type}: notify_watchlist_buy is disabled.")
            return False
        if is_sell_rule and not getattr(user_cfg, "notify_watchlist_sell", True):
            logger.info(f"[WatchlistAlert] Skipping SELL rule {alert.rule_type}: notify_watchlist_sell is disabled.")
            return False

        # Deduplication Check (4-hour cooldown per symbol + rule)
        if not force:
            cooldown_threshold = datetime.utcnow() - timedelta(hours=4)
            recent_log = (
                db.query(AlertDispatchLog)
                .filter(
                    AlertDispatchLog.channel == "TELEGRAM",
                    AlertDispatchLog.recipient == user_cfg.chat_id,
                    AlertDispatchLog.symbol == symbol,
                    AlertDispatchLog.status == "SUCCESS",
                    AlertDispatchLog.dispatched_at >= cooldown_threshold,
                    AlertDispatchLog.payload_preview.ilike(f"%{alert.rule_type}%"),
                )
                .first()
            )
            if recent_log:
                logger.info(
                    f"[WatchlistAlert] Suppressing duplicate alert for {symbol} ({alert.rule_type}): "
                    f"sent at {recent_log.dispatched_at}"
                )
                return False

        # Find conviction and thesis note
        conf_stars_count = 4
        if alert.watchlist_id:
            wl_item = (
                db.query(WatchlistItem)
                .filter(
                    WatchlistItem.watchlist_id == alert.watchlist_id,
                    WatchlistItem.symbol == symbol,
                )
                .first()
            )
            if wl_item and wl_item.confidence_score:
                conf_stars_count = wl_item.confidence_score

        conviction_stars = "⭐" * conf_stars_count
        score = conf_stars_count * 20
        score_tier = "ELITE" if score >= 90 else ("HIGH CONVICTION" if score >= 80 else "WATCHLIST SETUP")
        thesis_note = (alert.notes or "Institutional rule condition triggered.").strip()

        change_sign = "+" if day_change_pct >= 0 else ""
        vol_text = "N/A"
        if volume and avg_volume_20d and avg_volume_20d > 0:
            vol_mult = volume / avg_volume_20d
            vol_text = f"{vol_mult:.2f}x 20D Avg"

        header_icon = "🔴 *ALPHA INDIA | EXIT / SELL TRIGGER*" if is_sell_rule else "🟢 *ALPHA INDIA | BREAKOUT / BUY TRIGGER*"
        trigger_label = "Exit Trigger Level" if is_sell_rule else "Buy Trigger Price"

        # Price Matrix Levels
        if alert.threshold_value:
            trigger_price = alert.threshold_value
        elif "DMA_9" in alert.rule_type and dma_9:
            trigger_price = dma_9
        elif "DMA_20" in alert.rule_type and dma_20:
            trigger_price = dma_20
        elif "DMA_50" in alert.rule_type and dma_50:
            trigger_price = dma_50
        elif "DMA_200" in alert.rule_type and dma_200:
            trigger_price = dma_200
        elif "SUPERTREND" in alert.rule_type and supertrend_val:
            trigger_price = supertrend_val
        else:
            trigger_price = cmp

        target_price = round(cmp * 1.15, 2)
        stop_loss = round(cmp * 0.93, 2)
        upside_pct = round(((target_price - cmp) / max(0.01, cmp)) * 100, 1)
        downside_pct = round(((cmp - stop_loss) / max(0.01, cmp)) * 100, 1)
        risk_reward = round(abs(target_price - cmp) / max(0.01, abs(cmp - stop_loss)), 1)

        links_block = AlertDispatchService.get_stock_links(symbol)

        scope_desc = f"📍 Single Stock: `{symbol}`"
        if alert.target_scope == "WATCHLIST":
            scope_desc = f"📋 Watchlist: *{alert.target_name or 'Watchlist'}*"
        elif alert.target_scope == "PORTFOLIO":
            scope_desc = f"💼 Portfolio: *{alert.target_name or 'Portfolio'}*"
        elif alert.target_scope == "ALL_SCREENERS":
            scope_desc = "⚡ Platform Screeners Universe"

        msg = (
            f"{header_icon}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚡ *Rule Fired:* `{rule_detail}`\n"
            f"🏢 *Stock:* *{symbol} (NSE)*\n"
            f"🎯 *Scope:* {scope_desc}\n"
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
        if dma_9:
            msg += f"• *9 DMA:* ₹{dma_9:,.2f} ({'+' if cmp >= dma_9 else ''}{((cmp - dma_9)/dma_9)*100:.1f}%)\n"
        if dma_20:
            msg += f"• *20 DMA:* ₹{dma_20:,.2f} ({'+' if cmp >= dma_20 else ''}{((cmp - dma_20)/dma_20)*100:.1f}%)\n"
        if dma_50:
            msg += f"• *50 DMA:* ₹{dma_50:,.2f} ({'+' if cmp >= dma_50 else ''}{((cmp - dma_50)/dma_50)*100:.1f}%)\n"
        if dma_200:
            msg += f"• *200 DMA:* ₹{dma_200:,.2f} ({'+' if cmp >= dma_200 else ''}{((cmp - dma_200)/dma_200)*100:.1f}%)\n"
        if supertrend_val:
            msg += f"• *Supertrend (10, 3):* ₹{supertrend_val:,.2f}\n"
        if volume and avg_volume_20d:
            msg += f"• *Volume Spike:* {vol_text}\n"

        msg += (
            f"💡 *Trade Plan / Thesis:*\n{thesis_note}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{links_block}\n"
            f"📡 _Dispatched to {user_cfg.channel_name}_"
        )

        token = user_cfg.bot_token or DEFAULT_PLATFORM_BOT_TOKEN
        res = AlertDispatchService.dispatch_telegram(
            bot_token=token,
            chat_id=user_cfg.chat_id,
            text=msg,
            parse_mode="Markdown",
        )
        success = res.get("success", False)

        # Log dispatch in AlertDispatchLog
        log_entry = AlertDispatchLog(
            channel="TELEGRAM",
            recipient=user_cfg.chat_id,
            symbol=symbol,
            payload_preview=msg[:250],
            status="SUCCESS" if success else "FAILED",
            error_message=res.get("error") if not success else None,
            dispatched_at=datetime.utcnow(),
        )
        db.add(log_entry)

        if success:
            user_cfg.last_dispatched_at = utc_now()
            user_cfg.total_dispatched_count = (user_cfg.total_dispatched_count or 0) + 1
        db.commit()

        return success

