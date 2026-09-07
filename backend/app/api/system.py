
from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status")
def system_status():
    return {
        "project": "Alpha India",
        "version": "0.8.1",
        "status": "Healthy",
        "database": "Connected",
        "collector": "Idle",
        "timestamp": datetime.utcnow().isoformat(),
    }