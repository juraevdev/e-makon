from __future__ import annotations

import base64
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order, OrderEscrow, OrderPayment
from apps.orders.payments import estimate_for_service
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@override_settings(PAYME_MERCHANT_ID="", CLICK_SERVICE_ID="", CLICK_MERCHANT_ID="")
class OrderPaymentFlowTests(TestCase):
    def setUp(self):
        org = get_or_create_default_organization()
        self.customer = User.objects.create_user(
            phone="+998901000050", role=User.Role.CUSTOMER, organization=org
        )
        self.admin = User.objects.create_user(
            phone="+998901000051",
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
            name="Gazon",
            slug="lawn-care-pay",
            is_active=True,
            organization=org,
            price_from=Decimal("180000"),
            price_to=Decimal("650000"),
        )
        self.free = Service.objects.create(
            name="Maslahat", slug="free-pay", is_active=True, organization=org
        )
        self.superadmin = User.objects.create_user(
            phone="+998901000052", password="x", role=User.Role.SUPERADMIN, is_staff=True
        )
        self.customer_client = _auth_client(self.customer)
        self.admin_client = _auth_client(self.admin)
        self.super_client = _auth_client(self.superadmin)

    def _create_order(self, service=None, area="100") -> dict:
        resp = self.customer_client.post(
            "/api/v1/orders/",
            {"service_id": (service or self.service).pk, "area_size": area, "address": "Jizzax"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.json()["data"]

    def _transition(self, order_id: int, status: str):
        return self.admin_client.post(
            f"/api/v1/admin/orders/{order_id}/transition/", {"status": status}, format="json"
        )

    def _finance(self, order_id: int, action: str):
        return self.super_client.post(
            f"/api/v1/admin/orders/{order_id}/finance/{action}/", {}, format="json"
        )

    def test_order_amount_estimated_on_server(self):
        data = self._create_order(area="100")
        expected = estimate_for_service(self.service, 100)
        self.assertEqual(data["amount"], expected)
        self.assertEqual(data["payment_status"], "unpaid")

    def test_free_service_needs_no_payment(self):
        data = self._create_order(service=self.free)
        self.assertEqual(data["payment_status"], "not_required")
        self.assertEqual(self._transition(data["id"], "in_review").status_code, 200)

    def test_unpaid_order_cannot_be_started(self):
        data = self._create_order()
        resp = self._transition(data["id"], "in_review")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "order_payment_required")

    def test_full_flow_pay_check_confirm_complete_then_platform_releases(self):
        data = self._create_order()
        order_id = data["id"]

        resp = self.customer_client.post(
            f"/api/v1/orders/{order_id}/pay/", {"provider": "click"}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["payment"]["status"], "pending")

        resp = self.customer_client.post(f"/api/v1/orders/{order_id}/payment-sent/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["payment_status"], "checking")

        resp = self._finance(order_id, "mark_paid")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["order"]["payment_status"], "paid")
        self.assertEqual(
            OrderPayment.objects.get(order_id=order_id).status, OrderPayment.Status.CONFIRMED
        )

        for status in ("in_review", "contacted", "completed"):
            self.assertEqual(self._transition(order_id, status).status_code, 200)
        escrow = OrderEscrow.objects.get(order_id=order_id)
        self.assertEqual(escrow.status, OrderEscrow.Status.HELD)

        self.assertEqual(self._finance(order_id, "release").status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.status, OrderEscrow.Status.RELEASED)

    def test_firm_admin_cannot_run_finance_actions(self):
        data = self._create_order()
        resp = self.admin_client.post(
            f"/api/v1/admin/orders/{data['id']}/finance/mark_paid/", {}, format="json"
        )
        self.assertEqual(resp.status_code, 403)

    def test_firm_admin_cannot_change_price_after_payment(self):
        data = self._create_order()
        order_id = data["id"]
        self.customer_client.post(
            f"/api/v1/orders/{order_id}/pay/", {"provider": "click"}, format="json"
        )
        self.customer_client.post(f"/api/v1/orders/{order_id}/payment-sent/")
        resp = self.admin_client.post(
            f"/api/v1/admin/orders/{order_id}/transition/",
            {"status": "new", "quoted_price": "1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "order_price_locked")

    def test_cancel_after_payment_refunds(self):
        data = self._create_order()
        order_id = data["id"]
        self.customer_client.post(
            f"/api/v1/orders/{order_id}/pay/", {"provider": "payme"}, format="json"
        )
        self._finance(order_id, "mark_paid")
        resp = self.customer_client.post(f"/api/v1/orders/{order_id}/cancel/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["payment_status"], "refunded")
        self.assertEqual(Order.objects.get(pk=order_id).status, Order.Status.CANCELLED)

    def test_rejected_payment_can_be_retried(self):
        data = self._create_order()
        order_id = data["id"]
        self.customer_client.post(
            f"/api/v1/orders/{order_id}/pay/", {"provider": "click"}, format="json"
        )
        self.customer_client.post(f"/api/v1/orders/{order_id}/payment-sent/")
        resp = self._finance(order_id, "reject_payment")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["order"]["payment_status"], "rejected")

        resp = self.customer_client.post(
            f"/api/v1/orders/{order_id}/pay/", {"provider": "payme"}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["order"]["payment_status"], "unpaid")

    @override_settings(PAYMENTS_TEST_MODE=True)
    def test_test_payment_holds_escrow_and_unlocks_order(self):
        data = self._create_order()
        self.assertEqual(data["payment_options"], {"click": False, "payme": False, "test": True})
        resp = self.customer_client.post(f"/api/v1/orders/{data['id']}/test-pay/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["payment_status"], "paid")
        payment = OrderPayment.objects.get(order_id=data["id"])
        self.assertEqual(payment.provider, OrderPayment.Provider.TEST)
        self.assertEqual(payment.status, OrderPayment.Status.CONFIRMED)
        self.assertEqual(self._transition(data["id"], "in_review").status_code, 200)

    @override_settings(PAYMENTS_TEST_MODE=False)
    def test_test_payment_disabled(self):
        data = self._create_order()
        resp = self.customer_client.post(f"/api/v1/orders/{data['id']}/test-pay/")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(OrderPayment.objects.filter(order_id=data["id"]).exists())
        resp = self.customer_client.post(
            f"/api/v1/orders/{data['id']}/pay/", {"provider": "test"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    @override_settings(PAYME_MERCHANT_ID="merchant123")
    def test_payme_checkout_url(self):
        data = self._create_order()
        resp = self.customer_client.post(
            f"/api/v1/orders/{data['id']}/pay/", {"provider": "payme"}, format="json"
        )
        url = resp.json()["data"]["payment"]["checkout_url"]
        self.assertTrue(url.startswith("https://checkout.paycom.uz/"))
        decoded = base64.b64decode(url.rsplit("/", 1)[1]).decode()
        self.assertIn("m=merchant123", decoded)
        self.assertIn(f"ac.order_id={data['id']}", decoded)
        self.assertIn(f"a={data['amount'] * 100}", decoded)
