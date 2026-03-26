import io
from PIL import Image
from pathlib import Path
from typing import Optional


def get_image_dimensions(file_path: str) -> tuple[int, int]:
    """Get width and height of an image."""
    with Image.open(file_path) as img:
        return img.size


def get_mime_type(file_path: str) -> str:
    """Get MIME type based on file extension."""
    ext = Path(file_path).suffix.lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
    }
    return mime_map.get(ext, "image/jpeg")


def resize_for_api(file_path: str, max_dimension: int = 1536) -> bytes:
    """Resize image to fit within max_dimension while maintaining aspect ratio.
    Returns image as PNG bytes."""
    with Image.open(file_path) as img:
        # Convert RGBA to RGB if needed (for JPEG compatibility)
        if img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if needed
        w, h = img.size
        if max(w, h) > max_dimension:
            ratio = max_dimension / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Save to bytes as PNG
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", quality=95)
        buffer.seek(0)
        return buffer.read()


def convert_format(file_path: str, output_format: str = "jpeg", quality: int = 92) -> bytes:
    """Convert image to specified format. Returns bytes."""
    with Image.open(file_path) as img:
        if img.mode == "RGBA" and output_format.lower() in ("jpeg", "jpg"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB" and output_format.lower() in ("jpeg", "jpg"):
            img = img.convert("RGB")

        buffer = io.BytesIO()
        fmt = "JPEG" if output_format.lower() in ("jpeg", "jpg") else output_format.upper()
        save_kwargs = {"format": fmt}
        if fmt == "JPEG":
            save_kwargs["quality"] = quality
        elif fmt == "WEBP":
            save_kwargs["quality"] = quality

        img.save(buffer, **save_kwargs)
        buffer.seek(0)
        return buffer.read()


def calculate_target_resolution(
    original_width: int, original_height: int, target: str
) -> tuple[int, int]:
    """Calculate target dimensions based on resolution preset."""
    targets = {
        "1080p": 1920,
        "2k": 2560,
        "4k": 3840,
        "8k": 7680,
    }
    max_dim = targets.get(target, 3840)
    ratio = original_width / original_height

    if ratio >= 1:  # Landscape
        new_width = max_dim
        new_height = int(max_dim / ratio)
    else:  # Portrait
        new_height = max_dim
        new_width = int(max_dim * ratio)

    return new_width, new_height


def calculate_scale_factor(
    original_width: int, original_height: int, target_width: int, target_height: int
) -> float:
    """Calculate the scale factor needed."""
    scale_w = target_width / original_width
    scale_h = target_height / original_height
    return max(scale_w, scale_h)
