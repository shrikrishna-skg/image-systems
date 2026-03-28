"""
Cloud image model IDs for OpenAI + Gemini (enhance + text-to-image).
Keep aligned with frontend `providerIntegrationMeta` (OPENAI_IMAGE_MODELS / GEMINI_IMAGE_MODELS).
"""

ALLOWED_OPENAI_CLOUD_IMAGE_MODELS = frozenset(
    {
        "gpt-image-1.5",
        "gpt-image-1",
        "gpt-image-1-mini",
    }
)

ALLOWED_GEMINI_CLOUD_IMAGE_MODELS = frozenset(
    {
        "gemini-2.5-flash-image",
        "gemini-2.0-flash-exp-image-generation",
    }
)

DEFAULT_OPENAI_ENHANCE_MODEL = "gpt-image-1"
DEFAULT_GEMINI_ENHANCE_MODEL = "gemini-2.0-flash-exp-image-generation"
