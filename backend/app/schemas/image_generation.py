from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.image import ImageUploadResponse


class ImageGenerationComposeRequest(BaseModel):
    """Turn natural language into a concrete image prompt (preview before generation)."""

    user_request: str = Field(..., min_length=3, max_length=8000)
    provider: Literal["openai", "gemini"] = Field(
        "openai",
        description="Which provider's key to use for the interpretation LLM (match the key you use to generate).",
    )


class ImageGenerationComposeResponse(BaseModel):
    interpreted_prompt: str = Field(..., description="Refined prompt ready for the image model.")
    short_title: str = Field(..., description="Short label for filenames and UI.")


class ImageGenerationGenerateRequest(BaseModel):
    """Generate a new raster from text; optionally interpret vague text first."""

    description: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="Natural language (interpret=True) or exact prompt (interpret=False).",
    )
    provider: Literal["openai", "gemini"]
    interpret: bool = Field(
        True,
        description="When True, run an LLM step to expand the description into a detailed image prompt.",
    )
    model: str = Field(..., min_length=2, max_length=128)
    quality: str = Field(
        "high",
        description="OpenAI image quality: low | medium | high (ignored when provider=gemini).",
    )
    output_format: str = Field("png", description="png, jpeg, or webp for OpenAI output.")
    run_enhancement_pipeline: bool = Field(
        False,
        description="Phase 2: run full enhancement after generation — not implemented yet.",
    )


class ImageGenerationGenerateResponse(ImageUploadResponse):
    """New Image row plus generation metadata."""

    resolved_prompt: str = Field(..., description="Exact prompt sent to the image API.")
    used_interpretation: bool = Field(..., description="Whether the LLM interpretation step ran.")
