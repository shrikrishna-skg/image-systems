"""
When PERSIST_IMAGE_FILES_ON_SERVER is false, remove pixel files from disk after jobs complete.

We keep only the latest result file briefly (EPHEMERAL_IMAGE_GRACE_SECONDS) so the client can
download it into memory / blob URLs; then delete that file and clear storage_path fields.
Metadata rows (dimensions, job history) remain for auditing — no image bytes in the database.
"""

from __future__ import annotations

import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.image import Image, ImageVersion
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


async def maybe_ephemeral_after_job(db: AsyncSession, image_id: str, result_version_id: str) -> None:
    """Trim non-result files immediately; schedule deletion of the result file after grace period."""
    if settings.PERSIST_IMAGE_FILES_ON_SERVER:
        return

    result = await db.execute(
        select(Image).options(selectinload(Image.versions)).where(Image.id == image_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        return

    rv = next((v for v in image.versions if v.id == result_version_id), None)
    if not rv or not (rv.storage_path or "").strip():
        return

    keep = rv.storage_path.strip()

    for v in image.versions:
        p = (v.storage_path or "").strip()
        if p and p != keep:
            await storage_service.delete_file(p)
            v.storage_path = ""

    ip = (image.storage_path or "").strip()
    if ip and ip != keep:
        await storage_service.delete_file(ip)
        image.storage_path = ""

    await db.commit()

    grace = max(30, int(settings.EPHEMERAL_IMAGE_GRACE_SECONDS))
    _schedule_final_purge(image_id, result_version_id, keep, grace)


def _schedule_final_purge(image_id: str, result_version_id: str, result_path: str, delay_sec: int) -> None:
    async def _run() -> None:
        await asyncio.sleep(delay_sec)
        async with AsyncSessionLocal() as sdb:
            try:
                await storage_service.delete_file(result_path)
                res = await sdb.execute(select(ImageVersion).where(ImageVersion.id == result_version_id))
                ver = res.scalar_one_or_none()
                if ver:
                    ver.storage_path = ""
                res2 = await sdb.execute(
                    select(Image).options(selectinload(Image.versions)).where(Image.id == image_id)
                )
                img = res2.scalar_one_or_none()
                if img:
                    for v in img.versions:
                        p = (v.storage_path or "").strip()
                        if p:
                            await storage_service.delete_file(p)
                            v.storage_path = ""
                    img.storage_path = ""
                await sdb.commit()
            except Exception:
                logger.exception("Ephemeral final purge failed for image %s", image_id)

    asyncio.get_running_loop().create_task(_run(), name=f"ephemeral-purge-{image_id[:8]}")
