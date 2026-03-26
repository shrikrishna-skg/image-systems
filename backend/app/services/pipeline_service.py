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
from app.services.openai_service import openai_image_service
from app.services.gemini_service import gemini_image_service
from app.services.replicate_service import replicate_upscale_service
from app.utils.image_utils import get_image_dimensions
from app.config import settings
import os
import time

logger = logging.getLogger(__name__)

# Dedicated thread pool for CPU/IO-bound AI API calls
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pipeline")


async def _update_job(db: AsyncSession, job_id: str, **kwargs):
    """Update job fields."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
        await db.commit()


async def _get_api_key(db: AsyncSession, api_key_id: str) -> str:
    """Decrypt and return API key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == api_key_id))
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
            source_path = image.storage_path
            logger.info(f"Source image: {source_path}")

            # Decrypt API key
            api_key = await _get_api_key(db, params["api_key_id"])
            await _update_job(db, job_id, progress_pct=20)
            logger.info(f"API key decrypted, provider={params['provider']}")

            # Call AI service in thread pool
            provider = params["provider"]
            start_time = time.time()

            if provider == "openai":
                logger.info("Calling OpenAI enhance...")
                enhanced_bytes = await _run_in_thread(
                    openai_image_service.enhance_image,
                    api_key=api_key,
                    image_path=source_path,
                    prompt=params["prompt"],
                    model=params.get("model", "gpt-image-1"),
                    quality=params.get("quality", "high"),
                    output_format=params.get("output_format", "png"),
                )
            elif provider == "gemini":
                logger.info("Calling Gemini enhance...")
                enhanced_bytes = await _run_in_thread(
                    gemini_image_service.enhance_image,
                    api_key=api_key,
                    image_path=source_path,
                    prompt=params["prompt"],
                    model=params.get("model", "gemini-2.0-flash-exp-image-generation"),
                )
            else:
                raise ValueError(f"Unknown provider: {provider}")

            duration = time.time() - start_time
            logger.info(f"Enhancement complete, got {len(enhanced_bytes)} bytes in {duration:.1f}s")
            await _update_job(db, job_id, progress_pct=70)

            # Save enhanced image
            output_format = params.get("output_format", "png")
            filename = f"enhanced_{uuid.uuid4().hex[:8]}.{output_format}"
            user_dir = f"{settings.UPLOAD_DIR}/{job.user_id}"
            os.makedirs(user_dir, exist_ok=True)
            output_path = f"{user_dir}/{filename}"

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

            # Use latest version if available
            result = await db.execute(
                select(ImageVersion)
                .where(ImageVersion.image_id == image.id)
                .order_by(ImageVersion.created_at.desc())
            )
            latest_version = result.scalar_one_or_none()
            source_path = latest_version.storage_path if latest_version else image.storage_path

            api_key = await _get_api_key(db, params["api_key_id"])
            await _update_job(db, job_id, progress_pct=20)

            scale_factor = params.get("scale_factor", 2)

            upscaled_bytes = await _run_in_thread(
                replicate_upscale_service.upscale_multi_pass,
                api_key=api_key,
                image_path=source_path,
                total_scale=scale_factor,
            )

            await _update_job(db, job_id, progress_pct=80)

            output_format = params.get("output_format", "png")
            filename = f"upscaled_{scale_factor}x_{uuid.uuid4().hex[:8]}.{output_format}"
            user_dir = f"{settings.UPLOAD_DIR}/{job.user_id}"
            os.makedirs(user_dir, exist_ok=True)
            output_path = f"{user_dir}/{filename}"

            with open(output_path, "wb") as f:
                f.write(upscaled_bytes)

            try:
                width, height = get_image_dimensions(output_path)
            except Exception:
                width, height = None, None

            passes = 1 if scale_factor <= 4 else 2
            version = ImageVersion(
                image_id=image.id,
                version_type="upscaled",
                storage_path=output_path,
                width=width,
                height=height,
                file_size_bytes=len(upscaled_bytes),
                provider="replicate",
                model="real-esrgan",
                scale_factor=float(scale_factor),
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
            source_path = image.storage_path

            # --- Step 1: Enhance ---
            provider = params["provider"]
            enhance_api_key = await _get_api_key(db, params["enhance_api_key_id"])
            await _update_job(db, job_id, progress_pct=10)
            logger.info(f"Step 1: Enhancing with {provider}")

            if provider == "openai":
                enhanced_bytes = await _run_in_thread(
                    openai_image_service.enhance_image,
                    api_key=enhance_api_key,
                    image_path=source_path,
                    prompt=params["prompt"],
                    model=params.get("model", "gpt-image-1"),
                    quality=params.get("quality", "high"),
                )
            elif provider == "gemini":
                enhanced_bytes = await _run_in_thread(
                    gemini_image_service.enhance_image,
                    api_key=enhance_api_key,
                    image_path=source_path,
                    prompt=params["prompt"],
                    model=params.get("model", "gemini-2.0-flash-exp-image-generation"),
                )
            else:
                raise ValueError(f"Unknown provider: {provider}")

            logger.info(f"Enhancement done: {len(enhanced_bytes)} bytes")
            await _update_job(db, job_id, progress_pct=40)

            # Save enhanced intermediate
            user_dir = f"{settings.UPLOAD_DIR}/{job.user_id}"
            os.makedirs(user_dir, exist_ok=True)
            enhanced_path = f"{user_dir}/enhanced_{uuid.uuid4().hex[:8]}.png"

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

            # --- Step 2: Upscale ---
            await _update_job(db, job_id, progress_pct=50)
            logger.info("Step 2: Upscaling")

            replicate_api_key = await _get_api_key(db, params["replicate_api_key_id"])
            scale_factor = params.get("scale_factor", 2)

            upscaled_bytes = await _run_in_thread(
                replicate_upscale_service.upscale_multi_pass,
                api_key=replicate_api_key,
                image_path=enhanced_path,
                total_scale=scale_factor,
            )

            logger.info(f"Upscale done: {len(upscaled_bytes)} bytes")
            await _update_job(db, job_id, progress_pct=85)

            output_format = params.get("output_format", "png")
            final_filename = f"final_{scale_factor}x_{uuid.uuid4().hex[:8]}.{output_format}"
            final_path = f"{user_dir}/{final_filename}"

            with open(final_path, "wb") as f:
                f.write(upscaled_bytes)

            try:
                fw, fh = get_image_dimensions(final_path)
            except Exception:
                fw, fh = None, None

            passes = 1 if scale_factor <= 4 else 2
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
                scale_factor=float(scale_factor),
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
                scale_factor=float(scale_factor), cost_usd=float(upscale_cost),
                status="completed",
            )

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
