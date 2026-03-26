from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pathlib import Path
from app.database import get_db
from app.models.user import User
from app.models.image import Image, ImageVersion
from app.models.api_key import ApiKey
from app.models.job import Job
from app.schemas.image import (
    ImageUploadResponse, EnhancementRequest, UpscaleRequest,
    FullPipelineRequest, ImageDetailResponse, ImageVersionResponse,
    CostEstimateResponse, PresetsResponse,
)
from app.schemas.job import JobResponse
from app.services.auth_service import get_current_user
from app.services.storage_service import storage_service
from app.services.encryption_service import encryption_service
from app.utils.image_utils import get_image_dimensions, get_mime_type
from app.utils.prompt_templates import build_enhancement_prompt, get_available_presets
from app.config import settings

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("/presets", response_model=PresetsResponse)
async def get_presets():
    """Get available enhancement presets."""
    return get_available_presets()


@router.post("/upload", response_model=List[ImageUploadResponse])
async def upload_images(
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = []
    for file in files:
        # Validate extension
        ext = Path(file.filename).suffix.lower().lstrip(".")
        if ext not in settings.allowed_extensions_list:
            raise HTTPException(
                status_code=400,
                detail=f"File type .{ext} not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}",
            )

        # Save file
        storage_path, file_size = await storage_service.save_upload(file, user.id)

        # Get dimensions
        try:
            width, height = get_image_dimensions(storage_path)
        except Exception:
            width, height = None, None

        mime_type = get_mime_type(storage_path)

        # Create DB record
        image = Image(
            user_id=user.id,
            original_filename=file.filename,
            storage_path=storage_path,
            width=width,
            height=height,
            file_size_bytes=file_size,
            mime_type=mime_type,
        )
        db.add(image)
        await db.commit()
        await db.refresh(image)

        results.append(ImageUploadResponse(
            id=image.id,
            original_filename=image.original_filename,
            width=image.width,
            height=image.height,
            file_size_bytes=image.file_size_bytes,
            mime_type=image.mime_type,
            created_at=image.created_at.isoformat(),
        ))

        # Log upload to history
        from app.services.history_service import log_processing
        await log_processing(
            user_id=user.id, action="upload", image_id=image.id,
            input_width=image.width, input_height=image.height,
            status="completed",
        )

    return results


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

    # Build prompt
    prompt = build_enhancement_prompt(
        lighting=req.lighting,
        quality=req.quality_preset,
        perspective=req.perspective,
        room_type=req.room_type,
        custom_prompt=req.custom_prompt,
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
            "api_key_id": api_key_record.id,
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

    prompt = build_enhancement_prompt(
        lighting=req.lighting,
        quality=req.quality_preset,
        perspective=req.perspective,
        room_type=req.room_type,
        custom_prompt=req.custom_prompt,
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
            "enhance_api_key_id": enhance_key.id,
            "replicate_api_key_id": replicate_key.id,
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

    return ImageDetailResponse(
        id=image.id,
        original_filename=image.original_filename,
        width=image.width,
        height=image.height,
        file_size_bytes=image.file_size_bytes,
        mime_type=image.mime_type,
        created_at=image.created_at.isoformat(),
        versions=[
            ImageVersionResponse(
                id=v.id,
                version_type=v.version_type,
                width=v.width,
                height=v.height,
                file_size_bytes=v.file_size_bytes,
                provider=v.provider,
                model=v.model,
                scale_factor=v.scale_factor,
                processing_cost_usd=float(v.processing_cost_usd) if v.processing_cost_usd else None,
                created_at=v.created_at.isoformat(),
            )
            for v in image.versions
        ],
    )


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

    return [
        ImageDetailResponse(
            id=img.id,
            original_filename=img.original_filename,
            width=img.width,
            height=img.height,
            file_size_bytes=img.file_size_bytes,
            mime_type=img.mime_type,
            created_at=img.created_at.isoformat(),
            versions=[
                ImageVersionResponse(
                    id=v.id,
                    version_type=v.version_type,
                    width=v.width,
                    height=v.height,
                    file_size_bytes=v.file_size_bytes,
                    provider=v.provider,
                    model=v.model,
                    scale_factor=v.scale_factor,
                    processing_cost_usd=float(v.processing_cost_usd) if v.processing_cost_usd else None,
                    created_at=v.created_at.isoformat(),
                )
                for v in img.versions
            ],
        )
        for img in images
    ]


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
