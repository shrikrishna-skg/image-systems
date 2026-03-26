import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase JWT token and return the payload."""
    try:
        # Try decoding with the JWT secret
        if settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET != "your-jwt-secret-from-supabase-dashboard":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        else:
            # Fallback: decode without verification (development only)
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract user from Supabase JWT and ensure they exist in our DB."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_supabase_token(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no user ID")

    email = payload.get("email", "")

    # Look up user in our database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Auto-create user profile on first API call
        user = User(
            id=user_id,
            email=email,
            full_name=payload.get("user_metadata", {}).get("full_name", ""),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    return user
