import uuid
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, Text, Float, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Image(Base):
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="images")
    versions = relationship("ImageVersion", back_populates="image", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="image", cascade="all, delete-orphan")


class ImageVersion(Base):
    __tablename__ = "image_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id: Mapped[str] = mapped_column(String(36), ForeignKey("images.id"), nullable=False)
    version_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "enhanced", "upscaled", "final"
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    prompt_used: Mapped[str] = mapped_column(Text, nullable=True)
    scale_factor: Mapped[float] = mapped_column(Float, nullable=True)
    processing_cost_usd: Mapped[float] = mapped_column(Numeric(10, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    image = relationship("Image", back_populates="versions")
