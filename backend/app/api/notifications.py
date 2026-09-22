"""
Alpha India In-App Notification Center API
Sprint 34 — Institutional Notification Feed
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.models.notification import SystemNotification
from app.services.alert_dispatch_service import AlertDispatchService

router = APIRouter(prefix="/notifications", tags=["Notification Center"])


@router.get("")
def get_notifications(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Retrieves paginated notifications for the in-app notification center.
    Supports filtering by category, severity, and read status.
    """
    query = db.query(SystemNotification).filter(SystemNotification.is_archived.is_(False))

    if category and category.upper() != "ALL":
        query = query.filter(SystemNotification.category == category.upper())

    if severity:
        query = query.filter(SystemNotification.severity == severity.lower())

    if unread_only:
        query = query.filter(SystemNotification.is_read.is_(False))

    total = query.count()
    items = (
        query.order_by(desc(SystemNotification.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "notifications": [item.to_dict() for item in items],
    }


@router.get("/stats")
def get_notification_stats(db: Session = Depends(get_db)):
    """
    Returns unread count and active status for the top header badge.
    """
    unread_count = (
        db.query(SystemNotification)
        .filter(SystemNotification.is_read.is_(False), SystemNotification.is_archived.is_(False))
        .count()
    )

    total_count = (
        db.query(SystemNotification)
        .filter(SystemNotification.is_archived.is_(False))
        .count()
    )

    critical_count = (
        db.query(SystemNotification)
        .filter(
            SystemNotification.is_read.is_(False),
            SystemNotification.severity == "critical",
            SystemNotification.is_archived.is_(False),
        )
        .count()
    )

    return {
        "unread_count": unread_count,
        "total_count": total_count,
        "critical_count": critical_count,
        "has_unread": unread_count > 0,
    }


@router.patch("/{id}/read")
def mark_notification_read(id: int, db: Session = Depends(get_db)):
    """
    Marks a single notification as read.
    """
    notif = db.query(SystemNotification).filter(SystemNotification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "ok", "id": id, "is_read": True}


@router.post("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """
    Marks all notifications as read.
    """
    db.query(SystemNotification).filter(
        SystemNotification.is_read.is_(False),
        SystemNotification.is_archived.is_(False),
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok", "message": "All notifications marked as read"}


@router.delete("/{id}")
def archive_notification(id: int, db: Session = Depends(get_db)):
    """
    Archives/removes a notification from the active tray.
    """
    notif = db.query(SystemNotification).filter(SystemNotification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_archived = True
    db.commit()
    return {"status": "ok", "id": id, "archived": True}


@router.post("/seed-test")
def seed_test_notifications(db: Session = Depends(get_db)):
    """
    Seeds realistic institutional sample notifications for immediate testing of the drawer UI.
    """
    samples = [
        {
            "title": "🎯 VCP BREAKOUT: DIXON TECH (Score 96.2 — Elite Setup)",
            "message": "Minervini 3-Stage VCP pivot at ₹14,250.0. Entry: ₹14,220–14,460, SL: ₹13,400.0, Targets up to ₹16,800.0 (R:R 3.8x). Breakout volume 3.4x 20DMA with 68% supply contraction.",
            "category": "VCP_BREAKOUT",
            "severity": "critical",
            "action_url": "/vcp-discovery",
            "metadata": {"symbol": "DIXON", "total_score": 96.2, "pivot_price": 14250.0, "is_elite": True, "vcp_stage": "3-Stage VCP"},
        },
        {
            "title": "⚡ ATHENA FLASH: TRENT LTD (Grade AAA+)",
            "message": "Conviction score 94/100. Q3 PAT up +142.5% YoY with 18.2% EBITDA margin. Strong retail footprint expansion.",
            "category": "ATHENA_PEAD",
            "severity": "critical",
            "action_url": "/athena-omega",
            "metadata": {"symbol": "TRENT", "signal": "STRONG_BUY", "conviction": 94, "upside": 18.5},
        },
        {
            "title": "📡 CATALYST: SOLAR INDUSTRIES wins ₹2,450 Cr Defense Order",
            "message": "Defense Ministry awards multi-year supply contract for specialized high-energy weapon systems.",
            "category": "CATALYST_ORDER",
            "severity": "success",
            "action_url": "/announcements",
            "metadata": {"symbol": "SOLARINDS", "order_cr": 2450.0, "catalyst_type": "DEFENSE_CONTRACT"},
        },
        {
            "title": "📈 GROWTH BREAKOUT: KAYNES TECHNOLOGY (+98% YoY PAT)",
            "message": "EMS semiconductor assembly leader crosses 3-year revenue breakout threshold with clean earnings quality.",
            "category": "GROWTH_BREAKOUT",
            "severity": "info",
            "action_url": "/growth-screener",
            "metadata": {"symbol": "KAYNES", "pat_growth": 98.4, "rev_growth": 64.2},
        },
        {
            "title": "💼 SMART MONEY: HDFC & ICICI MF Accumulate DIXON",
            "message": "3 top-tier funds increased exposure in DIXON TECH by 1.8% of outstanding equity in last filing cycle.",
            "category": "SMART_MONEY",
            "severity": "info",
            "action_url": "/institutional-radar",
            "metadata": {"symbol": "DIXON", "fund_count": 3, "net_shares_cr": 450.0},
        },
        {
            "title": "⚙️ PIPELINE: NSE Live Wire Connected",
            "message": "Live feed synchronization active. 84 quarterly filing PDFs archived and parsed in last 4 hours.",
            "category": "SYSTEM_ALERT",
            "severity": "info",
            "action_url": "/monitoring",
            "metadata": {"source": "LiveExchangeWireWorker", "status": "HEALTHY"},
        },
    ]

    created = []
    for item in samples:
        notif = AlertDispatchService.create_in_app_notification(
            db=db,
            title=item["title"],
            message=item["message"],
            category=item["category"],
            severity=item["severity"],
            action_url=item["action_url"],
            metadata=item["metadata"],
        )
        created.append(notif.to_dict())

    return {
        "status": "seeded",
        "count": len(created),
        "notifications": created,
    }
