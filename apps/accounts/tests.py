from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import OTPChallenge, User
from apps.organizations.models import Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile


class OTPFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_otp_request_and_verify(self):
        req = self.client.post(
            "/api/v1/auth/otp/request/",
            {"phone": "901112233"},
            format="json",
        )
        self.assertEqual(req.status_code, 200)
        code = req.json()["data"]["debug_code"]

        verify = self.client.post(
            "/api/v1/auth/otp/verify/",
            {"phone": "901112233", "code": code, "full_name": "Aziz"},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        body = verify.json()["data"]
        self.assertIn("access", body)
        user = User.objects.get(phone="+998901112233")
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertIsNotNone(user.organization_id)

    def test_otp_blocks_admin_phone(self):
        org = get_or_create_default_organization()
        User.objects.create_user(
            phone="901998877",
            password="secret123",
            role=User.Role.ADMIN,
            organization=org,
        )
        req = self.client.post(
            "/api/v1/auth/otp/request/",
            {"phone": "901998877"},
            format="json",
        )
        self.assertEqual(req.status_code, 400)

    @override_settings(OTP_REQUEST_RATE_LIMIT=2, OTP_REQUEST_RATE_WINDOW_SECONDS=600)
    def test_otp_rate_limit(self):
        for _ in range(2):
            ok = self.client.post(
                "/api/v1/auth/otp/request/",
                {"phone": "901223344"},
                format="json",
            )
            self.assertEqual(ok.status_code, 200)
        blocked = self.client.post(
            "/api/v1/auth/otp/request/",
            {"phone": "901223344"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)


@override_settings(OTP_MAX_ATTEMPTS=3, OTP_DEBUG_RETURN_CODE=True)
class OTPBruteForceTests(TestCase):
    PHONE = "901554433"
    NORMALIZED = "+998901554433"

    def setUp(self):
        self.client = APIClient()

    def _request(self) -> str:
        resp = self.client.post("/api/v1/auth/otp/request/", {"phone": self.PHONE}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp.json()["data"]["debug_code"]

    def _verify(self, code: str):
        return self.client.post(
            "/api/v1/auth/otp/verify/", {"phone": self.PHONE, "code": code}, format="json"
        )

    @staticmethod
    def _wrong(code: str) -> str:
        return "000000" if code != "000000" else "111111"

    def _challenge(self) -> OTPChallenge:
        return OTPChallenge.objects.filter(phone=self.NORMALIZED).latest("created_at")

    def test_failed_attempts_are_persisted_and_lock_the_code(self):
        code = self._request()
        for expected_attempts in (1, 2, 3):
            self.assertEqual(self._verify(self._wrong(code)).status_code, 400)
            self.assertEqual(self._challenge().attempts, expected_attempts)
        self.assertTrue(self._challenge().is_used)

        blocked = self._verify(code)
        self.assertEqual(blocked.status_code, 400)
        self.assertNotIn("access", blocked.content.decode())
        self.assertEqual(self._challenge().attempts, 3)
        self.assertFalse(User.objects.filter(phone=self.NORMALIZED).exists())

    def test_correct_code_within_limit_succeeds_once(self):
        code = self._request()
        self.assertEqual(self._verify(self._wrong(code)).status_code, 400)
        self.assertEqual(self._verify(self._wrong(code)).status_code, 400)
        ok = self._verify(code)
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertIn("access", ok.json()["data"])
        self.assertEqual(self._verify(code).status_code, 400)

    def test_expired_code_cannot_be_used(self):
        code = self._request()
        OTPChallenge.objects.filter(phone=self.NORMALIZED).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(self._verify(code).status_code, 400)
        self.assertTrue(self._challenge().is_used)
        self.assertFalse(User.objects.filter(phone=self.NORMALIZED).exists())

    def test_resend_invalidates_previous_code(self):
        with mock.patch(
            "apps.accounts.services.otp._generate_code", side_effect=["111111", "222222"]
        ):
            first = self._request()
            second = self._request()
        self.assertEqual(self._verify(first).status_code, 400)
        self.assertEqual(self._verify(second).status_code, 200)

    def test_ineligible_numbers_get_identical_generic_error(self):
        org = get_or_create_default_organization()
        User.objects.create_user(
            phone="+998901998870", password="secret123", role=User.Role.ADMIN, organization=org
        )
        User.objects.create_user(
            phone="+998901998871", role=User.Role.CUSTOMER, organization=org, is_active=False
        )
        messages = []
        for phone in ("901998870", "901998871"):
            for path, body in (
                ("/api/v1/auth/otp/request/", {"phone": phone}),
                ("/api/v1/auth/otp/verify/", {"phone": phone, "code": "123456"}),
            ):
                resp = self.client.post(path, body, format="json")
                self.assertEqual(resp.status_code, 400)
                messages.append(resp.json()["message"])
        self.assertEqual(len(set(messages)), 1)
        self.assertNotIn("admin", messages[0].lower())

    @override_settings(OTP_DEBUG_RETURN_CODE=False, SMS_PROVIDER="")
    def test_code_is_not_logged_or_returned_without_debug(self):
        with mock.patch(
            "apps.accounts.services.otp._generate_code", return_value="987654"
        ), self.assertLogs("apps.accounts.services.otp", level="DEBUG") as logs:
            resp = self.client.post(
                "/api/v1/auth/otp/request/", {"phone": self.PHONE}, format="json"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("debug_code", resp.json()["data"])
        output = "\n".join(logs.output)
        self.assertNotIn("987654", output)
        self.assertNotIn("554433", output)


class TokenLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        org = get_or_create_default_organization()
        self.admin = User.objects.create_user(
            phone="+998901300001", password="secret123", role=User.Role.ADMIN, organization=org
        )
        AdminProfile.objects.create(user=self.admin, organization=org)

    def _login(self) -> dict:
        resp = self.client.post(
            "/api/v1/auth/admin/login/",
            {"phone": "+998901300001", "password": "secret123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp.json()["data"]

    def _refresh(self, token: str):
        return self.client.post("/api/v1/auth/token/refresh/", {"refresh": token}, format="json")

    def test_logout_revokes_refresh_token(self):
        tokens = self._login()
        out = self.client.post("/api/v1/auth/logout/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(out.status_code, 200)
        self.assertEqual(self._refresh(tokens["refresh"]).status_code, 401)

    def test_rotated_refresh_token_cannot_be_reused(self):
        tokens = self._login()
        first = self._refresh(tokens["refresh"])
        self.assertEqual(first.status_code, 200, first.content)
        self.assertIn("refresh", first.json())
        self.assertEqual(self._refresh(tokens["refresh"]).status_code, 401)

    def test_logout_with_garbage_token_is_harmless(self):
        out = self.client.post("/api/v1/auth/logout/", {"refresh": "not-a-token"}, format="json")
        self.assertEqual(out.status_code, 200)


class AuthThrottleTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()

    @override_settings(API_THROTTLE_RATES={"admin_login": "3/min"})
    def test_admin_login_is_throttled(self):
        codes = [
            self.client.post(
                "/api/v1/auth/admin/login/",
                {"phone": "+998901300099", "password": "wrong-pass"},
                format="json",
            ).status_code
            for _ in range(4)
        ]
        self.assertEqual(codes[:3], [401, 401, 401])
        self.assertEqual(codes[3], 429)

    @override_settings(API_THROTTLE_RATES={"otp_verify": "2/min"})
    def test_otp_verify_is_throttled(self):
        codes = [
            self.client.post(
                "/api/v1/auth/otp/verify/", {"phone": "901300098", "code": "123456"}, format="json"
            ).status_code
            for _ in range(3)
        ]
        self.assertEqual(codes[2], 429)

    @override_settings(API_THROTTLE_RATES={})
    def test_disabled_when_no_rate(self):
        for _ in range(5):
            resp = self.client.post(
                "/api/v1/auth/admin/login/",
                {"phone": "+998901300099", "password": "wrong-pass"},
                format="json",
            )
            self.assertEqual(resp.status_code, 401)


class AdminOrgScopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="Org A", slug="org-a")
        self.org_b = Organization.objects.create(name="Org B", slug="org-b")
        self.admin = User.objects.create_user(
            phone="901000001",
            password="secret123",
            role=User.Role.ADMIN,
            organization=self.org_a,
            is_staff=True,
        )
        AdminProfile.objects.create(
            user=self.admin,
            organization=self.org_a,
            can_manage_orders=True,
            can_manage_staff=True,
            can_view_analytics=True,
        )
        from apps.catalog.models import Service
        from apps.orders.models import Order

        self.svc_a = Service.objects.create(
            organization=self.org_a, slug="a-svc", name="A", is_active=True
        )
        self.svc_b = Service.objects.create(
            organization=self.org_b, slug="b-svc", name="B", is_active=True
        )
        cust_a = User.objects.create_user(
            phone="901000011", role=User.Role.CUSTOMER, organization=self.org_a
        )
        cust_b = User.objects.create_user(
            phone="901000012", role=User.Role.CUSTOMER, organization=self.org_b
        )
        self.order_a = Order.objects.create(
            customer=cust_a, organization=self.org_a, service=self.svc_a
        )
        self.order_b = Order.objects.create(
            customer=cust_b, organization=self.org_b, service=self.svc_b
        )

    def test_admin_sees_only_own_org_orders(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/admin/orders/")
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        rows = payload.get("results") or payload.get("data") or payload
        if isinstance(rows, dict) and "results" in rows:
            rows = rows["results"]
        ids = {row["id"] for row in rows}
        self.assertIn(self.order_a.id, ids)
        self.assertNotIn(self.order_b.id, ids)
