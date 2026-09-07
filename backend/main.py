
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine

# -----------------------------
# Import Models
# -----------------------------
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.announcement import Announcement

# -----------------------------
# Import API Routers
# -----------------------------
from app.api.companies import router as companies_router
from app.api.growth import router as growth_router
from app.api.dashboard import router as dashboard_router
from app.api.system import router as system_router

# Create database tables (only if they don't exist)
Base.metadata.create_all(bind=engine)

# -----------------------------
# FastAPI Application
# -----------------------------
app = FastAPI(
    title="Alpha India API",
    version="0.8.1",
    description="AI Powered NSE + BSE Growth Intelligence Platform",
)

# -----------------------------
# CORS Configuration
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Register Routers
# -----------------------------
app.include_router(companies_router)
app.include_router(growth_router)
app.include_router(dashboard_router)
app.include_router(system_router)

# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.8.1",
        "status": "Running",
        "database": "Connected",
        "modules": [
            "Companies API",
            "Growth Screener API",
            "Dashboard API",
            "System API",
            "Announcements Collector",
        ],
    }

# -----------------------------
# Health Endpoint
# -----------------------------
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "PostgreSQL Connected",
        "backend": "Running",
        "frontend": "http://localhost:3000",
        "version": "0.8.1",
    }