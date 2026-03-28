"""LLM step: natural language → concrete image generation prompt."""
import json
import logging
import re
from typing import Any

import httpx
from google.genai import errors as genai_errors
from google.genai import types
from openai import OpenAI

from app.config import settings
from app.services.gemini_service import make_gemini_client

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(120.0, connect=30.0, read=120.0, write=60.0)

_SYSTEM_OPENAI = (
    "You turn user requests into one detailed English image-generation prompt for photorealistic "
    "marketing visuals: architecture, hotel and real-estate interiors, exteriors, and lifestyle scenes. "
    "Be specific about lighting, materials, camera angle, and mood. No watermarks or logos unless asked. "
    "Output ONLY valid JSON with keys: image_prompt (string), short_title (string, max 8 words)."
)

# Gemini: same instructions as ChatGPT path above; JSON shape enforced via response_schema.
_SYSTEM_GEMINI = (
    "You turn user requests into one detailed English image-generation prompt for photorealistic "
    "marketing visuals: architecture, hotel and real-estate interiors, exteriors, and lifestyle scenes. "
    "Be specific about lighting, materials, camera angle, and mood. No watermarks or logos unless asked. "
    "Output ONLY valid JSON with keys: image_prompt (string), short_title (string, max 8 words)."
)

# Matches OpenAI interpret `max_tokens=1200`.
_GEMINI_INTENT_MAX_OUTPUT_TOKENS = 1200
# Matches OpenAI client read timeout budget (~120s) for compose.
_GEMINI_INTENT_TIMEOUT_MS = 120_000

# Structured output for compose; avoids markdown fences and fragile free-form JSON.
_INTENT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "image_prompt": {
            "type": "string",
            "description": "Detailed English image generation prompt",
        },
        "short_title": {
            "type": "string",
            "description": "Short title, max 8 words",
        },
    },
    "required": ["image_prompt", "short_title"],
}


def _parse_intent_json(raw: str) -> tuple[str, str]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty model output")
    # Allow accidental ```json fences
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    data: Any = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("expected JSON object")
    ip = data.get("image_prompt")
    st = data.get("short_title")
    if not isinstance(ip, str) or not ip.strip():
        raise ValueError("missing image_prompt")
    title = (st if isinstance(st, str) else "").strip() or "AI generated"
    return ip.strip()[:6000], title[:200]


def _gemini_raise_if_prompt_blocked(response: Any, context: str) -> None:
    pf = getattr(response, "prompt_feedback", None)
    if pf is None:
        return
    br = getattr(pf, "block_reason", None)
    if br is None:
        return
    name = str(br)
    if not name or "UNSPECIFIED" in name.upper():
        return
    raise ValueError(f"Gemini blocked the request ({context}): {name}")


def _collect_gemini_text(response: Any) -> str:
    out: list[str] = []
    for cand in getattr(response, "candidates", None) or []:
        content = getattr(cand, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", None) or []:
            t = getattr(part, "text", None)
            if t:
                out.append(t)
    return "".join(out)


def interpret_with_openai(user_request: str, api_key: str) -> tuple[str, str]:
    client = OpenAI(api_key=api_key, timeout=_TIMEOUT)
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_OPENAI},
            {"role": "user", "content": user_request.strip()[:8000]},
        ],
        max_tokens=1200,
    )
    content = (r.choices[0].message.content or "").strip()
    return _parse_intent_json(content)


def interpret_with_gemini(user_request: str, api_key: str) -> tuple[str, str]:
    # Same HTTP budget as OpenAI compose (read=120s).
    client = make_gemini_client(api_key, timeout_ms=_GEMINI_INTENT_TIMEOUT_MS)
    user = user_request.strip()[:8000]
    cfg = types.GenerateContentConfig(
        system_instruction=_SYSTEM_GEMINI,
        max_output_tokens=_GEMINI_INTENT_MAX_OUTPUT_TOKENS,
        response_mime_type="application/json",
        response_json_schema=_INTENT_RESPONSE_SCHEMA,
    )
    try:
        r = client.models.generate_content(
            model=settings.GEMINI_INTENT_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user)],
                )
            ],
            config=cfg,
        )
    except genai_errors.APIError as e:
        msg = getattr(e, "message", None) or str(e)
        logger.warning("Gemini interpret failed: %s", msg)
        raise ValueError(f"Gemini API error: {msg}") from e
    _gemini_raise_if_prompt_blocked(r, "interpret")
    text = _collect_gemini_text(r)
    if not text.strip():
        logger.warning("Gemini interpret returned no text (model=%s)", settings.GEMINI_INTENT_MODEL)
        raise ValueError("Gemini returned no interpretable text.")
    return _parse_intent_json(text)


def interpret_user_request(user_request: str, provider: str, api_key: str) -> tuple[str, str]:
    """
    Returns (image_prompt, short_title).
    Raises on hard failures; caller may fall back to raw description.
    """
    if provider == "openai":
        return interpret_with_openai(user_request, api_key)
    if provider == "gemini":
        return interpret_with_gemini(user_request, api_key)
    raise ValueError(f"unknown provider: {provider}")
