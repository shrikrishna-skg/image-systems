from pydantic import BaseModel
from typing import Optional


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    images_processed: int
    created_at: str

    model_config = {"from_attributes": True}
