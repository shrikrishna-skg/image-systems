"""Zyte API browser HTML for URL image scraping (primary JS-rendered fetch)."""

from __future__ import annotations

import base64
import logging
from typing import Tuple

import httpx

from app.utils.ssrf_safe_url import assert_url_safe_for_ssrf, normalize_http_url

logger = logging.getLogger(__name__)

DEFAULT_ZYTE_EXTRACT_URL = "https://api.zyte.com/v1/extract"


def _zyte_basic_auth(api_key: str) -> str:
    """Zyte API: API key as HTTP Basic username, empty password (RFC 7617)."""
    token = base64.b64encode(f"{api_key.strip()}:".encode()).decode()
    return f"Basic {token}"


async def fetch_html_via_zyte(
    *,
    api_key: str,
    page_url: str,
    extract_url: str = DEFAULT_ZYTE_EXTRACT_URL,
    timeout_sec: float = 120.0,
) -> Tuple[str, str]:
    """
    Single POST to Zyte extract with browserHtml (one billable browser job per call).
    Call this at most once per user scan; parse all image URLs locally from the returned HTML.
    Docs: https://docs.zyte.com/zyte-api/usage/browser.html
    """
    current = normalize_http_url(page_url)
    assert_url_safe_for_ssrf(current)

    endpoint = (extract_url or DEFAULT_ZYTE_EXTRACT_URL).strip()
    payload = {
        "url": current,
        "browserHtml": True,
    }
    headers = {
        "Authorization": _zyte_basic_auth(api_key),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        resp = await client.post(endpoint, json=payload, headers=headers)

    if resp.status_code == 401:
        raise ValueError("Zyte API rejected the key (HTTP 401).")
    if resp.status_code == 403:
        raise ValueError("Zyte API forbidden (HTTP 403).")
    if resp.status_code == 429:
        raise ValueError("Zyte API rate limit exceeded; try again later.")

    resp.raise_for_status()

    try:
        data = resp.json()
    except Exception as e:
        raise ValueError("Zyte returned non-JSON response.") from e

    html = (data.get("browserHtml") or "").strip()
    if not html:
        detail = data.get("detail") or data.get("error") or data.get("title")
        raise ValueError(detail or "Zyte returned empty browserHtml.")

    final = data.get("url") or current
    logger.info(
        "zyte scrape ok final_url=%s html_bytes=%d",
        final,
        len(html.encode("utf-8", errors="replace")),
    )
    return html, str(final)
