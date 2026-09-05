from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine

# Database Models
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.announcement import Announcement

# API Routers
from app.api.companies import router as companies_router
from app.api.growth import router as growth_router
from app.api.dashboard import router as dashboard_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.7.5-dev",
    description="AI-powered NSE Growth Screener Backend",
)

# CORS (Next.js Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(companies_router)
app.include_router(growth_router)
app.include_router(dashboard_router)


@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.7.5-dev",
        "database": "Connected",
        "status": "Ready 🚀",
        "apis": {
            "companies": "/companies",
            "growth_screener": "/growth-screener",
            "dashboard_summary": "/dashboard-summary",
            "health": "/health",
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "PostgreSQL Connected",
        "collector": "Not Started",
        "service": "Alpha India Backend v0.7.5-dev",
    }