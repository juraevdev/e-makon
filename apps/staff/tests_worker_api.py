from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order
from apps.organizations.models import Organization
from apps.staff.models import EmployeeProfile


def _auth(user: User) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


class WorkerApiTests(TestCase):
    def setUp(self):
        self.firm = Organization.objects.create(name="WorkerFirm", slug="worker-firm")
        self.service = Service.objects.create(
            name="Kesish", slug="worker-svc", organization=self.firm, is_active=True
        )
        self.customer = User.objects.create_user(phone="+998901222001", role=User.Role.CUSTOMER)
        self.worker = User.objects.create_user(
            phone="+998901222002",
            password="secret123",
            role=User.Role.WORKER,
            organization=self.firm,
        )
        EmployeeProfile.objects.create(user=self.worker, organization=self.firm)
        self.order = Order.objects.create(
            customer=self.customer,
            organization=self.firm,
            service=self.service,
            status=Order.Status.IN_REVIEW,
            assigned_worker=self.worker,
            assigned_worker_name=self.worker.phone,
            work_stage=Order.WorkStage.ACCEPTED,
        )
        self.client = _auth(self.worker)

    def test_worker_lists_assigned_orders(self):
        resp = self.client.get("/api/v1/worker/orders/")
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        rows = body.get("results") or body.get("data", {}).get("results") or body.get("data") or []
        ids = [row["id"] for row in rows]
        self.assertIn(self.order.pk, ids)

    def test_worker_can_advance_stage(self):
        resp = self.client.post(
            f"/api/v1/worker/orders/{self.order.pk}/stage/",
            {"stage": Order.WorkStage.ON_THE_WAY},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.order.refresh_from_db()
        self.assertEqual(self.order.work_stage, Order.WorkStage.ON_THE_WAY)

    def test_worker_password_login(self):
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/admin/login/",
            {"phone": self.worker.phone, "password": "secret123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("access", resp.json()["data"])
