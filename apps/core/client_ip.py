from __future__ import annotations

import ipaddress

from django.conf import settings
from django.http import HttpRequest


def get_client_ip(request: HttpRequest) -> str | None:
    """
    Client IP behind reverse proxies. When DRF_NUM_PROXIES is set (host + docker nginx),
    take the client address from the right end of X-Forwarded-For.
    """
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").strip()
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            num_proxies = getattr(settings, "DRF_NUM_PROXIES", None) or 0
            if num_proxies and len(parts) > num_proxies:
                return parts[-(num_proxies + 1)]
            if num_proxies:
                return parts[0]
            return parts[-1]
    real_ip = request.META.get("HTTP_X_REAL_IP", "").strip()
    if real_ip:
        return real_ip
    addr = request.META.get("REMOTE_ADDR", "").strip()
    return addr or None


def ip_allowed(client_ip: str | None, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    if not client_ip:
        return False
    try:
        addr = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for entry in allowlist:
        entry = entry.strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            elif addr == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False
