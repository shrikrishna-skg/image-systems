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
from app.config import settings
from app.services.filename_suggest_service import suggest_filename_openai, suggest_filename_gemini
from app.services.encryption_service import encryption_service
from app.utils.image_utils import get_mime_type, probe_stored_image, estimate_replicate_passes
from app.utils.prompt_templates import build_enhancement_prompt, get_available_presets
from app.services.perspective_plate import should_apply_perspective_plate
from app.constants.cloud_image_models import (
    ALLOWED_GEMINI_CLOUD_IMAGE_MODELS,
    ALLOWED_OPENAI_CLOUD_IMAGE_MODELS,
)
from app.services.pipeline_service import _estimate_enhance_cost

router = APIRouter(prefix="/api/images", tags=["images"])
log = logging.getLogger(__name__)


def _validate_cloud_image_model(provider: str, model: str) -> None:
    m = (model or "").strip()
    if provider == "openai" and m not in ALLOWED_OPENAI_CLOUD_IMAGE_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported OpenAI image model. Use one of: {', '.join(sorted(ALLOWED_OPENAI_CLOUD_IMAGE_MODELS))}.",
        )
    if provider == "gemini" and m not in ALLOWED_GEMINI_CLOUD_IMAGE_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Gemini image model. Use one of: {', '.join(sorted(ALLOWED_GEMINI_CLOUD_IMAGE_MODELS))}.",
        )


async def _validate_browser_improve_version(
    db: AsyncSession,
    image_id: str,
    improve_version_id: str,
) -> None:
    vres = await db.execute(
        select(ImageVersion).where(
            ImageVersion.id == improve_version_id,
            ImageVersion.image_id == image_id,
        )
    )
    imp_ver = vres.scalar_one_or_none()
    if not imp_ver:
        raise HTTPException(status_code=400, detail="improve_input_version_id not found for this image.")
    if (imp_ver.provider or "").lower() != "improve":
        raise HTTPException(
            status_code=400,
            detail="improve_input_version_id must be a browser Improve version (local engine).",
        )
    if not (imp_ver.storage_path or "").strip():
        raise HTTPException(status_code=400, detail="Improve version has no file on disk.")

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

    if req.provider in ("openai", "gemini"):
        _validate_cloud_image_model(req.provider, req.model)
        if not (req.improve_input_version_id or "").strip():
            raise HTTPException(
                status_code=400,
                detail="improve_input_version_id is required: run browser Improve first, then send that version to OpenAI or Gemini (same as the full pipeline).",
            )
        await _validate_browser_improve_version(db, image_id, req.improve_input_version_id)
        # Improve raster already includes perspective/lighting from the browser; do not add a cloud plate.
        use_plate = False
    else:
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
            "improve_input_version_id": req.improve_input_version_id,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.services.pipeline_service import run_enhance_job
    from app.services.task_manager import create_background_task
    create_background_task(run_enhance_job(job.id), name=f"enhance-{job.id}")

    return JobResponse.model_validate(job)


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

    return JobResponse.model_validate(job)


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

    if req.provider in ("openai", "gemini"):
        _validate_cloud_image_model(req.provider, req.model)

    skip_replicate = bool(settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_SKIP_UPSCALE)
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == "replicate")
    )
    replicate_key = result.scalar_one_or_none()
    if not skip_replicate and not replicate_key:
        raise HTTPException(status_code=400, detail="No Replicate API key configured.")

    if req.provider in ("openai", "gemini"):
        if not req.improve_input_version_id:
            raise HTTPException(
                status_code=400,
                detail="improve_input_version_id is required: the app runs browser Improve first, then sends that version to the cloud model.",
            )
        await _validate_browser_improve_version(db, image_id, req.improve_input_version_id)

    use_plate = should_apply_perspective_plate(req.perspective, req.auto_rotation_rad)
    if req.provider in ("openai", "gemini") and req.improve_input_version_id:
        # Perspective is already baked into the Improve raster; skip corner-outpaint prompt + plate.
        use_plate = False
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
            "replicate_api_key_id": replicate_key.id if replicate_key else None,
            "perspective_plate": use_plate,
            "auto_rotation_rad": req.auto_rotation_rad,
            "improve_input_version_id": req.improve_input_version_id,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.services.pipeline_service import run_full_pipeline_job
    from app.services.task_manager import create_background_task
    create_background_task(run_full_pipeline_job(job.id), name=f"pipeline-{job.id}")

    return JobResponse.model_validate(job)


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

    from app.services.ephemeral_storage import maybe_ephemeral_after_job

    await maybe_ephemeral_after_job(db, image.id, version.id)

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
        file_path = (ver.storage_path or "").strip()
        filename = f"enhanced_{image.original_filename}"
    else:
        file_path = (image.storage_path or "").strip()
        filename = image.original_filename

    if not file_path:
        raise HTTPException(
            status_code=410,
            detail="This file is no longer on the server. Download results promptly or keep a local copy — "
            "see PERSIST_IMAGE_FILES_ON_SERVER / ephemeral retention.",
        )

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

    ver_row: Optional[ImageVersion] = None
    if req.version:
        ver_row = next((v for v in image.versions if v.id == req.version), None)
        if not ver_row:
            raise HTTPException(status_code=404, detail="Version not found")
        file_path = (ver_row.storage_path or "").strip()
    else:
        file_path = (image.storage_path or "").strip()

    if not file_path:
        raise HTTPException(
            status_code=410,
            detail="Image bytes were removed from server storage; use a local file for filename suggestions.",
        )

    if not storage_service.file_exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    provider = (req.provider or "gemini").lower()
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

    ctx = {
        "original_filename": image.original_filename or "",
        "mime_type": image.mime_type,
    }
    if ver_row:
        ctx.update(
            {
                "subject": "processed_pipeline_output",
                "version_type": ver_row.version_type,
                "width": ver_row.width or image.width,
                "height": ver_row.height or image.height,
                "file_size_bytes": ver_row.file_size_bytes if ver_row.file_size_bytes is not None else image.file_size_bytes,
                "enhancement_provider": ver_row.provider,
                "enhancement_model": ver_row.model,
                "scale_factor": ver_row.scale_factor,
            }
        )
    else:
        ctx.update(
            {
                "subject": "original_upload",
                "width": image.width,
                "height": image.height,
                "file_size_bytes": image.file_size_bytes,
            }
        )

    try:
        if provider == "openai":
            out = await asyncio.to_thread(suggest_filename_openai, api_key, file_path, ctx)
        else:
            out = await asyncio.to_thread(
                suggest_filename_gemini,
                api_key,
                file_path,
                ctx,
                settings.GEMINI_FILENAME_SUGGEST_MODEL,
            )
    except Exception as e:
        log.exception("suggest-filename failed")
        raise HTTPException(status_code=502, detail=f"Model error: {e!s}") from e

    return SuggestFilenameResponse(
        basename=out.basename,
        model=out.model,
        prompt_tokens=out.prompt_tokens,
        output_tokens=out.output_tokens,
        estimated_cost_usd=out.estimated_cost_usd,
        cost_note=out.cost_note or "",
    )


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

    # Enhancement cost (same estimator as pipeline job metadata)
    if req.provider in ("openai", "gemini"):
        enhance_cost = float(_estimate_enhance_cost(req.provider, req.model, req.quality))
    else:
        enhance_cost = 0.0

    # Upscale cost (aligned with plan_replicate_upscale_total + replicate multi-pass)
    passes = estimate_replicate_passes(float(req.scale_factor), req.target_resolution)
    upscale_cost = 0.04 * passes
    if settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_SKIP_UPSCALE:
        upscale_cost = 0.0

    total = enhance_cost + upscale_cost

    if settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_SKIP_UPSCALE:
        details = (
            f"Enhancement: ${enhance_cost:.4f} ({req.provider}/{req.model}/{req.quality}) — "
            f"local dev: Replicate upscale skipped (LOCAL_DEV_SKIP_UPSCALE)."
        )
    else:
        details = (
            f"Enhancement: ${enhance_cost:.4f} ({req.provider}/{req.model}/{req.quality}) + "
            f"Upscale: ${upscale_cost:.4f} ({passes} pass{'es' if passes > 1 else ''})"
        )

    return CostEstimateResponse(
        enhancement_cost=round(enhance_cost, 4),
        upscale_cost=round(upscale_cost, 4),
        total_cost=round(total, 4),
        provider=req.provider,
        model=req.model,
        details=details,
    )
