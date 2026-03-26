from pydantic import BaseModel, Field
from typing import Optional, List


class ImageVersionResponse(BaseModel):
    id: str
    version_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    scale_factor: Optional[float] = None
    processing_cost_usd: Optional[float] = None
    created_at: str

    model_config = {"from_attributes": True}


class ImageUploadResponse(BaseModel):
    id: str
    original_filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: str
    versions: List[ImageVersionResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class EnhancementRequest(BaseModel):
    provider: str = "openai"  # "openai" or "gemini"
    model: str = "gpt-image-1"  # model name
    lighting: Optional[str] = None  # "bright", "warm", "natural", "hdr", "evening"
    quality_preset: Optional[str] = None  # "sharpen", "denoise", "color_correct", "full_enhance"
    perspective: Optional[str] = None  # "straighten", "correct_distortion"
    room_type: str = "general"
    custom_prompt: Optional[str] = None
    output_format: str = "png"
    quality: str = "high"  # "low", "medium", "high" (for OpenAI)


class UpscaleRequest(BaseModel):
    scale_factor: int = 2  # 2 or 4
    target_resolution: Optional[str] = None  # "1080p", "2k", "4k", "8k"
    output_format: str = "png"


class FullPipelineRequest(BaseModel):
    # Enhancement params
    provider: str = "openai"
    model: str = "gpt-image-1"
    lighting: Optional[str] = "bright"
    quality_preset: Optional[str] = "full_enhance"
    perspective: Optional[str] = None
    room_type: str = "general"
    custom_prompt: Optional[str] = None
    quality: str = "high"
    # Upscale params
    scale_factor: int = 2
    target_resolution: Optional[str] = "4k"
    output_format: str = "png"


class ImageDetailResponse(BaseModel):
    id: str
    original_filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: str
    versions: List[ImageVersionResponse] = []

    model_config = {"from_attributes": True}


class CostEstimateResponse(BaseModel):
    enhancement_cost: float
    upscale_cost: float
    total_cost: float
    provider: str
    model: str
    details: str


class PresetsResponse(BaseModel):
    lighting: List[str]
    quality: List[str]
    perspective: List[str]
    room_types: List[str]
