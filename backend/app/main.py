import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.config import settings
from app.routers import auth, api_keys, images, jobs, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload dir exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Image Enhance Pro",
    description="AI-powered hotel & real estate image enhancement API",
    version="2.0.0",
    lifespan=lifespan,
)

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
    uploads_path = Path(settings.UPLOAD_DIR)
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0", "auth": "supabase"}
