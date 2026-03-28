"""Scrape image URLs from a web page and import selected URLs as uploads."""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from pathlib import Path
from typing import List, Optional
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.api_key import ApiKey
from app.models.image import Image
from app.models.user import User
from app.schemas.image import ImageUploadResponse
from app.schemas.scrape import (
    EmbedCheckRequest,
    EmbedCheckResponse,
    ImportUrlsRequest,
    ScrapePageRequest,
    ScrapePageResponse,
    ScrapedImageOut,
)
from app.services.auth_service import get_current_user
from app.services.embed_check_service import check_url_embeddable
from app.services.encryption_service import encryption_service
from app.services.page_scrape_service import scrape_image_cap, scrape_page_for_images
from app.services.safe_http_fetch import fetch_bytes_with_redirects
from app.services.storage_service import storage_service
from app.utils.image_utils import probe_stored_image
from app.utils.ssrf_safe_url import normalize_http_url

router = APIRouter(prefix="/api/scrape", tags=["scrape"])
log = logging.getLogger(__name__)


async def _user_zyte_key(user_id: str, db: AsyncSession) -> Optional[str]:
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.provider == "zyte"))
    row = result.scalar_one_or_none()
    if not row:
        return None
    try:
        return encryption_service.decrypt(row.encrypted_key).strip()
    except Exception:
        log.warning("scrape: could not decrypt zyte key for user_id=%s", user_id)
        return None


async def _log_scrape_upload(
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
        log.exception("Scrape upload history log failed (non-fatal)")


def _filename_from_image_url(url: str) -> str:
    path = urlparse(url).path
    name = Path(unquote(path)).name if path else ""
    name = re.sub(r"[^\w.\-]+", "_", name)[:120]
    if not name or name in (".", ".."):
        return f"scraped_{uuid.uuid4().hex[:10]}.img"
    if "." not in name:
        name = f"{name}.img"
    return name


@router.post("/embed-check", response_model=EmbedCheckResponse)
async def embed_check(
    req: EmbedCheckRequest,
    user: User = Depends(get_current_user),
):
    """
    Check whether a URL can be displayed in an iframe from this app (X-Frame-Options / CSP). Many sites
    (e.g. Expedia) forbid embedding — the panel would stay blank without this check.
    """
    del user
    try:
        final, ok, detail = await check_url_embeddable(req.url.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        log.warning("embed_check failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not inspect that URL.") from e
    return EmbedCheckResponse(final_url=final, embed_allowed=ok, detail=detail)


@router.post("/page", response_model=ScrapePageResponse)
async def scrape_page(
    req: ScrapePageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch a page once (Zyte or direct HTTP) and list image URLs from that HTML.
    No additional Zyte calls for /scrape/import-urls — only this endpoint runs browser extract.
    """
    zyte_key = await _user_zyte_key(user.id, db)
    cap = scrape_image_cap()
    try:
        items, final = await scrape_page_for_images(
            req.url,
            use_rendered_scrape=req.use_rendered_scrape,
            zyte_api_key=zyte_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        log.warning("scrape_page failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not fetch or parse that page.") from e

    return ScrapePageResponse(
        page_url=req.url.strip(),
        final_url=final,
        images=[
            ScrapedImageOut(url=i.url, alt=i.alt, source=i.source) for i in items
        ],
        truncated=len(items) >= cap,
        scrape_image_cap=cap,
    )


@router.post("/import-urls", response_model=List[ImageUploadResponse])
async def import_urls_as_images(
    req: ImportUrlsRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Download image URLs (each re-validated for SSRF) and register as Image rows — same as multipart upload.
    Does not call Zyte; only HTTP GETs the selected asset URLs (your CDN / origin bandwidth).
    """
    cap = settings.MAX_FILES_PER_UPLOAD_BATCH
    urls = req.urls[:cap]
    if len(req.urls) > cap:
        raise HTTPException(
            status_code=400,
            detail=f"At most {cap} URLs per request.",
        )

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    created: List[Image] = []
    staged_paths: List[str] = []

    try:
        for raw in urls:
            try:
                u = normalize_http_url(raw)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e

            try:
                data, _final = await fetch_bytes_with_redirects(u, max_bytes=max_bytes)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Download failed ({u}): {e}") from e
            except Exception as e:
                log.warning("import url fetch failed %s: %s", u, e)
                raise HTTPException(
                    status_code=502,
                    detail=f"Could not download: {u}",
                ) from e

            fname = _filename_from_image_url(u)
            try:
                storage_path, file_size = await storage_service.save_bytes(data, user.id, fname)
            except Exception as e:
                raise HTTPException(status_code=500, detail="Could not save downloaded image.") from e

            staged_paths.append(storage_path)

            try:
                width, height, mime_type = await asyncio.to_thread(probe_stored_image, storage_path)
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not a decodable image: {u}",
                )

            img = Image(
                user_id=user.id,
                original_filename=fname,
                storage_path=storage_path,
                width=width,
                height=height,
                file_size_bytes=file_size,
                mime_type=mime_type,
            )
            db.add(img)
            created.append(img)

        await db.commit()
    except HTTPException:
        await db.rollback()
        for p in staged_paths:
            await storage_service.delete_file(p)
        raise

    for img in created:
        await db.refresh(img)

    out: List[ImageUploadResponse] = []
    for img in created:
        background_tasks.add_task(
            _log_scrape_upload,
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
