import jwt
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings, LOCAL_DEV_USER_ID
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/local/session")
async def create_local_dev_session(db: AsyncSession = Depends(get_db)):
    """Issue a dev JWT when LOCAL_DEV_MODE=true (no Supabase)."""
    if not settings.LOCAL_DEV_MODE:
        raise HTTPException(status_code=404, detail="Not found")
    result = await db.execute(select(User).where(User.id == LOCAL_DEV_USER_ID))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=503,
            detail="Local dev user missing; restart the API after LOCAL_DEV_MODE=true",
        )
    token = jwt.encode(
        {
            "sub": LOCAL_DEV_USER_ID,
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
