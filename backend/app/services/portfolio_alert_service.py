"""
Alpha India - Portfolio Alert Service
Dedicated Institutional BUY & SELL Signal Engine for Portfolio Intelligence and Watchlist.
Dispatches high-conviction trade alerts to a separate, private Telegram chat/group,
completely isolated from public screener engine alerts.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.db.database import utc_now
from app.models.portfolio import Portfolio, PortfolioHolding
from app.models.watchlist_alert import UserPersonalTelegramConfig
from app.models.portfolio_signal_alert import PortfolioSignalAlert
from app.models.notification import AlertDispatchLog, AlertChannelConfig
from app.services.alert_dispatch_service import AlertDispatchService
from app.services.portfolio_intelligence_service import PortfolioIntelligenceService

logger = logging.getLogger(__name__)

# Fallback bot token if user doesn't provide their own bot
DEFAULT_PLATFORM_BOT_TOKEN = "8864485951:AAG7HHDh0KOQ-GXFo9N51CwVxvQ7_g4UPks"


class PortfolioAlertService:

    # -------------------------------------------------------------
    # 1. Config Management (Shared dedicated Portfolio & Watchlist Telegram)
    # -------------------------------------------------------------
    @classmethod
    def get_or_create_config(
        cls,
        db: Session,
        user_id: Optional[int] = None,
    ) -> UserPersonalTelegramConfig:
        """
        Retrieves or initializes the dedicated Telegram channel configuration
        specifically for Portfolio Intelligence & Watchlist BUY/SELL alerts.
        """
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
                channel_name="Personal Portfolio & Watchlist Radar",
                bot_token=None,
                chat_id=default_chat_id,
                is_enabled=True,
                notify_price_cross=True,
                notify_dma_reclaim=True,
                notify_vcp_breakout=True,
                notify_volume_surge=True,
                notify_target_stop=True,
                notify_portfolio_buy=True,
                notify_portfolio_sell=True,
                notify_portfolio_rebalance=True,
                notify_watchlist_buy=True,
                notify_watchlist_sell=True,
                min_conviction_score=75,
            )
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
        return cfg

    @classmethod
    def update_config(
        cls,
        db: Session,
        user_id: Optional[int],
        chat_id: str,
        channel_name: Optional[str] = None,
        bot_token: Optional[str] = None,
        telegram_username: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        notify_portfolio_buy: Optional[bool] = None,
        notify_portfolio_sell: Optional[bool] = None,
        notify_portfolio_rebalance: Optional[bool] = None,
        notify_watchlist_buy: Optional[bool] = None,
        notify_watchlist_sell: Optional[bool] = None,
        min_conviction_score: Optional[int] = None,
        notify_price_cross: Optional[bool] = None,
        notify_dma_reclaim: Optional[bool] = None,
        notify_vcp_breakout: Optional[bool] = None,
        notify_volume_surge: Optional[bool] = None,
        notify_target_stop: Optional[bool] = None,
    ) -> UserPersonalTelegramConfig:
        cfg = cls.get_or_create_config(db, user_id)
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

        # Portfolio toggles
        if notify_portfolio_buy is not None:
            cfg.notify_portfolio_buy = notify_portfolio_buy
        if notify_portfolio_sell is not None:
            cfg.notify_portfolio_sell = notify_portfolio_sell
        if notify_portfolio_rebalance is not None:
            cfg.notify_portfolio_rebalance = notify_portfolio_rebalance
        if min_conviction_score is not None:
            cfg.min_conviction_score = min_conviction_score

        # Watchlist toggles
        if notify_watchlist_buy is not None:
            cfg.notify_watchlist_buy = notify_watchlist_buy
        if notify_watchlist_sell is not None:
            cfg.notify_watchlist_sell = notify_watchlist_sell
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
        """
        Sends an instant verification message to the separate Portfolio & Watchlist Telegram chat group.
        """
        cfg = cls.get_or_create_config(db, user_id)
        target_chat_id = (custom_chat_id or cfg.chat_id or "").strip()
        token = (custom_bot_token or cfg.bot_token or DEFAULT_PLATFORM_BOT_TOKEN).strip()

        if not target_chat_id:
            return {"success": False, "error": "No Chat ID provided. Please set your Telegram Chat ID / Group ID."}

        test_msg = (
            "🔔 *ALPHA INDIA | PORTFOLIO & WATCHLIST RADAR CONNECTED*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "⚡ *Status:* Verified & Armed\n"
            f"👤 *Channel:* {cfg.channel_name}\n"
            f"🎯 *Chat ID:* `{target_chat_id}`\n\n"
            "🔒 *Dedicated Private Channel:*\n"
            "This chat group is *SEPARATE from public screener engine alerts*.\n"
            "It receives high-conviction BUY & SELL signals exclusively for your personal portfolio and watchlist.\n\n"
            "🚀 *Active Signal Rules:*\n"
            "• 🟢 *Portfolio BUY:* Best Buy Zone Entry, High Conviction Dips, Rebalance Add\n"
            "• 🔴 *Portfolio SELL:* Profit Booking Targets, Stop Loss Breaches, Exit Downgrades\n"
            "• 🎯 *Watchlist BUY:* Price Cross Above, 50 DMA Reclaims, VCP Breakouts\n"
            "• ⚠️ *Watchlist SELL:* Price Cross Below Stop-Loss, 200 DMA Breaches\n\n"
            f"🕒 _Verified at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}_\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Alpha India Institutional Radar"
        )

        res = AlertDispatchService.dispatch_telegram(
            bot_token=token,
            chat_id=target_chat_id,
            text=test_msg,
            parse_mode="Markdown",
        )

        if res.get("success"):
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=target_chat_id,
                symbol="PORTFOLIO_TEST",
                payload_preview=test_msg[:250],
                status="SUCCESS",
            )
        return res

    # -------------------------------------------------------------
    # 2. Portfolio BUY & SELL Signal Evaluation Engine
    # -------------------------------------------------------------
    @classmethod
    def evaluate_portfolio_signals(
        cls,
        db: Session,
        portfolio_id: int,
        user_id: Optional[int] = None,
        force_refresh: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Evaluates all holdings in a portfolio against live CMP and institutional 360° diagnostics.
        Identifies actionable BUY signals (Buy zone entry, Strong Buy upgrade, Rebalance add)
        and SELL signals (Profit booking target hit, Stop loss breached, Exit downgrade, Rebalance trim).
        """
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if not portfolio:
            return []

        cfg = cls.get_or_create_config(db, user_id)
        min_conviction = getattr(cfg, "min_conviction_score", 75) or 75

        holdings = db.query(PortfolioHolding).filter(
            PortfolioHolding.portfolio_id == portfolio_id
        ).all()

        if not holdings:
            return []

        # Get enriched holdings
        enriched = PortfolioIntelligenceService.get_enriched_holdings(
            db, portfolio_id, force_refresh=force_refresh
        )

        signals: List[Dict[str, Any]] = []

        for h in enriched:
            cmp = h["cmp"]
            avg_buy = h["avg_buy_price"]
            pnl_pct = h["pnl_pct"]
            weight = h["weight_pct"]
            verdict = h["verdict"]
            conviction = h["conviction_score"]
            symbol = h["symbol"]
            company_name = h["company_name"]
            sector = h["sector"]
            profit_booking = h["profit_booking"]
            stop_loss = h["stop_loss"]
            best_buy_zone = h["best_buy_zone"]
            accumulate_zone = h["accumulate_zone"]
            ai_thesis = h["ai_thesis"]
            when_to_buy = h["when_to_buy"]

            # Parse zones
            analysis = db.query(
                PortfolioIntelligenceService.analyze_stock_360(db, symbol, cmp, force_refresh=False).__class__
            ).filter_by(symbol=symbol).first()

            best_buy_min = analysis.best_buy_min if analysis else round(cmp * 0.90, 2)
            best_buy_max = analysis.best_buy_max if analysis else round(cmp * 0.95, 2)
            accumulate_min = analysis.accumulate_min if analysis else round(cmp * 0.95, 2)
            accumulate_max = analysis.accumulate_max if analysis else round(cmp * 0.99, 2)

            # -------------------------------------------------------------
            # A. SELL SIGNALS EVALUATION
            # -------------------------------------------------------------
            base_url = "https://ipodesk.shop"
            stock_page_url = f"{base_url}/stocks/{symbol}"
            screener_page_url = f"https://www.screener.in/company/{symbol}/consolidated/"

            # -------------------------------------------------------------
            # A. SELL SIGNALS EVALUATION
            # -------------------------------------------------------------
            # 1. Profit Booking Target Hit
            if cmp >= profit_booking:
                upside_gain = round(((profit_booking - avg_buy) / avg_buy) * 100, 1) if avg_buy > 0 else 25.0
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "SELL",
                    "trigger_category": "PROFIT_BOOKING_TARGET",
                    "headline": f"🔴 [PORTFOLIO SELL] {symbol} Reached Profit Booking Target ₹{profit_booking:,.2f}",
                    "cmp": cmp,
                    "buy_trigger_price": None,
                    "exit_trigger_price": profit_booking,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Expansion target achieved! Lock in partial gains (trim 30-50%) and raise trailing stop-loss to ₹{round(cmp * 0.95, 2):,.2f}.",
                    "urgency": "HIGH",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 2. Stop Loss Breached
            elif cmp <= stop_loss:
                loss_pct = round(((cmp - avg_buy) / avg_buy) * 100, 1) if avg_buy > 0 else -12.0
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "SELL",
                    "trigger_category": "STOP_LOSS_BREACH",
                    "headline": f"⚠️ [CRITICAL SELL] {symbol} Breached Stop Loss (₹{stop_loss:,.2f})",
                    "cmp": cmp,
                    "buy_trigger_price": None,
                    "exit_trigger_price": stop_loss,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Capital preservation alert! CMP fell below institutional defense level (₹{stop_loss:,.2f}). Immediate exit or strict downside cut recommended.",
                    "urgency": "CRITICAL",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 3. Rating Downgraded to REDUCE or EXIT
            elif verdict in ["REDUCE", "EXIT"]:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "SELL",
                    "trigger_category": "RATING_DOWNGRADE_EXIT",
                    "headline": f"🔴 [PORTFOLIO TRIM/EXIT] {symbol} Rating Downgraded to {verdict}",
                    "cmp": cmp,
                    "buy_trigger_price": None,
                    "exit_trigger_price": cmp,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Fundamentals decelerating or overextended valuation. Consider trimming position to redeploy into high-growth leaders.",
                    "urgency": "HIGH",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 4. Overconcentration Rebalance Trim (>25% weight)
            elif weight > 25.0:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "SELL",
                    "trigger_category": "REBALANCE_TRIM",
                    "headline": f"⚖️ [REBALANCE TRIM] {symbol} Overweight Concentration ({weight:.1f}%)",
                    "cmp": cmp,
                    "buy_trigger_price": None,
                    "exit_trigger_price": cmp,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Position exceeds 25% portfolio concentration threshold. Trim partial allocation above ₹{round(cmp * 0.99, 2):,.2f} to manage portfolio variance.",
                    "urgency": "MEDIUM",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # -------------------------------------------------------------
            # B. BUY SIGNALS EVALUATION
            # -------------------------------------------------------------
            # 1. Best Buy Support Zone Entry
            if best_buy_min <= cmp <= best_buy_max:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "BUY",
                    "trigger_category": "BEST_BUY_ZONE",
                    "headline": f"🟢 [PORTFOLIO BUY] {symbol} in Best Buy Support Zone (₹{best_buy_min:,.0f} - ₹{best_buy_max:,.0f})",
                    "cmp": cmp,
                    "buy_trigger_price": best_buy_max,
                    "exit_trigger_price": None,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Institutional consolidation support reached. Favorable risk-reward pocket to add to high-conviction holdings.",
                    "urgency": "HIGH",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 2. Pullback Accumulate Zone
            elif accumulate_min <= cmp <= accumulate_max:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "BUY",
                    "trigger_category": "ACCUMULATE_DIP",
                    "headline": f"🟢 [ACCUMULATE DIP] {symbol} Testing Accumulation Band (₹{accumulate_min:,.0f} - ₹{accumulate_max:,.0f})",
                    "cmp": cmp,
                    "buy_trigger_price": accumulate_max,
                    "exit_trigger_price": None,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Dip accumulation zone active. Systematic laddering or fractional additions advised.",
                    "urgency": "MEDIUM",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 3. High Conviction Strong Buy Upgrade
            elif verdict == "STRONG_BUY" and conviction >= min_conviction and pnl_pct < 5.0:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "BUY",
                    "trigger_category": "STRONG_BUY_RATING",
                    "headline": f"🟢 [STRONG BUY UPGRADE] {symbol} Flagged with High Conviction ({conviction}%)",
                    "cmp": cmp,
                    "buy_trigger_price": cmp,
                    "exit_trigger_price": None,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Core business durability exceptional with strong capital efficiency. High upside potential to target ₹{profit_booking:,.2f}.",
                    "urgency": "HIGH",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

            # 4. Rebalance Add More (<10% weight and High Quality)
            elif weight < 10.0 and verdict in ["STRONG_BUY", "ACCUMULATE"] and pnl_pct < 0.0:
                signals.append({
                    "portfolio_id": portfolio_id,
                    "holding_id": h["id"],
                    "symbol": symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "signal_type": "BUY",
                    "trigger_category": "REBALANCE_ADD",
                    "headline": f"⚖️ [REBALANCE ADD] {symbol} Underweight Dip ({weight:.1f}%)",
                    "cmp": cmp,
                    "buy_trigger_price": cmp,
                    "exit_trigger_price": None,
                    "avg_buy_price": avg_buy,
                    "target_price": profit_booking,
                    "stop_loss": stop_loss,
                    "pnl_pct": pnl_pct,
                    "conviction_score": conviction,
                    "weight_pct": weight,
                    "quantity": h["quantity"],
                    "invested_value": h["invested_value"],
                    "current_value": h["current_value"],
                    "action_guidance": f"Stock is currently {abs(pnl_pct):.1f}% below your average buy price with below-target weight ({weight:.1f}%). High conviction dip opportunity.",
                    "urgency": "MEDIUM",
                    "stock_url": stock_page_url,
                    "screener_url": screener_page_url,
                    "created_at": datetime.utcnow().isoformat(),
                })

        return signals

    # -------------------------------------------------------------
    # 3. Dedicated Telegram Dispatching
    # -------------------------------------------------------------
    @classmethod
    def dispatch_signal_to_telegram(
        cls,
        db: Session,
        signal: Dict[str, Any],
        user_id: Optional[int] = None,
        force: bool = False,
    ) -> bool:
        """
        Dispatches a formatted BUY or SELL alert message to the user's separate Telegram channel/group.
        Enforces duplicate suppression within 4 hours unless force=True.
        """
        cfg = cls.get_or_create_config(db, user_id)
        if not cfg.is_enabled or not cfg.chat_id:
            logger.warning("[PortfolioAlertService] Telegram not enabled or missing chat_id.")
            return False

        is_buy = signal.get("signal_type") == "BUY"
        is_sell = signal.get("signal_type") == "SELL"

        # Check toggles
        if is_buy and not getattr(cfg, "notify_portfolio_buy", True):
            logger.info("[PortfolioAlertService] Skipping BUY signal: notify_portfolio_buy is disabled.")
            return False
        if is_sell and not getattr(cfg, "notify_portfolio_sell", True):
            logger.info("[PortfolioAlertService] Skipping SELL signal: notify_portfolio_sell is disabled.")
            return False

        sym = signal["symbol"]
        trigger_cat = signal.get("trigger_category", "")

        # -------------------------------------------------------------
        # Deduplication Check (4-hour cooldown for identical symbol + trigger)
        # -------------------------------------------------------------
        if not force:
            cooldown_threshold = datetime.utcnow() - timedelta(hours=4)
            recent = (
                db.query(PortfolioSignalAlert)
                .filter(
                    PortfolioSignalAlert.portfolio_id == signal["portfolio_id"],
                    PortfolioSignalAlert.symbol == sym,
                    PortfolioSignalAlert.trigger_category == trigger_cat,
                    PortfolioSignalAlert.is_dispatched == True,
                    PortfolioSignalAlert.created_at >= cooldown_threshold,
                )
                .first()
            )
            if recent:
                logger.info(
                    f"[PortfolioAlertService] Suppressing duplicate alert for {sym} ({trigger_cat}): "
                    f"dispatched at {recent.dispatched_at}"
                )
                return False

        comp = signal.get("company_name", sym)
        sec = signal.get("sector", "General")
        cmp = signal.get("cmp", 0.0)
        avg_buy = signal.get("avg_buy_price", 0.0)
        pnl_pct = signal.get("pnl_pct", 0.0)
        pnl_sign = "+" if pnl_pct >= 0 else ""
        qty = signal.get("quantity", 0)
        target = signal.get("target_price", 0.0)
        stop = signal.get("stop_loss", 0.0)
        action = signal.get("action_guidance", "")
        conviction = signal.get("conviction_score", 85) or 85
        tier = "ELITE" if conviction >= 90 else ("HIGH CONVICTION" if conviction >= 80 else "ACCUMULATE / WATCH")

        upside_pct = round(((target - cmp) / max(0.01, cmp)) * 100, 1) if (target and cmp > 0) else 0.0
        downside_pct = round(((cmp - stop) / max(0.01, cmp)) * 100, 1) if (stop and cmp > 0) else 0.0
        rr = round(abs(target - cmp) / max(0.01, abs(cmp - stop)), 1) if (target and stop and cmp > 0) else 2.5

        # Buy / Exit Trigger Price calculation
        buy_trigger = signal.get("buy_trigger_price") or round(cmp * 1.005, 2)
        exit_trigger = signal.get("exit_trigger_price") or (target if trigger_cat == "PROFIT_BOOKING_TARGET" else (stop if trigger_cat == "STOP_LOSS_BREACH" else cmp))

        links_block = AlertDispatchService.get_stock_links(sym)

        if is_buy:
            header = "🟢 *ALPHA INDIA | PORTFOLIO BUY SIGNAL*"
            signal_badge = f"⚡ *Trigger:* `{trigger_cat.replace('_', ' ')}`"
            price_matrix = (
                f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
                f"🎯 *Buy Trigger Price:* ₹{buy_trigger:,.2f}\n"
                f"🚀 *Target Price:* ₹{target:,.2f} (+{upside_pct}%)\n"
                f"🛑 *Stop Loss:* ₹{stop:,.2f} (-{downside_pct}%)\n"
                f"⚖️ *Risk:Reward:* 1:{rr:.1f}"
            )
        else:
            header = "🔴 *ALPHA INDIA | PORTFOLIO SELL SIGNAL*"
            signal_badge = f"⚠️ *Trigger:* `{trigger_cat.replace('_', ' ')}`"
            price_matrix = (
                f"💵 *Live CMP:* ₹{cmp:,.2f}\n"
                f"🎯 *Exit Trigger Level:* ₹{exit_trigger:,.2f}\n"
                f"🏁 *Target Level:* ₹{target:,.2f}\n"
                f"🛑 *Stop Loss Level:* ₹{stop:,.2f}"
            )

        msg = (
            f"{header}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{signal_badge}\n"
            f"🏢 *Stock:* *{sym} (NSE)* — {comp}\n"
            f"📊 *Sector:* {sec}\n"
            f"⭐ *Institutional Score:* {conviction}/100 ({tier})\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{price_matrix}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"💼 *Your Active Position:*\n"
            f"• Quantity: {qty:,.0f} shares\n"
            f"• Avg Buy Price: ₹{avg_buy:,.2f}\n"
            f"• Current P&L: {pnl_sign}{pnl_pct:.2f}%\n"
            f"• Portfolio Weight: {signal.get('weight_pct', 0.0):.1f}%\n\n"
            f"💡 *Institutional Execution Guidance:*\n"
            f"_{action}_\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"{links_block}\n\n"
            f"🔒 _Dispatched to Dedicated Portfolio & Watchlist Channel_\n"
            f"🕒 _{datetime.now().strftime('%H:%M:%S IST')} • Alpha India Radar_\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        )

        token = cfg.bot_token or DEFAULT_PLATFORM_BOT_TOKEN
        res = AlertDispatchService.dispatch_telegram(
            bot_token=token,
            chat_id=cfg.chat_id,
            text=msg,
            parse_mode="Markdown",
        )

        success = bool(res.get("success"))

        # Record to PortfolioSignalAlert
        alert_row = PortfolioSignalAlert(
            portfolio_id=signal["portfolio_id"],
            holding_id=signal.get("holding_id"),
            user_id=user_id,
            symbol=sym,
            signal_type=signal["signal_type"],
            trigger_category=trigger_cat,
            cmp=cmp,
            buy_trigger_price=buy_trigger if is_buy else exit_trigger,
            avg_buy_price=avg_buy,
            target_price=target,
            stop_loss=stop,
            pnl_pct=pnl_pct,
            conviction_score=conviction,
            headline=signal.get("headline", ""),
            message_text=msg,
            action_guidance=action,
            is_dispatched=success,
            dispatched_at=utc_now() if success else None,
            chat_id=cfg.chat_id,
        )
        db.add(alert_row)

        if success:
            cfg.last_dispatched_at = utc_now()
            cfg.total_dispatched_count = (cfg.total_dispatched_count or 0) + 1
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=cfg.chat_id,
                symbol=sym,
                payload_preview=msg[:250],
                status="SUCCESS",
            )

        db.commit()
        return success

    # -------------------------------------------------------------
    # 4. Batch Scan & Auto-Dispatch
    # -------------------------------------------------------------
    @classmethod
    def scan_and_dispatch_portfolio_alerts(
        cls,
        db: Session,
        portfolio_id: int,
        user_id: Optional[int] = None,
        force_broadcast: bool = False,
    ) -> Dict[str, Any]:
        """
        Scans all holdings in the portfolio, discovers active BUY/SELL signals,
        and dispatches alerts to the separate Telegram group.
        Default force_broadcast=False enforces a 4-hour duplicate suppression cooldown.
        """
        signals = cls.evaluate_portfolio_signals(db, portfolio_id, user_id=user_id, force_refresh=True)

        buy_count = sum(1 for s in signals if s["signal_type"] == "BUY")
        sell_count = sum(1 for s in signals if s["signal_type"] == "SELL")
        dispatched_count = 0
        skipped_count = 0

        # Check cooldown (4 hours)
        cooldown_threshold = datetime.utcnow() - timedelta(hours=4)

        for sig in signals:
            sym = sig["symbol"]
            cat = sig["trigger_category"]

            # Check if recently dispatched
            recent = (
                db.query(PortfolioSignalAlert)
                .filter(
                    PortfolioSignalAlert.portfolio_id == portfolio_id,
                    PortfolioSignalAlert.symbol == sym,
                    PortfolioSignalAlert.trigger_category == cat,
                    PortfolioSignalAlert.is_dispatched == True,
                    PortfolioSignalAlert.created_at >= cooldown_threshold,
                )
                .first()
            )

            if recent and not force_broadcast:
                skipped_count += 1
                continue

            # Dispatch with force flag matching force_broadcast
            sent = cls.dispatch_signal_to_telegram(db, sig, user_id=user_id, force=force_broadcast)
            if sent:
                dispatched_count += 1
            else:
                skipped_count += 1

        return {
            "success": True,
            "portfolio_id": portfolio_id,
            "total_signals_detected": len(signals),
            "buy_signals_count": buy_count,
            "sell_signals_count": sell_count,
            "dispatched_count": dispatched_count,
            "skipped_count": skipped_count,
            "signals": signals,
        }

    @classmethod
    def get_recent_portfolio_signals(
        cls,
        db: Session,
        portfolio_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Fetches history of dispatched BUY/SELL portfolio alerts."""
        query = db.query(PortfolioSignalAlert)
        if portfolio_id:
            query = query.filter(PortfolioSignalAlert.portfolio_id == portfolio_id)
        records = query.order_by(desc(PortfolioSignalAlert.created_at)).limit(limit).all()
        return [r.to_dict() for r in records]
