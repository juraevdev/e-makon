from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order
from apps.organizations.models import Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class FirmAdminScopeTests(TestCase):
    def setUp(self):
        self.default_org = get_or_create_default_organization()
        self.firm = Organization.objects.create(name="Yashil Bog'", slug="yashil-bog")
        self.other = Organization.objects.create(name="Boshqa firma", slug="boshqa")

        self.firm_admin = User.objects.create_user(
            phone="+998901000060",
            password="x",
            role=User.Role.ADMIN,
            is_staff=True,
            organization=self.firm,
        )
        AdminProfile.objects.create(
            user=self.firm_admin,
            organization=self.firm,
            can_manage_orders=True,
            can_manage_staff=True,
            can_view_analytics=True,
        )
        self.customer = User.objects.create_user(
            phone="+998901000061", role=User.Role.CUSTOMER, organization=self.default_org
        )
        self.stranger = User.objects.create_user(
            phone="+998901000062", role=User.Role.CUSTOMER, organization=self.default_org
        )
        self.service = Service.objects.create(
            name="Daraxt kesish",
            slug="firm-tree",
            is_active=True,
            organization=self.firm,
            price_from=Decimal("100000"),
        )
        self.client_admin = _auth_client(self.firm_admin)
        self.client_customer = _auth_client(self.customer)

    def _order(self) -> dict:
        resp = self.client_customer.post(
            "/api/v1/orders/",
            {"service_id": self.service.pk, "area_size": "10", "address": "Jizzax"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.json()["data"]

    def test_order_goes_to_service_owner_firm(self):
        data = self._order()
        self.assertEqual(Order.objects.get(pk=data["id"]).organization_id, self.firm.pk)
        resp = self.client_admin.get("/api/v1/admin/orders/")
        ids = [row["id"] for row in resp.json()["results"]]
        self.assertIn(data["id"], ids)

    def test_sales_banned_firm_cannot_receive_orders(self):
        self.firm.sales_banned_until = timezone.now() + timedelta(days=3)
        self.firm.save()
        resp = self.client_customer.post(
            "/api/v1/orders/",
            {"service_id": self.service.pk, "area_size": "10", "address": "Jizzax"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "firm_unavailable")

    def test_firm_admin_sees_only_own_firm(self):
        resp = self.client_admin.get("/api/v1/admin/firms/")
        ids = [row["id"] for row in resp.json()["results"]]
        self.assertEqual(ids, [self.firm.pk])
        self.assertEqual(
            self.client_admin.get(f"/api/v1/admin/firms/{self.other.pk}/stats/").status_code, 404
        )

    def test_firm_admin_cannot_moderate_firms(self):
        for url in (
            f"/api/v1/admin/firms/{self.firm.pk}/unblock/",
            f"/api/v1/admin/firms/{self.firm.pk}/adjust_debt/",
            f"/api/v1/admin/firms/{self.firm.pk}/lift_sales_ban/",
        ):
            self.assertEqual(self.client_admin.post(url, {}, format="json").status_code, 403, url)
        resp = self.client_admin.patch(
            f"/api/v1/admin/firms/{self.firm.pk}/", {"commission_rate": "0.1"}, format="json"
        )
        self.assertEqual(resp.status_code, 403)

    def test_firm_admin_edits_own_profile_contacts_only(self):
        resp = self.client_admin.patch(
            "/api/v1/admin/firms/me/",
            {"phone": "+998712000000", "commission_rate": "0.1", "status": "active"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.firm.refresh_from_db()
        self.assertEqual(self.firm.phone, "+998712000000")
        self.assertEqual(self.firm.commission_rate, Organization._meta.get_field("commission_rate").default)

    def test_superadmin_only_modules_are_forbidden(self):
        for url in (
            "/api/v1/admin/banners/",
            "/api/v1/admin/investors/",
            "/api/v1/admin/admins/",
            "/api/v1/admin/loyalty/settings/",
        ):
            self.assertEqual(self.client_admin.get(url).status_code, 403, url)

    def test_customers_scoped_to_firm_orders(self):
        self._order()
        resp = self.client_admin.get("/api/v1/admin/customers/")
        phones = [row["phone"] for row in resp.json()["results"]]
        self.assertIn(self.customer.phone, phones)
        self.assertNotIn(self.stranger.phone, phones)
        resp = self.client_admin.post(f"/api/v1/admin/customers/{self.customer.pk}/block/")
        self.assertEqual(resp.status_code, 403)
