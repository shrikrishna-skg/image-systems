"""Extract image URLs from public HTML pages (single remote fetch → local parse)."""

from __future__ import annotations

import json
import logging
import re
from html import unescape
from typing import Any, List, Optional, Set
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.config import settings
from app.services.safe_http_fetch import fetch_bytes_with_redirects

logger = logging.getLogger(__name__)

MAX_HTML_BYTES = 8 * 1024 * 1024

# Regex: common image URLs embedded in HTML/JSON (one pass over the same document as Zyte returns).
_IMG_URL_IN_TEXT_RE = re.compile(
    r'https?://[^\s"\'<>{}\\]+\.(?:jpe?g|png|webp|gif|avif|bmp|svg)(?:\?[^\s"\'<>{}\\]*)?',
    re.IGNORECASE,
)
_CSS_URL_RE = re.compile(r'url\(\s*["\']?(https?://[^"\')\s]+)["\']?\s*\)', re.IGNORECASE)


def scrape_image_cap() -> int:
    """Upper bound on unique image URLs extracted from one HTML response."""
    try:
        v = int(settings.SCRAPE_MAX_IMAGE_URLS)
    except (TypeError, ValueError):
        v = 50_000
    # Hard ceiling avoids accidental multi‑GB HTML / huge in-memory lists; raise via SCRAPE_MAX_IMAGE_URLS (capped here).
    _abs_max = 100_000
    return max(100, min(v, _abs_max))


class ScrapedImageItem:
    __slots__ = ("url", "alt", "source")

    def __init__(self, url: str, alt: Optional[str], source: str):
        self.url = url
        self.alt = alt
        self.source = source  # e.g. "img", "og:image", "srcset"


def _at_cap(out: List[ScrapedImageItem]) -> bool:
    return len(out) >= scrape_image_cap()


def _add(out: List[ScrapedImageItem], seen: Set[str], url: str, alt: Optional[str], source: str) -> None:
    if _at_cap(out):
        return
    u = url.strip()
    if not u or u.startswith("data:") or u.startswith("javascript:") or u.startswith("mailto:"):
        return
    parsed = urlparse(u)
    if parsed.scheme not in ("http", "https"):
        return
    if u in seen:
        return
    seen.add(u)
    out.append(ScrapedImageItem(u, alt, source))


def _all_urls_from_srcset(srcset: str, base: str) -> List[str]:
    if not srcset or not srcset.strip():
        return []
    found: List[str] = []
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        u = part.split()[0].strip()
        if u:
            found.append(urljoin(base, unescape(u)))
    return found


def _ingest_json_ld_image_value(
    val: Any,
    page_url: str,
    out: List[ScrapedImageItem],
    seen: Set[str],
) -> None:
    if _at_cap(out):
        return
    if isinstance(val, str):
        t = val.strip()
        if t.startswith("http://") or t.startswith("https://"):
            _add(out, seen, urljoin(page_url, t), None, "json-ld")
    elif isinstance(val, list):
        for x in val:
            _ingest_json_ld_image_value(x, page_url, out, seen)
    elif isinstance(val, dict):
        u = val.get("url") or val.get("contentUrl") or val.get("contentURL")
        if isinstance(u, str) and u.strip():
            _add(out, seen, urljoin(page_url, u.strip()), None, "json-ld")
        for k, v in val.items():
            if _at_cap(out):
                return
            kl = str(k).lower()
            if kl in ("image", "images", "thumbnail", "photo", "photos", "picture"):
                _ingest_json_ld_image_value(v, page_url, out, seen)
            elif isinstance(v, (dict, list)):
                _walk_json_ld(v, page_url, out, seen)


def _walk_json_ld(obj: Any, page_url: str, out: List[ScrapedImageItem], seen: Set[str]) -> None:
    if _at_cap(out):
        return
    if isinstance(obj, dict):
        for key, val in obj.items():
            if _at_cap(out):
                return
            kl = str(key).lower()
            if kl == "image":
                _ingest_json_ld_image_value(val, page_url, out, seen)
            elif kl in ("thumbnailurl", "contenturl"):
                if isinstance(val, str) and val.strip().startswith(("http://", "https://")):
                    _add(out, seen, urljoin(page_url, val.strip()), None, "json-ld")
            else:
                _walk_json_ld(val, page_url, out, seen)
    elif isinstance(obj, list):
        for item in obj:
            _walk_json_ld(item, page_url, out, seen)


def _parse_json_ld_scripts(soup: BeautifulSoup, page_url: str, out: List[ScrapedImageItem], seen: Set[str]) -> None:
    for script in soup.find_all("script"):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        ctype = (script.get("type") or "").lower()
        if "ld+json" not in ctype:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _walk_json_ld(data, page_url, out, seen)


def parse_image_urls_from_html(html: str, page_url: str) -> List[ScrapedImageItem]:
    """Extract as many http(s) image URLs as possible from one HTML string (no extra network)."""
    soup = BeautifulSoup(html, "html.parser")
    seen: Set[str] = set()
    out: List[ScrapedImageItem] = []

    for tag in soup.find_all("meta"):
        if _at_cap(out):
            break
        prop = (tag.get("property") or "").lower()
        name = (tag.get("name") or "").lower()
        if prop in ("og:image", "og:image:url", "og:image:secure_url") or name in (
            "twitter:image",
            "twitter:image:src",
        ):
            content = tag.get("content")
            if content:
                _add(out, seen, urljoin(page_url, unescape(content.strip())), None, "meta")

    for tag in soup.find_all("link"):
        if _at_cap(out):
            break
        rel_attr = tag.get("rel")
        if isinstance(rel_attr, str):
            rels = [rel_attr.lower()]
        else:
            rels = [str(r).lower() for r in (rel_attr or [])]
        if "image_src" in rels and tag.get("href"):
            _add(out, seen, urljoin(page_url, unescape(tag["href"].strip())), None, "link")
        if "preload" in rels and (tag.get("as") or "").lower() == "image" and tag.get("href"):
            _add(out, seen, urljoin(page_url, unescape(tag["href"].strip())), None, "preload")

    for tag in soup.find_all("img"):
        if _at_cap(out):
            break
        src = tag.get("src")
        if src:
            _add(out, seen, urljoin(page_url, unescape(src.strip())), tag.get("alt"), "img")
        srcset = tag.get("srcset")
        if srcset:
            for u in _all_urls_from_srcset(unescape(srcset), page_url):
                _add(out, seen, u, tag.get("alt"), "srcset")

    for tag in soup.find_all("source"):
        if _at_cap(out):
            break
        srcset = tag.get("srcset")
        if srcset:
            for u in _all_urls_from_srcset(unescape(srcset), page_url):
                _add(out, seen, u, None, "picture")

    lazy_attrs = (
        "data-src",
        "data-lazy-src",
        "data-original",
        "data-zoom-image",
        "data-image",
        "data-full-src",
        "data-large_image",
    )
    for attr in lazy_attrs:
        if _at_cap(out):
            break
        for tag in soup.find_all(attrs={attr: True}):
            if _at_cap(out):
                break
            v = tag.get(attr)
            if v:
                _add(out, seen, urljoin(page_url, unescape(str(v).strip())), tag.get("alt"), attr)

    for tag in soup.find_all(attrs={"data-srcset": True}):
        if _at_cap(out):
            break
        v = tag.get("data-srcset")
        if v:
            for u in _all_urls_from_srcset(unescape(str(v)), page_url):
                _add(out, seen, u, tag.get("alt"), "data-srcset")

    for tag in soup.find_all("video", poster=True):
        if _at_cap(out):
            break
        _add(out, seen, urljoin(page_url, str(tag["poster"]).strip()), None, "video-poster")

    for tag in soup.find_all(style=True):
        if _at_cap(out):
            break
        st = tag.get("style") or ""
        for m in _CSS_URL_RE.finditer(st):
            _add(out, seen, m.group(1), tag.get("alt"), "css-url")

    _parse_json_ld_scripts(soup, page_url, out, seen)

    # Last pass: any image-like absolute URLs in raw HTML (captures JSON blobs, inline config, etc.)
    if not _at_cap(out):
        for m in _IMG_URL_IN_TEXT_RE.finditer(html):
            if _at_cap(out):
                break
            _add(out, seen, m.group(0), None, "text")

    return out


async def _fetch_html_direct(page_url: str) -> tuple[str, str]:
    body, final = await fetch_bytes_with_redirects(page_url, max_bytes=MAX_HTML_BYTES)
    try:
        text = body.decode("utf-8", errors="replace")
    except Exception:
        text = body.decode("latin-1", errors="replace")
    return text, final


async def scrape_page_for_images(
    page_url: str,
    *,
    use_rendered_scrape: bool = True,
    zyte_api_key: str | None = None,
) -> tuple[List[ScrapedImageItem], str]:
    """
    Exactly one remote HTML fetch when Zyte succeeds (then parse locally), else direct HTTP.
    Zyte: at most one POST extract per call to this function.
    Import endpoints must not call this — only /scrape/page does.
    """
    text: str = ""
    final: str = page_url
    zyte_used = False

    if use_rendered_scrape:
        zyte_key = (zyte_api_key or "").strip() or (settings.ZYTE_API_KEY or "").strip()

        if zyte_key:
            try:
                from app.services.zyte_scrape import fetch_html_via_zyte

                text, final = await fetch_html_via_zyte(
                    api_key=zyte_key,
                    page_url=page_url,
                    extract_url=settings.ZYTE_EXTRACT_URL,
                )
                zyte_used = True
            except Exception as e:
                logger.warning("scrape: Zyte failed, falling back to direct HTTP: %s", e)

        if not text:
            text, final = await _fetch_html_direct(page_url)
    else:
        text, final = await _fetch_html_direct(page_url)

    text = text.replace("\x00", "")
    items = parse_image_urls_from_html(text, final)
    logger.info(
        "scrape: page=%s images=%d final=%s zyte=%s html_bytes=%d cap=%d",
        page_url,
        len(items),
        final,
        zyte_used,
        len(text.encode("utf-8", errors="replace")),
        scrape_image_cap(),
    )
    return items, final
