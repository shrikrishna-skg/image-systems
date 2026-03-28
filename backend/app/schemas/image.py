from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict


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
    """Full enhancement prompt text when this version ran through an LLM."""
    prompt_used: Optional[str] = None
    """Completed job type that produced this version (enhance / upscale / full_pipeline)."""
    source_job_type: Optional[str] = None
    """Sanitized job params (no API key ids) for UI replay."""
    generation_params: Optional[Dict[str, Any]] = None

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
    perspective: Optional[str] = None  # straighten, correct_distortion, align_verticals_auto, level_horizon_auto
    room_type: str = "general"
    custom_prompt: Optional[str] = None
    output_format: str = "png"
    quality: str = "high"  # "low", "medium", "high" (for OpenAI)
    auto_rotation_rad: Optional[float] = Field(
        default=None,
        description="Roll in radians from browser Sobel estimator; used with auto perspective + cloud plate.",
    )
    improve_input_version_id: Optional[str] = Field(
        default=None,
        description=(
            "Required when provider is openai or gemini: ImageVersion id from POST .../local-improve "
            "(browser Improve output). Cloud models always enhance this raster, never the raw upload."
        ),
    )


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
    auto_rotation_rad: Optional[float] = Field(
        default=None,
        description="Roll in radians for auto perspective when using cloud enhance.",
    )
    improve_input_version_id: Optional[str] = Field(
        default=None,
        description=(
            "Required for OpenAI/Gemini full pipeline: id of an ImageVersion with provider=improve "
            "(browser Improve output). Cloud models enhance this raster, not the raw upload."
        ),
    )
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


class SuggestFilenameRequest(BaseModel):
    """Which image bytes to analyze (original vs a version)."""
    version: Optional[str] = Field(None, description="Version ID; omit for original.")
    provider: str = Field(
        "gemini",
        description="'openai' or 'gemini' — must match a saved API key. Gemini 2.5 Flash-Lite is default for low-cost naming.",
    )


class SuggestFilenameResponse(BaseModel):
    basename: str
    model: Optional[str] = None
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    estimated_cost_usd: Optional[float] = None
    cost_note: str = ""
