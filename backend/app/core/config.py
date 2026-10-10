"""
Alpha India - Core Configuration Module
Sprint 36.5 Production Upgrade
Typed Pydantic BaseSettings with backward-compatible attribute exports.
"""

from pathlib import Path
from typing import List, Union, Optional
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

    # Redis Cache Settings
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for high-performance caching",
    )

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

    # Master autonomous and flagship velocity engines (active by default)
    ENABLE_AUTONOMOUS_ENGINE: bool = Field(
        default=True,
        description="Master autonomous orchestrator (exchange wire, growth, VCP, alerts)",
    )
    ENABLE_VELOCITY_SCHEDULER: bool = Field(
        default=True,
        description="Flagship Velocity Burst Elite institutional scanner",
    )

    # Granular Background Schedulers (default to False for lightweight performance & on-demand execution)
    ENABLE_CUP_HANDLE_SCHEDULER: bool = Field(
        default=False,
        description="Continuous 4000+ stock Cup & Handle universe loop (on-demand recommended)",
    )
    ENABLE_PATTERN_SCHEDULER: bool = Field(
        default=False,
        description="Continuous 4000+ stock chart pattern universe loop (on-demand recommended)",
    )
    ENABLE_EARLY_STAGE_SCHEDULER: bool = Field(
        default=False,
        description="Continuous Web/Social/YouTube discovery loop",
    )
    ENABLE_SCREENER_SCHEDULER: bool = Field(
        default=False,
        description="Continuous Screener.in polling loop",
    )
    ENABLE_RAW_FILE_ARCHIVER: bool = Field(
        default=False,
        description="Continuous disk traversal file compression service",
    )
    ENABLE_MF_DIP_SCHEDULER: bool = Field(
        default=False,
        description="High-frequency intraday MF dip scanner",
    )
    ENABLE_STANDALONE_VCP_SCHEDULER: bool = Field(
        default=False,
        description="Standalone VCP loop (AutonomousEngineScheduler already covers VCP)",
    )
    ENABLE_STANDALONE_WIRE_WORKER: bool = Field(
        default=False,
        description="Standalone live wire loop (AutonomousEngineScheduler already covers live wire)",
    )

    # DhanHQ Live Market Feed Credentials
    DHAN_CLIENT_ID: Optional[str] = Field(
        default=None,
        description="Dhan 10-digit Client ID for real-time market data",
    )
    DHAN_ACCESS_TOKEN: Optional[str] = Field(
        default=None,
        description="DhanHQ JWT Access Token",
    )

    # 5paisa Xstream Live Market Feed Credentials
    FIVEPAISA_APP_NAME: Optional[str] = Field(default=None)
    FIVEPAISA_APP_SOURCE: Optional[str] = Field(default=None)
    FIVEPAISA_USER_ID: Optional[str] = Field(default=None)
    FIVEPAISA_PASSWORD: Optional[str] = Field(default=None)
    FIVEPAISA_USER_KEY: Optional[str] = Field(default=None)
    FIVEPAISA_ENCRYPTION_KEY: Optional[str] = Field(default=None)
    FIVEPAISA_PIN: Optional[str] = Field(default=None)
    FIVEPAISA_CLIENT_CODE: Optional[str] = Field(default=None)
    FIVEPAISA_TOTP_KEY: Optional[str] = Field(default=None)
    FIVEPAISA_ACCESS_TOKEN: Optional[str] = Field(default=None)

    # Telegram Alert Dispatch Configuration
    TELEGRAM_BOT_TOKEN: Optional[str] = Field(
        default=None,
        description="Default Telegram Bot API Token for platform-wide alerts",
    )
    TELEGRAM_DEFAULT_CHAT_ID: Optional[str] = Field(
        default=None,
        description="Default Telegram Chat ID / Channel Username for platform-wide alerts",
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