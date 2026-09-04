from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine

# Import models so SQLAlchemy creates the tables
from app.models.company import Company

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alpha India API",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "database": "Connected ✅",
        "status": "Ready"
    }


@app.get("/health")
def health():
    return {"health": "OK"}