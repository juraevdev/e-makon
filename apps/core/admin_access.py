from __future__ import annotations

import base64
import logging
import secrets
import types
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.admin.forms import AdminAuthenticationForm
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.utils.deprecation import MiddlewareMixin

from apps.accounts.models import User
from apps.core.client_ip import get_client_ip, ip_allowed

if TYPE_CHECKING:
    from django.contrib.admin.sites import AdminSite

logger = logging.getLogger(__name__)

DJANGO_ADMIN_PREFIX = "/django-admin/"


class SuperadminOnlyAdminAuthenticationForm(AdminAuthenticationForm):
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if getattr(user, "role", None) != User.Role.SUPERADMIN:
            raise ValidationError(
                "Django admin faqat platforma superadmin uchun.",
                code="invalid_login",
            )


def patch_admin_site(site: AdminSite) -> None:
    site.login_form = SuperadminOnlyAdminAuthenticationForm

    _orig_has_permission = site.has_permission

    def _restricted_has_permission(self, request: HttpRequest) -> bool:
        if not _orig_has_permission(request):
            return False
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == User.Role.SUPERADMIN
        )

    site.has_permission = types.MethodType(_restricted_has_permission, site)


def _basic_auth_ok(request: HttpRequest) -> bool:
    user = getattr(settings, "DJANGO_ADMIN_HTTP_BASIC_USER", "") or ""
    password = getattr(settings, "DJANGO_ADMIN_HTTP_BASIC_PASSWORD", "") or ""
    if not user or not password:
        return True
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(header[6:].strip(), validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return False
    if ":" not in decoded:
        return False
    provided_user, provided_pass = decoded.split(":", 1)
    user_ok = secrets.compare_digest(provided_user, user)
    pass_ok = secrets.compare_digest(provided_pass, password)
    return user_ok and pass_ok


def _login_rate_limited(request: HttpRequest) -> bool:
    limit = int(getattr(settings, "DJANGO_ADMIN_LOGIN_RATE", 0) or 0)
    if limit <= 0:
        return False
    ident = get_client_ip(request) or "unknown"
    key = f"django-admin-login:{ident}"
    count = cache.get(key, 0)
    if count >= limit:
        return True
    cache.set(key, count + 1, timeout=60)
    return False


class DjangoAdminGuardMiddleware(MiddlewareMixin):
    """
    Defense in depth for /django-admin/: optional HTTP Basic, IP allowlist,
    login rate limit, and superadmin-only session checks.
    """

    def process_request(self, request: HttpRequest):
        path = request.path
        if not (path == DJANGO_ADMIN_PREFIX.rstrip("/") or path.startswith(DJANGO_ADMIN_PREFIX)):
            return None

        client_ip = get_client_ip(request)
        allowlist = getattr(settings, "DJANGO_ADMIN_ALLOWED_IPS", None) or []
        if allowlist and not ip_allowed(client_ip, allowlist):
            logger.warning("django-admin blocked ip=%s path=%s", client_ip, path)
            return HttpResponseForbidden("Access denied")

        if not _basic_auth_ok(request):
            response = HttpResponse("Authentication required", status=401)
            response["WWW-Authenticate"] = 'Basic realm="E-Makon Django Admin"'
            return response

        login_path = f"{DJANGO_ADMIN_PREFIX}login/"
        if (
            request.method == "POST"
            and path.rstrip("/") == login_path.rstrip("/")
            and _login_rate_limited(request)
        ):
            return HttpResponseForbidden("Too many login attempts")

        user = getattr(request, "user", None)
        if user and user.is_authenticated and path != login_path:
            if getattr(user, "role", None) != User.Role.SUPERADMIN:
                logger.warning(
                    "django-admin non-superadmin session ended ip=%s user=%s",
                    client_ip,
                    getattr(user, "pk", None),
                )
                from django.contrib.auth import logout

                logout(request)
                return HttpResponseForbidden("Access denied")

        return None
