import base64
import json
import logging
from typing import Any, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.schemas.api_key import (
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyValidateRequest,
    ApiKeyValidateSavedRequest,
)
from app.config import settings
from app.services.auth_service import get_current_user
from app.services.encryption_service import encryption_service
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyResponse])
async def list_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id)
    )
    keys = [k for k in result.scalars().all() if k.provider != "firecrawl"]

    results = []
    for k in keys:
        try:
            decrypted = encryption_service.decrypt(k.encrypted_key)
            masked = encryption_service.mask_key(decrypted)
        except Exception:
            masked = "****"
            k.is_valid = False
            await db.commit()
        results.append(
            ApiKeyResponse(
                id=k.id,
                provider=k.provider,
                masked_key=masked,
                label=k.label,
                is_valid=k.is_valid,
                created_at=k.created_at.isoformat(),
            )
        )
    return results


def _gemini_error_detail(resp: httpx.Response) -> Optional[str]:
    """Extract a short message from Google Generative Language API error JSON."""
    try:
        data: Any = resp.json()
    except (json.JSONDecodeError, ValueError):
        t = (resp.text or "").strip()
        return t[:240] if t else None
    err = data.get("error") if isinstance(data, dict) else None
    if not isinstance(err, dict):
        return None
    msg = err.get("message")
    status = err.get("status")
    parts = [p for p in (msg, status) if isinstance(p, str) and p.strip()]
    if not parts:
        return None
    out = " — ".join(parts)[:400]
    return out


def _soft_validate_key_format(provider: str, api_key: str) -> None:
    """Reject obviously wrong shapes before any network call."""
    if len(api_key) < 8:
        raise HTTPException(status_code=400, detail="API key is too short.")
    if provider == "openai" and not api_key.startswith("sk-"):
        raise HTTPException(
            status_code=400,
            detail="OpenAI secret keys usually start with sk-. Paste a secret key from "
            "https://platform.openai.com/api-keys — not a publishable or org id.",
        )
    if provider == "replicate" and not api_key.startswith("r8_"):
        raise HTTPException(
            status_code=400,
            detail="Replicate API tokens usually start with r8_. Copy the token from Replicate → Account → API tokens.",
        )
    if provider == "zyte" and len(api_key) < 16:
        raise HTTPException(
            status_code=400,
            detail="Zyte API key looks too short. Copy it from https://app.zyte.com/ → Zyte API → API access.",
        )


async def _probe_provider_api_key(
    provider: str, api_key: str
) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    Return (ok, error_message, http_status).
    http_status is None only on timeout / connection errors.
    """
    if provider == "openai":
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=15,
                )
            except httpx.TimeoutException:
                return False, "Connection timeout", None
            except httpx.RequestError as e:
                return False, str(e) or "Network error", None
            if resp.status_code == 200:
                return True, None, 200
            return False, f"HTTP {resp.status_code}", resp.status_code

    if provider == "gemini":
        # Prefer header over query string (avoids keys in access logs).
        # Lists models — same key used by google-genai / AI Studio.
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    headers={"x-goog-api-key": api_key},
                    timeout=15,
                )
            except httpx.TimeoutException:
                return False, "Connection timeout", None
            except httpx.RequestError as e:
                return False, str(e) or "Network error", None
            if resp.status_code == 200:
                return True, None, 200
            detail = _gemini_error_detail(resp)
            if detail:
                return False, f"HTTP {resp.status_code}: {detail}", resp.status_code
            return False, f"HTTP {resp.status_code} (enable Generative Language API for this key in Google Cloud)", resp.status_code

    if provider == "replicate":
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    "https://api.replicate.com/v1/account",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=15,
                )
            except httpx.TimeoutException:
                return False, "Connection timeout", None
            except httpx.RequestError as e:
                return False, str(e) or "Network error", None
            if resp.status_code == 200:
                return True, None, 200
            return False, f"HTTP {resp.status_code}", resp.status_code

    if provider == "zyte":
        auth = base64.b64encode(f"{api_key}:".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        }
        # Cheap HTTP fetch (not headless) to validate credentials — see Zyte extract reference.
        payload = {"url": "https://example.com", "httpResponseBody": True}
        extract_url = (settings.ZYTE_EXTRACT_URL or "https://api.zyte.com/v1/extract").strip()
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(extract_url, json=payload, headers=headers, timeout=35.0)
            except httpx.TimeoutException:
                return False, "Connection timeout", None
            except httpx.RequestError as e:
                return False, str(e) or "Network error", None
        if resp.status_code in (401, 403):
            return False, f"HTTP {resp.status_code}", resp.status_code
        if resp.status_code == 429:
            return False, "Rate limit exceeded", 429
        if resp.status_code >= 500:
            return False, f"HTTP {resp.status_code}", resp.status_code
        if resp.status_code != 200:
            return False, f"HTTP {resp.status_code}", resp.status_code
        try:
            data = resp.json()
        except Exception:
            return False, "Invalid JSON from Zyte", resp.status_code
        if data.get("httpResponseBody"):
            return True, None, 200
        detail = data.get("detail") or data.get("title") or "Unexpected Zyte response"
        return False, str(detail), resp.status_code

    raise HTTPException(status_code=400, detail="Unknown provider")


def _is_auth_rejection(_provider: str, status: Optional[int]) -> bool:
    return status in (401, 403)


@router.post("", response_model=ApiKeyResponse, status_code=201)
async def create_key(
    req: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.provider not in ("openai", "gemini", "replicate", "zyte"):
        raise HTTPException(
            status_code=400,
            detail="Provider must be openai, gemini, replicate, or zyte",
        )

    api_key = (req.api_key or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is empty")

    _soft_validate_key_format(req.provider, api_key)

    is_valid = False
    if req.skip_connection_test:
        logger.info("api_key.create provider=%s skip_connection_test=1 user_id=%s", req.provider, user.id)
        is_valid = False
    else:
        ok, err, status = await _probe_provider_api_key(req.provider, api_key)
        logger.info(
            "api_key.probe provider=%s ok=%s status=%s user_id=%s",
            req.provider,
            ok,
            status,
            user.id,
        )
        if ok:
            is_valid = True
        elif status is None:
            raise HTTPException(
                status_code=503,
                detail="Could not reach provider (timeout or network). Check your connection, or enable "
                "'Save without verifying' to store the key for use when online.",
            )
        elif _is_auth_rejection(req.provider, status):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid API key — provider rejected authentication ({err}).",
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Could not verify key with provider ({err}).",
            )

    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == req.provider)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.encrypted_key = encryption_service.encrypt(api_key)
        existing.label = req.label or existing.label
        existing.is_valid = is_valid
        await db.commit()
        await db.refresh(existing)
        key = existing
    else:
        key = ApiKey(
            user_id=user.id,
            provider=req.provider,
            encrypted_key=encryption_service.encrypt(api_key),
            label=req.label or f"{req.provider} key",
            is_valid=is_valid,
        )
        db.add(key)
        await db.commit()
        await db.refresh(key)

    return ApiKeyResponse(
        id=key.id,
        provider=key.provider,
        masked_key=encryption_service.mask_key(api_key),
        label=key.label,
        is_valid=key.is_valid,
        created_at=key.created_at.isoformat(),
    )


@router.delete("/{key_id}")
async def delete_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    await db.delete(key)
    await db.commit()
    return {"message": "API key deleted"}


@router.post("/validate")
async def validate_key(
    req: ApiKeyValidateRequest,
    user: User = Depends(get_current_user),
):
    """Test if an API key works against the provider (does not persist)."""
    try:
        ok, err, status = await _probe_provider_api_key(req.provider, req.api_key.strip())
        logger.info("api_key.validate_raw provider=%s ok=%s status=%s user_id=%s", req.provider, ok, status, user.id)
        return {"valid": ok, "provider": req.provider, **({"error": err} if err else {})}
    except httpx.TimeoutException:
        return {"valid": False, "provider": req.provider, "error": "Connection timeout"}
    except HTTPException:
        raise
    except Exception as e:
        return {"valid": False, "provider": req.provider, "error": str(e)}


@router.post("/validate-saved")
async def validate_saved_key(
    req: ApiKeyValidateSavedRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test the stored (encrypted) key and update is_valid on the row."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == req.provider)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No saved key for {req.provider}. Save a key first.",
        )
    try:
        api_key = encryption_service.decrypt(row.encrypted_key)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Stored key could not be decrypted. Check API_KEY_ENCRYPTION_KEY matches the key used when saving.",
        )
    try:
        ok, err, status = await _probe_provider_api_key(req.provider, api_key)
        row.is_valid = ok
        await db.commit()
        logger.info(
            "api_key.validate_saved provider=%s ok=%s status=%s user_id=%s",
            req.provider,
            ok,
            status,
            user.id,
        )
        return {"valid": ok, "provider": req.provider, **({"error": err} if err else {})}
    except httpx.TimeoutException:
        return {"valid": False, "provider": req.provider, "error": "Connection timeout"}
    except HTTPException:
        raise
    except Exception as e:
        return {"valid": False, "provider": req.provider, "error": str(e)}
