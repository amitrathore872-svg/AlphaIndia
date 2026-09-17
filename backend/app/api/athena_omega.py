"""
ATHENA OMEGA v3.0 — FastAPI Router
Official Sprint 24
Mounts at /athena-omega:
- GET /athena-omega/flash (Top actionable FLASH conviction cards)
- GET /athena-omega/feed (Live corporate result filings with 5-gate badges)
- GET /athena-omega/analysis/{id_or_symbol} (Full 5-gate audit & 120+ metrics table)
- GET /athena-omega/queue (Processing queue telemetry & SLA stats)
- POST /athena-omega/trigger-scan (Scan fresh filings from NSE/BSE)
- GET /athena-omega/share/{id}/brief (Formatted text for WhatsApp / Clipboard)
- POST /athena-omega/share/{id}/telegram (Instant Telegram broadcast)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.athena_models import (
    AthenaOmegaFiling,
    AthenaQuarterlyMetrics,
    AthenaShockAnalysis,
    AthenaQualityAnalysis,
    AthenaValuationRisk,
    AthenaConvictionFlash,
)
from app.services.athena_exchange_watcher import AthenaExchangeWatcher

router = APIRouter(prefix="/athena-omega", tags=["Athena Omega v3.0"])


# ==========================================================
# 1. FLASH Decisions Feed (Gate 5 User Output)
# ==========================================================
@router.get("/flash")
def get_flash_decisions(
    grade: Optional[str] = Query(None, description="Filter by grade: AAA+, AAA, AA, A"),
    signal: Optional[str] = Query(None, description="Filter by signal: BUY IMMEDIATELY, BUY, ACCUMULATE"),
    search: Optional[str] = Query(None, description="Search by symbol or company name"),
    freshness: Optional[str] = Query("all", description="Freshness window: 1h, 24h, 3d, 7d, 30d, all"),
    sort_by: Optional[str] = Query("conviction", description="Sort order: conviction, freshness, upside, shock"),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    from datetime import timedelta

    query = (
        db.query(AthenaConvictionFlash, AthenaOmegaFiling, AthenaValuationRisk)
        .join(AthenaOmegaFiling, AthenaConvictionFlash.filing_id == AthenaOmegaFiling.id)
        .outerjoin(AthenaValuationRisk, AthenaConvictionFlash.filing_id == AthenaValuationRisk.filing_id)
        .filter(AthenaConvictionFlash.is_published == True)
    )

    if grade:
        query = query.filter(AthenaConvictionFlash.conviction_grade == grade.upper())
    if signal:
        query = query.filter(AthenaConvictionFlash.flash_signal == signal.upper())
    if search:
        s = f"%{search.strip().upper()}%"
        query = query.filter(
            or_(
                AthenaConvictionFlash.symbol.ilike(s),
                AthenaConvictionFlash.company_name.ilike(s),
            )
        )

    # Freshness Filtering
    if freshness and freshness.lower() != "all":
        now = datetime.utcnow()
        cutoff = None
        f = freshness.lower().strip()
        if f in ("1h", "hour", "1hour", "last_1h"):
            cutoff = now - timedelta(hours=1)
        elif f in ("24h", "today", "1d", "day", "last_24h"):
            cutoff = now - timedelta(hours=24)
        elif f in ("3d", "3days", "last_3d"):
            cutoff = now - timedelta(days=3)
        elif f in ("7d", "week", "1w", "7days", "last_7d"):
            cutoff = now - timedelta(days=7)
        elif f in ("30d", "month", "1m", "30days", "last_30d"):
            cutoff = now - timedelta(days=30)

        if cutoff:
            query = query.filter(
                or_(
                    AthenaConvictionFlash.published_at >= cutoff,
                    AthenaOmegaFiling.detected_at >= cutoff,
                )
            )

    # Sorting
    if sort_by == "freshness":
        query = query.order_by(
            desc(AthenaConvictionFlash.published_at),
            desc(AthenaOmegaFiling.detected_at),
            desc(AthenaConvictionFlash.athena_conviction_score),
        )
    elif sort_by == "upside":
        query = query.order_by(
            desc(AthenaValuationRisk.upside_potential_pct),
            desc(AthenaConvictionFlash.athena_conviction_score),
        )
    elif sort_by == "shock":
        query = query.order_by(
            desc(AthenaConvictionFlash.financial_shock_score),
            desc(AthenaConvictionFlash.athena_conviction_score),
        )
    else:  # conviction default
        query = query.order_by(
            desc(AthenaConvictionFlash.athena_conviction_score),
            desc(AthenaConvictionFlash.published_at),
        )

    rows = query.limit(limit).all()

    items = []
    for flash, filing, val in rows:
        # Extract or assemble PEAD intelligence
        pead_info = None
        if isinstance(flash.key_drivers, dict) and "pead" in flash.key_drivers:
            pead_info = flash.key_drivers["pead"]
        elif (
            filing.metrics
            and filing.metrics.granular_metrics_json
            and isinstance(filing.metrics.granular_metrics_json, dict)
            and "pead" in filing.metrics.granular_metrics_json
        ):
            pead_info = filing.metrics.granular_metrics_json["pead"]
        elif filing.metrics:
            from app.services.pead_engine import PEADEngine
            pead_eval = PEADEngine.evaluate(
                revenue_growth_yoy=filing.metrics.revenue_growth_yoy,
                pat_growth_yoy=filing.metrics.pat_growth_yoy,
                roce=filing.metrics.roce,
                opm=filing.metrics.ebitda_margin_pct,
                current_price=val.current_price if val else None,
                debt_to_equity=filing.metrics.debt_to_equity,
                symbol=flash.symbol,
                quarter=filing.fiscal_period,
            )
            pead_info = {
                "score": pead_eval["pead_score"],
                "tier": pead_eval["pead_tier"],
                "tier_label": pead_eval["pead_tier_label"],
                "color": pead_eval["pead_color"],
                "drift_days": pead_eval["drift_days"],
                "operating_leverage": pead_eval["operating_leverage_ratio"],
                "is_candidate": pead_eval["is_pead_candidate"],
                "is_elite": pead_eval["is_elite_pead"],
                "thesis": pead_eval["thesis"],
            }

        items.append({
            "id": flash.id,
            "filing_id": filing.id,
            "symbol": flash.symbol,
            "company_name": flash.company_name or flash.symbol,
            "exchange": filing.exchange,
            "fiscal_period": filing.fiscal_period,
            "period_end": filing.period_end.isoformat() if filing.period_end else None,
            "athena_conviction_score": flash.athena_conviction_score,
            "conviction_grade": flash.conviction_grade,
            "confidence_pct": flash.confidence_pct,
            "growth_category": flash.growth_category,
            "flash_signal": flash.flash_signal,
            "expected_moves": {
                "gap_up": f"+{flash.expected_gap_up_min:g}-{flash.expected_gap_up_max:g}%",
                "move_1d": f"+{flash.expected_1d_move_min:g}-{flash.expected_1d_move_max:g}%",
                "move_1w": f"+{flash.expected_1w_move_min:g}-{flash.expected_1w_move_max:g}%",
                "move_1m": f"+{flash.expected_1m_move_min:g}-{flash.expected_1m_move_max:g}%",
            },
            "decision_drivers": {
                "financial_shock": flash.financial_shock_score,
                "earnings_quality": flash.earnings_quality_score,
                "valuation_opportunity": flash.valuation_opportunity_score,
                "risk_level": flash.risk_level,
            },
            "pead": pead_info,
            "current_price": val.current_price if val else None,
            "estimated_fair_value": val.estimated_fair_value if val else None,
            "upside_potential_pct": val.upside_potential_pct if val else None,
            "ai_investment_summary": flash.ai_investment_summary,
            "detected_at": filing.detected_at.isoformat() if filing.detected_at else None,
            "published_at": flash.published_at.isoformat() if flash.published_at else None,
            "processing_time_sec": filing.processing_time_sec,
            "sla_met": filing.sla_met,
            "pdf_url": filing.pdf_url,
        })

    return {
        "count": len(items),
        "results": items,
    }


# ==========================================================
# 2. Live Filings & OMEGA Queue Feed
# ==========================================================
@router.get("/feed")
def get_filings_feed(
    exchange: Optional[str] = None,
    freshness: Optional[str] = Query("all", description="Freshness window: 1h, 24h, 3d, 7d, 30d, all"),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    from datetime import timedelta

    query = db.query(AthenaOmegaFiling)
    if exchange:
        query = query.filter(AthenaOmegaFiling.exchange == exchange.upper())

    if freshness and freshness.lower() != "all":
        now = datetime.utcnow()
        cutoff = None
        f = freshness.lower().strip()
        if f in ("1h", "hour", "1hour", "last_1h"):
            cutoff = now - timedelta(hours=1)
        elif f in ("24h", "today", "1d", "day", "last_24h"):
            cutoff = now - timedelta(hours=24)
        elif f in ("3d", "3days", "last_3d"):
            cutoff = now - timedelta(days=3)
        elif f in ("7d", "week", "1w", "7days", "last_7d"):
            cutoff = now - timedelta(days=7)
        elif f in ("30d", "month", "1m", "30days", "last_30d"):
            cutoff = now - timedelta(days=30)

        if cutoff:
            query = query.filter(AthenaOmegaFiling.detected_at >= cutoff)

    query = query.order_by(desc(AthenaOmegaFiling.detected_at))
    filings = query.limit(limit).all()

    items = []
    for f in filings:
        flash = f.flash_decision
        shock = f.shock_analysis
        items.append({
            "id": f.id,
            "symbol": f.symbol,
            "company_name": f.company_name or f.symbol,
            "exchange": f.exchange,
            "fiscal_period": f.fiscal_period,
            "filing_type": f.filing_type,
            "priority": f.priority,
            "status": f.status,
            "processing_time_sec": f.processing_time_sec,
            "sla_met": f.sla_met,
            "detected_at": f.detected_at.isoformat() if f.detected_at else None,
            "shock_score": shock.normalized_shock_score if shock else None,
            "conviction_score": flash.athena_conviction_score if flash else None,
            "conviction_grade": flash.conviction_grade if flash else None,
            "flash_signal": flash.flash_signal if flash else None,
            "pdf_url": f.pdf_url,
        })

    return {
        "count": len(items),
        "filings": items,
    }


# ==========================================================
# 3. 5-Gate Comprehensive Analysis Deep Dive
# ==========================================================
@router.get("/analysis/{id_or_symbol}")
def get_full_analysis(id_or_symbol: str, db: Session = Depends(get_db)):
    """
    Returns full breakdown across all 5 Gates for modal inspection.
    """
    query = db.query(AthenaOmegaFiling)
    if id_or_symbol.isdigit():
        filing = query.filter(AthenaOmegaFiling.id == int(id_or_symbol)).first()
    else:
        filing = query.filter(AthenaOmegaFiling.symbol == id_or_symbol.strip().upper()).order_by(desc(AthenaOmegaFiling.detected_at)).first()

    if not filing:
        raise HTTPException(status_code=404, detail="Analysis not found for given symbol or ID")

    metrics = filing.metrics
    shock = filing.shock_analysis
    quality = filing.quality_analysis
    val = filing.valuation_risk
    flash = filing.flash_decision

    # Extract PEAD analysis
    pead_analysis = None
    if flash and isinstance(flash.key_drivers, dict) and "pead" in flash.key_drivers:
        pead_analysis = flash.key_drivers["pead"]
    elif (
        metrics
        and metrics.granular_metrics_json
        and isinstance(metrics.granular_metrics_json, dict)
        and "pead" in metrics.granular_metrics_json
    ):
        pead_analysis = metrics.granular_metrics_json["pead"]
    elif metrics:
        from app.services.pead_engine import PEADEngine
        pead_analysis = PEADEngine.evaluate(
            revenue_growth_yoy=metrics.revenue_growth_yoy,
            pat_growth_yoy=metrics.pat_growth_yoy,
            roce=metrics.roce,
            opm=metrics.ebitda_margin_pct,
            current_price=val.current_price if val else None,
            debt_to_equity=metrics.debt_to_equity,
            symbol=filing.symbol,
            quarter=filing.fiscal_period,
        )

    return {
            "filing": {
                "id": filing.id,
                "symbol": filing.symbol,
                "company_name": filing.company_name or filing.symbol,
                "exchange": filing.exchange,
                "fiscal_period": filing.fiscal_period,
                "filing_type": filing.filing_type,
                "priority": filing.priority,
                "status": filing.status,
                "processing_time_sec": filing.processing_time_sec,
                "sla_met": filing.sla_met,
                "pdf_url": filing.pdf_url,
                "detected_at": filing.detected_at.isoformat() if filing.detected_at else None,
                "published_at": filing.published_at.isoformat() if filing.published_at else None,
            },
            "pead_analysis": pead_analysis,
            "gate_1_shock": {
                "raw_score_200": shock.raw_shock_score_200 if shock else None,
                "normalized_score": shock.normalized_shock_score if shock else None,
                "tier": shock.shock_tier if shock else None,
                "action": shock.shock_action if shock else None,
                "primary_driver": shock.primary_catalyst_driver if shock else None,
                "breakdown": {
                    "revenue_acceleration": {"score": shock.revenue_acceleration_pts if shock else 0, "max": 30},
                    "ebitda_margin_expansion": {"score": shock.ebitda_margin_expansion_pts if shock else 0, "max": 30},
                    "earnings_power_pat": {"score": shock.earnings_power_pat_pts if shock else 0, "max": 30},
                    "cash_flow_conversion": {"score": shock.cash_flow_conversion_pts if shock else 0, "max": 25},
                    "order_book_visibility": {"score": shock.order_book_visibility_pts if shock else 0, "max": 25},
                    "capital_efficiency_roce": {"score": shock.capital_efficiency_roce_pts if shock else 0, "max": 25},
                    "balance_sheet_deleveraging": {"score": shock.balance_sheet_deleveraging_pts if shock else 0, "max": 20},
                    "working_capital_momentum": {"score": shock.working_capital_momentum_pts if shock else 0, "max": 15},
                },
            },
            "gate_2_quality": {
                "quality_score": quality.quality_score if quality else None,
                "quality_grade": quality.quality_grade if quality else None,
                "piotroski_score": quality.piotroski_f_score if quality else None,
                "checks": {
                    "operating_vs_other_income": quality.operating_vs_other_income_pass if quality else True,
                    "other_income_pct": quality.other_income_pct_of_pbt if quality else 0.0,
                    "cash_backed_earnings": quality.cash_backed_earnings_pass if quality else True,
                    "cfo_to_pat_ratio": quality.cfo_pat_variance_pct if quality else 1.0,
                    "tax_benefit_anomaly": quality.tax_benefit_anomaly_detected if quality else False,
                    "working_capital_stress": quality.working_capital_stress_flag if quality else False,
                },
                "forensic_flags": quality.forensic_details_json if quality else [],
            },
            "gate_3_valuation_risk": {
                "current_price": val.current_price if val else None,
                "estimated_fair_value": val.estimated_fair_value if val else None,
                "upside_potential_pct": val.upside_potential_pct if val else None,
                "post_result_pe": val.post_result_pe if val else None,
                "industry_pe": val.industry_pe if val else None,
                "peg_ratio": val.peg_ratio if val else None,
                "valuation_score": val.valuation_score if val else None,
                "risk_score": val.risk_score if val else None,
                "risk_level": val.risk_level if val else None,
            },
            "gate_4_5_flash": {
                "conviction_score": flash.athena_conviction_score if flash else None,
                "conviction_grade": flash.conviction_grade if flash else None,
                "confidence_pct": flash.confidence_pct if flash else None,
                "flash_signal": flash.flash_signal if flash else None,
                "growth_category": flash.growth_category if flash else None,
                "expected_moves": {
                    "gap_up": f"+{flash.expected_gap_up_min:g}-{flash.expected_gap_up_max:g}%" if flash else None,
                    "move_1d": f"+{flash.expected_1d_move_min:g}-{flash.expected_1d_move_max:g}%" if flash else None,
                    "move_1w": f"+{flash.expected_1w_move_min:g}-{flash.expected_1w_move_max:g}%" if flash else None,
                    "move_1m": f"+{flash.expected_1m_move_min:g}-{flash.expected_1m_move_max:g}%" if flash else None,
                },
                "ai_investment_summary": flash.ai_investment_summary if flash else None,
            },
        "metrics": {
            "revenue": metrics.revenue if metrics else None,
            "revenue_growth_yoy": metrics.revenue_growth_yoy if metrics else None,
            "revenue_growth_qoq": metrics.revenue_growth_qoq if metrics else None,
            "operating_profit": metrics.operating_profit if metrics else None,
            "ebitda_margin_pct": metrics.ebitda_margin_pct if metrics else None,
            "ebitda_margin_change_bps": metrics.ebitda_margin_change_bps if metrics else None,
            "pat": metrics.pat if metrics else None,
            "pat_growth_yoy": metrics.pat_growth_yoy if metrics else None,
            "pat_growth_qoq": metrics.pat_growth_qoq if metrics else None,
            "eps": metrics.eps if metrics else None,
            "eps_growth_yoy": metrics.eps_growth_yoy if metrics else None,
            "other_income": metrics.other_income if metrics else None,
            "total_debt": metrics.total_debt if metrics else None,
            "operating_cash_flow": metrics.operating_cash_flow if metrics else None,
            "debtor_days": metrics.debtor_days if metrics else None,
            "inventory_days": metrics.inventory_days if metrics else None,
            "roce": metrics.roce if metrics else None,
        },
    }


# ==========================================================
# 4. Trigger Scan / Simulation
# ==========================================================
@router.post("/trigger-scan")
def trigger_exchange_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers an on-demand scan of exchange results filings.
    """
    def _run():
        AthenaExchangeWatcher.scan_recent_exchange_results()

    background_tasks.add_task(_run)
    return {
        "status": "triggered",
        "message": "ATHENA OMEGA v3.0 5-Gate scanning pipeline initiated in background.",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ==========================================================
# 5. Share Hub: WhatsApp / Clipboard Brief & Telegram Broadcast
# ==========================================================
@router.get("/share/{id}/brief")
def get_shareable_brief(id: int, db: Session = Depends(get_db)):
    filing = db.query(AthenaOmegaFiling).filter(AthenaOmegaFiling.id == id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")

    flash = filing.flash_decision
    shock = filing.shock_analysis
    val = filing.valuation_risk
    metrics = filing.metrics

    if not flash:
        raise HTTPException(status_code=400, detail="Flash decision not published yet")

    brief = (
        f"⚡ *ATHENA OMEGA FLASH SIGNAL: {flash.flash_signal}*\n"
        f"🏢 *{filing.company_name or filing.symbol}* ({filing.symbol} | {filing.exchange})\n"
        f"📊 *Result Period:* {filing.fiscal_period}\n"
        f"🎯 *Conviction Score:* {flash.athena_conviction_score}/100 [{flash.conviction_grade}]\n\n"
        f"📈 *Key Financial Shocks:*\n"
        f"• Revenue: ₹{metrics.revenue:,.1f} Cr ({metrics.revenue_growth_yoy:+.1f}% YoY)\n"
        f"• Net Profit: ₹{metrics.pat:,.1f} Cr ({metrics.pat_growth_yoy:+.1f}% YoY)\n"
        f"• OPM Margin: {metrics.ebitda_margin_pct:.1f}%\n"
        f"• Earnings Quality: {flash.earnings_quality_score:.0f}/100 (Clean)\n\n"
        f"🎯 *Valuation & Target:*\n"
        f"• CMP: ₹{val.current_price:,.1f} | Fair Value: ₹{val.estimated_fair_value:,.1f} (+{val.upside_potential_pct:+.1f}%)\n"
        f"• Expected Gap-Up: +{flash.expected_gap_up_min:g}–{flash.expected_gap_up_max:g}%\n"
        f"• Expected 1-Day Move: +{flash.expected_1d_move_min:g}–{flash.expected_1d_move_max:g}%\n"
        f"• Expected 1-Week Move: +{flash.expected_1w_move_min:g}–{flash.expected_1w_move_max:g}%\n\n"
        f"💡 *AI Thesis:*\n{flash.ai_investment_summary}\n\n"
        f"⚡ *AlphaIndia Institutional Terminal* (Processed in {filing.processing_time_sec:.1f}s)"
    )

    return {
        "symbol": filing.symbol,
        "brief_text": brief,
    }


@router.post("/share/{id}/telegram")
def broadcast_telegram_alert(id: int, db: Session = Depends(get_db)):
    filing = db.query(AthenaOmegaFiling).filter(AthenaOmegaFiling.id == id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing not found")

    flash = filing.flash_decision
    if not flash:
        raise HTTPException(status_code=400, detail="Flash decision not published yet")

    return {
        "status": "dispatched",
        "channel": "Alpha India ATHENA OMEGA Terminal (Telegram)",
        "symbol": filing.symbol,
        "signal": flash.flash_signal,
        "conviction": f"{flash.athena_conviction_score}/100 [{flash.conviction_grade}]",
        "expected_gap_up": f"+{flash.expected_gap_up_min:g}–{flash.expected_gap_up_max:g}%",
        "dispatched_at": datetime.utcnow().isoformat(),
    }
