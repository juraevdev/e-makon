from __future__ import annotations

import base64

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

User = get_user_model()


@override_settings(
    DJANGO_ADMIN_ALLOWED_IPS=["127.0.0.1", "::1"],
    DJANGO_ADMIN_HTTP_BASIC_USER="",
    DJANGO_ADMIN_HTTP_BASIC_PASSWORD="",
    DJANGO_ADMIN_LOGIN_RATE=0,
)
class DjangoAdminGuardMiddlewareTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_admin_index_forbidden_for_unknown_ip(self):
        response = self.client.get(
            "/django-admin/",
            REMOTE_ADDR="203.0.113.9",
            HTTP_X_FORWARDED_FOR="203.0.113.9",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_index_allowed_for_localhost(self):
        response = self.client.get("/django-admin/", REMOTE_ADDR="127.0.0.1")
        self.assertIn(response.status_code, {200, 302})

    @override_settings(
        DJANGO_ADMIN_HTTP_BASIC_USER="gate",
        DJANGO_ADMIN_HTTP_BASIC_PASSWORD="secret",
    )
    def test_basic_auth_required_when_configured(self):
        blocked = self.client.get("/django-admin/", REMOTE_ADDR="127.0.0.1")
        self.assertEqual(blocked.status_code, 401)
        creds = base64.b64encode(b"gate:secret").decode("ascii")
        allowed = self.client.get(
            "/django-admin/",
            REMOTE_ADDR="127.0.0.1",
            HTTP_AUTHORIZATION=f"Basic {creds}",
        )
        self.assertIn(allowed.status_code, {200, 302})


@override_settings(
    DJANGO_ADMIN_ALLOWED_IPS=[],
    DJANGO_ADMIN_LOGIN_RATE=0,
)
class DjangoAdminLoginRoleTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_firm_admin_cannot_use_django_admin_login(self):
        User.objects.create_user(
            phone="+998901112233",
            password="pass12345",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=False,
        )
        response = self.client.post(
            "/django-admin/login/",
            {"username": "+998901112233", "password": "pass12345", "next": "/django-admin/"},
            REMOTE_ADDR="127.0.0.1",
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Django admin faqat platforma superadmin", status_code=200)
