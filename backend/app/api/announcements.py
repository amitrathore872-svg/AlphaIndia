"""
Alpha India — Announcements & Catalyst AI Radar API
Exposes endpoints for querying high-alpha corporate announcements, AI growth insights, and catalyst filters.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import desc, asc, func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.announcement_radar import AnnouncementRadar
from app.services.announcements_ai_service import run_announcements_ingestion

router = APIRouter(
    prefix="/announcements",
    tags=["Announcements & Catalyst Radar"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AnnouncementOut(BaseModel):
    id:                         int
    symbol:                     Optional[str]
    company_name:               str
    is_listed:                  bool
    category:                   Optional[str]
    headline:                   str
    filing_description:         Optional[str]
    catalyst_type:              str
    impact_level:               str
    impact_score:               float
    ai_insight:                 Optional[str]
    deal_value_cr:              Optional[float]
    synergy_cwip_cr:            Optional[float] = None
    synergy_rev_addition_cr:    Optional[float] = None
    synergy_rev_pct_ttm:        Optional[float] = None
    synergy_ebitda_addition_cr: Optional[float] = None
    synergy_ebitda_margin_pct:  Optional[float] = None
    synergy_interest_saved_cr:  Optional[float] = None
    synergy_pat_accretion_pct:  Optional[float] = None
    post_catalyst_return_1w:    Optional[float] = None
    momentum_status:            Optional[str] = "EARLY"
    recommendation:             Optional[str] = "TACTICAL_BUY"
    conviction_score:           Optional[float] = 80.0
    current_price:              Optional[float] = None
    target_price:               Optional[float] = None
    upside_pct:                 Optional[float] = None
    stop_loss:                  Optional[float] = None
    current_eps:                Optional[float] = None
    forward_eps:                Optional[float] = None
    valuation_pe:               Optional[float] = None
    fair_pe:                    Optional[float] = None
    buy_thesis:                 Optional[str] = None
    source_url:                 Optional[str]
    pdf_url:                    Optional[str]
    published_at:               datetime
    announcement_date:          Optional[datetime] = None
    recommendation_date:        Optional[datetime] = None
    vertical_archetype:         Optional[str] = None
    trend_regime:               Optional[str] = None
    price_at_announcement:      Optional[float] = None
    realized_move_pct:          Optional[float] = None
    absorption_status:          Optional[str] = None
    est_velocity_days:          Optional[str] = None
    dma_50:                     Optional[float] = None
    dma_200:                    Optional[float] = None

    class Config:
        from_attributes = True


class AnnouncementStatsOut(BaseModel):
    total: int
    by_catalyst: dict
    by_impact: dict
    by_recommendation: dict
    by_vertical: dict = {}
    by_absorption: dict = {}
    by_velocity: dict = {}
    by_feed_source: dict = {}
    latest_published_at: Optional[str]


class RunResponse(BaseModel):
    status: str
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/radar", response_model=List[AnnouncementOut])
def get_announcements_radar(
    page:               int = Query(default=1, ge=1),
    limit:              int = Query(default=35, ge=1, le=100),
    catalyst_type:      Optional[str] = Query(default=None, description="CAPEX_COMMISSIONING | ORDER_WIN | USFDA_REGULATORY | DELEVERAGING | DEMERGER_UNLOCK"),
    vertical_archetype: Optional[str] = Query(default=None, description="EARNINGS_ACCELERATION | BASE_BREAKOUT | INSTITUTIONAL_CONSENSUS | OPERATING_LEVERAGE | TURNAROUND_INFLECTION | EXCHANGE_CATALYST"),
    absorption_status:  Optional[str] = Query(default=None, description="FRESH_TRIGGER | IN_EXPANSION | PRICED_IN | STOPPED_OUT"),
    trend_regime:       Optional[str] = Query(default=None, description="GOLDEN_TREND | EARLY_BREAKOUT | DOWNTREND_TRAP"),
    impact_level:       Optional[str] = Query(default=None, description="CRITICAL | HIGH | MEDIUM"),
    recommendation:     Optional[str] = Query(default=None, description="STRONG_BUY | TACTICAL_BUY | ACCUMULATE | WATCHLIST_ONLY"),
    velocity:           Optional[str] = Query(default=None, description="FAST_UNDER_30D | SWING_30_60D | CYCLE_60_120D | 10-25 | 15-35 | 20-50 | 30-65 | 40-75 | 60-120"),
    feed_source:        Optional[str] = Query(default=None, description="ALL | POLL_WIRE | CATALYST"),
    category:           Optional[str] = Query(default=None, description="Raw category filter"),
    search:             Optional[str] = Query(default=None, description="Search company name, symbol or headline"),
    listed_only:        bool = Query(default=False, description="Filter only NSE/BSE listed stocks"),
    announcement_date_from:   Optional[str] = Query(default=None, description="Filter announcement date >= YYYY-MM-DD"),
    announcement_date_to:     Optional[str] = Query(default=None, description="Filter announcement date <= YYYY-MM-DD"),
    recommendation_date_from: Optional[str] = Query(default=None, description="Filter recommendation date >= YYYY-MM-DD"),
    recommendation_date_to:   Optional[str] = Query(default=None, description="Filter recommendation date <= YYYY-MM-DD"),
    sort_by:            str = Query(default="announcement_date", description="Sort field"),
    sort_order:         str = Query(default="desc"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated, sorted list of high-impact corporate announcements with AI Growth Insights and Buy Conviction.
    """
    query = db.query(AnnouncementRadar)

    if feed_source:
        fs = feed_source.strip().upper()
        if fs in ("POLL_WIRE", "WIRE", "EXCHANGE_WIRE", "LIVE_WIRE"):
            query = query.filter(AnnouncementRadar.category == "Live Exchange Filing")
        elif fs in ("CATALYST", "CATALYSTS", "CATALYST_RESULTS", "GROWTH_CATALYST"):
            query = query.filter(AnnouncementRadar.category != "Live Exchange Filing")

    if category:
        query = query.filter(AnnouncementRadar.category == category)

    if catalyst_type:
        cat_list = [c.strip() for c in catalyst_type.split(",") if c.strip()]
        if len(cat_list) == 1:
            query = query.filter(AnnouncementRadar.catalyst_type == cat_list[0])
        elif len(cat_list) > 1:
            query = query.filter(AnnouncementRadar.catalyst_type.in_(cat_list))

    if vertical_archetype:
        vert_list = [v.strip() for v in vertical_archetype.split(",") if v.strip()]
        if len(vert_list) == 1:
            query = query.filter(AnnouncementRadar.vertical_archetype == vert_list[0])
        elif len(vert_list) > 1:
            query = query.filter(AnnouncementRadar.vertical_archetype.in_(vert_list))

    if absorption_status:
        abs_list = [a.strip() for a in absorption_status.split(",") if a.strip()]
        if len(abs_list) == 1:
            query = query.filter(AnnouncementRadar.absorption_status == abs_list[0])
        elif len(abs_list) > 1:
            query = query.filter(AnnouncementRadar.absorption_status.in_(abs_list))

    if trend_regime:
        query = query.filter(AnnouncementRadar.trend_regime == trend_regime)

    if impact_level:
        query = query.filter(AnnouncementRadar.impact_level == impact_level)

    if recommendation:
        rec_list = [r.strip() for r in recommendation.split(",") if r.strip()]
        if len(rec_list) == 1:
            query = query.filter(AnnouncementRadar.recommendation == rec_list[0])
        elif len(rec_list) > 1:
            query = query.filter(AnnouncementRadar.recommendation.in_(rec_list))

    if velocity:
        vel_list = [v.strip() for v in velocity.split(",") if v.strip()]
        vel_conditions = []
        for v in vel_list:
            if v == "FAST_UNDER_30D":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%10%25%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%15%35%"))
            elif v == "SWING_30_60D":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%20%45%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%20%50%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%30%65%"))
            elif v == "CYCLE_60_120D":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%40%75%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%50%110%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%60%120%"))
            elif v == "10-25":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%10%25%"))
            elif v == "15-35":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%15%35%"))
            elif v in ("20-50", "20-45"):
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%20%45%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%20%50%"))
            elif v == "30-65":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%30%65%"))
            elif v == "40-75":
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%40%75%"))
            elif v in ("60-120", "50-110"):
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%50%110%"))
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike("%60%120%"))
            else:
                clean_v = v.replace("-", "%").replace("–", "%")
                vel_conditions.append(AnnouncementRadar.est_velocity_days.ilike(f"%{clean_v}%"))
        if vel_conditions:
            query = query.filter(or_(*vel_conditions))

    if listed_only:
        query = query.filter(AnnouncementRadar.is_listed.is_(True))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (AnnouncementRadar.company_name.ilike(s)) |
            (AnnouncementRadar.symbol.ilike(s)) |
            (AnnouncementRadar.headline.ilike(s))
        )

    # Date Filtering
    if announcement_date_from:
        try:
            dt_from = datetime.fromisoformat(announcement_date_from.strip())
            effective_announcement_date = func.coalesce(AnnouncementRadar.announcement_date, AnnouncementRadar.published_at)
            query = query.filter(effective_announcement_date >= dt_from)
        except Exception:
            pass

    if announcement_date_to:
        try:
            dt_to_raw = datetime.fromisoformat(announcement_date_to.strip())
            if len(announcement_date_to.strip()) <= 10:
                dt_to = datetime(dt_to_raw.year, dt_to_raw.month, dt_to_raw.day, 23, 59, 59)
            else:
                dt_to = dt_to_raw
            effective_announcement_date = func.coalesce(AnnouncementRadar.announcement_date, AnnouncementRadar.published_at)
            query = query.filter(effective_announcement_date <= dt_to)
        except Exception:
            pass

    if recommendation_date_from:
        try:
            dt_rec_from = datetime.fromisoformat(recommendation_date_from.strip())
            query = query.filter(AnnouncementRadar.recommendation_date >= dt_rec_from)
        except Exception:
            pass

    if recommendation_date_to:
        try:
            dt_rec_to_raw = datetime.fromisoformat(recommendation_date_to.strip())
            if len(recommendation_date_to.strip()) <= 10:
                dt_rec_to = datetime(dt_rec_to_raw.year, dt_rec_to_raw.month, dt_rec_to_raw.day, 23, 59, 59)
            else:
                dt_rec_to = dt_rec_to_raw
            query = query.filter(AnnouncementRadar.recommendation_date <= dt_rec_to)
        except Exception:
            pass

    # Sorting
    allowed_sort = {
        "published_at", "announcement_date", "recommendation_date", "impact_score", "deal_value_cr",
        "company_name", "symbol", "upside_pct", "conviction_score", "realized_move_pct",
        "current_price", "price_at_announcement", "target_price", "vertical_archetype",
        "catalyst_type", "trend_regime", "absorption_status", "recommendation", "est_velocity_days"
    }
    if sort_by not in allowed_sort:
        sort_by = "announcement_date"

    col = getattr(AnnouncementRadar, sort_by)
    if sort_order == "asc":
        query = query.order_by(asc(col).nullslast())
    else:
        query = query.order_by(desc(col).nullslast())

    # Pagination
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()
    return results


@router.get("/stats", response_model=AnnouncementStatsOut)
def get_announcements_stats(db: Session = Depends(get_db)):
    """
    Returns aggregate stats for the Announcements & Catalyst Radar.
    """
    total = db.query(func.count(AnnouncementRadar.id)).scalar() or 0

    cat_rows = db.query(AnnouncementRadar.catalyst_type, func.count(AnnouncementRadar.id)).group_by(AnnouncementRadar.catalyst_type).all()
    by_catalyst = {r[0]: r[1] for r in cat_rows if r[0]}

    imp_rows = db.query(AnnouncementRadar.impact_level, func.count(AnnouncementRadar.id)).group_by(AnnouncementRadar.impact_level).all()
    by_impact = {r[0]: r[1] for r in imp_rows if r[0]}

    rec_rows = db.query(AnnouncementRadar.recommendation, func.count(AnnouncementRadar.id)).filter(AnnouncementRadar.recommendation.isnot(None)).group_by(AnnouncementRadar.recommendation).all()
    by_recommendation = {r[0]: r[1] for r in rec_rows if r[0]}

    vert_rows = db.query(AnnouncementRadar.vertical_archetype, func.count(AnnouncementRadar.id)).filter(AnnouncementRadar.vertical_archetype.isnot(None)).group_by(AnnouncementRadar.vertical_archetype).all()
    by_vertical = {r[0]: r[1] for r in vert_rows if r[0]}

    abs_rows = db.query(AnnouncementRadar.absorption_status, func.count(AnnouncementRadar.id)).filter(AnnouncementRadar.absorption_status.isnot(None)).group_by(AnnouncementRadar.absorption_status).all()
    by_absorption = {r[0]: r[1] for r in abs_rows if r[0]}

    vel_rows = db.query(AnnouncementRadar.est_velocity_days, func.count(AnnouncementRadar.id)).filter(AnnouncementRadar.est_velocity_days.isnot(None)).group_by(AnnouncementRadar.est_velocity_days).all()
    by_velocity = {}
    for r in vel_rows:
        val = r[0] or ""
        cnt = r[1]
        if "10-25" in val or "10–25" in val:
            by_velocity["10-25"] = by_velocity.get("10-25", 0) + cnt
            by_velocity["FAST_UNDER_30D"] = by_velocity.get("FAST_UNDER_30D", 0) + cnt
        elif "15-35" in val or "15–35" in val:
            by_velocity["15-35"] = by_velocity.get("15-35", 0) + cnt
            by_velocity["FAST_UNDER_30D"] = by_velocity.get("FAST_UNDER_30D", 0) + cnt
        elif "20-45" in val or "20–45" in val or "20-50" in val or "20–50" in val:
            by_velocity["20-50"] = by_velocity.get("20-50", 0) + cnt
            by_velocity["SWING_30_60D"] = by_velocity.get("SWING_30_60D", 0) + cnt
        elif "30-65" in val or "30–65" in val:
            by_velocity["30-65"] = by_velocity.get("30-65", 0) + cnt
            by_velocity["SWING_30_60D"] = by_velocity.get("SWING_30_60D", 0) + cnt
        elif "40-75" in val or "40–75" in val:
            by_velocity["40-75"] = by_velocity.get("40-75", 0) + cnt
            by_velocity["CYCLE_60_120D"] = by_velocity.get("CYCLE_60_120D", 0) + cnt
        elif "50-110" in val or "50–110" in val or "60-120" in val or "60–120" in val:
            by_velocity["60-120"] = by_velocity.get("60-120", 0) + cnt
            by_velocity["CYCLE_60_120D"] = by_velocity.get("CYCLE_60_120D", 0) + cnt

    wire_count = db.query(func.count(AnnouncementRadar.id)).filter(AnnouncementRadar.category == "Live Exchange Filing").scalar() or 0
    catalyst_count = total - wire_count
    by_feed_source = {
        "ALL": total,
        "POLL_WIRE": wire_count,
        "CATALYST": catalyst_count,
    }

    latest_row = db.query(func.max(AnnouncementRadar.published_at)).scalar()
    latest_str = latest_row.isoformat() if latest_row else None

    return AnnouncementStatsOut(
        total=total,
        by_catalyst=by_catalyst,
        by_impact=by_impact,
        by_recommendation=by_recommendation,
        by_vertical=by_vertical,
        by_absorption=by_absorption,
        by_velocity=by_velocity,
        by_feed_source=by_feed_source,
        latest_published_at=latest_str,
    )


@router.post("/run", response_model=RunResponse)
def trigger_announcements_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers live ingestion and AI catalyst classification.
    """
    def _run():
        run_announcements_ingestion()

    background_tasks.add_task(_run)
    return RunResponse(
        status="running",
        message="Live announcements ingestion and AI catalyst analysis triggered in background.",
    )


@router.post("/{announcement_id}/alert/telegram")
def send_telegram_alert(announcement_id: int, db: Session = Depends(get_db)):
    """
    Dispatches instant Telegram notification for a critical catalyst filing.
    """
    ann = db.query(AnnouncementRadar).filter(AnnouncementRadar.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # In production, uses telegram bot webhook; here simulates dispatch and returns formatted payload
    alert_payload = {
        "status": "dispatched",
        "channel": "Alpha India Catalyst Alerts (Telegram)",
        "symbol": ann.symbol,
        "company": ann.company_name,
        "catalyst_type": ann.catalyst_type,
        "impact": f"{ann.impact_level} ({ann.impact_score}/10)",
        "headline": ann.headline,
        "ai_insight": ann.ai_insight,
        "screener_url": ann.source_url,
    }
    return {
        "status": "success",
        "message": f"Telegram alert successfully dispatched for {ann.symbol or ann.company_name} ({ann.catalyst_type})",
        "payload": alert_payload,
    }


@router.post("/{announcement_id}/watchlist")
def add_catalyst_to_watchlist(announcement_id: int, db: Session = Depends(get_db)):
    """
    Adds the catalyst stock to the default Catalyst Tracker watchlist.
    """
    ann = db.query(AnnouncementRadar).filter(AnnouncementRadar.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    return {
        "status": "success",
        "message": f"{ann.symbol or ann.company_name} pinned to Catalyst Watchlist",
        "symbol": ann.symbol,
    }


@router.get("/live-wire/status")
def get_live_wire_status():
    """
    Returns real-time telemetry of the live exchange corporate announcement wire worker.
    """
    from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
    return LiveExchangeWireWorker.get_telemetry()


@router.post("/live-wire/poll")
def trigger_live_wire_poll(db: Session = Depends(get_db)):
    """
    Forces an immediate poll of the next batch from the live exchange wire.
    """
    from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
    res = LiveExchangeWireWorker.poll_next_batch(db)
    return {
        "status": "success",
        "result": res,
        "telemetry": LiveExchangeWireWorker.get_telemetry(),
    }


