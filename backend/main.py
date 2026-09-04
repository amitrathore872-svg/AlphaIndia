from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine

# Import database models
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult

# Import API routers
from app.api.companies import router as companies_router
from app.api.growth import router as growth_router

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.6.0",
    description="AI-powered NSE Growth Screener Backend"
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(companies_router)
app.include_router(growth_router)


@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.6.0",
        "database": "Connected",
        "status": "Ready 🚀",
        "apis": [
            "/companies",
            "/growth-screener",
            "/health"
        ]
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "PostgreSQL Connected",
        "service": "Alpha India Backend v0.6"
    }