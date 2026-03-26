import datetime as dt
from sqlalchemy import String, Integer, Float, DateTime, Text, Numeric, Column
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base


class ProcessingHistory(Base):
    __tablename__ = "processing_history"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    image_id = Column(String(36), nullable=True)
    job_id = Column(String(36), nullable=True)
    action = Column(String(50), nullable=False)
    provider = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    prompt_used = Column(Text, nullable=True)
    input_width = Column(Integer, nullable=True)
    input_height = Column(Integer, nullable=True)
    output_width = Column(Integer, nullable=True)
    output_height = Column(Integer, nullable=True)
    scale_factor = Column(Float, nullable=True)
    quality = Column(String(20), nullable=True)
    cost_usd = Column(Numeric(10, 6), default=0)
    duration_seconds = Column(Float, nullable=True)
    status = Column(String(20), default="completed")
    error_message = Column(Text, nullable=True)
    extra_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=lambda: dt.datetime.now(dt.timezone.utc))
