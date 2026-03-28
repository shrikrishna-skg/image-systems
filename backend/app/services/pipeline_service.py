from __future__ import annotations

import os
import uuid
import asyncio
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.image import Image, ImageVersion
from app.models.job import Job
from app.models.api_key import ApiKey
from app.services.encryption_service import encryption_service
from app.constants.cloud_image_models import (
    DEFAULT_GEMINI_ENHANCE_MODEL,
    DEFAULT_OPENAI_ENHANCE_MODEL,
)
from app.services.openai_service import openai_image_service
from app.services.gemini_service import gemini_image_service
from app.services.replicate_service import replicate_upscale_service
from app.utils.image_utils import (
    get_image_dimensions,
    plan_replicate_upscale_total,
    resize_raster_bytes_to_size,
)
from app.config import settings
from app.services.perspective_plate import write_perspective_plate_tempfile
import time

logger = logging.getLogger(__name__)

# Dedicated thread pool for CPU/IO-bound work (resize, provider SDK calls).
_workers = 8 if settings.LOCAL_DEV_MODE else 4
_executor = ThreadPoolExecutor(max_workers=_workers, thread_name_prefix="pipeline")


async def _update_job(db: AsyncSession, job_id: str, **kwargs):
    """Update job fields."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
        await db.commit()


async def _get_api_key_for_user(db: AsyncSession, api_key_id: str, user_id: str) -> str:
    """Decrypt API key only if it belongs to the job owner (defense in depth)."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == api_key_id, ApiKey.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise ValueError("API key not found")
    return encryption_service.decrypt(record.encrypted_key)


def _estimate_enhance_cost(provider: str, model: str = None, quality: str = None) -> float:
    """Estimate enhancement cost."""
    if provider == "gemini":
        return 0.0
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
    return cost_map.get((model, quality), 0.20)


async def _run_in_thread(func, *args, **kwargs):
    """Run a sync function in the thread pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, lambda: func(*args, **kwargs))


def run_cloud_enhance_sync(
    *,
    provider: str,
    api_key: str,
    image_path: str,
    prompt: str,
    model: str | None,
    quality: str,
    output_format: str,
) -> bytes:
    """
    Single entry for OpenAI vs Gemini image enhance (same params, same architectural step).
    Used by enhance-only and full-pipeline jobs.
    """
    q = (quality or "high").lower()
    if q not in ("low", "medium", "high"):
        q = "high"
    out_fmt = (output_format or "png").lower()
    if provider == "openai":
        return openai_image_service.enhance_image(
            api_key,
            image_path,
            prompt,
            (model or DEFAULT_OPENAI_ENHANCE_MODEL).strip(),
            q,
            out_fmt,
        )
    if provider == "gemini":
        return gemini_image_service.enhance_image(
            api_key,
            image_path,
            prompt,
            (model or DEFAULT_GEMINI_ENHANCE_MODEL).strip(),
            q,
            out_fmt,
        )
    raise ValueError(f"Unknown cloud enhance provider: {provider}")


async def _stall_progress_pulse(
    job_id: str,
    floor_pct: int,
    cap_pct: int,
    done: asyncio.Event,
    *,
    interval_sec: float = 60.0,
    step_pct: int = 4,
):
    """
    While a blocking provider call runs, creep progress so the UI does not look frozen.
    OpenAI/Replicate often take several minutes with no intermediate callbacks.
    """
    step = 0
    while True:
        try:
            await asyncio.wait_for(done.wait(), timeout=interval_sec)
            return
        except asyncio.TimeoutError:
            step += 1
            pct = min(floor_pct + step * step_pct, cap_pct)
            try:
                async with AsyncSessionLocal() as sdb:
                    res = await sdb.execute(select(Job).where(Job.id == job_id))
                    row = res.scalar_one_or_none()
                    if not row or row.status != "processing":
                        return
                    await _update_job(sdb, job_id, progress_pct=pct)
            except Exception:
                logger.debug("stall progress pulse failed for job %s", job_id, exc_info=True)


def _is_replicate_credit_error(exc: Exception) -> bool:
    s = str(exc).lower()
    return (
        "402" in s
        or "insufficient credit" in s
        or "billing credit" in s
        or "needs billing credit" in s
    )


async def _finish_full_pipeline_enhanced_only(
    db: AsyncSession,
    job_id: str,
    job: Job,
    image: Image,
    enhanced_version: ImageVersion,
    ew: int | None,
    eh: int | None,
    enhance_cost: float,
    provider: str,
    params: dict,
    scale_factor: float,
    note: str,
) -> None:
    """Mark job complete using the enhanced version (no Replicate output on disk)."""
    await db.refresh(enhanced_version)
    await _update_job(
        db,
        job_id,
        status="completed",
        progress_pct=100,
        completed_at=datetime.now(timezone.utc),
        result_version_id=enhanced_version.id,
    )
    logger.info("Full pipeline completed (enhanced-only): %s — %s", job_id, note)
    from app.services.history_service import log_processing

    await log_processing(
        user_id=job.user_id,
        action="enhance",
        image_id=image.id,
        job_id=job_id,
        provider=provider,
        model=params.get("model"),
        prompt=params["prompt"],
        input_width=image.width,
        input_height=image.height,
        output_width=ew,
        output_height=eh,
        quality=params.get("quality"),
        cost_usd=float(enhance_cost),
        status="completed",
    )
    await log_processing(
        user_id=job.user_id,
        action="upscale",
        image_id=image.id,
        job_id=job_id,
        provider="replicate",
        model="real-esrgan",
        input_width=ew,
        input_height=eh,
        output_width=ew,
        output_height=eh,
        scale_factor=float(scale_factor),
        cost_usd=0.0,
        status="skipped",
        error_message=note[:500],
    )

    from app.services.ephemeral_storage import maybe_ephemeral_after_job

    await maybe_ephemeral_after_job(db, image.id, enhanced_version.id)


def _resolve_enhance_image_path(params: dict, source_path: str) -> tuple[str, str | None]:
    """Return (path_for_openai_or_gemini, tempfile_to_delete_or_none)."""
    if not params.get("perspective_plate"):
        return source_path, None
    tmp = write_perspective_plate_tempfile(
        source_path,
        params["perspective"],
        params.get("auto_rotation_rad"),
    )
    return tmp, tmp


async def _resolve_full_pipeline_enhance_source(
    db: AsyncSession, image: Image, params: dict
) -> tuple[str, dict]:
    """
    OpenAI/Gemini always enhance the browser Improve output, not the raw upload.
    Perspective plate is skipped — geometry is already baked into the Improve raster.
    """
    improve_vid = params.get("improve_input_version_id")
    if not improve_vid:
        raise ValueError(
            "improve_input_version_id is required: run browser Improve and save it before OpenAI/Gemini."
        )
    result = await db.execute(
        select(ImageVersion).where(
            ImageVersion.id == improve_vid,
            ImageVersion.image_id == image.id,
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        raise ValueError("improve_input_version_id not found for this image")
    if (v.provider or "").lower() != "improve":
        raise ValueError("improve_input_version_id must reference a browser Improve version (provider=improve)")
    sp = (v.storage_path or "").strip()
    if not sp:
        raise ValueError("Improve version has no image file on disk")
    plate_params = {**params, "perspective_plate": False, "auto_rotation_rad": None}
    return sp, plate_params


async def run_enhance_job(job_id: str):
    """Enhance an image using OpenAI or Gemini. Runs as async background task."""
    logger.info(f"Starting enhance job: {job_id}")
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                logger.error(f"Job not found: {job_id}")
                return

            await _update_job(db, job_id, status="processing", started_at=datetime.now(timezone.utc), progress_pct=10)

            params = job.params_json
            result = await db.execute(select(Image).where(Image.id == job.image_id))
            image = result.scalar_one_or_none()
            if not image:
                raise ValueError(f"Image not found: {job.image_id}")
            if image.user_id != job.user_id:
                raise ValueError("Image does not belong to job owner")
            provider = params["provider"]
            if provider in ("openai", "gemini"):
                if not (params.get("improve_input_version_id") or "").strip():
                    raise ValueError(
                        "improve_input_version_id is required for OpenAI/Gemini enhance: "
                        "run browser Improve and save it before calling the cloud model."
                    )
                source_path, plate_params = await _resolve_full_pipeline_enhance_source(db, image, params)
                logger.info("Enhance job: input is browser Improve raster (OpenAI/Gemini)")
            else:
                source_path = image.storage_path
                plate_params = params
            logger.info(f"Source image: {source_path}")

            api_key = await _get_api_key_for_user(db, params["api_key_id"], job.user_id)
            await _update_job(db, job_id, progress_pct=20)
            logger.info("Using stored API key for provider=%s", params["provider"])

            start_time = time.time()

            enhance_input, plate_tmp = _resolve_enhance_image_path(plate_params, source_path)
            try:
                if provider not in ("openai", "gemini"):
                    raise ValueError(f"Unknown provider: {provider}")
                logger.info("Calling cloud enhance (provider=%s)...", provider)
                enhanced_bytes = await _run_in_thread(
                    run_cloud_enhance_sync,
                    provider=provider,
                    api_key=api_key,
                    image_path=enhance_input,
                    prompt=params["prompt"],
                    model=params.get("model"),
                    quality=params.get("quality", "high"),
                    output_format=params.get("output_format", "png"),
                )
            finally:
                if plate_tmp:
                    try:
                        os.unlink(plate_tmp)
                    except OSError:
                        pass

            duration = time.time() - start_time
            logger.info(f"Enhancement complete, got {len(enhanced_bytes)} bytes in {duration:.1f}s")
            await _update_job(db, job_id, progress_pct=70)

            # Save enhanced image (Gemini returns PNG; keep extension consistent)
            out_fmt = (params.get("output_format", "png") or "png").lower()
            if out_fmt in ("jpg", "jpeg"):
                ext = "jpg"
            elif out_fmt == "webp":
                ext = "webp"
            else:
                ext = "png"
            if provider == "gemini":
                ext = "png"
            filename = f"enhanced_{uuid.uuid4().hex[:8]}.{ext}"
            user_dir = settings.upload_dir_path / str(job.user_id)
            user_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(user_dir / filename)

            with open(output_path, "wb") as f:
                f.write(enhanced_bytes)

            try:
                width, height = get_image_dimensions(output_path)
            except Exception:
                width, height = None, None

            version = ImageVersion(
                image_id=image.id,
                version_type="enhanced",
                storage_path=output_path,
                width=width,
                height=height,
                file_size_bytes=len(enhanced_bytes),
                provider=provider,
                model=params.get("model"),
                prompt_used=params["prompt"],
                processing_cost_usd=_estimate_enhance_cost(provider, params.get("model"), params.get("quality")),
            )
            db.add(version)
            await db.commit()
            await db.refresh(version)

            await _update_job(
                db, job_id,
                status="completed",
                progress_pct=100,
                completed_at=datetime.now(timezone.utc),
                result_version_id=version.id,
            )
            logger.info(f"Enhance job completed: {job_id}")

            # Log to history
            from app.services.history_service import log_processing
            await log_processing(
                user_id=job.user_id, action="enhance", image_id=image.id, job_id=job_id,
                provider=provider, model=params.get("model"), prompt=params["prompt"],
                input_width=image.width, input_height=image.height,
                output_width=width, output_height=height,
                quality=params.get("quality"), cost_usd=float(version.processing_cost_usd or 0),
                duration_seconds=duration, status="completed",
            )

            from app.services.ephemeral_storage import maybe_ephemeral_after_job

            await maybe_ephemeral_after_job(db, image.id, version.id)

        except Exception as e:
            logger.error(f"Enhance job failed: {job_id} - {str(e)}")
            traceback.print_exc()
            await _update_job(
                db, job_id,
                status="failed",
                error_message=str(e),
                progress_pct=0,
            )
            # Log failure to history
            try:
                from app.services.history_service import log_processing
                await log_processing(
                    user_id=job.user_id, action="enhance", image_id=job.image_id, job_id=job_id,
                    provider=params.get("provider"), model=params.get("model"),
                    status="failed", error_message=str(e),
                )
            except Exception:
                pass


async def run_upscale_job(job_id: str):
    """Upscale an image using Real-ESRGAN via Replicate."""
    logger.info(f"Starting upscale job: {job_id}")
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                return

            await _update_job(db, job_id, status="processing", started_at=datetime.now(timezone.utc), progress_pct=10)

            params = job.params_json
            result = await db.execute(select(Image).where(Image.id == job.image_id))
            image = result.scalar_one_or_none()
            if not image:
                raise ValueError(f"Image not found: {job.image_id}")
            if image.user_id != job.user_id:
                raise ValueError("Image does not belong to job owner")

            # Use latest version if available
            result = await db.execute(
                select(ImageVersion)
                .where(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
                .limit(1)
            )
            latest_version = result.scalar_one_or_none()
            source_path = latest_version.storage_path if latest_version else image.storage_path

            api_key = await _get_api_key_for_user(db, params["api_key_id"], job.user_id)
            await _update_job(db, job_id, progress_pct=20)

            scale_factor = float(params.get("scale_factor", 2))
            try:
                sw, sh = get_image_dimensions(source_path)
            except Exception:
                sw, sh = None, None
            rep_scale, target_wh = plan_replicate_upscale_total(
                sw or 0,
                sh or 0,
                params.get("target_resolution"),
                scale_factor,
            )

            upscaled_bytes = await _run_in_thread(
                replicate_upscale_service.upscale_multi_pass,
                api_key=api_key,
                image_path=source_path,
                total_scale=int(rep_scale),
            )

            await _update_job(db, job_id, progress_pct=80)

            output_format = params.get("output_format", "png")
            if target_wh:
                upscaled_bytes = await _run_in_thread(
                    resize_raster_bytes_to_size,
                    upscaled_bytes,
                    target_wh[0],
                    target_wh[1],
                    output_format,
                )

            filename = f"upscaled_{rep_scale}x_{uuid.uuid4().hex[:8]}.{output_format}"
            user_dir = settings.upload_dir_path / str(job.user_id)
            user_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(user_dir / filename)

            with open(output_path, "wb") as f:
                f.write(upscaled_bytes)

            try:
                width, height = get_image_dimensions(output_path)
            except Exception:
                width, height = None, None

            passes = 1 if rep_scale <= 4 else 2
            version = ImageVersion(
                image_id=image.id,
                version_type="upscaled",
                storage_path=output_path,
                width=width,
                height=height,
                file_size_bytes=len(upscaled_bytes),
                provider="replicate",
                model="real-esrgan",
                scale_factor=float(rep_scale),
                processing_cost_usd=0.04 * passes,
            )
            db.add(version)
            await db.commit()
            await db.refresh(version)

            await _update_job(
                db, job_id,
                status="completed",
                progress_pct=100,
                completed_at=datetime.now(timezone.utc),
                result_version_id=version.id,
            )
            logger.info(f"Upscale job completed: {job_id}")

            from app.services.ephemeral_storage import maybe_ephemeral_after_job

            await maybe_ephemeral_after_job(db, image.id, version.id)

        except Exception as e:
            logger.error(f"Upscale job failed: {job_id} - {str(e)}")
            traceback.print_exc()
            await _update_job(
                db, job_id,
                status="failed",
                error_message=str(e),
                progress_pct=0,
            )


async def run_full_pipeline_job(job_id: str):
    """Full pipeline: enhance + upscale."""
    logger.info(f"Starting full pipeline job: {job_id}")
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                return

            await _update_job(db, job_id, status="processing", started_at=datetime.now(timezone.utc), progress_pct=5)

            params = job.params_json
            result = await db.execute(select(Image).where(Image.id == job.image_id))
            image = result.scalar_one_or_none()
            if not image:
                raise ValueError(f"Image not found: {job.image_id}")
            if image.user_id != job.user_id:
                raise ValueError("Image does not belong to job owner")

            # --- Step 1: Enhance (input = browser Improve raster, not raw upload) ---
            provider = params["provider"]
            enhance_api_key = await _get_api_key_for_user(db, params["enhance_api_key_id"], job.user_id)
            await _update_job(db, job_id, progress_pct=10)
            logger.info("Step 1: Enhancing with %s (source=browser Improve version)", provider)

            source_path, plate_params = await _resolve_full_pipeline_enhance_source(db, image, params)
            enhance_input, plate_tmp = _resolve_enhance_image_path(plate_params, source_path)
            enhance_done = asyncio.Event()
            enhance_pulse = asyncio.create_task(
                _stall_progress_pulse(
                    job_id, 11, 36, enhance_done, interval_sec=60.0, step_pct=4
                )
            )
            try:
                try:
                    if provider not in ("openai", "gemini"):
                        raise ValueError(f"Unknown provider: {provider}")
                    enhanced_bytes = await _run_in_thread(
                        run_cloud_enhance_sync,
                        provider=provider,
                        api_key=enhance_api_key,
                        image_path=enhance_input,
                        prompt=params["prompt"],
                        model=params.get("model"),
                        quality=params.get("quality", "high"),
                        output_format=params.get("output_format", "png"),
                    )
                finally:
                    enhance_done.set()
                    try:
                        await enhance_pulse
                    except Exception:
                        logger.debug("enhance progress pulse join failed", exc_info=True)
            finally:
                if plate_tmp:
                    try:
                        os.unlink(plate_tmp)
                    except OSError:
                        pass

            logger.info(f"Enhancement done: {len(enhanced_bytes)} bytes")
            await _update_job(db, job_id, progress_pct=40)

            # Save enhanced intermediate
            user_dir = settings.upload_dir_path / str(job.user_id)
            user_dir.mkdir(parents=True, exist_ok=True)
            enhanced_path = str(user_dir / f"enhanced_{uuid.uuid4().hex[:8]}.png")

            with open(enhanced_path, "wb") as f:
                f.write(enhanced_bytes)

            try:
                ew, eh = get_image_dimensions(enhanced_path)
            except Exception:
                ew, eh = None, None

            enhance_cost = _estimate_enhance_cost(provider, params.get("model"), params.get("quality"))
            enhanced_version = ImageVersion(
                image_id=image.id,
                version_type="enhanced",
                storage_path=enhanced_path,
                width=ew,
                height=eh,
                file_size_bytes=len(enhanced_bytes),
                provider=provider,
                model=params.get("model"),
                prompt_used=params["prompt"],
                processing_cost_usd=enhance_cost,
            )
            db.add(enhanced_version)
            await db.commit()
            await db.refresh(enhanced_version)

            scale_factor = float(params.get("scale_factor", 2))
            ew_plan = ew if ew and ew > 0 else 0
            eh_plan = eh if eh and eh > 0 else 0
            rep_scale, target_wh = plan_replicate_upscale_total(
                ew_plan,
                eh_plan,
                params.get("target_resolution"),
                scale_factor,
            )
            logger.info(
                "Upscale plan: enhanced=%sx%s target_resolution=%s ui_scale=%s -> replicate_total=%s exact=%s",
                ew_plan or "?",
                eh_plan or "?",
                params.get("target_resolution"),
                scale_factor,
                rep_scale,
                target_wh,
            )

            # --- Step 2: Upscale (optional in local dev) ---
            if settings.LOCAL_DEV_MODE and settings.LOCAL_DEV_SKIP_UPSCALE:
                await _finish_full_pipeline_enhanced_only(
                    db,
                    job_id,
                    job,
                    image,
                    enhanced_version,
                    ew,
                    eh,
                    float(enhance_cost),
                    provider,
                    params,
                    scale_factor,
                    "LOCAL_DEV_SKIP_UPSCALE: Replicate step skipped; result is the enhanced image.",
                )
                return

            await _update_job(db, job_id, progress_pct=50)
            logger.info("Step 2: Upscaling")

            rid = params.get("replicate_api_key_id")
            if not rid:
                raise ValueError("Missing replicate_api_key_id in job params")
            replicate_api_key = await _get_api_key_for_user(db, rid, job.user_id)

            upscale_done = asyncio.Event()
            upscale_pulse = asyncio.create_task(
                _stall_progress_pulse(
                    job_id, 52, 82, upscale_done, interval_sec=75.0, step_pct=3
                )
            )
            try:
                try:
                    upscaled_bytes = await _run_in_thread(
                        replicate_upscale_service.upscale_multi_pass,
                        api_key=replicate_api_key,
                        image_path=enhanced_path,
                        total_scale=int(rep_scale),
                    )
                except RuntimeError as up_e:
                    if (
                        settings.LOCAL_DEV_MODE
                        and settings.LOCAL_DEV_UPSCALE_FALLBACK_ON_CREDIT_ERROR
                        and _is_replicate_credit_error(up_e)
                    ):
                        logger.warning(
                            "Local dev: Replicate credit/billing error; finishing with enhanced-only: %s",
                            up_e,
                        )
                        await _finish_full_pipeline_enhanced_only(
                            db,
                            job_id,
                            job,
                            image,
                            enhanced_version,
                            ew,
                            eh,
                            float(enhance_cost),
                            provider,
                            params,
                            scale_factor,
                            "Replicate billing/credit error (e.g. HTTP 402); delivered enhanced image only.",
                        )
                        return
                    raise
            finally:
                upscale_done.set()
                try:
                    await upscale_pulse
                except Exception:
                    logger.debug("upscale progress pulse join failed", exc_info=True)

            logger.info(f"Upscale done: {len(upscaled_bytes)} bytes")
            await _update_job(db, job_id, progress_pct=85)

            output_format = params.get("output_format", "png")
            if target_wh:
                upscaled_bytes = await _run_in_thread(
                    resize_raster_bytes_to_size,
                    upscaled_bytes,
                    target_wh[0],
                    target_wh[1],
                    output_format,
                )

            final_filename = f"final_{rep_scale}x_{uuid.uuid4().hex[:8]}.{output_format}"
            final_path = str(user_dir / final_filename)

            with open(final_path, "wb") as f:
                f.write(upscaled_bytes)

            try:
                fw, fh = get_image_dimensions(final_path)
            except Exception:
                fw, fh = None, None

            passes = 1 if rep_scale <= 4 else 2
            upscale_cost = 0.04 * passes

            final_version = ImageVersion(
                image_id=image.id,
                version_type="final",
                storage_path=final_path,
                width=fw,
                height=fh,
                file_size_bytes=len(upscaled_bytes),
                provider="replicate",
                model="real-esrgan",
                scale_factor=float(rep_scale),
                processing_cost_usd=upscale_cost,
            )
            db.add(final_version)
            await db.commit()
            await db.refresh(final_version)

            await _update_job(
                db, job_id,
                status="completed",
                progress_pct=100,
                completed_at=datetime.now(timezone.utc),
                result_version_id=final_version.id,
            )
            logger.info(f"Full pipeline completed: {job_id}")

            # Log both steps to history
            from app.services.history_service import log_processing
            await log_processing(
                user_id=job.user_id, action="enhance", image_id=image.id, job_id=job_id,
                provider=provider, model=params.get("model"), prompt=params["prompt"],
                input_width=image.width, input_height=image.height,
                output_width=ew, output_height=eh,
                quality=params.get("quality"), cost_usd=float(enhance_cost),
                status="completed",
            )
            await log_processing(
                user_id=job.user_id, action="upscale", image_id=image.id, job_id=job_id,
                provider="replicate", model="real-esrgan",
                input_width=ew, input_height=eh, output_width=fw, output_height=fh,
                scale_factor=float(rep_scale), cost_usd=float(upscale_cost),
                status="completed",
            )

            from app.services.ephemeral_storage import maybe_ephemeral_after_job

            await maybe_ephemeral_after_job(db, image.id, final_version.id)

        except Exception as e:
            logger.error(f"Full pipeline failed: {job_id} - {str(e)}")
            traceback.print_exc()
            await _update_job(
                db, job_id,
                status="failed",
                error_message=str(e),
                progress_pct=0,
            )
            try:
                from app.services.history_service import log_processing
                await log_processing(
                    user_id=job.user_id, action="full_pipeline", image_id=job.image_id, job_id=job_id,
                    provider=params.get("provider"), model=params.get("model"),
                    status="failed", error_message=str(e),
                )
            except Exception:
                pass
