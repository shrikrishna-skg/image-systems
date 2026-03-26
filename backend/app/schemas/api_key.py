from pydantic import BaseModel
from typing import Optional


class ApiKeyCreate(BaseModel):
    provider: str  # "openai", "gemini", "replicate"
    api_key: str
    label: Optional[str] = None


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
