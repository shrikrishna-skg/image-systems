"""Block SSRF when the server fetches user-supplied URLs."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

_BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "metadata.google.internal",
        "metadata",
        "kubernetes.default",
        "kubernetes.default.svc",
    }
)


def _ip_is_forbidden(ip: ipaddress._BaseAddress) -> bool:
    if ip.is_private or ip.is_loopback or ip.is_link_local:
        return True
    if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return True
    if ip.version == 4:
        # AWS/cloud metadata and link-local IPv4
        octets = str(ip).split(".")
        if len(octets) == 4 and octets[0] == "169" and octets[1] == "254":
            return True
    if ip.version == 6:
        mapped = ip.ipv4_mapped
        if mapped is not None and _ip_is_forbidden(mapped):
            return True
    return False


def _hostname_ips_safe(hostname: str) -> bool:
    h = hostname.lower().strip()
    if h.startswith("[") and h.endswith("]"):
        h = h[1:-1]
    if h in _BLOCKED_HOSTNAMES:
        return False
    try:
        ip = ipaddress.ip_address(h)
        return not _ip_is_forbidden(ip)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    for _fam, _type, _proto, _canon, sockaddr in infos:
        addr = sockaddr[0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if _ip_is_forbidden(ip):
            return False
    return True


def assert_url_safe_for_ssrf(url: str) -> None:
    """
    Raise ValueError if the URL must not be fetched by the server.
    Call after each redirect target as well.
    """
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed.")
    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not allowed.")
    host = parsed.hostname
    if not host:
        raise ValueError("URL is missing a host.")
    if not _hostname_ips_safe(host):
        raise ValueError("This host is not allowed (private or restricted network).")


def normalize_http_url(url: str) -> str:
    """Validate and return a normalized URL string for fetching."""
    raw = url.strip()
    if not raw:
        raise ValueError("URL is empty.")
    parsed = urlparse(raw)
    if not parsed.scheme:
        raw = "https://" + raw
        parsed = urlparse(raw)
    assert_url_safe_for_ssrf(raw)
    # Drop fragment only (keep query — some CDNs use it)
    clean = parsed._replace(fragment="")
    return urlunparse(clean)
