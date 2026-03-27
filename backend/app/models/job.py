import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    image_id: Mapped[str] = mapped_column(String(36), ForeignKey("images.id"), nullable=False)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "enhance", "upscale", "full_pipeline"
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, processing, completed, failed
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    params_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    result_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("image_versions.id"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="jobs")
    image = relationship("Image", back_populates="jobs")
    result_version = relationship("ImageVersion", foreign_keys=[result_version_id])
