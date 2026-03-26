import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from app.config import settings


class StorageService:
    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_user_dir(self, user_id: str) -> Path:
        user_dir = self.upload_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def _generate_filename(self, original_filename: str, prefix: str = "") -> str:
        ext = Path(original_filename).suffix.lower()
        unique_id = str(uuid.uuid4())[:8]
        name = f"{prefix}{unique_id}{ext}" if prefix else f"{unique_id}{ext}"
        return name

    async def save_upload(self, file: UploadFile, user_id: str) -> tuple[str, int]:
        """Save an uploaded file. Returns (storage_path, file_size_bytes)."""
        user_dir = self._get_user_dir(user_id)
        filename = self._generate_filename(file.filename, prefix="orig_")
        file_path = user_dir / filename

        file_size = 0
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                await f.write(chunk)
                file_size += len(chunk)

        return str(file_path), file_size

    async def save_bytes(self, data: bytes, user_id: str, filename: str) -> tuple[str, int]:
        """Save raw bytes to storage. Returns (storage_path, file_size_bytes)."""
        user_dir = self._get_user_dir(user_id)
        file_path = user_dir / filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)

        return str(file_path), len(data)

    def get_file_path(self, storage_path: str) -> Path:
        """Get the full path for a stored file."""
        return Path(storage_path)

    def file_exists(self, storage_path: str) -> bool:
        return Path(storage_path).exists()

    async def delete_file(self, storage_path: str) -> bool:
        path = Path(storage_path)
        if path.exists():
            os.remove(path)
            return True
        return False


storage_service = StorageService()
