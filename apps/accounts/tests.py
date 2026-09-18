from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
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
