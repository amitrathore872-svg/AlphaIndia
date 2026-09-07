from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.system_setting import SystemSetting
from app.schemas.system_setting import (
    SystemSettingResponse,
    SystemSettingUpdate,
)

router = APIRouter(prefix="/system", tags=["System"])

from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.schemas.monitoring_heartbeat import MonitoringHeartbeatResponse

# -------------------------------------------------------
# Existing Health Endpoint (Kept for backward compatibility)
# -------------------------------------------------------
@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    settings = {
        item.setting_key: item.setting_value
        for item in db.query(SystemSetting).all()
    }

    monitoring_enabled = settings.get("monitoring_enabled", "false") == "true"

    now = datetime.now().time()

    market_start = time.fromisoformat(
        settings.get("market_start_time", "09:15")
    )
    market_end = time.fromisoformat(
        settings.get("market_end_time", "15:30")
    )
    post_market_end = time.fromisoformat(
        settings.get("post_market_end_time", "22:30")
    )

    if not monitoring_enabled:
        current_session = "STOPPED"
        collector = "Stopped"

    elif market_start <= now <= market_end:
        current_session = "MARKET"
        collector = "Monitoring Live Results"

    elif market_end < now <= post_market_end:
        current_session = "POST_MARKET"
        collector = "Monitoring Post Market Filings"

    else:
        current_session = "NON_MARKET"
        collector = "Idle"

    return {
        "project": "Alpha India",
        "version": "0.9.0",
        "status": "Healthy",
        "database": "Connected",
        "collector": collector,
        "monitoring_enabled": monitoring_enabled,
        "current_session": current_session,
        "market_interval_minutes": int(
            settings.get("market_interval_minutes", 5)
        ),
        "post_market_interval_minutes": int(
            settings.get("post_market_interval_minutes", 15)
        ),
        "timestamp": datetime.utcnow().isoformat(),
    }


# -------------------------------------------------------
# GET ALL MONITORING SETTINGS
# -------------------------------------------------------
@router.get(
    "/settings",
    response_model=list[SystemSettingResponse],
)
def get_system_settings(db: Session = Depends(get_db)):
    return (
        db.query(SystemSetting)
        .order_by(SystemSetting.id)
        .all()
    )


# -------------------------------------------------------
# UPDATE SINGLE SETTING
# -------------------------------------------------------
@router.put(
    "/settings/{setting_key}",
    response_model=SystemSettingResponse,
)
def update_system_setting(
    setting_key: str,
    payload: SystemSettingUpdate,
    db: Session = Depends(get_db),
):
    setting = (
        db.query(SystemSetting)
        .filter(SystemSetting.setting_key == setting_key)
        .first()
    )

    if not setting:
        raise HTTPException(
            status_code=404,
            detail="Setting not found.",
        )

    setting.setting_value = payload.setting_value

    db.commit()
    db.refresh(setting)

    return setting


# -------------------------------------------------------
# RESET DEFAULT SETTINGS
# -------------------------------------------------------
@router.post("/settings/reset")
def reset_system_settings(db: Session = Depends(get_db)):
    defaults = {
        "monitoring_enabled": "true",
        "market_session_enabled": "true",
        "post_market_enabled": "true",
        "non_result_session_enabled": "false",
        "weekend_monitoring": "false",
        "holiday_monitoring": "false",
        "market_interval_minutes": "5",
        "post_market_interval_minutes": "15",
        "market_start_time": "09:15",
        "market_end_time": "15:30",
        "post_market_end_time": "22:30",
    }

    updated = 0

    for key, value in defaults.items():
        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.setting_key == key)
            .first()
        )

        if setting:
            setting.setting_value = value
            updated += 1

    db.commit()

    return {
        "success": True,
        "updated": updated,
        "message": "Monitoring settings reset successfully.",
    }


# -------------------------------------------------------
# HEARTBEAT STATUS
# -------------------------------------------------------
@router.get(
    "/heartbeat",
    response_model=MonitoringHeartbeatResponse,
)
def monitoring_heartbeat(db: Session = Depends(get_db)):
    heartbeat = db.query(MonitoringHeartbeat).first()

    if heartbeat is None:
        raise HTTPException(
            status_code=404,
            detail="Monitoring heartbeat not initialized.",
        )

    return heartbeat