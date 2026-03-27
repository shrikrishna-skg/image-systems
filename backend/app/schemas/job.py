from pydantic import BaseModel
from typing import Optional


class JobResponse(BaseModel):
    id: str
    image_id: str
    job_type: str
    status: str
    progress_pct: int
    error_message: Optional[str] = None
    result_version_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}
