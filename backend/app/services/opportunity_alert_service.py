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
from sqlalchemy import desc, or_

from app.models.notification import SystemNotification, AlertChannelConfig, AlertDispatchLog
from app.models.athena_models import AthenaConvictionFlash, AthenaQuarterlyMetrics, AthenaValuationRisk
from app.models.announcement_radar import AnnouncementRadar
from app.services.alert_dispatch_service import AlertDispatchService
from app.services.vcp_engine_service import VCPEngineService
from app.services.prebreakout_radar_service import PreBreakoutRadarService
from app.services.momentum_screener_service import MomentumScreenerService
from app.services.intraday_opportunity_service import IntradayOpportunityService
from app.services.techno_funda_service import TechnoFundaService
from app.services.delivery_screener_service import DeliveryScreenerService
from app.services.mf_analytics_service import MFAnalyticsService
from app.models.screener_growth_record import ScreenerGrowthRecord

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
        "vcp_elite_only": False,
        "prebreakout_a_plus_enabled": True,
        "prebreakout_min_conviction": 80,
        "momentum_match_9_enabled": True,
        "momentum_min_matches": 9,
        "momentum_conviction_79_enabled": True,
        "momentum_min_conviction": 79,
        "momentum_universe_enabled": True,
        "momentum_min_mcap_cr": 1000.0,
        "momentum_min_price": 20.0,
        "momentum_min_turnover_lakhs": 50.0,
        "tomorrow_radar_enabled": True,
        "tomorrow_min_conviction": 90,
        "athena_pead_enabled": True,
        "athena_min_shock_score": 75.0,
        "catalysts_enabled": True,
        "catalysts_min_impact": 8.5,
        "order_win_enabled": True,
        "order_win_min_significance": 65.0,
        "order_win_min_deal_cr": 25.0,
        "techno_funda_enabled": True,
        "techno_funda_min_score": 85.0,
        "techno_funda_max_pivot_dist": 4.0,
        "delivery_breakout_enabled": True,
        "delivery_tier": "ACTIVE_SWING",
        "delivery_min_spike": 1.6,
        "delivery_min_pct": 55.0,
        "delivery_min_flow_20d": 1.15,
        "institutional_mf_enabled": True,
        "institutional_min_schemes": 3,
        "institutional_min_smart_money_score": 80.0,
        "growth_screener_enabled": True,
        "growth_min_pat_pct": 50.0,
        "growth_min_sales_pct": 25.0,
        "breakout_execution_enabled": True,
        "ipo_radar_enabled": True,
        "ipo_min_conviction": 85.0,
        "ipo_blue_sky_only": False,
        "transformational_multibaggers_enabled": True,
        "transformational_min_conviction": 80.0,
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
        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)

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

                    # Daily Deduplication check (timezone-proof session window)
                    existing = (
                        db.query(SystemNotification)
                        .filter(
                            SystemNotification.category == "VCP_BREAKOUT",
                            SystemNotification.created_at >= today_start,
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
        # 3. /momentum-radar — Multi-Timeframe Momentum Screener
        #    (Evaluates F&O Basket + Full NSE/BSE Universe Scan + Live Watchlist Breakouts)
        # ==================================================================
        mom_match_enabled = rules.get("momentum_match_9_enabled", True)
        mom_conv_enabled = rules.get("momentum_conviction_79_enabled", True)
        mom_universe_enabled = rules.get("momentum_universe_enabled", True)

        if mom_match_enabled or mom_conv_enabled or mom_universe_enabled:
            try:
                min_match = int(rules.get("momentum_min_matches", 9))
                min_conv = int(rules.get("momentum_min_conviction", 79))
                min_mcap = float(rules.get("momentum_min_mcap_cr", 1000.0))
                min_price = float(rules.get("momentum_min_price", 20.0))
                min_turnover = float(rules.get("momentum_min_turnover_lakhs", 50.0))

                # Aggregate candidates by symbol across all sources
                candidates_by_sym: Dict[str, Dict[str, Any]] = {}

                # A. Standard F&O candidates
                try:
                    mom_data = MomentumScreenerService.scan_opportunities(db=db, force_refresh=force_scan)
                    for opp in mom_data.get("opportunities", []):
                        s = opp.get("symbol", "").strip().upper()
                        if s:
                            opp_copy = dict(opp)
                            opp_copy["scan_source"] = "FNO_BASKET"
                            candidates_by_sym[s] = opp_copy
                except Exception as fno_err:
                    logger.warning(f"Error fetching F&O momentum opportunities: {fno_err}")

                # B. Full Universe Scanner Findings (Disk Cache)
                if mom_universe_enabled:
                    try:
                        from app.services.momentum_universe_scanner import MomentumUniverseScanner
                        u_cache = MomentumUniverseScanner.load_universe_cache()
                        if u_cache and u_cache.get("results"):
                            for r in u_cache["results"]:
                                s = r.get("symbol", "").strip().upper()
                                if not s:
                                    continue

                                # Institutional gate verification
                                cmp_val = float(r.get("cmp") or 0.0)
                                if cmp_val < min_price:
                                    continue
                                mcap_val = r.get("market_cap_cr")
                                if mcap_val is not None and mcap_val < min_mcap:
                                    continue
                                turnover_val = r.get("turnover_lakhs")
                                if turnover_val is not None and turnover_val < min_turnover:
                                    continue

                                # If already exists from F&O, keep higher match_count or enrich metadata
                                if s in candidates_by_sym:
                                    existing = candidates_by_sym[s]
                                    if r.get("match_count", 0) > existing.get("match_count", 0):
                                        candidates_by_sym[s] = dict(r, scan_source="FULL_UNIVERSE")
                                    else:
                                        existing["market_cap_cr"] = r.get("market_cap_cr")
                                        existing["turnover_lakhs"] = r.get("turnover_lakhs")
                                else:
                                    r_copy = dict(r)
                                    r_copy["scan_source"] = "FULL_UNIVERSE"
                                    candidates_by_sym[s] = r_copy
                    except Exception as u_err:
                        logger.warning(f"Error merging full universe momentum findings: {u_err}")

                    # C. Live Breakout Watchlist Candidates
                    try:
                        from app.models.momentum_radar_watchlist import MomentumRadarWatchlist
                        today_str = date.today().isoformat()
                        live_candidates = (
                            db.query(MomentumRadarWatchlist)
                            .filter(
                                MomentumRadarWatchlist.promoted_date == today_str,
                                or_(
                                    MomentumRadarWatchlist.breakout_triggered == True,
                                    MomentumRadarWatchlist.intraday_match_count >= min_match,
                                )
                            )
                            .all()
                        )
                        for b_row in live_candidates:
                            s = b_row.symbol.strip().upper()
                            b_dict = {
                                "symbol": s,
                                "company_name": b_row.company_name or s,
                                "match_count": b_row.intraday_match_count or b_row.match_count,
                                "conviction_score": b_row.conviction_score,
                                "cmp": b_row.intraday_cmp or b_row.cmp_at_scan or 0.0,
                                "trade_blueprint": {
                                    "entry_trigger": b_row.entry_trigger,
                                    "stop_loss": b_row.stop_loss,
                                    "target_1": b_row.target_1,
                                    "target_2": b_row.target_2,
                                    "risk_reward": b_row.risk_reward or 2.5,
                                },
                                "indicators": {
                                    "daily_rsi": b_row.daily_rsi_at_scan or 60.0,
                                    "weekly_rsi": b_row.weekly_rsi_at_scan or 60.0,
                                    "volume_surge_ratio": b_row.vol_surge_ratio_at_scan or 1.5,
                                },
                                "scan_source": "LIVE_BREAKOUT",
                                "breakout_triggered": b_row.breakout_triggered,
                            }
                            candidates_by_sym[s] = b_dict
                    except Exception as b_err:
                        logger.warning(f"Error checking live momentum breakouts: {b_err}")

                for sym, opp in candidates_by_sym.items():
                    match_count = int(opp.get("match_count", 0))
                    c_score = int(opp.get("conviction_score", 0))
                    scan_source = opp.get("scan_source", "FNO_BASKET")
                    is_live_breakout = (scan_source == "LIVE_BREAKOUT")

                    qualifies_match_9 = mom_match_enabled and (match_count >= min_match)
                    qualifies_conv_79 = mom_conv_enabled and (c_score >= min_conv)
                    qualifies_live = is_live_breakout and (match_count >= min_match or opp.get("breakout_triggered"))

                    if not (qualifies_match_9 or qualifies_conv_79 or qualifies_live):
                        continue

                    # Deduplication check for momentum
                    existing = (
                        db.query(SystemNotification)
                        .filter(
                            SystemNotification.category == "MOMENTUM_RADAR",
                            SystemNotification.created_at >= today_start,
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
                        skipped_duplicates.append({"engine": "momentum-radar", "symbol": sym, "reason": "Already alerted today"})
                        continue

                    company_name = opp.get("company_name", sym)
                    cmp_price = float(opp.get("cmp", 0.0))
                    tb = opp.get("trade_blueprint", {})
                    ind = opp.get("indicators", {})
                    market_cap_cr = opp.get("market_cap_cr")
                    turnover_lakhs = opp.get("turnover_lakhs")

                    entry_trigger = float(tb.get("entry_trigger", cmp_price))
                    stop_loss = float(tb.get("stop_loss", cmp_price * 0.95))
                    target_1 = float(tb.get("target_1", cmp_price * 1.08))
                    target_2 = float(tb.get("target_2", cmp_price * 1.16))
                    rr = float(tb.get("risk_reward", 2.5))
                    d_rsi = float(ind.get("daily_rsi", 60.0))
                    w_rsi = float(ind.get("weekly_rsi", 60.0))
                    vol_surge = float(ind.get("volume_surge_ratio", 1.5))

                    tag = "PERFECT 10/10" if match_count == 10 else f"{match_count}/10 MATCH"
                    if is_live_breakout:
                        headline_tag = f"LIVE BREAKOUT {match_count}/10"
                        title = f"🔥 MOMENTUM BREAKOUT: {sym} ({headline_tag})"
                    elif scan_source == "FULL_UNIVERSE":
                        if qualifies_match_9 and qualifies_conv_79:
                            headline_tag = f"UNIVERSE {match_count}/10 & {c_score} PTS"
                        elif qualifies_match_9:
                            headline_tag = f"UNIVERSE {match_count}/10"
                        else:
                            headline_tag = f"UNIVERSE {c_score} PTS"
                        title = f"🌐 MOMENTUM RADAR: {sym} ({headline_tag})"
                    else:
                        if qualifies_match_9 and qualifies_conv_79:
                            headline_tag = f"MATCH {match_count}/10 & CONVICTION {c_score} PTS"
                        elif qualifies_match_9:
                            headline_tag = f"MATCH SCORE {match_count}/10"
                        else:
                            headline_tag = f"CONVICTION SCORE {c_score} PTS"
                        title = f"🚀 MOMENTUM RADAR: {sym} ({headline_tag})"

                    depth_str = ""
                    if market_cap_cr is not None:
                        depth_str += f" | Mcap ₹{int(market_cap_cr):,} Cr"
                    if turnover_lakhs is not None:
                        depth_str += f" | 20D TO ₹{int(turnover_lakhs):,}L"

                    message = (
                        f"Multi-Timeframe Confluence: {match_count}/10 criteria met, Conviction: {c_score} pts{depth_str}. "
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
                        "scan_source": scan_source,
                        "market_cap_cr": market_cap_cr,
                        "turnover_lakhs": turnover_lakhs,
                        "cmp": cmp_price,
                        "entry_trigger": entry_trigger,
                        "stop_loss": stop_loss,
                        "target_1": target_1,
                        "target_2": target_2,
                        "daily_rsi": d_rsi,
                        "weekly_rsi": w_rsi,
                        "volume_surge_ratio": vol_surge,
                        "action_url": "/momentum-radar?tab=universe" if scan_source == "FULL_UNIVERSE" else "/momentum-radar",
                    }

                    severity = "critical" if match_count == 10 or c_score >= 88 or is_live_breakout else "warning"
                    notif = AlertDispatchService.create_in_app_notification(
                        db=db,
                        title=title,
                        message=message,
                        category="MOMENTUM_RADAR",
                        severity=severity,
                        action_url="/momentum-radar?tab=universe" if scan_source == "FULL_UNIVERSE" else "/momentum-radar",
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
                        action_url="http://localhost:3000/momentum-radar?tab=universe" if scan_source == "FULL_UNIVERSE" else "http://localhost:3000/momentum-radar",
                        market_cap_cr=market_cap_cr,
                        turnover_lakhs=turnover_lakhs,
                        scan_source=scan_source,
                    )
                    cls._dispatch_external_channels(db, sym, memo, rules)

                    dispatched_alerts.append({"engine": "momentum-radar", "symbol": sym, "title": title, "notif_id": notif.id, "source": scan_source})

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

        # ==================================================================
        # 7. /announcements — High-Impact Order Win Radar
        # ==================================================================
        try:
            order_res = cls.scan_order_win_radar_alerts(db=db, rules=rules)
            for item in order_res:
                dispatched_alerts.append(item)
        except Exception as ow_err:
            logger.error(f"Error evaluating order win radar alerts in master scan: {ow_err}", exc_info=True)

        # ==================================================================
        # 8. /techno-funda — Techno-Funda Near-Pivot Breakouts
        # ==================================================================
        try:
            tf_res = cls.scan_techno_funda_alerts(db=db, rules=rules)
            for item in tf_res:
                dispatched_alerts.append(item)
        except Exception as tf_err:
            logger.error(f"Error evaluating techno-funda alerts in master scan: {tf_err}", exc_info=True)

        # ==================================================================
        # 9. /delivery-radar — Institutional Delivery Surge Breakouts
        # ==================================================================
        try:
            deliv_res = cls.scan_delivery_breakout_alerts(db=db, rules=rules)
            for item in deliv_res:
                dispatched_alerts.append(item)
        except Exception as del_err:
            logger.error(f"Error evaluating delivery breakout alerts in master scan: {del_err}", exc_info=True)

        # ==================================================================
        # 10. /institutional-radar — Mutual Fund Smart Money & Fresh Entries
        # ==================================================================
        try:
            mf_res = cls.scan_institutional_mf_alerts(db=db, rules=rules)
            for item in mf_res:
                dispatched_alerts.append(item)
        except Exception as mf_err:
            logger.error(f"Error evaluating institutional MF alerts in master scan: {mf_err}", exc_info=True)

        # ==================================================================
        # 11. /growth-screener — Fundamental PAT & Sales Acceleration
        # ==================================================================
        try:
            growth_res = cls.scan_growth_screener_alerts(db=db, rules=rules)
            for item in growth_res:
                dispatched_alerts.append(item)
        except Exception as gr_err:
            logger.error(f"Error evaluating growth screener alerts in master scan: {gr_err}", exc_info=True)

        # ==================================================================
        # 12. /ipo-radar — Mainboard IPO Breakouts & Base Cheats
        # ==================================================================
        try:
            ipo_res = cls.scan_ipo_radar_alerts(db=db, rules=rules)
            for item in ipo_res:
                dispatched_alerts.append(item)
        except Exception as ipo_err:
            logger.error(f"Error evaluating IPO radar alerts in master scan: {ipo_err}", exc_info=True)

        # ==================================================================
        # 13. /investor-intelligence — Transformational Concall Multibaggers
        # ==================================================================
        try:
            trans_res = cls.scan_transformational_multibaggers_alerts(db=db, rules=rules)
            for item in trans_res:
                dispatched_alerts.append(item)
        except Exception as trans_err:
            logger.error(f"Error evaluating transformational multibagger alerts in master scan: {trans_err}", exc_info=True)

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
        Enforces strict deduplication via AlertDispatchLog so symbols aren't broadcast twice.
        """
        cutoff_time = AlertDispatchService.get_dedup_cutoff(hours=18)

        # Telegram Dispatch
        if rules.get("auto_broadcast_telegram", True):
            try:
                tg_cfg_dict = AlertDispatchService.get_telegram_config(db)
                if tg_cfg_dict and tg_cfg_dict.get("is_enabled", True):
                    already_sent_tg = (
                        db.query(AlertDispatchLog)
                        .filter(
                            AlertDispatchLog.channel == "TELEGRAM",
                            AlertDispatchLog.symbol == symbol,
                            AlertDispatchLog.status == "SUCCESS",
                            AlertDispatchLog.dispatched_at >= cutoff_time,
                        )
                        .first()
                    )
                    if already_sent_tg:
                        logger.info(f"Skipping Telegram dispatch: {symbol} already dispatched at {already_sent_tg.dispatched_at}")
                    else:
                        res = AlertDispatchService.dispatch_telegram(
                            bot_token=tg_cfg_dict["bot_token"],
                            chat_id=tg_cfg_dict["chat_id"],
                            text=memo_text,
                        )
                        AlertDispatchService.log_dispatch(
                            db=db,
                            channel="TELEGRAM",
                            recipient=tg_cfg_dict["chat_id"],
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
                    already_sent_wa = (
                        db.query(AlertDispatchLog)
                        .filter(
                            AlertDispatchLog.channel == "WHATSAPP",
                            AlertDispatchLog.symbol == symbol,
                            AlertDispatchLog.status == "SUCCESS",
                            AlertDispatchLog.dispatched_at >= cutoff_time,
                        )
                        .first()
                    )
                    if already_sent_wa:
                        logger.info(f"Skipping WhatsApp dispatch: {symbol} already dispatched at {already_sent_wa.dispatched_at}")
                    else:
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

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)

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

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)

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

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)

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
    def scan_order_win_radar_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
        force_top_recent: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Scans AnnouncementRadar for high-impact Order Win contract awards meeting significance & size thresholds.
        Evaluates quant significance scores (>= 65 by default), deduplicates daily per symbol,
        generates in-app SystemNotification (category ORDER_WIN_RADAR), and broadcasts to Telegram / WhatsApp.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("order_win_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            min_score = float(rules.get("order_win_min_significance", 65.0))
            min_deal = float(rules.get("order_win_min_deal_cr", 25.0))

            query = (
                db.query(AnnouncementRadar)
                .filter(
                    (AnnouncementRadar.catalyst_type == "ORDER_WIN") | (AnnouncementRadar.order_significance_score.isnot(None)),
                    AnnouncementRadar.order_significance_score >= min_score,
                )
            )

            if not force_top_recent:
                # Normal operational scan: check announcements published within active session window
                query = query.filter(AnnouncementRadar.published_at >= today_start)

            order_wins = query.order_by(desc(AnnouncementRadar.order_significance_score)).limit(10).all()

            # Fallback if testing/forcing and no orders in last 18h
            if not order_wins and force_top_recent:
                order_wins = (
                    db.query(AnnouncementRadar)
                    .filter(
                        (AnnouncementRadar.catalyst_type == "ORDER_WIN") | (AnnouncementRadar.order_significance_score.isnot(None)),
                        AnnouncementRadar.order_significance_score >= min_score,
                    )
                    .order_by(desc(AnnouncementRadar.order_significance_score))
                    .limit(3)
                    .all()
                )

            for item in order_wins:
                sym = (item.symbol or "").strip().upper()
                if not sym:
                    continue

                deal_val = float(item.deal_value_cr) if item.deal_value_cr is not None else 0.0
                if deal_val > 0 and deal_val < min_deal:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "ORDER_WIN_RADAR",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                score = float(item.order_significance_score or 70.0)
                tier = item.order_significance_tier or ("TRANSFORMATIONAL" if score >= 80 else "HIGH_IMPACT")
                tier_clean = tier.replace("_", " ").upper()
                deal_str = f" ₹{deal_val:,.1f} Cr" if deal_val > 0 else ""
                client = item.order_client_counterparty or ""
                client_str = f" from {client}" if client else ""

                severity = "critical" if score >= 80.0 else "warning"
                title = f"🏆 ORDER WIN RADAR: {sym} ({tier_clean} • {score:.0f} PTS)"
                message = (
                    f"Secured commercial contract{deal_str}{client_str}. "
                    f"Significance: {score:.1f}/100. Target: ₹{float(item.target_price or 0):,.1f} "
                    f"(+{float(item.upside_pct or 0):.1f}%), Win Prob: {float(item.order_upside_prob_pct or 75):.1f}%."
                )

                metadata = {
                    "rule_type": "ORDER_WIN_CONTRACT",
                    "symbol": sym,
                    "company_name": item.company_name or sym,
                    "catalyst_type": "ORDER_WIN",
                    "order_significance_score": score,
                    "order_significance_tier": tier,
                    "deal_value_cr": deal_val,
                    "client_counterparty": client,
                    "order_execution_months": item.order_execution_months,
                    "order_quarterly_rev_cr": item.order_quarterly_rev_cr,
                    "order_earnings_impact_cr": item.order_earnings_impact_cr,
                    "current_price": item.current_price,
                    "target_price": item.target_price,
                    "upside_pct": item.upside_pct,
                    "stop_loss": item.stop_loss,
                    "win_probability": item.order_upside_prob_pct,
                    "action_url": "/announcements?catalyst_type=ORDER_WIN",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="ORDER_WIN_RADAR",
                    severity=severity,
                    action_url="/announcements?catalyst_type=ORDER_WIN",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_order_win_alert(
                    symbol=sym,
                    company_name=item.company_name or sym,
                    deal_value_cr=deal_val if deal_val > 0 else None,
                    significance_score=score,
                    significance_tier=tier,
                    client_counterparty=client,
                    rev_pct_ttm=item.synergy_rev_pct_ttm,
                    execution_months=item.order_execution_months,
                    quarterly_rev_cr=item.order_quarterly_rev_cr,
                    earnings_impact_cr=item.order_earnings_impact_cr,
                    cmp=item.current_price,
                    target_price=item.target_price,
                    upside_pct=item.upside_pct,
                    stop_loss=item.stop_loss,
                    upside_prob_pct=item.order_upside_prob_pct,
                    headline=item.headline,
                    thesis=item.buy_thesis or item.ai_insight,
                    source_url=item.source_url,
                )

                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "order-win-radar", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Order Win Radar for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_techno_funda_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans TechnoFundaService for high setup scores and near-pivot setups.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("techno_funda_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            min_score = float(rules.get("techno_funda_min_score", 85.0))
            max_pivot_dist = float(rules.get("techno_funda_max_pivot_dist", 4.0))

            screener_data = TechnoFundaService.get_screener_results(
                db=db,
                limit=35,
                sort_by="setup_score",
                sort_order="desc",
            )
            items = screener_data.get("items", [])

            for item in items:
                sym = (item.get("symbol") or "").strip().upper()
                if not sym:
                    continue

                setup_sc = float(item.get("setup_score", 0.0))
                pivot_dist = float(item.get("distance_to_pivot_pct", 999.0))

                if setup_sc < min_score or pivot_dist > max_pivot_dist:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "TECHNO_FUNDA",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                cmp_val = float(item.get("current_price") or 0.0)
                pivot_val = float(item.get("model_pivot") or item.get("pivot_price") or cmp_val * 1.02)
                co_name = item.get("company_name") or sym
                sec = item.get("sector") or "Diversified"
                hlth = float(item.get("health_score") or 70.0)
                sig = item.get("signal") or "PRE_BREAKOUT"
                pat = item.get("primary_pattern") or item.get("pattern") or "VCP Base"

                severity = "critical" if setup_sc >= 90.0 else "warning"
                title = f"🎯 TECHNO-FUNDA: {sym} (Score {setup_sc:.1f} • {pivot_dist:+.1f}% from Pivot)"
                message = (
                    f"Setup Score {setup_sc:.1f}/100 with Stage-2 confirmation. "
                    f"CMP ₹{cmp_val:,.2f} | Model Pivot: ₹{pivot_val:,.2f} ({pivot_dist:+.1f}% away). "
                    f"Pattern: {pat}, Signal: {sig}, Health: {hlth:.0f}/100."
                )

                metadata = {
                    "rule_type": "TECHNO_FUNDA_SCREENER",
                    "symbol": sym,
                    "company_name": co_name,
                    "setup_score": setup_sc,
                    "distance_to_pivot_pct": pivot_dist,
                    "cmp": cmp_val,
                    "model_pivot": pivot_val,
                    "signal": sig,
                    "health_score": hlth,
                    "action_url": "/techno-funda",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="TECHNO_FUNDA",
                    severity=severity,
                    action_url="/techno-funda",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_techno_funda_alert(
                    symbol=sym,
                    company_name=co_name,
                    setup_score=setup_sc,
                    cmp=cmp_val,
                    pivot_price=pivot_val,
                    distance_to_pivot_pct=pivot_dist,
                    sector=sec,
                    health_score=hlth,
                    signal=sig,
                    pattern=pat,
                    action_url="http://localhost:3000/techno-funda",
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "techno-funda", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Techno-Funda for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_delivery_breakout_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans DeliveryScreenerService for institutional delivery volume surge candidates.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("delivery_breakout_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            tier_filter = str(rules.get("delivery_tier", "ACTIVE_SWING")).upper()
            min_spike = float(rules.get("delivery_min_spike", 1.6))
            min_pct = float(rules.get("delivery_min_pct", 55.0))
            min_flow_20d = float(rules.get("delivery_min_flow_20d", 1.15))

            deliv_data = DeliveryScreenerService.scan_opportunities(
                force_refresh=False,
                min_spike=min_spike,
                min_deliv_per=min_pct,
                lookback_sessions=1,
            )
            items = deliv_data.get("opportunities", [])

            for item in items:
                sym = (item.get("symbol") or "").strip().upper()
                if not sym:
                    continue

                tier = item.get("conviction_tier", "ACTIVE_SWING").upper()
                # Tier Filter Evaluation
                if tier_filter == "APEX_SNIPER" and tier != "APEX_SNIPER":
                    continue
                elif tier_filter == "ACTIVE_SWING" and tier not in ["APEX_SNIPER", "ACTIVE_SWING"]:
                    continue

                spike = float(item.get("delivery_spike_x", 0.0))
                deliv_per = float(item.get("delivery_per", 0.0))
                flow_20d = float(item.get("deliv_flow_20d", 1.0))
                conv_score = float(item.get("conviction_score", 80.0))

                if spike < min_spike or deliv_per < min_pct or flow_20d < min_flow_20d:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "DELIVERY_BREAKOUT",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                cmp_val = float(item.get("current_price") or 0.0)
                co_name = item.get("company_name") or sym
                sec = item.get("sector") or "Diversified"
                stype = item.get("setup_type") or "50D_BREAKOUT"

                # Unpack tailored execution blueprint
                bp = item.get("blueprint") or {}
                t1 = float(bp.get("target_1") or cmp_val * 1.055)
                t2 = float(bp.get("target_2") or cmp_val * 1.11)
                sl = float(bp.get("stop_loss") or cmp_val * 0.965)
                be_trigger = float(bp.get("breakeven_trigger") or cmp_val * 1.02)
                risk_pct = float(bp.get("risk_pct") or 3.5)
                rr_str = bp.get("rr_ratio") or "1:3.1"
                win_rate_exp = bp.get("win_rate_expectation") or ("68% - 72%" if tier == "APEX_SNIPER" else "60% - 63%")
                trail_rule = bp.get("trail_rule") or ""

                tier_icon = "🎯" if tier == "APEX_SNIPER" else ("⚡" if tier == "ACTIVE_SWING" else "📡")
                severity = "critical" if tier == "APEX_SNIPER" or spike >= 3.0 else "warning"

                title = f"{tier_icon} {tier.replace('_', ' ')}: {sym} ({flow_20d:.1f}x Flow • {deliv_per:.0f}% Deliv)"
                message = (
                    f"Institutional delivery surge on {co_name} ({deliv_per:.1f}% delivery, {spike:.2f}x spike, {flow_20d:.2f}x 20D flow). "
                    f"CMP ₹{cmp_val:,.2f} | Setup: {stype.replace('_', ' ')}. "
                    f"SL: ₹{sl:,.2f} (-{risk_pct}%) | BE Lock: ₹{be_trigger:,.2f} (+2.0%) | "
                    f"Targets: T1 ₹{t1:,.2f} / T2 ₹{t2:,.2f} | R:R {rr_str} (Exp WR: {win_rate_exp})."
                )

                metadata = {
                    "rule_type": "DELIVERY_SPIKE_ACCUMULATION",
                    "symbol": sym,
                    "company_name": co_name,
                    "conviction_tier": tier,
                    "delivery_spike_x": spike,
                    "delivery_per": deliv_per,
                    "deliv_flow_20d": flow_20d,
                    "setup_type": stype,
                    "cmp": cmp_val,
                    "target_1": t1,
                    "target_2": t2,
                    "breakeven_trigger": be_trigger,
                    "stop_loss": sl,
                    "risk_reward": rr_str,
                    "win_rate_expectation": win_rate_exp,
                    "trail_rule": trail_rule,
                    "action_url": "/delivery-radar",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="DELIVERY_BREAKOUT",
                    severity=severity,
                    action_url="/delivery-radar",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_delivery_breakout_alert(
                    symbol=sym,
                    company_name=co_name,
                    delivery_per=deliv_per,
                    delivery_spike_x=spike,
                    cmp=cmp_val,
                    setup_type=stype,
                    conviction_score=conv_score,
                    sector=sec,
                    tier=tier,
                    deliv_flow_20d=flow_20d,
                    target_1=t1,
                    target_2=t2,
                    breakeven_trigger=be_trigger,
                    stop_loss=sl,
                    risk_pct=risk_pct,
                    risk_reward=rr_str,
                    win_rate_expectation=win_rate_exp,
                    trail_rule=trail_rule,
                    action_url="http://localhost:3000/delivery-radar",
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "delivery-radar", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Delivery Radar for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_institutional_mf_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans MFAnalyticsService for institutional mutual fund accumulation and fresh AMC entries.
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("institutional_mf_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            min_schemes = int(rules.get("institutional_min_schemes", 3))
            min_smart_score = float(rules.get("institutional_min_smart_money_score", 80.0))

            screener_data = MFAnalyticsService.get_institutional_radar_screener(
                db=db,
                limit=25,
                sort_by="smart_money_score",
                sort_order="desc",
            )
            items = screener_data.get("items", [])

            for item in items:
                sym = (item.get("symbol") or "").strip().upper()
                if not sym:
                    continue

                sm_score = float(item.get("smart_money_score") or 0.0)
                mf_cnt = int(item.get("mf_count") or item.get("schemes_count") or 0)

                if sm_score < min_smart_score and mf_cnt < min_schemes:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "INSTITUTIONAL_MF",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                co_name = item.get("company_name") or sym
                sec = item.get("sector") or "Diversified"
                net_chg = float(item.get("net_change_shares_pct") or 5.0)

                title = f"🏛️ SMART MONEY RADAR: {sym} (Score {sm_score:.1f} • {mf_cnt} Schemes)"
                message = (
                    f"Strong institutional float absorption across {mf_cnt} domestic mutual fund portfolios. "
                    f"Smart Money Score: {sm_score:.1f}/100. Net shares accumulated: {net_chg:+.1f}%."
                )

                metadata = {
                    "rule_type": "INSTITUTIONAL_MF_ACCUMULATION",
                    "symbol": sym,
                    "company_name": co_name,
                    "smart_money_score": sm_score,
                    "mf_count": mf_cnt,
                    "net_change_shares_pct": net_chg,
                    "action_url": "/institutional-radar",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="INSTITUTIONAL_MF",
                    severity="critical" if sm_score >= 88.0 else "info",
                    action_url="/institutional-radar",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_institutional_mf_alert(
                    symbol=sym,
                    company_name=co_name,
                    smart_money_score=sm_score,
                    schemes_count=mf_cnt,
                    net_shares_change_pct=net_chg,
                    sector=sec,
                    action_url="http://localhost:3000/institutional-radar",
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "institutional-radar", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Institutional MF Radar for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_growth_screener_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans fundamental growth acceleration leaders (YoY PAT and Sales breakout).
        """
        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("growth_screener_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            min_pat = float(rules.get("growth_min_pat_pct", 50.0))
            min_sales = float(rules.get("growth_min_sales_pct", 25.0))

            records = (
                db.query(ScreenerGrowthRecord)
                .filter(
                    ScreenerGrowthRecord.profit_growth_ttm >= min_pat,
                    ScreenerGrowthRecord.sales_growth_ttm >= min_sales,
                )
                .order_by(desc(ScreenerGrowthRecord.profit_growth_ttm))
                .limit(10)
                .all()
            )

            for rec in records:
                sym = (rec.symbol or "").strip().upper()
                if not sym:
                    continue

                pat_g = float(rec.profit_growth_ttm or 0.0)
                sales_g = float(rec.sales_growth_ttm or 0.0)

                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "GROWTH_SCREENER",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                co_name = rec.company_name or sym
                opm_val = float(rec.opm_ttm or rec.opm_latest or 15.0)
                pe_val = float(rec.stock_pe) if rec.stock_pe else None

                title = f"🚀 GROWTH BREAKOUT: {sym} (PAT +{pat_g:.1f}% YoY • Sales +{sales_g:.1f}%)"
                message = (
                    f"Exceptional quarterly fundamental acceleration. "
                    f"YoY PAT: +{pat_g:.1f}%, YoY Sales: +{sales_g:.1f}%, OPM: {opm_val:.1f}%."
                )

                metadata = {
                    "rule_type": "GROWTH_SCREENER_ACCELERATION",
                    "symbol": sym,
                    "company_name": co_name,
                    "profit_growth_ttm": pat_g,
                    "sales_growth_ttm": sales_g,
                    "opm_ttm": opm_val,
                    "stock_pe": pe_val,
                    "action_url": "/growth-screener",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="GROWTH_SCREENER",
                    severity="critical" if pat_g >= 100.0 else "info",
                    action_url="/growth-screener",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_growth_breakout_alert(
                    symbol=sym,
                    company_name=co_name,
                    pat_growth_yoy=pat_g,
                    rev_growth_yoy=sales_g,
                    opm=opm_val,
                    pe=pe_val,
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "growth-screener", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Growth Screener for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_ipo_radar_alerts(
        cls,
        db: Session,
        rules: Optional[Dict[str, Any]] = None,
        force_top_recent: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Scans Mainboard IPO Radar for active high-conviction institutional setups:
        - Blue-Sky Listing Day High (LDH) Breakouts
        - IPO Base & Cheat Pivots (VCP Contraction)
        - SEBI 30-Day & 90-Day Anchor Lock-in Float Absorption
        - Broken Phoenix Turnaround Reclaims
        Deduplicates per symbol daily, creates in-app notification (IPO_RADAR), and broadcasts to Telegram / WhatsApp.
        """
        from app.services.ipo_radar_service import IPORadarService

        if rules is None:
            rules = cls.get_opportunity_thresholds(db)

        if not rules.get("ipo_radar_enabled", True):
            return []

        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        dispatched = []

        try:
            min_conviction = float(rules.get("ipo_min_conviction", 85.0))
            blue_sky_only = bool(rules.get("ipo_blue_sky_only", False))

            data = IPORadarService.scan_all(force_refresh=force_top_recent)
            candidates = data.get("candidates", [])

            for cand in candidates:
                sym = cand.get("symbol", "").strip().upper()
                if not sym:
                    continue

                c_score = float(cand.get("conviction_score", 0.0))
                setup_type = cand.get("setup_type", "")
                setup_status = cand.get("setup_status", "")

                # Filtering rules
                if blue_sky_only and "LDH" not in setup_type:
                    continue

                if c_score < min_conviction and setup_status not in ["TRIGGERED", "DAY_1_ACTIVE"]:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category == "IPO_RADAR",
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                company_name = cand.get("company", sym)
                cmp_price = float(cand.get("cmp", 0.0))
                pivot_price = float(cand.get("pivot_price", 0.0))
                stop_loss = float(cand.get("stop_loss", 0.0))
                target_1 = float(cand.get("target_1", 0.0))
                target_2 = float(cand.get("target_2", 0.0))
                risk_pct = float(cand.get("risk_pct", 0.0))
                day1_high = float(cand.get("day1_high", 0.0))
                days_since_listing = int(cand.get("days_since_listing", 0))
                rvol = float(cand.get("rvol", 1.0))
                setup_label = cand.get("setup_label", setup_type)
                anchor_days_left = cand.get("anchor_30d_days_left")

                severity = "critical" if setup_status == "TRIGGERED" or c_score >= 90.0 else "warning"
                title = f"🚀 IPO RADAR: {sym} ({setup_label} • {c_score:.0f} PTS)"
                message = (
                    f"Mainboard IPO setup active ({setup_status}). "
                    f"CMP: ₹{cmp_price:,.1f}, Pivot: ₹{pivot_price:,.1f}, SL: ₹{stop_loss:,.1f} (-{risk_pct:.1f}%). "
                    f"2R Target: ₹{target_1:,.1f} (+15%). RelVol: {rvol:.2f}x."
                )

                metadata = {
                    "rule_type": "IPO_RADAR",
                    "symbol": sym,
                    "company_name": company_name,
                    "setup_type": setup_type,
                    "setup_label": setup_label,
                    "setup_status": setup_status,
                    "conviction_score": c_score,
                    "cmp": cmp_price,
                    "pivot_price": pivot_price,
                    "stop_loss": stop_loss,
                    "target_1": target_1,
                    "target_2": target_2,
                    "risk_pct": risk_pct,
                    "day1_high": day1_high,
                    "days_since_listing": days_since_listing,
                    "action_url": "/ipo-radar",
                }

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="IPO_RADAR",
                    severity=severity,
                    action_url="/ipo-radar",
                    metadata=metadata,
                )

                memo = AlertDispatchService.format_ipo_radar_alert(
                    symbol=sym,
                    company_name=company_name,
                    setup_type=setup_type,
                    setup_label=setup_label,
                    setup_status=setup_status,
                    conviction_score=c_score,
                    cmp=cmp_price,
                    pivot_price=pivot_price,
                    stop_loss=stop_loss,
                    target_1=target_1,
                    target_2=target_2,
                    risk_pct=risk_pct,
                    day1_high=day1_high,
                    days_since_listing=days_since_listing,
                    rvol=rvol,
                    anchor_days_left=anchor_days_left,
                    rationale=cand.get("rationale"),
                    action_url="http://localhost:3000/ipo-radar",
                )
                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "ipo-radar", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Mainboard IPO Radar for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def scan_transformational_multibaggers_alerts(
        cls,
        db: Session,
        rules: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Scans investor presentations and concall analyses for multibagger triggers
        reconciled against real-time technical stage analysis.
        """
        if not rules.get("transformational_multibaggers_enabled", True):
            return []

        dispatched: List[Dict[str, Any]] = []
        today_start = AlertDispatchService.get_dedup_cutoff(hours=18)
        min_score = float(rules.get("transformational_min_conviction", 80.0))

        try:
            from app.services.investor_intelligence_service import InvestorIntelligenceService
            opps = InvestorIntelligenceService.get_active_opportunities(db)
            candidates = opps.get("ready_to_buy", []) + opps.get("inflection_radar", [])

            for cand in candidates:
                sym = cand.get("symbol", "").strip().upper()
                if not sym:
                    continue

                c_score = float(cand.get("conviction_score") or 0.0)
                if c_score < min_score:
                    continue

                # Deduplication check
                existing = (
                    db.query(SystemNotification)
                    .filter(
                        SystemNotification.category.in_(["TRANSFORMATIONAL_CATALYST", "MULTIBAGGER_OPPORTUNITY"]),
                        SystemNotification.created_at >= today_start,
                        SystemNotification.title.like(f"%{sym}%"),
                    )
                    .first()
                )
                if existing:
                    continue

                opp_class = cand.get("opportunity_type", "READY_TO_BUY_STAGE_2")
                badge = cand.get("badge", "READY TO BUY")
                is_ready = (opp_class == "READY_TO_BUY_STAGE_2")
                severity = "critical" if is_ready else "warning"

                headline = cand.get("catalyst_headline") or f"Transformational Growth Radar for {sym}"
                cmp_price = float(cand.get("cmp") or 0.0)
                dma_50 = float(cand.get("dma_50") or 0.0)
                dma_200 = float(cand.get("dma_200") or 0.0)
                verdict = cand.get("verdict") or ("READY TO BUY" if is_ready else "ACCUMULATE ON BASE BREAKOUT")

                title = f"🚀 MULTIBAGGER RADAR: {sym} ({badge})"
                message = f"{headline}. Stance: {cand.get('institutional_stance')}. CMP: ₹{cmp_price:,.1f}. Verdict: {verdict}"

                notif = AlertDispatchService.create_in_app_notification(
                    db=db,
                    title=title,
                    message=message,
                    category="TRANSFORMATIONAL_CATALYST",
                    severity=severity,
                    action_url="/investor-intelligence",
                    metadata=cand,
                )

                memo = AlertDispatchService.format_transformational_multibagger_alert(
                    symbol=sym,
                    company_name=cand.get("company_name", sym),
                    opportunity_class=opp_class,
                    catalyst_headline=headline,
                    catalyst_category=cand.get("catalyst_category") or "GROWTH_LEADER",
                    guidance_change=cand.get("guidance_change"),
                    conviction_score=c_score,
                    cmp=cmp_price,
                    dma_50=dma_50 if dma_50 > 0 else None,
                    dma_200=dma_200 if dma_200 > 0 else None,
                    action_verdict=verdict,
                    entry_corridor=f"₹{cmp_price*0.99:.1f} – ₹{cmp_price*1.02:.1f}" if cmp_price > 0 else None,
                    stop_loss=round(dma_50 * 0.97, 1) if dma_50 > 0 else None,
                )

                cls._dispatch_external_channels(db, sym, memo, rules)
                dispatched.append({"engine": "investor-intelligence", "symbol": sym, "title": title, "notif_id": notif.id})

        except Exception as e:
            logger.error(f"Error scanning Transformational Multibaggers for alerts: {e}", exc_info=True)

        return dispatched

    @classmethod
    def get_recent_opportunity_alerts(cls, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns recent opportunity notifications across all key radar categories.
        """
        categories = [
            "VCP_BREAKOUT",
            "PRE_BREAKOUT",
            "MOMENTUM_RADAR",
            "TOMORROW_RADAR",
            "ATHENA_PEAD",
            "CATALYST_ORDER",
            "ORDER_WIN_RADAR",
            "TECHNO_FUNDA",
            "DELIVERY_BREAKOUT",
            "INSTITUTIONAL_MF",
            "GROWTH_SCREENER",
            "BREAKOUT_EXECUTION",
            "IPO_RADAR",
            "TRANSFORMATIONAL_CATALYST",
            "MULTIBAGGER_OPPORTUNITY",
        ]
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
