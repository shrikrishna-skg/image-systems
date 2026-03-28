import logging
import time
from contextlib import asynccontextmanager

from app.config import settings

logging.basicConfig(
    level=settings.resolved_python_log_level,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)
logging.captureWarnings(True)
log = logging.getLogger("app.main")

if settings.resolved_python_log_level > logging.DEBUG:
    for _name in ("httpx", "httpcore", "hpack", "urllib3"):
        logging.getLogger(_name).setLevel(logging.WARNING)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.database import engine, Base
from app.services.auth_service import _jwt_secret_configured
import app.models  # noqa: F401 — register all ORM tables on Base.metadata
from app.routers import auth, api_keys, images, jobs, history, scrape, image_generation


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir_path.mkdir(parents=True, exist_ok=True)
    if settings.LOCAL_DEV_MODE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        # Local users are created on first POST /api/auth/local/session (one row per email).
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    log.info("Database connection OK")
    if (
        settings.APP_ENV == "production"
        and not settings.LOCAL_DEV_MODE
        and not _jwt_secret_configured()
    ):
        log.error(
            "SUPABASE_JWT_SECRET is not set: Supabase-authenticated API calls will fail with 500 until "
            "you set the JWT secret (Dashboard → Project Settings → API → JWT Secret)."
        )
    yield


_docs_public = settings.LOCAL_DEV_MODE or settings.APP_ENV != "production"

app = FastAPI(
    title="Imagesystems",
    description="Imagesystems — hotel & real estate image enhancement, generation, and batch pipelines",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_public else None,
    redoc_url="/redoc" if _docs_public else None,
    openapi_url="/openapi.json" if _docs_public else None,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if settings.APP_ENV != "development":
        return await call_next(request)
    path = request.url.path
    query = str(request.query_params) if request.query_params else ""
    log.debug("→ %s %s%s", request.method, path, f"?{query}" if query else "")
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("ERR %s %s failed after %.1fms", request.method, path, (time.perf_counter() - t0) * 1000)
        raise
    ms = (time.perf_counter() - t0) * 1000
    log.info(
        "← %s %s %s %.1fms",
        request.method,
        path,
        response.status_code,
        ms,
    )
    return response


# CORS (explicit list + optional regex for any localhost port in LOCAL_DEV_MODE)
_cors_kw: dict = {
    "allow_origins": settings.cors_origins_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
_rx = settings.cors_local_dev_origin_regex
if _rx:
    _cors_kw["allow_origin_regex"] = _rx
app.add_middleware(CORSMiddleware, **_cors_kw)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline headers for API responses (keys and tokens travel only over TLS + app logic)."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    return response


# Routers
app.include_router(auth.router)
app.include_router(api_keys.router)
app.include_router(images.router)
app.include_router(jobs.router)
app.include_router(history.router)
app.include_router(scrape.router)
app.include_router(image_generation.router)

# Serve uploaded files (development only)
if settings.APP_ENV == "development":
    uploads_path = settings.upload_dir_path
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "auth": "local" if settings.LOCAL_DEV_MODE else "supabase",
        "persist_image_files_on_server": bool(settings.PERSIST_IMAGE_FILES_ON_SERVER),
        "ephemeral_image_grace_seconds": int(settings.EPHEMERAL_IMAGE_GRACE_SECONDS),
        "local_dev_skip_upscale": bool(settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_SKIP_UPSCALE),
        "local_dev_upscale_fallback_on_credit_error": bool(
            settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_UPSCALE_FALLBACK_ON_CREDIT_ERROR
        ),
    }
