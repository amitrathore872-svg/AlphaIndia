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
from app.api.notifications import router as notifications_router
from app.api.alerts import router as alerts_router
from app.api.techno_funda import router as techno_funda_router
from app.api.vcp_router import router as vcp_router
from app.api.stocks import router as stocks_router
from app.api.delivery_radar import router as delivery_radar_router
from app.api.momentum_screener import router as momentum_screener_router
from app.api.prebreakout_radar import router as prebreakout_radar_router
from app.api.portfolio import router as portfolio_router
from app.api.swing_overlay import router as swing_overlay_router
from app.api.auth import router as auth_router
import asyncio
from app.api.websockets import router as websockets_router
from app.core.websocket_manager import ws_manager
from app.api.metrics import router as metrics_router
from app.core.telemetry import telemetry
from app.api.screener_formula import router as screener_formula_router
import time
from fastapi import Request

# ---------------- Background Schedulers & Workers ----------------
from app.services.screener_scheduler import ScreenerScheduler
from app.services.early_stage_scheduler import EarlyStageScheduler
from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
from app.services.raw_file_archiver import RawFileArchiveService
from app.services.vcp_scheduler import VCPScheduler
from app.services.autonomous_scheduler import AutonomousEngineScheduler


from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: register event loop for thread-safe WebSocket broadcasting
    ws_manager.set_event_loop(asyncio.get_running_loop())

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Conditionally launch background services if enabled in settings
    if settings.ENABLE_BACKGROUND_WORKERS:
        ScreenerScheduler.start()
        EarlyStageScheduler.start()
        LiveExchangeWireWorker.start(poll_interval_seconds=settings.WORKER_POLL_INTERVAL_SECONDS)
        RawFileArchiveService.start(interval_seconds=600)
        VCPScheduler.start()
        AutonomousEngineScheduler.start()

    yield

    # Shutdown: graceful cleanup of background threads
    if settings.ENABLE_BACKGROUND_WORKERS:
        ScreenerScheduler.stop()
        EarlyStageScheduler.stop()
        LiveExchangeWireWorker.stop()
        RawFileArchiveService.stop()
        VCPScheduler.stop()
        AutonomousEngineScheduler.stop()



app = FastAPI(
    title="Alpha India API",
    version="2.3.1",
    description="AI Powered NSE/BSE Growth Scanner Backend",
    lifespan=lifespan,
)

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Observability Telemetry Middleware ----------------
@app.middleware("http")
async def telemetry_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start_time
    if request.url.path not in ("/metrics", "/health"):
        telemetry.record_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_seconds=duration,
        )
    return response

# ---------------- Register Routers (Single mount per domain) ----------------
app.include_router(metrics_router)
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
app.include_router(notifications_router)
app.include_router(alerts_router)
app.include_router(techno_funda_router)
app.include_router(vcp_router)
app.include_router(stocks_router)
app.include_router(delivery_radar_router, prefix="/api/v1")
app.include_router(momentum_screener_router, prefix="/api/v1")
app.include_router(prebreakout_radar_router, prefix="/api/v1")
app.include_router(portfolio_router)
app.include_router(swing_overlay_router)
app.include_router(auth_router)
app.include_router(websockets_router)
app.include_router(screener_formula_router)


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
    db_latency_ms = None
    stats = {}
    try:
        from app.db.database import SessionLocal
        from app.models.filing_registry import FilingRegistry
        from app.models.quarterly_result import QuarterlyResult
        from app.models.announcement_radar import AnnouncementRadar
        from sqlalchemy import text
        t_db_start = time.perf_counter()
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - t_db_start) * 1000.0, 2)
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
        "database_latency_ms": db_latency_ms,
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
            "autonomous_scheduler_running": AutonomousEngineScheduler.is_running(),
            "autonomous_scheduler_telemetry": AutonomousEngineScheduler.get_telemetry(),
        },
        "database_metrics": stats,
        "telemetry_summary": telemetry.get_summary(),
        "service": "Alpha India Unified Backend v2.3.1",
    }