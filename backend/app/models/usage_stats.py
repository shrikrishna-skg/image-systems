import datetime as dt
from sqlalchemy import String, Integer, Date, DateTime, Numeric, Column
from app.database import Base


class UsageStats(Base):
    __tablename__ = "usage_stats"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    date = Column(Date, nullable=False)
    images_uploaded = Column(Integer, default=0)
    images_enhanced = Column(Integer, default=0)
    images_upscaled = Column(Integer, default=0)
    total_cost_usd = Column(Numeric(10, 6), default=0)
    api_calls_openai = Column(Integer, default=0)
    api_calls_gemini = Column(Integer, default=0)
    api_calls_replicate = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: dt.datetime.now(dt.timezone.utc))
    updated_at = Column(DateTime, default=lambda: dt.datetime.now(dt.timezone.utc), onupdate=lambda: dt.datetime.now(dt.timezone.utc))
