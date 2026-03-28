"""Vision-backed filename stems for export (OpenAI / Gemini) with cost hints."""
from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from typing import Any, Mapping, Optional

from openai import OpenAI
from google import genai
from google.genai import types

from app.utils.image_utils import resize_for_api

logger = logging.getLogger(__name__)

# Google AI list pricing (USD per 1M tokens), Standard paid tier — see https://ai.google.dev/gemini-api/docs/pricing
_GEMINI_USD_PER_MILLION: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-2.5-flash": (0.30, 2.50),  # ballpark; check pricing page for exact tier
    "gemini-2.0-flash": (0.10, 0.40),
    "default": (0.10, 0.40),
}

# OpenAI gpt-4o-mini (approximate list; image input billed in tokens via usage)
_OPENAI_MINI_IN_PER_M = 0.15
_OPENAI_MINI_OUT_PER_M = 0.60


@dataclass
class FilenameSuggestResult:
    basename: str
    model: Optional[str] = None
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    estimated_cost_usd: Optional[float] = None
    cost_note: str = ""


def sanitize_stem(raw: str) -> str:
    s = (raw or "").strip().strip('`"\'')
    s = s.split("\n")[0][:120]
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-_.")
    return (s or "listing-photo")[:80]


def _format_context_block(ctx: Mapping[str, Any]) -> str:
    lines = [
        "Metadata (use together with the pixels; do not paste this whole block as the filename):",
        f"- Original upload filename: {ctx.get('original_filename') or 'unknown'}",
        f"- Asset role: {ctx.get('subject') or 'unknown'}",
    ]
    vt = ctx.get("version_type")
    if vt:
        lines.append(f"- Pipeline stage / version type: {vt}")
    w, h = ctx.get("width"), ctx.get("height")
    if w and h:
        lines.append(f"- Pixel dimensions: {w}×{h}")
    mime = ctx.get("mime_type")
    if mime:
        lines.append(f"- MIME type: {mime}")
    fs = ctx.get("file_size_bytes")
    if fs is not None and isinstance(fs, (int, float)) and fs >= 0:
        mb = fs / (1024 * 1024)
        lines.append(f"- File size (this asset): ~{mb:.2f} MB" if mb >= 0.01 else f"- File size (this asset): {int(fs)} B")
    ep = ctx.get("enhancement_provider")
    em = ctx.get("enhancement_model")
    if ep or em:
        lines.append(f"- How it was produced: provider={ep or '?'}, model={em or '?'}")
    sf = ctx.get("scale_factor")
    if sf is not None and isinstance(sf, (int, float)) and sf > 1:
        lines.append(f"- Upscale factor: ×{sf}")
    return "\n".join(lines)


def _gemini_rates_for_model(model_id: str) -> tuple[float, float]:
    m = (model_id or "").strip().lower()
    if m in _GEMINI_USD_PER_MILLION:
        return _GEMINI_USD_PER_MILLION[m]
    for key, rates in _GEMINI_USD_PER_MILLION.items():
        if key != "default" and m.startswith(key):
            return rates
    return _GEMINI_USD_PER_MILLION["default"]


def _usage_from_gemini(r: Any) -> tuple[Optional[int], Optional[int]]:
    um = getattr(r, "usage_metadata", None)
    if um is None:
        return None, None
    pt = getattr(um, "prompt_token_count", None)
    # total_token_count includes prompt; output often reported as candidates_token_count
    ct = getattr(um, "candidates_token_count", None)
    if ct is None:
        tt = getattr(um, "total_token_count", None)
        if isinstance(pt, int) and isinstance(tt, int) and tt >= pt:
            ct = tt - pt
    if not isinstance(pt, int):
        pt = None
    if not isinstance(ct, int):
        ct = None
    return pt, ct


def _estimate_gemini_cost(
    model_id: str,
    prompt_tokens: Optional[int],
    output_tokens: Optional[int],
) -> tuple[Optional[float], str]:
    rin, rout = _gemini_rates_for_model(model_id)
    if prompt_tokens is not None and output_tokens is not None:
        usd = (prompt_tokens / 1_000_000) * rin + (output_tokens / 1_000_000) * rout
        note = (
            f"Estimated from this call’s usage ({prompt_tokens} input + {output_tokens} output tokens) at "
            f"Google’s published list rates for {model_id} (~${rin}/1M input, ~${rout}/1M output). "
            "Free tier or org discounts may apply; this is not an invoice."
        )
        return round(usd, 8), note
    # Typical small vision + short text answer (conservative ballpark)
    pt, ct = 900, 45
    usd = (pt / 1_000_000) * rin + (ct / 1_000_000) * rout
    note = (
        f"Typical ballpark for one compressed image + short name (~{pt} in / {ct} out tokens) at "
        f"list rates for {model_id} (~${rin}/1M in, ~${rout}/1M out). Actual usage varies; free tier may apply."
    )
    return round(usd, 8), note


def suggest_filename_openai(api_key: str, image_path: str, context: Mapping[str, Any]) -> FilenameSuggestResult:
    client = OpenAI(api_key=api_key)
    png_bytes = resize_for_api(image_path, max_dimension=1024)
    b64 = base64.standard_b64encode(png_bytes).decode("ascii")
    meta = _format_context_block(context)
    prompt = (
        f"{meta}\n\n"
        "You label files for real-estate, hospitality, and architectural photo libraries.\n"
        "Look at the image and the metadata. Infer scene type (e.g. bedroom, lobby, pool, exterior, food, product).\n"
        "Output exactly ONE filename stem: lowercase kebab-case, ASCII letters digits hyphens only, "
        "max 55 characters, no file extension, no spaces, no quotes, no explanation."
    )
    model = "gpt-4o-mini"
    r = client.chat.completions.create(
        model=model,
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
    stem = sanitize_stem(text)
    usage = getattr(r, "usage", None)
    pt = getattr(usage, "prompt_tokens", None) if usage else None
    ct = getattr(usage, "completion_tokens", None) if usage else None
    cost: Optional[float] = None
    note = ""
    if isinstance(pt, int) and isinstance(ct, int):
        cost = round(
            (pt / 1_000_000) * _OPENAI_MINI_IN_PER_M + (ct / 1_000_000) * _OPENAI_MINI_OUT_PER_M,
            8,
        )
        note = (
            f"From OpenAI usage ({pt} prompt + {ct} completion tokens), approximate list cost for {model} "
            f"(~${_OPENAI_MINI_IN_PER_M}/1M in, ~${_OPENAI_MINI_OUT_PER_M}/1M out). Not an invoice."
        )
    else:
        note = f"Rough list-price tier for {model} vision calls is low (fractions of a cent); see OpenAI pricing."
    return FilenameSuggestResult(
        basename=stem,
        model=model,
        prompt_tokens=pt if isinstance(pt, int) else None,
        output_tokens=ct if isinstance(ct, int) else None,
        estimated_cost_usd=cost,
        cost_note=note,
    )


def suggest_filename_gemini(
    api_key: str,
    image_path: str,
    context: Mapping[str, Any],
    model: str,
) -> FilenameSuggestResult:
    png_bytes = resize_for_api(image_path, max_dimension=1024)
    client = genai.Client(api_key=api_key)
    image_part = types.Part.from_bytes(data=png_bytes, mime_type="image/png")
    meta = _format_context_block(context)
    prompt = (
        f"{meta}\n\n"
        "You name image files for professional media libraries (real estate, hotels, architecture, interiors, "
        "exteriors, venues, products).\n"
        "Study the picture: identify the kind of scene, main subject, and 1–2 distinctive visual cues "
        "(e.g. twin-beds-city-view, marble-kitchen-island, sunset-pool-deck).\n"
        "Output exactly ONE line: the filename stem only — lowercase kebab-case, ASCII letters digits hyphens, "
        "max 55 characters, no extension, no backticks, no explanation."
    )
    model_id = (model or "gemini-2.5-flash-lite").strip()
    r = client.models.generate_content(
        model=model_id,
        contents=[types.Content(parts=[image_part, types.Part.from_text(text=prompt)])],
        config=types.GenerateContentConfig(response_modalities=["TEXT"]),
    )
    text = ""
    if r.candidates:
        for part in r.candidates[0].content.parts:
            if getattr(part, "text", None):
                text += part.text
    stem = sanitize_stem(text)
    pt, ct = _usage_from_gemini(r)
    est, note = _estimate_gemini_cost(model_id, pt, ct)
    return FilenameSuggestResult(
        basename=stem,
        model=model_id,
        prompt_tokens=pt,
        output_tokens=ct,
        estimated_cost_usd=est,
        cost_note=note,
    )
