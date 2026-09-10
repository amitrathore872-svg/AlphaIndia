
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import companies, system, growth_metrics
from app.services.monitoring_scheduler import scheduler


# =========================================================
# Alpha India Lifecycle
# =========================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n=====================================")
    print(" Alpha India Backend Starting")
    print("=====================================\n")

    scheduler.start()

    yield

    scheduler.stop()

    print("\n=====================================")
    print(" Alpha India Backend Stopped")
    print("=====================================\n")


# =========================================================
# FastAPI App
# =========================================================
app = FastAPI(
    title="Alpha India API",
    version="0.9.1",
    lifespan=lifespan,
)


# =========================================================
# CORS
# =========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# API Routes
# =========================================================

app.include_router(companies.router)
app.include_router(growth_metrics.router)
app.include_router(system.router)


# =========================================================
# Root Endpoint
# =========================================================
@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "version": "0.9.1",
        "status": "Running",
    }