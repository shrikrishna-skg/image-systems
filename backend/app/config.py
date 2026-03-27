import logging
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List, Optional
from urllib.parse import urlparse

# Directory containing `app/` — used so UPLOAD_DIR=./uploads always means backend/uploads.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Application
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "change-me"
    API_KEY_ENCRYPTION_KEY: str = "change-me"
    # Logging: DEBUG, INFO, WARNING, ERROR (empty = DEBUG in development, INFO in production)
    LOG_LEVEL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Database (Supabase PostgreSQL, or SQLite when LOCAL_DEV_MODE=true)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    # None = auto (enable TLS when host looks like Supabase). Set false for local Postgres without TLS.
    DATABASE_SSL_REQUIRE: Optional[bool] = None
    # Fully local: file DB under backend/ + JWT auth (no Supabase). See frontend VITE_LOCAL_DEV_MODE.
    LOCAL_DEV_MODE: bool = False
    LOCAL_SQLITE_PATH: str = "./local.db"

    # Upload (relative paths are resolved under backend/, not shell cwd)
    MAX_UPLOAD_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./uploads"
    # Documentary / future policy hooks — uploads are validated by Pillow decode, not this list alone.
    ALLOWED_EXTENSIONS: str = (
        "jpg,jpeg,jpe,png,webp,tiff,tif,gif,bmp,ico,avif,heic,heif,jxl,svg,psd,jp2,j2k,cr2,nef,arw,dng"
    )
    # Larger chunks = fewer async read/write syscalls (faster uploads on SSD).
    UPLOAD_READ_CHUNK_BYTES: int = 8 * 1024 * 1024
    # Align with frontend workspace batch cap (bulk import + fair API limits).
    MAX_FILES_PER_UPLOAD_BATCH: int = 25

    # CORS
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:2020,http://127.0.0.1:2020,"
        "http://localhost:8989,http://127.0.0.1:8989,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    @staticmethod
    def _database_host(url: str) -> str:
        try:
            u = urlparse(url.replace("postgresql+asyncpg://", "postgresql://", 1))
            return (u.hostname or "").lower()
        except Exception:
            return ""

    @property
    def effective_database_url(self) -> str:
        if self.LOCAL_DEV_MODE:
            p = Path(self.LOCAL_SQLITE_PATH)
            if not p.is_absolute():
                p = _BACKEND_ROOT / p
            return f"sqlite+aiosqlite:///{p.resolve().as_posix()}"
        return self.DATABASE_URL

    @property
    def database_use_ssl(self) -> bool:
        if self.LOCAL_DEV_MODE:
            return False
        if self.DATABASE_SSL_REQUIRE is not None:
            return bool(self.DATABASE_SSL_REQUIRE)
        host = self._database_host(self.DATABASE_URL)
        return "supabase" in host

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip().lower() for ext in self.ALLOWED_EXTENSIONS.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def upload_dir_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        if p.is_absolute():
            return p.resolve()
        return (_BACKEND_ROOT / p).resolve()

    @property
    def resolved_python_log_level(self) -> int:
        raw = (self.LOG_LEVEL or "").strip().upper()
        if not raw:
            return logging.DEBUG if self.APP_ENV == "development" else logging.INFO
        return getattr(logging, raw, logging.INFO)

    @property
    def uvicorn_log_level(self) -> str:
        """Lowercase name for uvicorn --log-level."""
        mapping = {
            "DEBUG": "debug",
            "INFO": "info",
            "WARNING": "warning",
            "ERROR": "error",
            "CRITICAL": "critical",
        }
        raw = (self.LOG_LEVEL or "").strip().upper()
        if raw in mapping:
            return mapping[raw]
        if self.APP_ENV == "development":
            return "debug"
        return "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

# Stable ID for LOCAL_DEV_MODE (matches JWT `sub` in /api/auth/local/session).
LOCAL_DEV_USER_ID = "00000000-0000-4000-8000-000000000001"
