import asyncio
import logging
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.models.user import User
from app.models.image import Image, ImageVersion
from app.models.api_key import ApiKey
from app.models.job import Job
from app.schemas.image import (
    ImageUploadResponse, EnhancementRequest, UpscaleRequest,
    FullPipelineRequest, ImageDetailResponse, ImageVersionResponse,
    CostEstimateResponse, PresetsResponse,
    SuggestFilenameRequest, SuggestFilenameResponse,
)
from app.schemas.job import JobResponse
from app.services.auth_service import get_current_user
from app.services.storage_service import storage_service
from app.services.filename_suggest_service import suggest_filename_openai, suggest_filename_gemini
from app.services.encryption_service import encryption_service
from app.utils.image_utils import get_mime_type, probe_stored_image
from app.utils.prompt_templates import build_enhancement_prompt, get_available_presets
from app.services.perspective_plate import should_apply_perspective_plate
from app.config import settings

router = APIRouter(prefix="/api/images", tags=["images"])
log = logging.getLogger(__name__)

_JOB_PARAM_SECRET_KEYS = frozenset({"api_key_id", "enhance_api_key_id", "replicate_api_key_id"})


def _sanitize_generation_params(raw: Optional[dict]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    out = {k: v for k, v in raw.items() if k not in _JOB_PARAM_SECRET_KEYS}
    return out if out else None


async def _completed_jobs_by_result_version(
    db: AsyncSession,
    user_id: str,
    version_ids: List[str],
) -> Dict[str, Job]:
    if not version_ids:
        return {}
    result = await db.execute(
        select(Job).where(
            Job.user_id == user_id,
            Job.result_version_id.in_(version_ids),
            Job.status == "completed",
        )
    )
    jobs = result.scalars().all()
    by_ver: Dict[str, Job] = {}
    for j in jobs:
        rid = j.result_version_id
        if rid and rid not in by_ver:
            by_ver[rid] = j
    return by_ver


def _version_to_response(v: ImageVersion, jobs_map: Dict[str, Job]) -> ImageVersionResponse:
    job = jobs_map.get(v.id)
    return ImageVersionResponse(
        id=v.id,
        version_type=v.version_type,
        width=v.width,
        height=v.height,
        file_size_bytes=v.file_size_bytes,
        provider=v.provider,
        model=v.model,
        scale_factor=float(v.scale_factor) if v.scale_factor is not None else None,
        processing_cost_usd=float(v.processing_cost_usd) if v.processing_cost_usd is not None else None,
        created_at=v.created_at.isoformat(),
        prompt_used=v.prompt_used,
        source_job_type=job.job_type if job else None,
        generation_params=_sanitize_generation_params(job.params_json if job else None),
    )


async def _detail_response_for_image(db: AsyncSession, user_id: str, image: Image) -> ImageDetailResponse:
    vids = [v.id for v in image.versions]
    jobs_map = await _completed_jobs_by_result_version(db, user_id, vids)
    return ImageDetailResponse(
        id=image.id,
        original_filename=image.original_filename,
        width=image.width,
        height=image.height,
        file_size_bytes=image.file_size_bytes,
        mime_type=image.mime_type,
        created_at=image.created_at.isoformat(),
        versions=[_version_to_response(v, jobs_map) for v in image.versions],
    )


async def _log_upload_history(
    user_id: str,
    image_id: str,
    input_width: Optional[int],
    input_height: Optional[int],
) -> None:
    from app.services.history_service import log_processing

    try:
        await log_processing(
            user_id=user_id,
            action="upload",
            image_id=image_id,
            input_width=input_width,
            input_height=input_height,
            status="completed",
        )
    except Exception:
        log.exception("Upload history log failed (non-fatal)")


@router.get("/presets", response_model=PresetsResponse)
async def get_presets():
    """Get available enhancement presets."""
    return get_available_presets()


async def _ingest_one_upload(file: UploadFile, user_id: str) -> dict:
    """Stream file to disk; Pillow must decode the file (any raster Pillow supports — ext agnostic)."""
    storage_path, file_size = await storage_service.save_upload(file, user_id)
    try:
        width, height, mime_type = await asyncio.to_thread(probe_stored_image, storage_path)
    except Exception as e:
        log.warning("Upload rejected (not decodable as image): %s", file.filename, exc_info=True)
        await storage_service.delete_file(storage_path)
        raise HTTPException(
            status_code=400,
            detail=f"Could not read as an image (unsupported or corrupt): {file.filename}",
        ) from e
    return {
        "original_filename": file.filename,
        "storage_path": storage_path,
        "file_size_bytes": file_size,
        "width": width,
        "height": height,
        "mime_type": mime_type,
    }


@router.post("/upload", response_model=List[ImageUploadResponse])
async def upload_images(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cap = settings.MAX_FILES_PER_UPLOAD_BATCH
    if len(files) > cap:
        raise HTTPException(
            status_code=400,
            detail=f"At most {cap} files per upload. Split into batches or remove extras.",
        )
    rows = await asyncio.gather(*(_ingest_one_upload(f, user.id) for f in files))

    images: List[Image] = []
    for row in rows:
        img = Image(
            user_id=user.id,
            original_filename=row["original_filename"],
            storage_path=row["storage_path"],
            width=row["width"],
            height=row["height"],
            file_size_bytes=row["file_size_bytes"],
            mime_type=row["mime_type"],
        )
        db.add(img)
        images.append(img)

    await db.commit()

    out: List[ImageUploadResponse] = []
    for img in images:
        background_tasks.add_task(
            _log_upload_history,
            user.id,
            img.id,
            img.width,
            img.height,
        )
        out.append(
            ImageUploadResponse(
                id=img.id,
                original_filename=img.original_filename,
                width=img.width,
                height=img.height,
                file_size_bytes=img.file_size_bytes,
                mime_type=img.mime_type,
                created_at=img.created_at.isoformat(),
            )
        )
    return out


@router.post("/{image_id}/enhance", response_model=JobResponse)
async def enhance_image(
    image_id: str,
    req: EnhancementRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an AI enhancement job."""
    # Verify image ownership
    result = await db.execute(select(Image).where(Image.id == image_id, Image.user_id == user.id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Verify API key exists for provider
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == req.provider)
    )
    api_key_record = result.scalar_one_or_none()
    if not api_key_record:
        raise HTTPException(status_code=400, detail=f"No {req.provider} API key configured. Add one in Settings.")

    use_plate = should_apply_perspective_plate(req.perspective, req.auto_rotation_rad)
    prompt = build_enhancement_prompt(
        lighting=req.lighting,
        quality=req.quality_preset,
        perspective=req.perspective,
        room_type=req.room_type,
        custom_prompt=req.custom_prompt,
        perspective_corner_outpaint=use_plate,
    )

    # Create job
    job = Job(
        user_id=user.id,
        image_id=image_id,
        job_type="enhance",
        status="pending",
        params_json={
            "provider": req.provider,
            "model": req.model,
            "prompt": prompt,
            "output_format": req.output_format,
            "quality": req.quality,
            "lighting": req.lighting,
            "quality_preset": req.quality_preset,
            "perspective": req.perspective,
            "room_type": req.room_type,
            "custom_prompt": req.custom_prompt,
            "api_key_id": api_key_record.id,
            "perspective_plate": use_plate,
            "auto_rotation_rad": req.auto_rotation_rad,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.services.pipeline_service import run_enhance_job
    from app.services.task_manager import create_background_task
    create_background_task(run_enhance_job(job.id), name=f"enhance-{job.id}")

    return JobResponse(
        id=job.id,
        image_id=job.image_id,
        job_type=job.job_type,
        status=job.status,
        progress_pct=job.progress_pct,
        created_at=job.created_at.isoformat(),
    )


@router.post("/{image_id}/upscale", response_model=JobResponse)
async def upscale_image(
    image_id: str,
    req: UpscaleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an upscaling job."""
    result = await db.execute(select(Image).where(Image.id == image_id, Image.user_id == user.id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Verify Replicate API key
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == "replicate")
    )
    api_key_record = result.scalar_one_or_none()
    if not api_key_record:
        raise HTTPException(status_code=400, detail="No Replicate API key configured. Add one in Settings.")

    job = Job(
        user_id=user.id,
        image_id=image_id,
        job_type="upscale",
        status="pending",
        params_json={
            "scale_factor": req.scale_factor,
            "target_resolution": req.target_resolution,
            "output_format": req.output_format,
            "api_key_id": api_key_record.id,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.services.pipeline_service import run_upscale_job
    from app.services.task_manager import create_background_task
    create_background_task(run_upscale_job(job.id), name=f"upscale-{job.id}")

    return JobResponse(
        id=job.id,
        image_id=job.image_id,
        job_type=job.job_type,
        status=job.status,
        progress_pct=job.progress_pct,
        created_at=job.created_at.isoformat(),
    )


@router.post("/{image_id}/process", response_model=JobResponse)
async def process_full_pipeline(
    image_id: str,
    req: FullPipelineRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start full pipeline: enhance + upscale."""
    result = await db.execute(select(Image).where(Image.id == image_id, Image.user_id == user.id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Verify both API keys
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == req.provider)
    )
    enhance_key = result.scalar_one_or_none()
    if not enhance_key:
        raise HTTPException(status_code=400, detail=f"No {req.provider} API key configured.")

    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == "replicate")
    )
    replicate_key = result.scalar_one_or_none()
    if not replicate_key:
        raise HTTPException(status_code=400, detail="No Replicate API key configured.")

    use_plate = should_apply_perspective_plate(req.perspective, req.auto_rotation_rad)
    prompt = build_enhancement_prompt(
        lighting=req.lighting,
        quality=req.quality_preset,
        perspective=req.perspective,
        room_type=req.room_type,
        custom_prompt=req.custom_prompt,
        perspective_corner_outpaint=use_plate,
    )

    job = Job(
        user_id=user.id,
        image_id=image_id,
        job_type="full_pipeline",
        status="pending",
        params_json={
            "provider": req.provider,
            "model": req.model,
            "prompt": prompt,
            "quality": req.quality,
            "scale_factor": req.scale_factor,
            "target_resolution": req.target_resolution,
            "output_format": req.output_format,
            "lighting": req.lighting,
            "quality_preset": req.quality_preset,
            "perspective": req.perspective,
            "room_type": req.room_type,
            "custom_prompt": req.custom_prompt,
            "enhance_api_key_id": enhance_key.id,
            "replicate_api_key_id": replicate_key.id,
            "perspective_plate": use_plate,
            "auto_rotation_rad": req.auto_rotation_rad,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.services.pipeline_service import run_full_pipeline_job
    from app.services.task_manager import create_background_task
    create_background_task(run_full_pipeline_job(job.id), name=f"pipeline-{job.id}")

    return JobResponse(
        id=job.id,
        image_id=job.image_id,
        job_type=job.job_type,
        status=job.status,
        progress_pct=job.progress_pct,
        created_at=job.created_at.isoformat(),
    )


@router.post("/{image_id}/local-improve", response_model=ImageDetailResponse)
async def upload_local_improve_version(
    image_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist a browser-processed result (Improve engine) as a new final version — no external API keys."""
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    data = await file.read()
    max_b = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(data) > max_b:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds max upload size ({settings.MAX_UPLOAD_SIZE_MB} MB).",
        )

    filename = f"improve_{uuid.uuid4().hex[:12]}.png"
    storage_path, file_size = await storage_service.save_bytes(data, user.id, filename)

    try:
        width, height, _mime = await asyncio.to_thread(probe_stored_image, storage_path)
    except Exception as e:
        log.warning("local-improve rejected (not decodable): %s", image_id, exc_info=True)
        await storage_service.delete_file(storage_path)
        raise HTTPException(
            status_code=400,
            detail="Could not read as an image (unsupported or corrupt).",
        ) from e

    version = ImageVersion(
        image_id=image.id,
        version_type="final",
        storage_path=storage_path,
        width=width,
        height=height,
        file_size_bytes=file_size,
        provider="improve",
        model="browser",
        prompt_used=None,
        scale_factor=None,
        processing_cost_usd=0,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one()

    return await _detail_response_for_image(db, user.id, image)


@router.get("/{image_id}", response_model=ImageDetailResponse)
async def get_image(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    return await _detail_response_for_image(db, user.id, image)


@router.get("/{image_id}/download")
async def download_image(
    image_id: str,
    version: Optional[str] = Query(None, description="Version ID to download. If empty, downloads original."),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if version:
        # Download specific version
        ver = next((v for v in image.versions if v.id == version), None)
        if not ver:
            raise HTTPException(status_code=404, detail="Version not found")
        file_path = ver.storage_path
        filename = f"enhanced_{image.original_filename}"
    else:
        file_path = image.storage_path
        filename = image.original_filename

    if not storage_service.file_exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=get_mime_type(file_path),
        headers={
            "Cache-Control": "private, max-age=86400"
            + (", immutable" if version else ""),
        },
    )


@router.post("/{image_id}/suggest-filename", response_model=SuggestFilenameResponse)
async def suggest_export_filename(
    image_id: str,
    req: SuggestFilenameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vision model suggests a short kebab-case filename stem (requires OpenAI or Gemini API key)."""
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if req.version:
        ver = next((v for v in image.versions if v.id == req.version), None)
        if not ver:
            raise HTTPException(status_code=404, detail="Version not found")
        file_path = ver.storage_path
    else:
        file_path = image.storage_path

    if not storage_service.file_exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    provider = (req.provider or "openai").lower()
    if provider not in ("openai", "gemini"):
        raise HTTPException(status_code=400, detail="provider must be 'openai' or 'gemini'")

    key_row = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == provider)
    )
    row = key_row.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=400,
            detail=f"No {provider} API key configured. Add one in Settings.",
        )
    api_key = encryption_service.decrypt(row.encrypted_key)

    try:
        if provider == "openai":
            stem = await asyncio.to_thread(suggest_filename_openai, api_key, file_path)
        else:
            stem = await asyncio.to_thread(suggest_filename_gemini, api_key, file_path)
    except Exception as e:
        log.exception("suggest-filename failed")
        raise HTTPException(status_code=502, detail=f"Model error: {e!s}") from e

    return SuggestFilenameResponse(basename=stem)


@router.get("", response_model=List[ImageDetailResponse])
async def list_images(
    skip: int = 0,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.user_id == user.id)
        .order_by(Image.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    images = result.scalars().all()

    return await asyncio.gather(*[_detail_response_for_image(db, user.id, img) for img in images])


@router.delete("/{image_id}")
async def delete_image(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Image)
        .options(selectinload(Image.versions))
        .where(Image.id == image_id, Image.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete files
    await storage_service.delete_file(image.storage_path)
    for v in image.versions:
        await storage_service.delete_file(v.storage_path)

    await db.delete(image)
    await db.commit()
    return {"message": "Image deleted"}


@router.post("/estimate-cost", response_model=CostEstimateResponse)
async def estimate_cost(req: FullPipelineRequest):
    """Estimate processing cost before starting."""
    if req.provider == "improve":
        return CostEstimateResponse(
            enhancement_cost=0.0,
            upscale_cost=0.0,
            total_cost=0.0,
            provider="improve",
            model="browser",
            details="Improve runs in your browser — no API usage.",
        )

    # Enhancement cost
    if req.provider == "openai":
        cost_map = {
            ("gpt-image-1.5", "high"): 0.20,
            ("gpt-image-1.5", "medium"): 0.05,
            ("gpt-image-1.5", "low"): 0.013,
            ("gpt-image-1", "high"): 0.25,
            ("gpt-image-1", "medium"): 0.063,
            ("gpt-image-1", "low"): 0.016,
            ("gpt-image-1-mini", "high"): 0.052,
            ("gpt-image-1-mini", "medium"): 0.015,
            ("gpt-image-1-mini", "low"): 0.006,
        }
        enhance_cost = cost_map.get((req.model, req.quality), 0.20)
    else:
        enhance_cost = 0.0  # Gemini free/minimal

    # Upscale cost
    passes = 1 if req.scale_factor <= 2 else 2
    upscale_cost = 0.04 * passes

    total = enhance_cost + upscale_cost

    return CostEstimateResponse(
        enhancement_cost=round(enhance_cost, 4),
        upscale_cost=round(upscale_cost, 4),
        total_cost=round(total, 4),
        provider=req.provider,
        model=req.model,
        details=f"Enhancement: ${enhance_cost:.4f} ({req.provider}/{req.model}/{req.quality}) + Upscale: ${upscale_cost:.4f} ({passes} pass{'es' if passes > 1 else ''})",
    )
