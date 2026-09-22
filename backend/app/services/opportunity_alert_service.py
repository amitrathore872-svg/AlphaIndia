"""
Alpha India Opportunity Alert & Notification Engine
Sprint 36 — High-Conviction Opportunity Radar Alerts & Multi-Channel Dispatch

Monitors 4 key opportunity triggers:
1. /vcp-signals: Active Mark Minervini VCP Breakout signals
2. /pre-breakout-radar: Conviction Tier A+ setups (setup_tier starts with A+ or conviction >= 80)
3. /momentum-radar: Multi-timeframe momentum with Match Score >= 9/10
4. /momentum-radar: Multi-timeframe momentum with Conviction Score >= 79 pts
"""

import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.notification import SystemNotification, AlertChannelConfig
from app.models.athena_models import AthenaConvictionFlash, AthenaQuarterlyMetrics, AthenaValuationRisk
from app.models.announcement_radar import AnnouncementRadar
from app.services.alert_dispatch_service import AlertDispatchService
from app.services.vcp_engine_service import VCPEngineService
from app.services.prebreakout_radar_service import PreBreakoutRadarService
from app.services.momentum_screener_service import MomentumScreenerService
from app.services.intraday_opportunity_service import IntradayOpportunityService

logger = logging.getLogger("alpha_india.opportunity_alerts")


class OpportunityAlertService:
    """
    Central coordinator for scanning, filtering, deduplicating, and broadcasting
    institutional trade opportunities across VCP, Pre-Breakout, Momentum, Tomorrow Radar,
    Athena PEAD, and Material Corporate Catalyst engines.
    """

    DEFAULT_RULES = {
        "vcp_signals_enabled": True,
        "vcp_min_score": 90.0,
        "prebreakout_a_plus_enabled": True,
        "prebreakout_min_conviction": 80,
        "momentum_match_9_enabled": True,
        "momentum_min_matches": 9,
        "momentum_conviction_79_enabled": True,
        "momentum_min_conviction": 79,
        "tomorrow_radar_enabled": True,
        "tomorrow_min_conviction": 90,
        "athena_pead_enabled": True,
        "athena_min_shock_score": 75.0,
        "catalysts_enabled": True,
        "catalysts_min_impact": 8.5,
        "auto_broadcast_telegram": True,
        "auto_broadcast_whatsapp": True,
    }

    @classmethod
    def get_opportunity_thresholds(cls, db: Session) -> Dict[str, Any]:
        """
        Retrieves active rule settings from AlertChannelConfig or defaults.
        """
        tg_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
        saved_rules = (tg_cfg.auto_rules or {}) if tg_cfg else {}

        rules = dict(cls.DEFAULT_RULES)
        for k, v in saved_rules.items():
            if k in rules:
                rules[k] = v
        return rules

    @classmethod
    def update_opportunity_thresholds(cls, db: Session, updated_rules: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persists updated opportunity rule settings into AlertChannelConfig.
        """
        for channel_name in ["TELEGRAM", "WHATSAPP"]:
            cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == channel_name).first()
            if not cfg:
                cfg = AlertChannelConfig(channel=channel_name, is_enabled=True, auto_rules={})
                db.add(cfg)
                db.flush()

            current = dict(cfg.auto_rules or {})
            current.update(updated_rules)
            cfg.auto_rules = current
            cfg.updated_at = datetime.utcnow()

        db.commit()
        return cls.get_opportunity_thresholds(db)

    @classmethod
    def scan_and_dispatch_opportunity_alerts(
        cls,
        db: Session,
        force_scan: bool = False,
    ) -> Dict[str, Any]:
        """
        Scans all 4 engines, evaluates opportunity triggers against active thresholds,
        performs daily deduplication, and generates in-app notifications + channel broadcasts.
        """
        rules = cls.get_opportunity_thresholds(db)
        from datetime import timezone
        today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())

        dispatched_alerts: List[Dict[str, Any]] = []
        skipped_duplicates: List[Dict[str, Any]] = []

        # ==================================================================
        # 1. /vcp-signals — Minervini VCP Breakout Signals
        # ==================================================================
        if rules.get("vcp_signals_enabled", True):
            try:
                track_record = VCPEngineService.get_signal_track_record(db=db, trade_state="ACTIVE")
                active_signals = track_record.get("signals", [])

                for sig in active_signals:
                    sym = sig.get("symbol", "").strip().upper()
                    if not sym:
                        continue

                    total_score = float(sig.get("total_score", sig.get("final_ai_score", 90.0)))
                    min_vcp_score = float(rules.get("vcp_min_score", 90.0))
                    if total_score < min_vcp_score:
                        continue

                    # Daily Deduplication check
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
                        skipped_duplicates.append({"engine": "vcp-signals", "symbol": sym, "reason": "Already alerted today"})
                        continue

                    company_name = sig.get("company_name", sym)
                    pivot_price = float(sig.get("pivot_price", 0.0))
                    cmp_price = float(sig.get("cmp", pivot_price))
                    stop_loss = float(sig.get("stop_loss", 0.0))
                    target_1 = float(sig.get("target_1", 0.0))
                    target_2 = float(sig.get("target_2", 0.0))
                    vcp_stage = sig.get("vcp_stage", "3-Stage VCP")
                    vol_ratio = float(sig.get("volume_breakout_ratio", 2.5))
                    dryup_pct = int(sig.get("volume_dryup_pct", 60))
                    is_elite = bool(sig.get("is_elite", total_score >= 95.0))
                    rr = float(sig.get("reward_risk", 3.0))
                    verdict = sig.get("verdict", "Elite VCP Breakout" if is_elite else "High Conviction Breakout")

                    severity = "critical" if is_elite or total_score >= 94.0 else "warning"
                    title = f"🎯 VCP BREAKOUT: {sym} (Score {total_score:.1f} — {verdict})"
                    message = (
                        f"Minervini {vcp_stage} pivot at ₹{pivot_price:,.1f}. "
                        f"CMP ₹{cmp_price:,.1f}, SL ₹{stop_loss:,.1f}. "
                        f"Targets: ₹{target_1:,.1f} / ₹{target_2:,.1f} (R:R {rr:.1f}x). "
                        f"Volume {vol_ratio:.1f}x with {dryup_pct}% contraction."
                    )

                    metadata = {
                        "rule_type": "VCP_SIGNAL",
                        "symbol": sym,
                        "company_name": company_name,
                        "total_score": total_score,
                        "pivot_price": pivot_price,
                        "cmp": cmp_price,
                        "stop_loss": stop_loss,
                        "target_1": target_1,
                        "target_2": target_2,
                        "vcp_stage": vcp_stage,
                        "is_elite": is_elite,
                        "action_url": "/vcp-signals",
                    }

                    notif = AlertDispatchService.create_in_app_notification(
                        db=db,
                        title=title,
                        message=message,
                        category="VCP_BREAKOUT",
                        severity=severity,
                        action_url="/vcp-signals",
                        metadata=metadata,
                    )

                    # External Broadcast
                    memo = AlertDispatchService.format_vcp_breakout_alert(
                        symbol=sym,
                        company_name=company_name,
                        vcp_stage=vcp_stage,
                        pivot_price=pivot_price,
                        cmp=cmp_price,
                        entry_zone=sig.get("entry_zone", f"₹{pivot_price*0.998:.1f}–{pivot_price*1.015:.1f}"),
                        stop_loss=stop_loss,
                        target_1=target_1,
                        target_2=target_2,
                        reward_risk=rr,
                        total_score=total_score,
                        breakout_volume_ratio=vol_ratio,
                        dryup_pct=dryup_pct,
                        action_url="http://localhost:3000/vcp-signals",
                    )
                    cls._dispatch_external_channels(db, sym, memo, rules)

                    dispatched_alerts.append({"engine": "vcp-signals", "symbol": sym, "title": title, "notif_id": notif.id})

            except Exception as e:
                logger.error(f"Error scanning VCP signals for alerts: {e}", exc_info=True)

        # ==================================================================
        # 2. /pre-breakout-radar — Conviction Tier A+
        # ==================================================================
        if rules.get("prebreakout_a_plus_enabled", True):
            try:
                pre_data = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=force_scan)
                candidates = pre_data.get("opportunities", [])
                min_conviction = int(rules.get("prebreakout_min_conviction", 80))

                for opp in candidates:
                    tier = opp.get("setup_tier", "")
                    c_score = int(opp.get("conviction_score", 0))

                    # Filter: Conviction Tier A+ or conviction >= min_conviction
                    if not (tier.startswith("A+") or c_score >= min_conviction):
                        continue

                    sym = opp.get("symbol", "").strip().upper()
                    if not sym:
                        continue

                    # Daily Deduplication check
                    existing = (
                        db.query(SystemNotification)
                        .filter(
                            SystemNotification.category == "PRE_BREAKOUT",
                            SystemNotification.created_at >= today_start,
                            SystemNotification.title.like(f"%{sym}%"),
                        )
                        .first()
                    )
                    if existing:
                        skipped_duplicates.append({"engine": "pre-breakout-radar", "symbol": sym, "reason": "Already alerted today"})
                        continue

                    company_name = opp.get("company_name", sym)
                    cmp_price = float(opp.get("cmp", 0.0))
                    bp = opp.get("blueprint", {})
                    metrics = opp.get("metrics", {})
                    cheat_entry = float(bp.get("cheat_entry", cmp_price))
                    stop_loss = float(bp.get("stop_loss", cmp_price * 0.97))
                    target_1 = float(bp.get("target_1", cmp_price * 1.09))
                    target_2 = float(bp.get("target_2", cmp_price * 1.18))
                    rr = float(bp.get("risk_reward", 3.0))
                    primary_pattern = opp.get("primary_pattern", "Super Coil Base")
                    vdu = float(metrics.get("vdu_ratio", 0.65))

                    title = f"⚡ PRE-BREAKOUT A+: {sym} ({tier} • {c_score} PTS)"
                    message = (
                        f"High-compression {primary_pattern} setup. "
                        f"CMP ₹{cmp_price:,.2f} | Cheat Entry: ₹{cheat_entry:,.2f} | SL: ₹{stop_loss:,.2f}. "
                        f"Targets: ₹{target_1:,.2f} (+9%) / ₹{target_2:,.2f} (+18%). VDU contraction {vdu:.2f}x."
                    )

                    metadata = {
                        "rule_type": "PRE_BREAKOUT_A_PLUS",
                        "symbol": sym,
                        "company_name": company_name,
                        "conviction_score": c_score,
                        "setup_tier": tier,
                        "cmp": cmp_price,
                        "cheat_entry": cheat_entry,
                        "stop_loss": stop_loss,
                        "target_1": target_1,
                        "target_2": target_2,
                        "vdu_ratio": vdu,
                        "action_url": "/pre-breakout-radar",
                    }

                    notif = AlertDispatchService.create_in_app_notification(
                        db=db,
                        title=title,
                        message=message,
                        category="PRE_BREAKOUT",
                        severity="critical",
                        action_url="/pre-breakout-radar",
                        metadata=metadata,
                    )

                    memo = AlertDispatchService.format_prebreakout_alert(
                        symbol=sym,
                        company_name=company_name,
                        conviction_score=c_score,
                        setup_tier=tier,
                        cmp=cmp_price,
                        cheat_entry=cheat_entry,
                        stop_loss=stop_loss,
                        target_1=target_1,
                        target_2=target_2,
                        risk_reward=rr,
                        primary_pattern=primary_pattern,
                        vdu_ratio=vdu,
                        action_url="http://localhost:3000/pre-breakout-radar",
                    )
                    cls._dispatch_external_channels(db, sym, memo, rules)

                    dispatched_alerts.append({"engine": "pre-breakout-radar", "symbol": sym, "title": title, "notif_id": notif.id})

            except Exception as e:
                logger.error(f"Error scanning pre-breakout radar for alerts: {e}", exc_info=True)

        # ==================================================================
        # 3 & 4. /momentum-radar — Match Score >= 9 & Conviction Score >= 79
        # ==================================================================
        mom_match_enabled = rules.get("momentum_match_9_enabled", True)
        mom_conv_enabled = rules.get("momentum_conviction_79_enabled", True)

        if mom_match_enabled or mom_conv_enabled:
            try:
                mom_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=force_scan)
                mom_opps = mom_data.get("opportunities", [])
                min_match = int(rules.get("momentum_min_matches", 9))
                min_conv = int(rules.get("momentum_min_conviction", 79))

                for opp in mom_opps:
                    sym = opp.get("symbol", "").strip().upper()
                    if not sym:
                        continue

                    match_count = int(opp.get("match_count", 0))
                    c_score = int(opp.get("conviction_score", 0))

                    qualifies_match_9 = mom_match_enabled and (match_count >= min_match)
                    qualifies_conv_79 = mom_conv_enabled and (c_score >= min_conv)

                    if not (qualifies_match_9 or qualifies_conv_79):
                        continue

                    # Deduplication check for momentum
                    existing = (
                        db.query(SystemNotification)
                        .filter(
                            SystemNotification.category == "MOMENTUM_RADAR",
                            SystemNotification.created_at >= today_start,
                            SystemNotification.title.like(f"%{sym}%"),
                        )
                        .first()
                    )
                    if existing:
                        skipped_duplicates.append({"engine": "momentum-radar", "symbol": sym, "reason": "Already alerted today"})
                        continue

                    company_name = opp.get("company_name", sym)
                    cmp_price = float(opp.get("cmp", 0.0))
                    tb = opp.get("trade_blueprint", {})
                    ind = opp.get("indicators", {})

                    entry_trigger = float(tb.get("entry_trigger", cmp_price))
                    stop_loss = float(tb.get("stop_loss", cmp_price * 0.95))
                    target_1 = float(tb.get("target_1", cmp_price * 1.08))
                    target_2 = float(tb.get("target_2", cmp_price * 1.16))
                    rr = float(tb.get("risk_reward", 2.5))
                    d_rsi = float(ind.get("daily_rsi", 60.0))
                    w_rsi = float(ind.get("weekly_rsi", 60.0))
                    vol_surge = float(ind.get("volume_surge_ratio", 1.5))

                    tag = "PERFECT 10/10" if match_count == 10 else f"{match_count}/10 MATCH"
                    if qualifies_match_9 and qualifies_conv_79:
                        headline_tag = f"MATCH {match_count}/10 & CONVICTION {c_score} PTS"
                    elif qualifies_match_9:
                        headline_tag = f"MATCH SCORE {match_count}/10"
                    else:
                        headline_tag = f"CONVICTION SCORE {c_score} PTS"

                    title = f"🚀 MOMENTUM RADAR: {sym} ({headline_tag})"
                    message = (
                        f"Multi-Timeframe Confluence: {match_count}/10 criteria met, Conviction: {c_score} pts. "
                        f"CMP ₹{cmp_price:,.2f} | Trigger: ₹{entry_trigger:,.2f} | SL: ₹{stop_loss:,.2f}. "
                        f"Targets: ₹{target_1:,.2f} / ₹{target_2:,.2f}. Daily RSI: {d_rsi:.1f}, Weekly RSI: {w_rsi:.1f}, Vol Surge: {vol_surge:.1f}x."
                    )

                    metadata = {
                        "rule_type": "MOMENTUM_CONFLUENCE",
                        "symbol": sym,
                        "company_name": company_name,
                        "match_count": match_count,
                        "conviction_score": c_score,
                        "qualifies_match_9": qualifies_match_9,
                        "qualifies_conv_79": qualifies_conv_79,
                        "cmp": cmp_price,
                        "entry_trigger": entry_trigger,
                        "stop_loss": stop_loss,
                        "target_1": target_1,
                        "target_2": target_2,
                        "daily_rsi": d_rsi,
                        "weekly_rsi": w_rsi,
                        "volume_surge_ratio": vol_surge,
                        "action_url": "/momentum-radar",
                    }

                    severity = "critical" if match_count == 10 or c_score >= 88 else "warning"
                    notif = AlertDispatchService.create_in_app_notification(
                        db=db,
                        title=title,
                        message=message,
                        category="MOMENTUM_RADAR",
                        severity=severity,
                        action_url="/momentum-radar",
                        metadata=metadata,
                    )

                    memo = AlertDispatchService.format_momentum_radar_alert(
                        symbol=sym,
                        company_name=company_name,
                        match_count=match_count,
                        conviction_score=c_score,
                        cmp=cmp_price,
                        entry_trigger=entry_trigger,
                        stop_loss=stop_loss,
                        target_1=target_1,
                        target_2=target_2,
                        risk_reward=rr,
                        daily_rsi=d_rsi,
                        weekly_rsi=w_rsi,
                        vol_surge=vol_surge,
                        action_url="http://localhost:3000/momentum-radar",
                    )
                    cls._dispatch_external_channels(db, sym, memo, rules)

                    dispatched_alerts.append({"engine": "momentum-radar", "symbol": sym, "title": title, "notif_id": notif.id})

            except Exception as e:
                logger.error(f"Error scanning momentum radar for alerts: {e}", exc_info=True)

        # ==================================================================
        # 4. /intraday-radar — Top Tomorrow 5%+ High-Conviction Radar
        # ==================================================================
        try:
            tomorrow_res = cls.scan_tomorrow_radar_alerts(db=db, rules=rules)
            for item in tomorrow_res:
                dispatched_alerts.append(item)
        except Exception as t_err:
            logger.error(f"Error evaluating tomorrow radar alerts in master scan: {t_err}", exc_info=True)

        # ==================================================================
        # 5. /athena-omega — Athena PEAD High-Conviction Flash
        # ==================================================================
        try:
            athena_res = cls.scan_athena_pead_alerts(db=db, rules=rules)
            for item in athena_res:
                dispatched_alerts.append(item)
        except Exception as a_err:
            logger.error(f"Error evaluating Athena PEAD alerts in master scan: {a_err}", exc_info=True)

        # ==================================================================
        # 6. /announcements — High-Impact Corporate Catalysts
        # ==================================================================
        try:
            cat_res = cls.scan_catalyst_radar_alerts(db=db, rules=rules)
            for item in cat_res:
                dispatched_alerts.append(item)
        except Exception as c_err:
            logger.error(f"Error evaluating catalyst radar alerts in master scan: {c_err}", exc_info=True)

        return {
            "status": "SUCCESS",
            "timestamp": datetime.utcnow().isoformat(),
            "new_alerts_count": len(dispatched_alerts),
            "skipped_duplicates_count": len(skipped_duplicates),
            "dispatched_alerts": dispatched_alerts,
            "skipped_duplicates": skipped_duplicates,
        }

    @classmethod
    def _dispatch_external_channels(
        cls,
        db: Session,
        symbol: str,
        memo_text: str,
        rules: Dict[str, Any],
    ) -> None:
        """
        Broadcasts formatted memo to Telegram and WhatsApp if channels are active.
        """
        # Telegram Dispatch
        if rules.get("auto_broadcast_telegram", True):
            try:
                tg_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "TELEGRAM").first()
                if tg_cfg and tg_cfg.is_enabled and tg_cfg.bot_token and tg_cfg.chat_id:
                    res = AlertDispatchService.dispatch_telegram(
                        bot_token=tg_cfg.bot_token,
                        chat_id=tg_cfg.chat_id,
                        text=memo_text,
                    )
                    AlertDispatchService.log_dispatch(
                        db=db,
                        channel="TELEGRAM",
                        recipient=tg_cfg.chat_id,
                        symbol=symbol,
                        payload_preview=memo_text,
                        status="SUCCESS" if res.get("success") else "FAILED",
                        error_message=res.get("error"),
                    )
            except Exception as ex:
                logger.error(f"External Telegram dispatch failed for {symbol}: {ex}")

        # WhatsApp Cloud Dispatch
        if rules.get("auto_broadcast_whatsapp", True):
            try:
                wa_cfg = db.query(AlertChannelConfig).filter(AlertChannelConfig.channel == "WHATSAPP").first()
                if wa_cfg and wa_cfg.is_enabled and wa_cfg.api_key and wa_cfg.phone_number_id and wa_cfg.target_recipient:
                    res = AlertDispatchService.dispatch_whatsapp_cloud(
                        api_key=wa_cfg.api_key,
                        phone_number_id=wa_cfg.phone_number_id,
                        recipient=wa_cfg.target_recipient,
                        text=memo_text,
                    )
                    AlertDispatchService.log_dispatch(
                        db=db,
                        channel="WHATSAPP",
                        recipient=wa_cfg.target_recipient,
                        symbol=symbol,
                        payload_preview=memo_text,
                        status="SUCCESS" if res.get("success") else "FAILED",
                        error_message=res.get("error"),
                    )
            except Exception as ex:
                logger.error(f"External WhatsApp dispatch failed for {symbol}: {ex}")

    @classmethod
    def scan_tomorrow_radar_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans IntradayOpportunityService for Top Tomorrow 5%+ picks.
        If any elite pick has conviction >= tomorrow_min_conviction (default 90) and hasn't been alerted today,
        dispatches curated institutional memo to external channels and creates SystemNotification.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("tomorrow_radar_enabled", True):
            return []

        from datetime import timezone
        today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())

        # Check if already alerted today for tomorrow radar
        existing_today = (
            db.query(SystemNotification)
            .filter(
                SystemNotification.category == "TOMORROW_RADAR",
                SystemNotification.created_at >= today_start,
            )
            .first()
        )
        if existing_today:
            return []

        try:
            res = IntradayOpportunityService.get_deep_dive_opportunities(db=db, force_refresh=False)
            min_conv = int(rules.get("tomorrow_min_conviction", 90))
            elite = res.get("elite_candidates", [])
            # Filter candidates meeting conviction threshold
            qualifying = [p for p in elite if int(p.get("conviction_score", 0)) >= min_conv]
            if not qualifying:
                # If none >= min_conv, check top elite setups with A+ tier
                qualifying = [p for p in elite if p.get("conviction_tier", "").startswith("A+")][:2]

            if not qualifying:
                return []

            top_picks = qualifying[:3]
            top_symbols = ", ".join([p.get("symbol", "") for p in top_picks])
            nifty = res.get("nifty_benchmark", {})
            nifty_cmp = nifty.get("cmp", "N/A")
            nifty_regime = nifty.get("regime", "NEUTRAL")

            now_ist = datetime.now(timezone.utc).strftime("%d %b %Y | %H:%M UTC")

            msg_lines = [
                "🎯 *ALPHA INDIA — TOMORROW 5%+ RADAR*",
                f"*Session Scan:* {now_ist}",
                f"*NIFTY 50:* {nifty_cmp} ({nifty_regime})",
                "━━━━━━━━━━━━━━━━━━━━━",
                "*TOP HIGH-CONVICTION PICKS*",
                ""
            ]

            for idx, p in enumerate(top_picks, 1):
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
                "━━━━━━━━━━━━━━━━━━━━━",
                "*Execution Protocol:*",
                "1. Check 9:15-9:30 AM gap: Enter only if opening gap is between +0.2% and +1.2%.",
                "2. Buy above trigger after 9:30 AM with strict SL.",
                "3. Book 60% profit at Target 1 and trail SL to cost.",
                "",
                "📡 *Live Terminal:* http://localhost:3000/intraday-radar"
            ])

            memo_text = "\n".join(msg_lines)

            # Create In-App Notification
            notif = AlertDispatchService.create_in_app_notification(
                db=db,
                title=f"Tomorrow High-Conviction Radar: {top_symbols}",
                message=f"Dispatched Top {len(top_picks)} breakout candidates coiling for tomorrow ({top_symbols}).",
                category="TOMORROW_RADAR",
                severity="critical",
                action_url="/intraday-radar",
                metadata={"symbols": [p.get("symbol") for p in top_picks], "count": len(top_picks)},
            )

            # Dispatch External Channels
            cls._dispatch_external_channels(db, top_symbols, memo_text, rules)

            return [{"engine": "tomorrow-radar", "symbols": top_symbols, "title": notif.title, "notif_id": notif.id}]
        except Exception as e:
            logger.error(f"Error scanning tomorrow radar for alerts: {e}", exc_info=True)
            return []

    @classmethod
    def scan_athena_pead_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans AthenaConvictionFlash for AAA+/AAA post-earnings announcement drift opportunities.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("athena_pead_enabled", True):
            return []

        from datetime import timezone
        today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())

        dispatched = []
        try:
            min_shock = float(rules.get("athena_min_shock_score", 75.0))
            flashes = (
                db.query(AthenaConvictionFlash)
                .filter(
                    AthenaConvictionFlash.is_published.is_(True),
                    AthenaConvictionFlash.published_at >= today_start,
                    (AthenaConvictionFlash.conviction_grade.in_(["AAA+", "AAA"])) | (AthenaConvictionFlash.financial_shock_score >= min_shock)
                )
                .all()
            )

            for fl in flashes:
                sym = fl.symbol.strip().upper()
                if not sym:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "ATHENA_PEAD",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                metrics = db.query(AthenaQuarterlyMetrics).filter(AthenaQuarterlyMetrics.filing_id == fl.filing_id).first()
                val = db.query(AthenaValuationRisk).filter(AthenaValuationRisk.filing_id == fl.filing_id).first()

                pat = float(metrics.pat) if (metrics and metrics.pat is not None) else 0.0
                revenue = float(metrics.revenue) if (metrics and metrics.revenue is not None) else 0.0
                growth_pat = float(metrics.pat_growth_yoy) if (metrics and metrics.pat_growth_yoy is not None) else 0.0
                upside = float(val.upside_potential_pct if (val and val.upside_potential_pct is not None) else (fl.expected_1m_move_max if fl.expected_1m_move_max is not None else 12.5))
                shock_score = float(fl.financial_shock_score or 0.0)
                conv_score = int(fl.athena_conviction_score or 85)

                title = f"⚡ ATHENA PEAD FLASH: {sym} (Grade {fl.conviction_grade} • {conv_score} PTS)"
                message = (
                    f"Athena Omega 5-Gate PEAD Trigger ({fl.flash_signal}). "
                    f"PAT: ₹{pat:,.1f} Cr ({growth_pat:+.1f}% YoY), Rev: ₹{revenue:,.1f} Cr. "
                    f"Est. 1M Upside: {upside:+.1f}%. Shock Score: {shock_score:.1f}/100."
                )

                metadata = {
                    "rule_type": "ATHENA_PEAD_FLASH",
                    "symbol": sym,
                    "company_name": fl.company_name or sym,
                    "conviction_score": fl.athena_conviction_score,
                    "conviction_grade": fl.conviction_grade,
                    "flash_signal": fl.flash_signal,
                    "pat": pat,
                    "revenue": revenue,
                    "growth_pat": growth_pat,
                    "upside_pct": upside,
                    "action_url": "/athena-omega",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="ATHENA_PEAD",
                    severity="critical",
                    action_url="/athena-omega",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_pead_flash_alert(
                    symbol=sym,
                    company_name=fl.company_name or sym,
                    signal=fl.flash_signal,
                    conviction_score=int(fl.athena_conviction_score),
                    conviction_grade=fl.conviction_grade,
                    revenue=revenue,
                    pat=pat,
                    growth_pat=growth_pat,
                    upside_pct=upside,
                    thesis=fl.ai_investment_summary or "Exceptional earnings acceleration with forensic quality validation.",
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "athena-pead", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Athena PEAD for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_catalyst_radar_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans AnnouncementRadar for high-impact material catalyst disclosures (Order Wins, Capex, Demergers).
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("catalysts_enabled", True):
            return []

        from datetime import timezone
        today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())

        dispatched = []
        try:
            min_impact = float(rules.get("catalysts_min_impact", 8.5))
            catalysts = (
                db.query(AnnouncementRadar)
                .filter(
                    AnnouncementRadar.published_at >= today_start,
                    AnnouncementRadar.impact_score >= min_impact,
                    AnnouncementRadar.recommendation == "STRONG_BUY",
                )
                .all()
            )

            for cat in catalysts:
                sym = cat.symbol.strip().upper()
                if not sym:
                    continue

                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "CATALYST_ORDER",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                deal_val = float(cat.deal_value_cr) if cat.deal_value_cr is not None else None
                deal_str = f" Deal Value: ₹{deal_val:,.1f} Cr." if deal_val is not None else ""
                target_p = float(cat.target_price) if cat.target_price is not None else 0.0
                upside_p = float(cat.upside_pct) if cat.upside_pct is not None else 0.0
                sl_p = float(cat.stop_loss) if cat.stop_loss is not None else 0.0

                title = f"📡 CATALYST RADAR: {sym} ({cat.catalyst_type.replace('_', ' ')} • {cat.impact_score}/10)"
                message = (
                    f"{cat.headline}.{deal_str} "
                    f"Target: ₹{target_p:,.1f} (+{upside_p:.1f}%), SL: ₹{sl_p:,.1f}."
                )

                metadata = {
                    "rule_type": "MATERIAL_CATALYST",
                    "symbol": sym,
                    "company_name": cat.company_name or sym,
                    "catalyst_type": cat.catalyst_type,
                    "impact_score": cat.impact_score,
                    "deal_value_cr": deal_val,
                    "target_price": target_p,
                    "stop_loss": sl_p,
                    "action_url": "/announcements",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="CATALYST_ORDER",
                    severity="critical" if cat.impact_score >= 9.0 else "warning",
                    action_url="/announcements",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_catalyst_alert(
                    symbol=sym,
                    company_name=cat.company_name or sym,
                    catalyst_type=cat.catalyst_type,
                    headline=cat.headline,
                    order_value_cr=cat.deal_value_cr,
                    source_url=cat.source_url,
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "catalyst-radar", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning catalysts for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def get_recent_opportunity_alerts(cls, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns recent opportunity notifications across all key radar categories.
        """
        categories = ["VCP_BREAKOUT", "PRE_BREAKOUT", "MOMENTUM_RADAR", "TOMORROW_RADAR", "ATHENA_PEAD", "CATALYST_ORDER"]
        items = (
            db.query(SystemNotification)
            .filter(
                SystemNotification.category.in_(categories),
                SystemNotification.is_archived.is_(False),
            )
            .order_by(desc(SystemNotification.created_at))
            .limit(limit)
            .all()
        )
        return [it.to_dict() for it in items]
