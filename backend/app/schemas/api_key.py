from pydantic import BaseModel, Field
from typing import Optional


class ApiKeyCreate(BaseModel):
    provider: str  # "openai", "gemini", "replicate"
    api_key: str
    label: Optional[str] = None
    skip_connection_test: bool = Field(
        default=False,
        description="If True, store without contacting provider; is_valid stays False.",
    )


class ApiKeyResponse(BaseModel):
    id: str
    provider: str
    masked_key: str
    label: Optional[str]
    is_valid: bool
    created_at: str

    model_config = {"from_attributes": True}


class ApiKeyValidateRequest(BaseModel):
    provider: str
    api_key: str


class ApiKeyValidateSavedRequest(BaseModel):
    """Validate the key already stored for this provider (server decrypts)."""

    provider: str
