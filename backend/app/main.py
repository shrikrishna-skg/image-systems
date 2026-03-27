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
from sqlalchemy import select, text

from app.config import LOCAL_DEV_USER_ID
from app.database import engine, Base, AsyncSessionLocal
from app.services.auth_service import _jwt_secret_configured
import app.models  # noqa: F401 — register all ORM tables on Base.metadata
from app.models.user import User
from app.routers import auth, api_keys, images, jobs, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir_path.mkdir(parents=True, exist_ok=True)
    if settings.LOCAL_DEV_MODE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == LOCAL_DEV_USER_ID))
            if result.scalar_one_or_none() is None:
                db.add(
                    User(
                        id=LOCAL_DEV_USER_ID,
                        email="local@dev",
                        full_name="Local dev",
                        is_active=True,
                    )
                )
                await db.commit()
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


app = FastAPI(
    title="Image Enhance Pro",
    description="AI-powered hotel & real estate image enhancement API",
    version="2.0.0",
    lifespan=lifespan,
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


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(api_keys.router)
app.include_router(images.router)
app.include_router(jobs.router)
app.include_router(history.router)

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
    }
