from datetime import datetime
from pydantic import BaseModel


class MonitoringHeartbeatResponse(BaseModel):
    id: int

    engine_status: str
    current_session: str

    last_scan_time: datetime | None = None
    next_scan_time: datetime | None = None

    companies_scanned_today: int
    results_found_today: int
    parser_failures_today: int

    heartbeat_at: datetime

    class Config:
        from_attributes = True