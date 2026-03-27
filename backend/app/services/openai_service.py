import base64
import io
import logging
from openai import OpenAI
from app.utils.image_utils import resize_for_api

logger = logging.getLogger(__name__)


class OpenAIImageService:
    """Wrapper for OpenAI Image Generation/Editing API."""

    def enhance_image(
        self,
        api_key: str,
        image_path: str,
        prompt: str,
        model: str = "gpt-image-1",
        quality: str = "high",
        output_format: str = "png",
    ) -> bytes:
        """
        Enhance an image using OpenAI's image editing API.
        Returns the enhanced image as bytes.
        """
        client = OpenAI(api_key=api_key)

        # Resize image for API (max 1536px) — returns PNG bytes
        image_bytes = resize_for_api(image_path, max_dimension=1536)

        logger.info(f"Calling OpenAI images.edit: model={model}, quality={quality}, size=1536x1024")

        # Wrap bytes in a file-like object with a name (required by OpenAI SDK)
        image_file = io.BytesIO(image_bytes)
        image_file.name = "image.png"

        try:
            result = client.images.edit(
                model=model,
                image=image_file,
                prompt=prompt,
                n=1,
                size="1536x1024",
                quality=quality,
            )
        except Exception as e:
            logger.error(f"OpenAI images.edit failed: {e}")
            # Fallback: try the generate endpoint with the image described
            logger.info("Falling back to images.generate")
            result = client.images.generate(
                model=model,
                prompt=f"Based on a hotel/real estate photo: {prompt}",
                n=1,
                size="1536x1024",
                quality=quality,
                response_format="b64_json",
            )

        # Get the image data
        image_data = result.data[0]

        if hasattr(image_data, "b64_json") and image_data.b64_json:
            logger.info("Got base64 response from OpenAI")
            return base64.b64decode(image_data.b64_json)
        elif hasattr(image_data, "url") and image_data.url:
            logger.info("Got URL response from OpenAI, downloading...")
            import httpx
            resp = httpx.get(image_data.url, timeout=120)
            resp.raise_for_status()
            return resp.content
        else:
            raise ValueError("No image data returned from OpenAI")


openai_image_service = OpenAIImageService()
