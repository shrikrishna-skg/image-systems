"""Vision-backed filename stems for export (OpenAI / Gemini)."""
import base64
import logging
import re

from openai import OpenAI
from google import genai
from google.genai import types

from app.utils.image_utils import resize_for_api

logger = logging.getLogger(__name__)


def sanitize_stem(raw: str) -> str:
    s = (raw or "").strip().strip('`"\'')
    s = s.split("\n")[0][:120]
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-_.")
    return (s or "listing-photo")[:80]


def suggest_filename_openai(api_key: str, image_path: str) -> str:
    client = OpenAI(api_key=api_key)
    png_bytes = resize_for_api(image_path, max_dimension=1024)
    b64 = base64.standard_b64encode(png_bytes).decode("ascii")
    prompt = (
        "You name files for hotel and real-estate photography libraries. "
        "Output exactly one filename stem: lowercase kebab-case, ASCII letters digits hyphens only, "
        "max 50 characters, no extension, no spaces, no quotes. Describe the scene or room briefly."
    )
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            }
        ],
        max_tokens=80,
    )
    text = (r.choices[0].message.content or "").strip()
    return sanitize_stem(text)


def suggest_filename_gemini(api_key: str, image_path: str) -> str:
    png_bytes = resize_for_api(image_path, max_dimension=1024)
    client = genai.Client(api_key=api_key)
    image_part = types.Part.from_bytes(data=png_bytes, mime_type="image/png")
    prompt = (
        "Output exactly one filename stem for this real-estate photo: lowercase-kebab-case, ASCII, "
        "max 50 characters, no extension, no explanation."
    )
    r = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[types.Content(parts=[image_part, types.Part.from_text(prompt)])],
        config=types.GenerateContentConfig(response_modalities=["TEXT"]),
    )
    text = ""
    if r.candidates:
        for part in r.candidates[0].content.parts:
            if getattr(part, "text", None):
                text += part.text
    return sanitize_stem(text)
