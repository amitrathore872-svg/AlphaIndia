"""
Alpha India - Core Configuration Module
Sprint 36.5 Production Upgrade
Typed Pydantic BaseSettings with backward-compatible attribute exports.
"""

from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Alpha India"
    APP_VERSION: str = "2.3.1"
    APP_ENV: str = "development"

    # Database Settings
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/alpha_india",
        description="PostgreSQL connection string",
    )
    DEBUG_SQL: bool = Field(
        default=False,
        description="Enable SQLAlchemy query echo logging",
    )
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 1800

    # Security & Auth
    SECRET_KEY: str = Field(
        default="alpha-india-super-secure-internal-secret-change-in-prod-2026",
        description="Secret key for signing tokens and state",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Background Workers & Ingestion Controls
    ENABLE_BACKGROUND_WORKERS: bool = Field(
        default=True,
        description="Whether in-process background workers are started inside FastAPI lifespan",
    )
    WORKER_POLL_INTERVAL_SECONDS: int = Field(
        default=60,
        description="Default polling interval in seconds for exchange wire workers",
    )
    NSE_USE_CURL_CFFI: bool = Field(
        default=True,
        description="Use curl_cffi with browser TLS impersonation to avoid Akamai 403 blocks",
    )

    # CORS Settings
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Allowed CORS origin URLs (comma-separated or list)",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


# Global settings singleton
settings = Settings()

# Backward-compatibility exports
DATABASE_URL = settings.DATABASE_URL
DEBUG_SQL = settings.DEBUG_SQL
BASE_DIR = BASE_DIR