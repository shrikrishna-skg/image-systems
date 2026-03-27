from pydantic import BaseModel, Field
from typing import Optional


class LocalDevLoginBody(BaseModel):
    """Credentials for LOCAL_DEV_MODE JWT (never used in production Supabase flow)."""

    email: str = Field(default="", max_length=255)
    password: str = Field(default="", max_length=256)
    full_name: Optional[str] = Field(default=None, max_length=255)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    images_processed: int
    created_at: str

    model_config = {"from_attributes": True}
