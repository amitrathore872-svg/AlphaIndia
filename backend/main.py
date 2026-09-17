from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
import app.models  # Cleanly registers all SQLAlchemy declarative models

# ---------------- API Routers ----------------
from app.api.companies import router as companies_router
from app.api.growth import router as growth_router
from app.api.dashboard import router as dashboard_router
from app.api.import_dashboard import router as import_dashboard_router
from app.api.system import router as system_router
from app.api.discovery import router as discovery_router
from app.api.filings import router as filings_router
from app.api.downloads import router as downloads_router
from app.api.financials import router as financials_router
from app.api.mission_control import router as mission_control_router
from app.api.market_intelligence import router as market_intelligence_router
from app.api.screener_growth import router as screener_growth_router
from app.api.screener_monitoring import router as screener_monitoring_router
from app.api.watchlist import router as watchlist_router
from app.api.early_stage import router as early_stage_router
from app.api.monitoring_early_stage import router as monitoring_early_stage_router
from app.api.announcements import router as announcements_router
from app.api.athena_omega import router as athena_omega_router
from app.api.institutional_radar import router as institutional_radar_router
from app.api.quarterly_results import router as quarterly_results_router
from app.api.control_system import router as control_system_router

# ---------------- Background Schedulers & Workers ----------------
from app.services.screener_scheduler import ScreenerScheduler
from app.services.early_stage_scheduler import EarlyStageScheduler
from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
from app.services.raw_file_archiver import RawFileArchiveService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and launch background services
    Base.metadata.create_all(bind=engine)
    ScreenerScheduler.start()
    EarlyStageScheduler.start()
    LiveExchangeWireWorker.start(poll_interval_seconds=60)
    RawFileArchiveService.start(interval_seconds=600)
    yield
    # Shutdown: graceful cleanup of background threads
    ScreenerScheduler.stop()
    EarlyStageScheduler.stop()
    LiveExchangeWireWorker.stop()
    RawFileArchiveService.stop()


app = FastAPI(
    title="Alpha India API",
    version="2.3.1",
    description="AI Powered NSE/BSE Growth Scanner Backend",
    lifespan=lifespan,
)

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Register Routers (Single mount per domain) ----------------
app.include_router(companies_router)
app.include_router(growth_router)
app.include_router(dashboard_router)
app.include_router(import_dashboard_router)
app.include_router(system_router)
app.include_router(discovery_router)
app.include_router(filings_router)
app.include_router(downloads_router)
app.include_router(financials_router)
app.include_router(mission_control_router)
app.include_router(market_intelligence_router)
app.include_router(screener_growth_router)
app.include_router(screener_monitoring_router)
app.include_router(watchlist_router)
app.include_router(early_stage_router)
app.include_router(monitoring_early_stage_router)
app.include_router(announcements_router)
app.include_router(athena_omega_router)
app.include_router(institutional_radar_router, prefix="/api/v1")
app.include_router(quarterly_results_router)
app.include_router(control_system_router)


# ==========================================================
# Root Endpoint
# ==========================================================
@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "2.3.0-optimized",
        "database": "Connected",
        "status": "Ready 🚀",
        "apis": {
            "companies": "/companies",
            "dashboard_summary": "/companies/dashboard-summary",
            "growth_screener": "/growth-screener",
            "import_dashboard": "/import-dashboard",
            "mission_control": "/mission-control",
            "telemetry": "/mission-control/telemetry",
            "health": "/health",
        },
    }


# ==========================================================
# Health & Exchange Telemetry Endpoint
# ==========================================================
@app.get("/health")
def health():
    db = None
    db_status = "Connected"
    stats = {}
    try:
        from app.db.database import SessionLocal
        from app.models.filing_registry import FilingRegistry
        from app.models.quarterly_result import QuarterlyResult
        from app.models.announcement_radar import AnnouncementRadar
        db = SessionLocal()
        stats = {
            "total_filings_registry": db.query(FilingRegistry).count(),
            "total_quarterly_statements": db.query(QuarterlyResult).count(),
            "total_announcements_radar": db.query(AnnouncementRadar).count(),
        }
    except Exception as e:
        db_status = f"Degraded ({str(e)})"
    finally:
        if db:
            db.close()

    exchange_wire_telemetry = LiveExchangeWireWorker.get_telemetry()

    return {
        "status": "healthy" if db_status == "Connected" else "degraded",
        "database": db_status,
        "exchange_wire_worker": {
            "is_running": exchange_wire_telemetry.get("is_running"),
            "poll_interval_seconds": exchange_wire_telemetry.get("poll_interval_seconds"),
            "total_filings_scanned": exchange_wire_telemetry.get("total_filings_scanned"),
            "catalysts_discovered": exchange_wire_telemetry.get("catalysts_discovered"),
            "last_poll_time": exchange_wire_telemetry.get("last_poll_time"),
            "cursor_offset": exchange_wire_telemetry.get("current_cursor_offset"),
        },
        "schedulers": {
            "screener_scheduler_running": ScreenerScheduler.is_running() if hasattr(ScreenerScheduler, "is_running") else True,
            "early_stage_scheduler_running": EarlyStageScheduler.is_running() if hasattr(EarlyStageScheduler, "is_running") else True,
        },
        "database_metrics": stats,
        "service": "Alpha India Unified Backend v2.3.0",
    }