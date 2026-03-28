import base64
import io
import logging
from typing import Any, Optional

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.utils.image_utils import resize_for_api

logger = logging.getLogger(__name__)

# Match OpenAI image path patience (often multi-minute). HttpOptions.timeout is milliseconds.
_GEMINI_TIMEOUT_MS = 900_000

# When one image model hits quota or is unavailable, try the other (both are allowed in the UI).
_GEMINI_IMAGE_PRIMARY_MODEL = "gemini-2.5-flash-image"
_GEMINI_IMAGE_FALLBACK_MODEL = "gemini-2.0-flash-exp-image-generation"


def _gemini_sibling_image_model(model_id: str) -> Optional[str]:
    """Other UI-listed image model id (for quota / availability retries)."""
    m = (model_id or "").strip()
    if m == _GEMINI_IMAGE_PRIMARY_MODEL:
        return _GEMINI_IMAGE_FALLBACK_MODEL
    if m == _GEMINI_IMAGE_FALLBACK_MODEL:
        return _GEMINI_IMAGE_PRIMARY_MODEL
    return None


def make_gemini_client(api_key: str, *, timeout_ms: Optional[int] = None) -> genai.Client:
    """AI Studio client. Default timeout matches long image calls; pass timeout_ms for short LLM steps."""
    key = (api_key or "").strip()
    ms = _GEMINI_TIMEOUT_MS if timeout_ms is None else timeout_ms
    return genai.Client(
        api_key=key,
        http_options=types.HttpOptions(timeout=ms),
    )


def _blob_data_to_bytes(data: Any) -> Optional[bytes]:
    if data is None:
        return None
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    if isinstance(data, str):
        try:
            return base64.b64decode(data, validate=True)
        except Exception:
            return base64.b64decode(data)
    return None


def _part_to_image_png_bytes(part: Any) -> Optional[bytes]:
    """Decode image from inline_data or SDK helper (covers more response shapes)."""
    inline = getattr(part, "inline_data", None)
    if inline is not None:
        mime = (getattr(inline, "mime_type", None) or "").lower()
        raw = _blob_data_to_bytes(getattr(inline, "data", None))
        if raw and (mime.startswith("image/") or not mime):
            return raw
    try:
        pil_img = part.as_image()
        if pil_img is not None:
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            return buf.getvalue()
    except Exception:
        pass
    return None


def _extract_image_bytes_from_response(response: Any, context: str) -> bytes:
    """
    Parse GenerateContentResponse for an image part.
    Raises ValueError with an actionable message (pipeline surfaces this to the user).
    """
    if response is None:
        raise ValueError(f"Gemini returned no response ({context}).")

    pf = getattr(response, "prompt_feedback", None)
    if pf is not None:
        br = getattr(pf, "block_reason", None)
        if br is not None:
            brs = str(br)
            if brs and "UNSPECIFIED" not in brs.upper():
                raise ValueError(
                    f"Gemini blocked the request ({context}): {brs}. "
                    "Try a different prompt or check API key / model access in Google AI Studio."
                )

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise ValueError(
            f"No output candidates from Gemini ({context}). "
            "The model may have produced only text, refused the request, or your key may not allow this model."
        )

    notes: list[str] = []
    for i, cand in enumerate(candidates):
        fr = getattr(cand, "finish_reason", None)
        content = getattr(cand, "content", None)
        if content is None:
            notes.append(f"[{i}] no content (finish_reason={fr})")
            continue
        parts = getattr(content, "parts", None) or []
        for part in parts:
            png = _part_to_image_png_bytes(part)
            if png:
                return png
        notes.append(f"[{i}] finish_reason={fr}, no image bytes in parts")

    raise ValueError(
        f"No image in Gemini response ({context}). " + " ".join(notes[:4])
    )


def _map_gemini_api_error(e: genai_errors.APIError, context: str) -> ValueError:
    msg = getattr(e, "message", None) or str(e)
    logger.warning("Gemini APIError (%s): %s", context, msg)
    return ValueError(
        f"Gemini API failed ({context}): {msg}. "
        "Confirm your API key, billing, and that the model is enabled for image output."
    )


def _gemini_error_suggests_retry_other_model(e: genai_errors.APIError) -> bool:
    """True when trying the other bundled image model may help (quota, wrong id, availability)."""
    msg = getattr(e, "message", None) or str(e)
    raw = msg.lower()
    code = getattr(e, "code", None)
    try:
        code_int = int(code) if code is not None else None
    except (TypeError, ValueError):
        code_int = None
    if code_int in (404, 429):
        return True
    if code_int == 400 and any(
        s in raw
        for s in (
            "not found",
            "is not found",
            "invalid model",
            "unknown model",
            "does not exist",
            "not supported for",
            "is not supported",
        )
    ):
        return True
    return (
        "429" in raw
        or "resource_exhausted" in raw
        or "resource exhausted" in raw
        or "quota" in raw
        or "rate limit" in raw
        or "too many requests" in raw
    )


class GeminiImageService:
    """Wrapper for Google Gemini image generation/editing API (AI Studio key)."""

    def enhance_image(
        self,
        api_key: str,
        image_path: str,
        prompt: str,
        model: str = "gemini-2.0-flash-exp-image-generation",
        quality: str = "high",
        output_format: str = "png",
    ) -> bytes:
        """
        Enhance an image using Gemini multimodal image output.
        Same positional/datapoint shape as OpenAIImageService.enhance_image; quality/output_format are logged for
        parity (Gemini image API does not mirror OpenAI's edit parameters).
        """
        client = make_gemini_client(api_key)

        primary = model.strip()
        q = (quality or "high").lower()
        if q not in ("low", "medium", "high"):
            q = "high"
        out_fmt = (output_format or "png").lower()
        logger.info(
            "Calling Gemini generate_content (enhance): model=%s quality=%s output=%s resize_max=1536",
            primary,
            q,
            out_fmt,
        )
        cfg = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])

        def _enhance(model_id: str):
            # Fresh parts each call so retries are not affected by any SDK mutation.
            ib = resize_for_api(image_path, max_dimension=1536)
            image_part = types.Part.from_bytes(data=ib, mime_type="image/png")
            return client.models.generate_content(
                model=model_id,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            image_part,
                            types.Part.from_text(text=prompt),
                        ],
                    )
                ],
                config=cfg,
            )

        try:
            response = _enhance(primary)
        except genai_errors.APIError as e:
            alt = _gemini_sibling_image_model(primary) if _gemini_error_suggests_retry_other_model(e) else None
            if alt:
                logger.warning("Gemini image enhance failed on %s; retrying with %s", primary, alt)
                try:
                    response = _enhance(alt)
                except genai_errors.APIError as e2:
                    raise _map_gemini_api_error(e2, "enhance") from e2
            else:
                raise _map_gemini_api_error(e, "enhance") from e

        return _extract_image_bytes_from_response(response, "enhance")

    def generate_image_from_text(
        self,
        api_key: str,
        prompt: str,
        model: str = "gemini-2.5-flash-image",
        quality: str = "high",
        output_format: str = "png",
    ) -> bytes:
        """
        Text-to-image using a Gemini image-capable model.
        Same call shape as OpenAIImageService.generate_image; quality/output_format logged for parity.
        """
        client = make_gemini_client(api_key)
        primary = model.strip()
        q = (quality or "high").lower()
        if q not in ("low", "medium", "high"):
            q = "high"
        out_fmt = (output_format or "png").lower()
        # Match OpenAI images.generate prompt cap (openai_service.generate_image).
        prompt_text = prompt.strip()[:4000]
        logger.info(
            "Calling Gemini generate_content (generate): model=%s quality=%s logical_output=%s",
            primary,
            q,
            out_fmt,
        )
        cfg = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])

        def _generate(model_id: str):
            return client.models.generate_content(
                model=model_id,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=prompt_text)],
                    )
                ],
                config=cfg,
            )

        try:
            response = _generate(primary)
        except genai_errors.APIError as e:
            alt = _gemini_sibling_image_model(primary) if _gemini_error_suggests_retry_other_model(e) else None
            if alt:
                logger.warning("Gemini image generate failed on %s; retrying with %s", primary, alt)
                try:
                    response = _generate(alt)
                except genai_errors.APIError as e2:
                    raise _map_gemini_api_error(e2, "generate") from e2
            else:
                raise _map_gemini_api_error(e, "generate") from e

        return _extract_image_bytes_from_response(response, "generate")


gemini_image_service = GeminiImageService()
