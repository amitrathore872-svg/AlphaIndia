"""
Alpha India Database Configuration
Sprint 31.5.1 — Production Database Layer
Version: v2.1.0
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import DATABASE_URL, DEBUG_SQL

# ==========================================================
# SQLAlchemy Engine
# ==========================================================

engine_kwargs = {
    "echo": DEBUG_SQL,
    "pool_pre_ping": True,
}

if "sqlite" not in DATABASE_URL:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
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