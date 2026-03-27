"""Automatic history tracking for all processing operations."""
import uuid
import logging
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.processing_history import ProcessingHistory
from app.models.usage_stats import UsageStats

logger = logging.getLogger(__name__)


async def log_processing(
    user_id: str,
    action: str,
    image_id: str = None,
    job_id: str = None,
    provider: str = None,
    model: str = None,
    prompt: str = None,
    input_width: int = None,
    input_height: int = None,
    output_width: int = None,
    output_height: int = None,
    scale_factor: float = None,
    quality: str = None,
    cost_usd: float = 0,
    duration_seconds: float = None,
    status: str = "completed",
    error_message: str = None,
    metadata: dict = None,
):
    """Log a processing operation to history and update usage stats."""
    try:
        async with AsyncSessionLocal() as db:
            # 1. Save to processing_history
            entry = ProcessingHistory(
                id=str(uuid.uuid4()),
                user_id=user_id,
                image_id=image_id,
                job_id=job_id,
                action=action,
                provider=provider,
                model=model,
                prompt_used=prompt,
                input_width=input_width,
                input_height=input_height,
                output_width=output_width,
                output_height=output_height,
                scale_factor=scale_factor,
                quality=quality,
                cost_usd=cost_usd,
                duration_seconds=duration_seconds,
                status=status,
                error_message=error_message,
                extra_data=metadata or {},
            )
            db.add(entry)

            # 2. Update usage_stats (upsert for today)
            today = date.today()
            result = await db.execute(
                select(UsageStats).where(
                    UsageStats.user_id == user_id,
                    UsageStats.date == today,
                )
            )
            stats = result.scalar_one_or_none()

            if not stats:
                stats = UsageStats(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    date=today,
                )
                db.add(stats)

            # Increment counters based on action
            if action == "upload":
                stats.images_uploaded = (stats.images_uploaded or 0) + 1
            elif action == "enhance":
                stats.images_enhanced = (stats.images_enhanced or 0) + 1
            elif action == "upscale" and status == "completed":
                stats.images_upscaled = (stats.images_upscaled or 0) + 1

            # Track provider usage
            if provider == "openai":
                stats.api_calls_openai = (stats.api_calls_openai or 0) + 1
            elif provider == "gemini":
                stats.api_calls_gemini = (stats.api_calls_gemini or 0) + 1
            elif provider == "replicate" and status == "completed":
                stats.api_calls_replicate = (stats.api_calls_replicate or 0) + 1

            # Accumulate cost
            stats.total_cost_usd = float(stats.total_cost_usd or 0) + (cost_usd or 0)
            stats.updated_at = datetime.now(timezone.utc)

            await db.commit()
            logger.info(f"History logged: {action} for user {user_id[:8]}...")

    except Exception as e:
        logger.error(f"Failed to log history: {e}")
        # Don't fail the main operation if history logging fails
