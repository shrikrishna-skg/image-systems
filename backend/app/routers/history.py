from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.processing_history import ProcessingHistory
from app.models.usage_stats import UsageStats
from app.services.auth_service import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/history", tags=["history"])


class HistoryEntry(BaseModel):
    id: str
    action: str
    provider: Optional[str] = None
    model: Optional[str] = None
    input_width: Optional[int] = None
    input_height: Optional[int] = None
    output_width: Optional[int] = None
    output_height: Optional[int] = None
    scale_factor: Optional[float] = None
    quality: Optional[str] = None
    cost_usd: Optional[float] = None
    duration_seconds: Optional[float] = None
    status: str
    error_message: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


class UsageStatsResponse(BaseModel):
    date: str
    images_uploaded: int
    images_enhanced: int
    images_upscaled: int
    total_cost_usd: float
    api_calls_openai: int
    api_calls_gemini: int
    api_calls_replicate: int

    model_config = {"from_attributes": True}


class UsageSummary(BaseModel):
    total_images: int
    total_enhanced: int
    total_upscaled: int
    total_cost: float
    daily_stats: List[UsageStatsResponse]


@router.get("", response_model=List[HistoryEntry])
async def get_history(
    skip: int = 0,
    limit: int = 50,
    action: Optional[str] = Query(None, description="Filter by action type"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get processing history for the current user."""
    query = select(ProcessingHistory).where(
        ProcessingHistory.user_id == user.id
    ).order_by(ProcessingHistory.created_at.desc())

    if action:
        query = query.where(ProcessingHistory.action == action)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()

    return [
        HistoryEntry(
            id=e.id,
            action=e.action,
            provider=e.provider,
            model=e.model,
            input_width=e.input_width,
            input_height=e.input_height,
            output_width=e.output_width,
            output_height=e.output_height,
            scale_factor=e.scale_factor,
            quality=e.quality,
            cost_usd=float(e.cost_usd) if e.cost_usd else None,
            duration_seconds=e.duration_seconds,
            status=e.status,
            error_message=e.error_message,
            created_at=e.created_at.isoformat(),
        )
        for e in entries
    ]


@router.get("/usage", response_model=UsageSummary)
async def get_usage_summary(
    days: int = Query(30, description="Number of days to include"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get usage summary and daily stats."""
    from datetime import date, timedelta

    start_date = date.today() - timedelta(days=days)

    result = await db.execute(
        select(UsageStats)
        .where(UsageStats.user_id == user.id, UsageStats.date >= start_date)
        .order_by(UsageStats.date.desc())
    )
    stats = result.scalars().all()

    total_images = sum(s.images_uploaded or 0 for s in stats)
    total_enhanced = sum(s.images_enhanced or 0 for s in stats)
    total_upscaled = sum(s.images_upscaled or 0 for s in stats)
    total_cost = sum(float(s.total_cost_usd or 0) for s in stats)

    return UsageSummary(
        total_images=total_images,
        total_enhanced=total_enhanced,
        total_upscaled=total_upscaled,
        total_cost=total_cost,
        daily_stats=[
            UsageStatsResponse(
                date=s.date.isoformat(),
                images_uploaded=s.images_uploaded or 0,
                images_enhanced=s.images_enhanced or 0,
                images_upscaled=s.images_upscaled or 0,
                total_cost_usd=float(s.total_cost_usd or 0),
                api_calls_openai=s.api_calls_openai or 0,
                api_calls_gemini=s.api_calls_gemini or 0,
                api_calls_replicate=s.api_calls_replicate or 0,
            )
            for s in stats
        ],
    )
