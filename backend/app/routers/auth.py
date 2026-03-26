from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
