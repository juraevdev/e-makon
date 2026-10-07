from __future__ import annotations

from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.finance import FinanceService
from apps.orders.models import Order, OrderEscrow, OrderItem
from apps.orders.payments import _parse_area, estimate_for_service
from apps.organizations.models import FirmMessage, Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class AreaParsingTests(SimpleTestCase):
    def test_units(self):
        self.assertEqual(_parse_area("250"), 250)
        self.assertEqual(_parse_area("250 m2"), 250)
        self.assertEqual(_parse_area("2 sotix"), 200)
        self.assertEqual(_parse_area("2,5 sotix"), 250)
        self.assertEqual(_parse_area("0,5 ga"), 5000)
        self.assertEqual(_parse_area("taxminan 3 sotiq"), 300)
        self.assertEqual(_parse_area(""), 0)
        self.assertEqual(_parse_area("bilmayman"), 0)


@override_settings(PAYMENTS_TEST_MODE=True, PAYME_MERCHANT_ID="", CLICK_SERVICE_ID="")
class OrderIntegrityTests(TestCase):
    def setUp(self):
        self.platform = get_or_create_default_organization()
        self.firm = Organization.objects.create(name="Yashil", slug="yashil")
        self.customer = User.objects.create_user(
            phone="+998901400001", role=User.Role.CUSTOMER, organization=self.platform
        )
        self.admin = User.objects.create_user(
            phone="+998901400002", password="x", role=User.Role.ADMIN, organization=self.firm
        )
        AdminProfile.objects.create(user=self.admin, organization=self.firm)
        self.superadmin = User.objects.create_user(
            phone="+998901400003", password="x", role=User.Role.SUPERADMIN
        )
        self.lawn_root = Service.objects.create(
            name="Gazon", slug="lawn", organization=self.platform,
            price_from=Decimal("100000"), price_to=Decimal("400000"),
        )
        self.tree_root = Service.objects.create(
            name="Daraxt", slug="tree", organization=self.platform,
            price_from=Decimal("50000"), price_to=Decimal("200000"),
        )
        self.water_root = Service.objects.create(
            name="Sug'orish", slug="water", organization=self.platform,
            price_from=Decimal("70000"), price_to=Decimal("70000"),
        )
        self.lawn = self._offer(self.lawn_root, "120000", "450000")
        self.tree = self._offer(self.tree_root, "60000", "60000")
        self.api_customer = _auth_client(self.customer)
        self.api_admin = _auth_client(self.admin)
        self.api_super = _auth_client(self.superadmin)

    def _offer(self, root: Service, low: str, high: str) -> Service:
        return Service.objects.create(
            name=f"{root.name} (Yashil)", slug=f"{root.slug}-yashil", organization=self.firm,
            base_service=root, price_from=Decimal(low), price_to=Decimal(high),
            moderation_status=Service.Moderation.APPROVED,
        )

    def _create(self, **extra):
        payload = {"service_id": self.lawn_root.pk, "firm_id": self.firm.pk, "area_size": "100"}
        payload.update(extra)
        return self.api_customer.post("/api/v1/orders/", payload, format="json")

    def test_every_selected_service_is_stored_and_priced(self):
        resp = self._create(service_ids=[self.lawn_root.pk, self.tree_root.pk])
        self.assertEqual(resp.status_code, 201, resp.content)
        data = resp.json()["data"]
        items = list(OrderItem.objects.filter(order_id=data["id"]).order_by("sort_order"))
        self.assertEqual([i.service_id for i in items], [self.lawn.pk, self.tree.pk])
        expected = estimate_for_service(self.lawn, 100) + estimate_for_service(self.tree, 100)
        self.assertEqual(data["amount"], expected)
        self.assertEqual(sum(int(i.amount) for i in items), expected)
        self.assertEqual([s["name"] for s in data["services"]], [self.lawn.name, self.tree.name])

    def test_extra_service_the_firm_does_not_offer_is_rejected(self):
        resp = self._create(service_ids=[self.lawn_root.pk, self.water_root.pk])
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_new_order_alerts_the_firm(self):
        resp = self._create()
        self.assertEqual(resp.status_code, 201, resp.content)
        order_id = resp.json()["data"]["id"]
        self.assertTrue(
            FirmMessage.objects.filter(firm=self.firm, subject__contains=f"#{order_id}").exists()
        )

    def test_rejected_transition_does_not_persist_side_fields(self):
        order_id = self._create().json()["data"]["id"]
        before = Order.objects.get(pk=order_id)
        resp = self.api_admin.post(
            f"/api/v1/admin/orders/{order_id}/transition/",
            {"status": "completed", "quoted_price": "1.00", "agreed_duration": "BOGUS"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        after = Order.objects.get(pk=order_id)
        self.assertEqual(after.quoted_price, before.quoted_price)
        self.assertEqual(after.agreed_duration, "")

    def test_payment_required_failure_rolls_back_side_fields(self):
        order_id = self._create().json()["data"]["id"]
        resp = self.api_admin.post(
            f"/api/v1/admin/orders/{order_id}/transition/",
            {"status": "in_review", "agreed_duration": "3 kun"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Order.objects.get(pk=order_id).agreed_duration, "")

    def test_customer_can_cancel_before_crew_leaves(self):
        data = self._create().json()["data"]
        self.assertTrue(data["can_cancel"])
        self.api_customer.post(f"/api/v1/orders/{data['id']}/test-pay/")
        self.api_admin.post(
            f"/api/v1/admin/orders/{data['id']}/stage/", {"stage": "accepted"}, format="json"
        )
        resp = self.api_customer.post(f"/api/v1/orders/{data['id']}/cancel/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["payment_status"], "refunded")

    def test_customer_cannot_cancel_once_crew_is_on_the_way(self):
        order_id = self._create().json()["data"]["id"]
        self.api_customer.post(f"/api/v1/orders/{order_id}/test-pay/")
        stage = self.api_admin.post(
            f"/api/v1/admin/orders/{order_id}/stage/", {"stage": "working"}, format="json"
        )
        self.assertEqual(stage.status_code, 200, stage.content)
        resp = self.api_customer.post(f"/api/v1/orders/{order_id}/cancel/")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "order_cancel_locked")
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.CONTACTED)
        self.assertEqual(order.escrow.status, OrderEscrow.Status.HELD)
        detail = self.api_customer.get(f"/api/v1/orders/{order_id}/").json()
        self.assertFalse(detail.get("data", detail)["can_cancel"])

    def test_held_escrow_amount_is_not_rewritten(self):
        order_id = self._create().json()["data"]["id"]
        self.api_customer.post(f"/api/v1/orders/{order_id}/test-pay/")
        order = Order.objects.get(pk=order_id)
        paid = order.escrow.amount
        order.quoted_price = paid + 999
        order.save(update_fields=["quoted_price"])
        escrow = FinanceService.ensure(order)
        self.assertEqual(escrow.amount, paid)

    def test_punish_firm_respects_explicit_zero_fine_and_validates_input(self):
        order_id = self._create().json()["data"]["id"]
        self.api_customer.post(f"/api/v1/orders/{order_id}/test-pay/")
        url = f"/api/v1/admin/orders/{order_id}/finance/punish_firm/"
        bad = self.api_super.post(url, {"fine_amount": "abc"}, format="json")
        self.assertEqual(bad.status_code, 400)
        resp = self.api_super.post(
            url, {"refund": True, "fine_amount": 0, "sales_ban_days": 0}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.firm.refresh_from_db()
        self.assertEqual(self.firm.unpaid_fines, Decimal("0"))
        self.assertEqual(Order.objects.get(pk=order_id).escrow.status, OrderEscrow.Status.REFUNDED)

    def test_media_type_and_count_are_validated(self):
        exe = SimpleUploadedFile("virus.exe", b"MZ", content_type="application/octet-stream")
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {"service_id": self.lawn_root.pk, "firm_id": self.firm.pk, "media": [exe]},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

        photos = [
            SimpleUploadedFile(f"p{i}.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
            for i in range(6)
        ]
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {"service_id": self.lawn_root.pk, "firm_id": self.firm.pk, "media": photos},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_photos_are_stored(self):
        photos = [
            SimpleUploadedFile(f"p{i}.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
            for i in range(2)
        ]
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {"service_id": self.lawn_root.pk, "firm_id": self.firm.pk, "media": photos},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(len(resp.json()["data"]["media"]), 2)


class StaffAndSupportTests(TestCase):
    def setUp(self):
        self.platform = get_or_create_default_organization()
        self.firm = Organization.objects.create(name="Yashil", slug="yashil")
        self.other = Organization.objects.create(name="Gulzor", slug="gulzor")
        self.superadmin = User.objects.create_user(
            phone="+998901600001", password="x", role=User.Role.SUPERADMIN
        )
        self.admin = User.objects.create_user(
            phone="+998901600002", password="x", role=User.Role.ADMIN, organization=self.firm
        )
        self.profile = AdminProfile.objects.create(user=self.admin, organization=self.firm)
        self.api_super = _auth_client(self.superadmin)
        self.api_admin = _auth_client(self.admin)

    def test_employee_duplicate_phone_is_a_validation_error(self):
        first = self.api_admin.post(
            "/api/v1/admin/employees/", {"phone": "901600010", "full_name": "Ali Vali"}, format="json"
        )
        self.assertEqual(first.status_code, 201, first.content)
        second = self.api_admin.post(
            "/api/v1/admin/employees/", {"phone": "+998 90 160 00 11", "full_name": "B C"}, format="json"
        )
        self.assertEqual(second.status_code, 201, second.content)
        resp = self.api_admin.patch(
            f"/api/v1/admin/employees/{second.json()['id']}/", {"phone": "90 160 00 10"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(User.objects.filter(phone="+998901600011").exists())

    def test_moving_admin_to_another_firm_updates_scoping(self):
        resp = self.api_super.patch(
            f"/api/v1/admin/admins/{self.profile.pk}/", {"organization_id": self.other.pk}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.organization_id, self.other.pk)

    def test_deactivated_admin_profile_loses_all_admin_access(self):
        self.api_super.patch(
            f"/api/v1/admin/admins/{self.profile.pk}/", {"is_active": False}, format="json"
        )
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.is_active)
        self.profile.refresh_from_db()
        self.profile.is_active = False
        self.profile.save()
        self.admin.is_active = True
        self.admin.save()
        self.assertEqual(_auth_client(self.admin).get("/api/v1/admin/firms/me/").status_code, 403)

    def test_admin_cannot_delete_or_create_tickets_or_send_empty_reply(self):
        from apps.support.models import SupportTicket

        customer = User.objects.create_user(
            phone="+998901600020", role=User.Role.CUSTOMER, organization=self.firm
        )
        ticket = SupportTicket.objects.create(customer=customer, organization=self.firm, subject="Yordam")
        self.assertEqual(self.api_admin.delete(f"/api/v1/admin/support/{ticket.pk}/").status_code, 405)
        self.assertEqual(
            self.api_admin.post("/api/v1/admin/support/", {"subject": "x"}, format="json").status_code, 405
        )
        empty = self.api_admin.post(
            f"/api/v1/admin/support/{ticket.pk}/reply/", {"body": "  "}, format="json"
        )
        self.assertEqual(empty.status_code, 400)
        closed = self.api_admin.patch(
            f"/api/v1/admin/support/{ticket.pk}/", {"status": "closed", "order": 999}, format="json"
        )
        self.assertEqual(closed.status_code, 200, closed.content)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "closed")
        self.assertIsNone(ticket.order_id)
        self.assertTrue(SupportTicket.objects.filter(pk=ticket.pk).exists())


class DashboardRevenueTests(TestCase):
    def setUp(self):
        self.platform = get_or_create_default_organization()
        self.firm = Organization.objects.create(name="Yashil", slug="yashil")
        self.customer = User.objects.create_user(
            phone="+998901500001", role=User.Role.CUSTOMER, organization=self.platform
        )
        self.superadmin = User.objects.create_user(
            phone="+998901500002", password="x", role=User.Role.SUPERADMIN
        )
        self.service = Service.objects.create(name="Gazon", slug="g", organization=self.firm)

    def _order(self, price: str, escrow_status: str | None) -> Order:
        order = Order.objects.create(
            customer=self.customer, organization=self.firm, service=self.service,
            status=Order.Status.COMPLETED, quoted_price=Decimal(price),
        )
        if escrow_status:
            OrderEscrow.objects.create(order=order, status=escrow_status, amount=Decimal(price))
        return order

    def test_only_paid_completed_orders_count_as_revenue(self):
        self._order("100000", OrderEscrow.Status.RELEASED)
        self._order("50000", None)
        self._order("70000", OrderEscrow.Status.REFUNDED)
        data = _auth_client(self.superadmin).get("/api/v1/admin/dashboard/").json()["data"]
        self.assertEqual(Decimal(data["revenue_done"]), Decimal("100000"))
        self.assertEqual(Decimal(data["revenue_period"]), Decimal("100000"))

    def test_admin_without_firm_gets_no_global_analytics(self):
        orphan = User.objects.create_user(phone="+998901500003", password="x", role=User.Role.ADMIN)
        AdminProfile.objects.create(user=orphan, organization=None, can_view_analytics=True)
        client = _auth_client(orphan)
        self.assertEqual(client.get("/api/v1/admin/dashboard/").status_code, 403)
        self.assertEqual(client.get("/api/v1/admin/map/").status_code, 403)
