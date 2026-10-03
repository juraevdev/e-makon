from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Banner
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction
from apps.loyalty.services import LoyaltyService
from apps.orders.models import Order
from apps.orders.payments import PaymentService
from apps.orders.services import OrderService
from apps.organizations.tests_portal import PortalTestBase


class CustomerFeatureBase(PortalTestBase):
    def _completed_order(self) -> Order:
        resp = self.api_customer.post(
            "/api/v1/orders/", {"service_id": self.offer.pk, "address": "Jizzax"}, format="json"
        )
        order = Order.objects.get(pk=resp.json()["data"]["id"])
        order.quoted_price = Decimal("250000")
        order.save(update_fields=["quoted_price"])
        PaymentService.start(order, "click")
        PaymentService.confirm(order, actor=self.superadmin)
        order = Order.objects.get(pk=order.pk)
        for status in (Order.Status.IN_REVIEW, Order.Status.CONTACTED, Order.Status.COMPLETED):
            OrderService.transition(order, status, actor=self.superadmin)
        return order


class ApiSchemaTests(CustomerFeatureBase):
    def test_openapi_schema_builds(self):
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)


class PublicBannerTests(CustomerFeatureBase):
    def test_only_live_banners_are_listed(self):
        now = timezone.now()
        live = Banner.objects.create(
            title="Kuzgi chegirma", status=Banner.Status.ACTIVE, link_service=self.root
        )
        Banner.objects.create(title="Qoralama", status=Banner.Status.DRAFT)
        Banner.objects.create(
            title="Tugagan", status=Banner.Status.ACTIVE, ends_at=now - timedelta(days=1)
        )
        Banner.objects.create(
            title="Kelajakda", status=Banner.Status.SCHEDULED, starts_at=now + timedelta(days=1)
        )
        started = Banner.objects.create(
            title="Boshlangan", status=Banner.Status.SCHEDULED, starts_at=now - timedelta(hours=1)
        )

        rows = self.client.get("/api/v1/banners/").json()
        self.assertEqual({r["id"] for r in rows}, {live.pk, started.pk})
        row = next(r for r in rows if r["id"] == live.pk)
        self.assertEqual(row["service_slug"], self.root.slug)


class FirmReviewTests(CustomerFeatureBase):
    def test_review_requires_completed_order_and_updates_rating(self):
        url = f"/api/v1/partners/{self.firm.pk}/reviews/"
        resp = self.api_customer.post(url, {"score": 5}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "review_not_allowed")

        self.assertEqual(self.client.post(url, {"score": 5}, format="json").status_code, 403)

        order = self._completed_order()
        resp = self.api_customer.post(url, {"score": 4, "comment": "Yaxshi"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.json()["data"]["order"], order.pk)

        resp = self.api_customer.post(url, {"score": 1}, format="json")
        self.assertEqual(resp.status_code, 400)

        self.firm.refresh_from_db()
        self.assertEqual(self.firm.rating, Decimal("4.00"))
        self.assertEqual(self.firm.ratings_count, 1)

        rows = self.client.get(url).json()["results"]
        self.assertEqual(rows[0]["comment"], "Yaxshi")
        self.assertNotIn("customer_phone", rows[0])


class LoyaltyTests(CustomerFeatureBase):
    def test_completed_order_earns_points_once(self):
        order = self._completed_order()
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, 25)
        self.assertIsNone(LoyaltyService.award_for_order(order))
        self.assertEqual(
            PointTransaction.objects.filter(order=order, kind=PointTransaction.Kind.EARN).count(), 1
        )

        data = self.api_customer.get("/api/v1/loyalty/").json()["data"]
        self.assertEqual(data["balance"], 25)
        history = self.api_customer.get("/api/v1/loyalty/transactions/").json()["results"]
        self.assertEqual(history[0]["points"], 25)

        resp = self.api_super.get("/api/v1/admin/loyalty-transactions/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["results"][0]["order_id"], order.pk)

    def test_redeem_checks_minimum_and_balance(self):
        self._completed_order()
        reward = LoyaltyReward.objects.create(name="Bepul maslahat", points_cost=20)
        expensive = LoyaltyReward.objects.create(name="Bepul ekish", points_cost=100)
        url = "/api/v1/loyalty/redeem/"

        resp = self.api_customer.post(url, {"reward_id": reward.pk}, format="json")
        self.assertEqual(resp.json()["code"], "loyalty_min_points")

        settings_obj = LoyaltySettings.load()
        settings_obj.min_redeem_points = 10
        settings_obj.save()

        resp = self.api_customer.post(url, {"reward_id": expensive.pk}, format="json")
        self.assertEqual(resp.json()["code"], "loyalty_insufficient")

        resp = self.api_customer.post(url, {"reward_id": reward.pk}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["balance"], 5)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, 5)
