from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.companies import router as companies_router
from app.api.growth import router as growth_router
from app.db.database import Base, engine

# Import models before creating tables so SQLAlchemy registers their metadata.
from app.models.company import Company  # noqa: F401
from app.models.quarterly_result import QuarterlyResult  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.6.0",
    description="AI-powered NSE Growth Screener Backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies_router)
app.include_router(growth_router)


@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.6.0",
        "database": "Connected",
        "status": "Ready",
        "apis": ["/companies", "/growth-screener", "/health"],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "PostgreSQL Connected",
        "service": "Alpha India Backend v0.6",
    }
