"""Detect whether a URL can be shown in a cross-origin iframe (X-Frame-Options / CSP)."""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple
from urllib.parse import urljoin

import httpx

from app.services.safe_http_fetch import DEFAULT_UA
from app.utils.ssrf_safe_url import assert_url_safe_for_ssrf, normalize_http_url

logger = logging.getLogger(__name__)


def _csp_frame_ancestor_values(csp_headers: list[str]) -> Optional[str]:
    combined = "; ".join(csp_headers)
    m = re.search(r"frame-ancestors\s+([^;]+)", combined, re.IGNORECASE)
    if not m:
        return None
    return m.group(1).strip()


def embed_allowed_for_cross_origin_app(headers: httpx.Headers) -> Tuple[bool, str]:
    """
    Whether our app (different origin) may embed this response in an iframe.

    Conservative: if unclear, we report not embeddable with a reason.
    """
    xfo = (headers.get("x-frame-options") or "").strip()
    if xfo:
        return False, (
            f"This site sends X-Frame-Options ({xfo}), so browsers will not show it inside our panel."
        )

    csp_vals: list[str] = []
    for key, value in headers.multi_items():
        if key.lower() == "content-security-policy":
            csp_vals.append(value)
    if not csp_vals:
        return True, ""

    fa = _csp_frame_ancestor_values(csp_vals)
    if fa is None:
        return True, ""

    tokens = [t.strip() for t in fa.split() if t.strip()]
    if not tokens:
        return True, ""

    lowered = [t.lower() for t in tokens]
    if "'none'" in lowered or (len(tokens) == 1 and tokens[0].lower() == "'none'"):
        return False, "Content-Security-Policy (frame-ancestors) blocks embedding this site in other pages."

    if any(t == "*" for t in tokens):
        return True, ""

    if len(tokens) == 1 and tokens[0] == "'self'":
        return False, (
            "Content-Security-Policy only allows this site to be framed by pages on the same domain, "
            "not by this app."
        )

    # Specific hosts / non-* list: our app origin is not listed — treat as blocked for in-panel preview.
    return False, (
        "Content-Security-Policy limits which sites can embed this page; this app is not allowed to show it inline."
    )


async def fetch_final_headers_after_redirects(url: str) -> Tuple[str, httpx.Headers]:
    """
    HEAD the URL (manual redirects, SSRF-safe). Falls back to tiny GET if HEAD is not allowed.
    Returns (final_url, response_headers).
    """
    current = normalize_http_url(url)
    async with httpx.AsyncClient(timeout=22.0) as client:
        for hop in range(8):
            assert_url_safe_for_ssrf(current)
            resp = await client.request(
                "HEAD",
                current,
                headers={"User-Agent": DEFAULT_UA},
                follow_redirects=False,
            )
            if resp.status_code in (301, 302, 303, 307, 308):
                loc = resp.headers.get("location")
                if not loc or hop >= 7:
                    resp.raise_for_status()
                current = urljoin(str(resp.url), loc.strip())
                continue
            if resp.status_code == 405:
                resp = await client.request(
                    "GET",
                    current,
                    headers={
                        "User-Agent": DEFAULT_UA,
                        "Range": "bytes=0-0",
                    },
                    follow_redirects=False,
                )
                if resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("location")
                    if not loc:
                        resp.raise_for_status()
                    current = urljoin(str(resp.url), loc.strip())
                    continue
            resp.raise_for_status()
            return str(resp.url), resp.headers
        raise ValueError("Too many redirects.")


async def check_url_embeddable(url: str) -> Tuple[str, bool, str]:
    """
    Returns (final_url, embed_ok, user_message_if_not).

    embed_ok True means iframe src=url should render for a cross-origin parent.
    On fetch errors (429, timeouts, etc.) we optimistically allow iframe — the browser may still load.
    """
    try:
        final, headers = await fetch_final_headers_after_redirects(url)
    except Exception as e:
        logger.warning("embed header fetch failed: %s", e)
        u = normalize_http_url(url)
        return (
            u,
            False,
            "Could not read this page’s security headers (network, timeout, or rate limit). "
            "Use “Open in new tab” below to view the site in a normal browser tab.",
        )
    ok, reason = embed_allowed_for_cross_origin_app(headers)
    return final, ok, reason
