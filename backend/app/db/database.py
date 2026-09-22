"""
Alpha India Database Configuration
Sprint 31.5.1 — Production Database Layer
Version: v2.1.0
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings, DATABASE_URL, DEBUG_SQL

# ==========================================================
# SQLAlchemy Engine
# ==========================================================

engine_kwargs = {
    "echo": DEBUG_SQL,
    "pool_pre_ping": True,
}

if "sqlite" not in DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_recycle": settings.DB_POOL_RECYCLE,
    })

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs,
)


# ==========================================================
# Session Factory
# ==========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

# ==========================================================
# Base Model
# ==========================================================

Base = declarative_base()

# ==========================================================
# FastAPI Database Dependency
# ==========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()