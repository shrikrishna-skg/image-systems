import base64
import io
import logging

import httpx
from openai import APIStatusError, OpenAI
from app.utils.image_utils import resize_for_api

logger = logging.getLogger(__name__)

# Image generation often runs 1–8+ minutes; fail with a clear error instead of hanging indefinitely.
_OPENAI_TIMEOUT = httpx.Timeout(900.0, connect=60.0, read=900.0, write=120.0)


def _norm_output_format(fmt: str) -> str:
    f = (fmt or "png").lower()
    if f in ("jpg", "jpeg"):
        return "jpeg"
    if f == "webp":
        return "webp"
    return "png"


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
        client = OpenAI(api_key=api_key, timeout=_OPENAI_TIMEOUT)
        out_fmt = _norm_output_format(output_format)

        # Resize image for API (max 1536px) — returns PNG bytes
        image_bytes = resize_for_api(image_path, max_dimension=1536)

        logger.info(
            "Calling OpenAI images.edit: model=%s quality=%s size=1536x1024 output=%s",
            model,
            quality,
            out_fmt,
        )

        def _decode_first_image(result) -> bytes:
            if not result.data:
                raise ValueError("OpenAI returned no image entries")
            image_data = result.data[0]
            if getattr(image_data, "b64_json", None):
                logger.info("Got base64 image from OpenAI")
                return base64.b64decode(image_data.b64_json)
            if getattr(image_data, "url", None):
                logger.info("Got URL from OpenAI, downloading result")
                resp = httpx.get(image_data.url, timeout=_OPENAI_TIMEOUT)
                resp.raise_for_status()
                return resp.content
            raise ValueError("OpenAI returned neither b64_json nor url for the image")

        def _edit(with_fidelity: bool):
            buf = io.BytesIO(image_bytes)
            buf.name = "image.png"
            # gpt-image-1 rejects response_format on images.edit; decode URL or b64 from the response.
            kw = dict(
                model=model,
                image=buf,
                prompt=prompt,
                n=1,
                size="1536x1024",
                quality=quality,
                output_format=out_fmt,  # type: ignore[arg-type]
            )
            if with_fidelity:
                kw["input_fidelity"] = "high"
            return client.images.edit(**kw)

        try:
            try:
                result = _edit(with_fidelity=True)
            except APIStatusError as e:
                if e.status_code == 400:
                    logger.warning("Retrying images.edit without input_fidelity (model may not support it)")
                    result = _edit(with_fidelity=False)
                else:
                    raise
        except Exception as e:
            logger.error("OpenAI images.edit failed: %s", e)
            logger.info("Falling back to images.generate (no source image)")
            result = client.images.generate(
                model=model,
                prompt=f"Based on a hotel/real estate photo: {prompt}",
                n=1,
                size="1536x1024",
                quality=quality,
                output_format=out_fmt,  # type: ignore[arg-type]
            )

        return _decode_first_image(result)

    def generate_image(
        self,
        api_key: str,
        prompt: str,
        model: str = "gpt-image-1",
        quality: str = "high",
        output_format: str = "png",
    ) -> bytes:
        """
        Text-to-image via OpenAI images.generate (no source image).
        """
        client = OpenAI(api_key=api_key, timeout=_OPENAI_TIMEOUT)
        out_fmt = _norm_output_format(output_format)
        q = (quality or "high").lower()
        if q not in ("low", "medium", "high"):
            q = "high"

        logger.info(
            "Calling OpenAI images.generate: model=%s quality=%s size=1536x1024 output=%s",
            model,
            q,
            out_fmt,
        )

        result = client.images.generate(
            model=model,
            prompt=prompt.strip()[:4000],
            n=1,
            size="1536x1024",
            quality=q,
            output_format=out_fmt,  # type: ignore[arg-type]
        )

        if not result.data:
            raise ValueError("OpenAI returned no image entries")
        image_data = result.data[0]
        if getattr(image_data, "b64_json", None):
            return base64.b64decode(image_data.b64_json)
        if getattr(image_data, "url", None):
            resp = httpx.get(image_data.url, timeout=_OPENAI_TIMEOUT)
            resp.raise_for_status()
            return resp.content
        raise ValueError("OpenAI returned neither b64_json nor url for the image")


openai_image_service = OpenAIImageService()
