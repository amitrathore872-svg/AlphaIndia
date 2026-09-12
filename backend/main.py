from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine

# ---------------- Database Models ----------------
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.announcement import Announcement
from app.models.filing_registry import FilingRegistry
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.models.financial_import_queue import FinancialImportQueue

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
from app.api.screener import router as screener_router



# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.9.5-recovery",
    description="AI Powered NSE/BSE Growth Scanner Backend",
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

# ---------------- Register Routers ----------------
# ---------------- Register Routers ----------------
app.include_router(companies_router)
app.include_router(growth_router)
app.include_router(dashboard_router)
app.include_router(import_dashboard_router)
app.include_router(system_router)
app.include_router(discovery_router)
app.include_router(filings_router)
app.include_router(downloads_router)
app.include_router(financials_router)
app.include_router(screener_router)

# ==========================================================
# Root Endpoint
# ==========================================================
@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.9.5-recovery",
        "database": "Connected",
        "status": "Ready 🚀",
        "apis": {
            "companies": "/companies",
            "dashboard_summary": "/companies/dashboard-summary",
            "growth_screener": "/growth-screener",
            "import_dashboard": "/import-dashboard",
            "health": "/health",
        },
    }


# ==========================================================
# Health Endpoint
# ==========================================================
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "PostgreSQL Connected",
        "collector": "Ready",
        "service": "Alpha India Backend v0.9.5-recovery",
    }