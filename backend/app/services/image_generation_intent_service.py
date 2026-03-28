"""LLM step: natural language → concrete image generation prompt."""
import json
import logging
import re
from typing import Any

import httpx
from google import genai
from google.genai import types
from openai import OpenAI

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(120.0, connect=30.0, read=120.0, write=60.0)

_SYSTEM_OPENAI = (
    "You turn user requests into one detailed English image-generation prompt for photorealistic "
    "marketing visuals: architecture, hotel and real-estate interiors, exteriors, and lifestyle scenes. "
    "Be specific about lighting, materials, camera angle, and mood. No watermarks or logos unless asked. "
    "Output ONLY valid JSON with keys: image_prompt (string), short_title (string, max 8 words)."
)

_SYSTEM_GEMINI = (
    "You expand short user wishes into ONE detailed English image prompt for photorealistic marketing visuals "
    "(architecture, interiors, hospitality, real estate). Be specific about lighting, lens, and composition. "
    "Reply with ONLY valid JSON, no markdown fences: "
    '{"image_prompt": string, "short_title": string}'
)


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
    client = genai.Client(api_key=api_key)
    r = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_text(
                        text=_SYSTEM_GEMINI + "\n\nUser request:\n" + user_request.strip()[:8000]
                    ),
                ]
            )
        ],
        config=types.GenerateContentConfig(response_modalities=["TEXT"]),
    )
    text = ""
    if r.candidates:
        for part in r.candidates[0].content.parts:
            if getattr(part, "text", None):
                text += part.text
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
