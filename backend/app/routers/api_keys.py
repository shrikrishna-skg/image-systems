from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyValidateRequest
from app.services.auth_service import get_current_user
from app.services.encryption_service import encryption_service
import httpx

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyResponse])
async def list_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id)
    )
    keys = result.scalars().all()

    results = []
    for k in keys:
        try:
            decrypted = encryption_service.decrypt(k.encrypted_key)
            masked = encryption_service.mask_key(decrypted)
        except Exception:
            # Key was encrypted with a different key — mark invalid
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


@router.post("", response_model=ApiKeyResponse, status_code=201)
async def create_key(
    req: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.provider not in ("openai", "gemini", "replicate"):
        raise HTTPException(status_code=400, detail="Provider must be openai, gemini, or replicate")

    # Check if key for this provider already exists
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == req.provider)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing key
        existing.encrypted_key = encryption_service.encrypt(req.api_key)
        existing.label = req.label or existing.label
        existing.is_valid = True
        await db.commit()
        await db.refresh(existing)
        key = existing
    else:
        key = ApiKey(
            user_id=user.id,
            provider=req.provider,
            encrypted_key=encryption_service.encrypt(req.api_key),
            label=req.label or f"{req.provider} key",
        )
        db.add(key)
        await db.commit()
        await db.refresh(key)

    return ApiKeyResponse(
        id=key.id,
        provider=key.provider,
        masked_key=encryption_service.mask_key(req.api_key),
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
    """Test if an API key works against the provider."""
    try:
        if req.provider == "openai":
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {req.api_key}"},
                    timeout=10,
                )
                valid = resp.status_code == 200

        elif req.provider == "gemini":
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={req.api_key}",
                    timeout=10,
                )
                valid = resp.status_code == 200

        elif req.provider == "replicate":
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.replicate.com/v1/account",
                    headers={"Authorization": f"Bearer {req.api_key}"},
                    timeout=10,
                )
                valid = resp.status_code == 200
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")

        return {"valid": valid, "provider": req.provider}
    except httpx.TimeoutException:
        return {"valid": False, "provider": req.provider, "error": "Connection timeout"}
    except Exception as e:
        return {"valid": False, "provider": req.provider, "error": str(e)}
