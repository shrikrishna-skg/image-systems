"""Natural-language image generation (interpret → image API → stored Image row)."""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.api_key import ApiKey
from app.models.image import Image
from app.models.user import User
from app.schemas.image import ImageUploadResponse
from app.schemas.image_generation import (
    ImageGenerationComposeRequest,
    ImageGenerationComposeResponse,
    ImageGenerationGenerateRequest,
    ImageGenerationGenerateResponse,
)
from app.services.auth_service import get_current_user
from app.services.encryption_service import encryption_service
from app.services.image_generation_intent_service import interpret_user_request
from app.services.history_service import log_processing
from app.services.gemini_service import gemini_image_service
from app.services.openai_service import openai_image_service
from app.services.storage_service import storage_service
from app.utils.image_utils import probe_stored_image
from app.services.filename_suggest_service import sanitize_stem

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/image-generation", tags=["image-generation"])

ALLOWED_OPENAI_GEN_MODELS = frozenset({"gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"})
ALLOWED_GEMINI_GEN_MODELS = frozenset(
    {
        "gemini-2.5-flash-image",
        "gemini-2.0-flash-exp-image-generation",
    }
)


async def _decrypt_user_provider_key(user_id: str, provider: str, db: AsyncSession) -> str:
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.provider == provider)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=400,
            detail=f"No {provider} API key saved. Add one under Integrations.",
        )
    try:
        return encryption_service.decrypt(row.encrypted_key).strip()
    except Exception as e:
        log.warning("image_generation: decrypt key failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Could not read stored API key.") from e


def _validate_model(provider: str, model: str) -> None:
    m = (model or "").strip()
    if provider == "openai" and m not in ALLOWED_OPENAI_GEN_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported OpenAI image model. Use one of: {', '.join(sorted(ALLOWED_OPENAI_GEN_MODELS))}.",
        )
    if provider == "gemini" and m not in ALLOWED_GEMINI_GEN_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Gemini image model. Use one of: {', '.join(sorted(ALLOWED_GEMINI_GEN_MODELS))}.",
        )


def _norm_output_format(fmt: str) -> str:
    f = (fmt or "png").lower()
    if f in ("jpg", "jpeg"):
        return "jpeg"
    if f == "webp":
        return "webp"
    if f == "png":
        return "png"
    raise HTTPException(status_code=400, detail="output_format must be png, jpeg, or webp")


async def _log_gen_upload(
    user_id: str,
    image_id: str,
    provider: str,
    model: str,
    prompt: str,
    input_width: Optional[int],
    input_height: Optional[int],
    used_interpretation: bool,
) -> None:
    try:
        await log_processing(
            user_id=user_id,
            action="upload",
            image_id=image_id,
            provider=provider,
            model=model,
            prompt=prompt[:4000] if prompt else None,
            input_width=input_width,
            input_height=input_height,
            status="completed",
            metadata={
                "source": "image_generation",
                "used_interpretation": used_interpretation,
            },
        )
    except Exception:
        log.exception("image_generation history log failed (non-fatal)")


@router.post("/compose", response_model=ImageGenerationComposeResponse)
async def compose_prompt(
    req: ImageGenerationComposeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 1a — Software intelligence: turn a vague request into a concrete image prompt.
    Does not call the image API or consume image-generation quota.
    """
    api_key = await _decrypt_user_provider_key(user.id, req.provider, db)
    try:
        image_prompt, short_title = await asyncio.to_thread(
            interpret_user_request, req.user_request, req.provider, api_key
        )
    except Exception as e:
        log.warning("compose interpretation failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Could not interpret that request. Try shorter text, another provider, or use “Exact prompt” mode on the generation screen.",
        ) from e

    return ImageGenerationComposeResponse(
        interpreted_prompt=image_prompt,
        short_title=short_title,
    )


@router.post("/generate", response_model=ImageGenerationGenerateResponse)
async def generate_image(
    req: ImageGenerationGenerateRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Interpret (optional) → image model → persist as a new Image (original), same as an upload for Operations.
    """
    if req.run_enhancement_pipeline:
        raise HTTPException(
            status_code=501,
            detail="Phase 2: automatic enhancement after generation is not implemented yet. Open Operations to run the pipeline on the new image.",
        )

    _validate_model(req.provider, req.model)
    out_fmt = _norm_output_format(req.output_format)
    api_key = await _decrypt_user_provider_key(user.id, req.provider, db)

    used_interpretation = bool(req.interpret)
    short_title = "ai-generated"
    if req.interpret:
        try:
            resolved_prompt, short_title = await asyncio.to_thread(
                interpret_user_request, req.description, req.provider, api_key
            )
        except Exception as e:
            log.warning("generate: interpretation failed, using raw description: %s", e)
            resolved_prompt = req.description.strip()[:6000]
            used_interpretation = False
    else:
        resolved_prompt = req.description.strip()[:6000]

    if len(resolved_prompt) < 3:
        raise HTTPException(status_code=400, detail="Prompt is too short after processing.")

    try:
        if req.provider == "openai":
            q = (req.quality or "high").lower()
            if q not in ("low", "medium", "high"):
                q = "high"
            image_bytes = await asyncio.to_thread(
                openai_image_service.generate_image,
                api_key,
                resolved_prompt,
                req.model.strip(),
                q,
                out_fmt,
            )
        else:
            image_bytes = await asyncio.to_thread(
                gemini_image_service.generate_image_from_text,
                api_key,
                resolved_prompt,
                req.model.strip(),
            )
    except HTTPException:
        raise
    except Exception as e:
        log.warning("image generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Image provider failed. Check your key, model access, and prompt; try again.",
        ) from e

    ext = ".png"
    if out_fmt == "jpeg":
        ext = ".jpg"
    elif out_fmt == "webp":
        ext = ".webp"
    stem = sanitize_stem(short_title)[:48]
    fname = f"gen_{stem}_{uuid.uuid4().hex[:8]}{ext}"

    storage_path, file_size = await storage_service.save_bytes(image_bytes, user.id, fname)

    try:
        width, height, mime_type = await asyncio.to_thread(probe_stored_image, storage_path)
    except Exception as e:
        log.warning("generated file not decodable as image, removing: %s", e)
        await storage_service.delete_file(storage_path)
        raise HTTPException(
            status_code=502,
            detail="Provider returned bytes we could not decode as an image.",
        ) from e

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
    await db.commit()
    await db.refresh(img)

    background_tasks.add_task(
        _log_gen_upload,
        user.id,
        img.id,
        req.provider,
        req.model,
        resolved_prompt,
        width,
        height,
        used_interpretation,
    )

    base = ImageUploadResponse(
        id=img.id,
        original_filename=img.original_filename,
        width=img.width,
        height=img.height,
        file_size_bytes=img.file_size_bytes,
        mime_type=img.mime_type,
        created_at=img.created_at.isoformat(),
        versions=[],
    )
    return ImageGenerationGenerateResponse(
        **base.model_dump(),
        resolved_prompt=resolved_prompt,
        used_interpretation=used_interpretation,
    )
