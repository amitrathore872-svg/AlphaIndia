"""
Alpha India Database Configuration
Sprint 31.5.1 — Production Database Layer
Version: v2.1.0
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import DATABASE_URL

# ==========================================================
# SQLAlchemy Engine
# ==========================================================

engine = create_engine(
    DATABASE_URL,
    echo=True,          # Shows SQL queries in terminal
    pool_pre_ping=True, # Reconnect automatically if DB connection drops
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