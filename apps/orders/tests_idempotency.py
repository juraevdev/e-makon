from __future__ import annotations

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order, OrderIdempotency
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class OrderIdempotencyTests(TestCase):
    def setUp(self):
        org = get_or_create_default_organization()
        self.customer = User.objects.create_user(
            phone="+998901000030", role=User.Role.CUSTOMER, organization=org
        )
        self.other = User.objects.create_user(
            phone="+998901000031", role=User.Role.CUSTOMER, organization=org
        )
        self.service = Service.objects.create(
            name="Gazon", slug="lawn-care", is_active=True, organization=org
        )
        self.client = _auth_client(self.customer)

    def test_same_key_twice_one_order(self):
        payload = {"service_id": self.service.pk, "address": "Jizzax", "phone_number": "+998901000030"}
        r1 = self.client.post(
            "/api/v1/orders/",
            payload,
            format="multipart",
            HTTP_IDEMPOTENCY_KEY="key-abc-1",
        )
        r2 = self.client.post(
            "/api/v1/orders/",
            payload,
            format="multipart",
            HTTP_IDEMPOTENCY_KEY="key-abc-1",
        )
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r1.json()["data"]["id"], r2.json()["data"]["id"])
        self.assertEqual(Order.objects.filter(customer=self.customer).count(), 1)

    def test_different_keys_two_orders(self):
        payload = {"service_id": self.service.pk, "address": "A"}
        self.client.post("/api/v1/orders/", payload, format="multipart", HTTP_IDEMPOTENCY_KEY="k1")
        self.client.post("/api/v1/orders/", payload, format="multipart", HTTP_IDEMPOTENCY_KEY="k2")
        self.assertEqual(Order.objects.filter(customer=self.customer).count(), 2)

    def test_same_key_other_user_creates_own(self):
        payload = {"service_id": self.service.pk, "address": "A"}
        self.client.post("/api/v1/orders/", payload, format="multipart", HTTP_IDEMPOTENCY_KEY="shared-key")
        other_client = _auth_client(self.other)
        resp = other_client.post(
            "/api/v1/orders/", payload, format="multipart", HTTP_IDEMPOTENCY_KEY="shared-key"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Order.objects.count(), 2)
        self.assertEqual(OrderIdempotency.objects.count(), 2)


@override_settings(EMAKON_BOT_SERVICE_KEY="test-bot-key")
class OrderTransitionGraphTests(TestCase):
    def setUp(self):
        org = get_or_create_default_organization()
        self.customer = User.objects.create_user(
            phone="+998901000040", role=User.Role.CUSTOMER, organization=org
        )
        self.admin = User.objects.create_user(
            phone="+998901000041",
            password="x",
            role=User.Role.ADMIN,
            is_staff=True,
            organization=org,
        )
        AdminProfile.objects.create(
            user=self.admin,
            organization=org,
            can_manage_orders=True,
            can_manage_staff=True,
            can_view_analytics=True,
        )
        self.service = Service.objects.create(
            name="Gazon", slug="lawn-care-2", is_active=True, organization=org
        )
        self.order = Order.objects.create(
            customer=self.customer,
            service=self.service,
            organization=org,
            status=Order.Status.NEW,
        )
        self.client = _auth_client(self.admin)

    def test_illegal_jump_rejected(self):
        resp = self.client.post(
            f"/api/v1/admin/orders/{self.order.pk}/transition/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.NEW)

    def test_legal_path(self):
        for status in ("in_review", "contacted", "completed"):
            resp = self.client.post(
                f"/api/v1/admin/orders/{self.order.pk}/transition/",
                {"status": status},
                format="json",
            )
            self.assertEqual(resp.status_code, 200, resp.content)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.COMPLETED)
