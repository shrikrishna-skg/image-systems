import uuid
import jwt
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LocalDevLoginBody, UserResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/local/session")
async def create_local_dev_session(
    body: LocalDevLoginBody,
    db: AsyncSession = Depends(get_db),
):
    """Issue a dev JWT when LOCAL_DEV_MODE=true (no Supabase). Validates optional env gate."""
    if not settings.LOCAL_DEV_MODE:
        raise HTTPException(status_code=404, detail="Not found")

    email_raw = (body.email or "").strip()
    password = body.password or ""
    if not email_raw or "@" not in email_raw:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(password) < 1:
        raise HTTPException(status_code=400, detail="Enter your password.")

    email_norm = email_raw.lower()
    pw_env = (settings.LOCAL_DEV_LOGIN_PASSWORD or "").strip()
    em_env = (settings.LOCAL_DEV_LOGIN_EMAIL or "").strip()
    if pw_env:
        if password != pw_env:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        if em_env and email_norm != em_env.lower():
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    elif em_env and email_norm != em_env.lower():
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # One DB user per email so API keys, images, and jobs stay scoped to that account.
    result = await db.execute(select(User).where(func.lower(User.email) == email_norm))
    user = result.scalar_one_or_none()
    if not user:
        fn = (body.full_name or "").strip() if body.full_name is not None else None
        user = User(
            id=str(uuid.uuid4()),
            email=email_norm,
            full_name=fn or None,
            is_active=True,
        )
        db.add(user)
    else:
        if body.full_name is not None:
            fn = (body.full_name or "").strip()
            user.full_name = fn or None
    await db.commit()
    await db.refresh(user)

    token = jwt.encode(
        {
            "sub": user.id,
            "email": user.email,
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
        },
        settings.APP_SECRET_KEY,
        algorithm="HS256",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            images_processed=user.images_processed,
            created_at=user.created_at.isoformat(),
        ),
    }


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile. Auth is handled by Supabase on the frontend."""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        images_processed=user.images_processed,
        created_at=user.created_at.isoformat(),
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    full_name: str = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    if full_name is not None:
        user.full_name = full_name
        await db.commit()
        await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        images_processed=user.images_processed,
        created_at=user.created_at.isoformat(),
    )
