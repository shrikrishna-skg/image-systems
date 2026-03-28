"""Bounded HTTP GET with manual redirects — each hop is SSRF-checked."""

from __future__ import annotations

import logging
from typing import Tuple
from urllib.parse import urljoin

import httpx

from app.utils.ssrf_safe_url import assert_url_safe_for_ssrf, normalize_http_url

logger = logging.getLogger(__name__)

DEFAULT_UA = (
    "Mozilla/5.0 (compatible; Imagesystems/1.0; +https://example.com) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


async def fetch_bytes_with_redirects(
    url: str,
    *,
    max_bytes: int,
    max_redirects: int = 5,
    timeout_sec: float = 20.0,
) -> Tuple[bytes, str]:
    """
    GET url (following redirects manually). Raises on SSRF, size, or HTTP error.
    Returns (body, final_url).
    """
    current = normalize_http_url(url)
    headers = {"User-Agent": DEFAULT_UA, "Accept": "*/*"}

    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        for hop in range(max_redirects + 1):
            assert_url_safe_for_ssrf(current)
            resp = await client.get(current, headers=headers, follow_redirects=False)
            if resp.status_code in (301, 302, 303, 307, 308):
                loc = resp.headers.get("location")
                if not loc or hop >= max_redirects:
                    resp.raise_for_status()
                current = urljoin(current, loc.strip())
                continue
            resp.raise_for_status()
            buf = bytearray()
            async for chunk in resp.aiter_bytes():
                buf.extend(chunk)
                if len(buf) > max_bytes:
                    raise ValueError(f"Response exceeds maximum size ({max_bytes // (1024 * 1024)} MB).")
            return bytes(buf), str(resp.url)
        raise ValueError("Too many redirects.")
