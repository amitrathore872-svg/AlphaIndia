from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.models.company import Company
from app.api.companies import router as companies_router

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Companies API
app.include_router(companies_router)


@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "database": "Connected",
        "status": "Ready 🚀"
    }


@app.get("/health")
def health():
    return {"health": "OK"}