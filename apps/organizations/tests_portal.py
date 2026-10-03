from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.care.models import CareContract
from apps.catalog.models import Service
from apps.notifications.models import UserNotification
from apps.orders.models import Order, OrderEscrow
from apps.orders.payments import PaymentService
from apps.organizations.models import Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile, EmployeeProfile
from apps.support.models import ChatRoom


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class PortalTestBase(TestCase):
    def setUp(self):
        self.platform = get_or_create_default_organization()
        self.firm = Organization.objects.create(
            name="Yashil Bog'", slug="yashil-bog", telegram_channel="@yashilbog"
        )
        self.rival = Organization.objects.create(name="Gulzor", slug="gulzor")
        self.superadmin = User.objects.create_user(
            phone="+998901000100", password="x", role=User.Role.SUPERADMIN, is_staff=True
        )
        self.firm_admin = self._admin("+998901000101", self.firm)
        self.rival_admin = self._admin("+998901000102", self.rival)
        self.worker = User.objects.create_user(
            phone="+998901000103", password="x", role=User.Role.WORKER, organization=self.firm
        )
        self.worker_profile = EmployeeProfile.objects.create(user=self.worker, organization=self.firm)
        self.customer = User.objects.create_user(
            phone="+998901000104", role=User.Role.CUSTOMER, organization=self.platform
        )
        self.root = Service.objects.create(
            name="Gazon parvarishi",
            slug="lawn",
            organization=self.platform,
            price_from=Decimal("180000"),
            price_to=Decimal("650000"),
        )
        self.offer = Service.objects.create(
            name="Gazon parvarishi (Yashil Bog')",
            slug="lawn-yashil",
            organization=self.firm,
            base_service=self.root,
            price_from=Decimal("250000"),
            price_to=Decimal("250000"),
        )
        self.api_super = _auth_client(self.superadmin)
        self.api_firm = _auth_client(self.firm_admin)
        self.api_rival = _auth_client(self.rival_admin)
        self.api_customer = _auth_client(self.customer)

    def _admin(self, phone: str, org: Organization) -> User:
        user = User.objects.create_user(
            phone=phone, password="x", role=User.Role.ADMIN, is_staff=True, organization=org
        )
        AdminProfile.objects.create(user=user, organization=org)
        return user


class ServiceOfferTests(PortalTestBase):
    def test_firm_service_requires_fixed_price_and_goes_to_moderation(self):
        resp = self.api_rival.post(
            "/api/v1/admin/services/",
            {"name": "Gazon", "slug": "gulzor-gazon", "base_service": self.root.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

        resp = self.api_rival.post(
            "/api/v1/admin/services/",
            {"name": "Gazon", "slug": "gulzor-gazon", "base_service": self.root.pk, "price": 300000},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        service = Service.objects.get(slug="gulzor-gazon")
        self.assertEqual(service.moderation_status, Service.Moderation.PENDING)
        self.assertEqual(service.price_from, service.price_to)

        offers = self.client.get(f"/api/v1/services/{self.root.slug}/offers/").json()["data"]
        self.assertNotIn(service.pk, [o["service_id"] for o in offers])

        resp = self.api_rival.post(f"/api/v1/admin/services/{service.pk}/approve/")
        self.assertEqual(resp.status_code, 403)
        resp = self.api_super.post(f"/api/v1/admin/services/{service.pk}/approve/")
        self.assertEqual(resp.status_code, 200, resp.content)

        offers = self.client.get(f"/api/v1/services/{self.root.slug}/offers/").json()["data"]
        prices = {o["firm"]["name"]: o["price"] for o in offers}
        self.assertEqual(prices["Gulzor"], 300000)
        self.assertEqual(prices["Yashil Bog'"], 250000)

    def _propose(self, client, name: str, slug: str, price: int):
        resp = client.post(
            "/api/v1/admin/services/",
            {"name": name, "slug": slug, "price": price, "short_description": "Mevali daraxtlar"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        return Service.objects.get(pk=resp.json()["data"]["id"] if "data" in resp.json() else resp.json()["id"])

    def test_new_type_proposals_from_many_firms_become_one_catalog_service(self):
        first = self._propose(self.api_firm, "Daraxt butash", "butash-a", 200000)
        second = self._propose(self.api_rival, "daraxt  BUTASH", "butash-b", 180000)
        self.assertIsNone(first.base_service_id)
        self.assertTrue(
            UserNotification.objects.filter(user=self.superadmin, entity_type="service", entity_id=first.pk).exists()
        )
        catalog = self.client.get("/api/v1/services/").json()["results"]
        self.assertNotIn("Daraxt butash", [r["name"] for r in catalog])

        self.assertEqual(self.api_super.post(f"/api/v1/admin/services/{first.pk}/approve/").status_code, 200)
        self.assertEqual(self.api_super.post(f"/api/v1/admin/services/{second.pk}/approve/").status_code, 200)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertIsNotNone(first.base_service_id)
        self.assertEqual(first.base_service_id, second.base_service_id)
        root = first.base_service
        self.assertEqual(root.organization_id, self.platform.pk)

        catalog = self.client.get("/api/v1/services/").json()["results"]
        rows = [r for r in catalog if r["name"] == "Daraxt butash"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["offers_count"], 2)
        self.assertEqual((rows[0]["price_min"], rows[0]["price_max"]), (180000, 200000))

        offers = self.client.get(f"/api/v1/services/{root.slug}/offers/").json()["data"]
        self.assertEqual({o["firm"]["name"] for o in offers}, {"Yashil Bog'", "Gulzor"})

        third_firm = Organization.objects.create(name="Bog'bon", slug="bogbon")
        third = self._propose(_auth_client(self._admin("+998901000109", third_firm)), "Daraxt butash", "butash-c", 210000)
        self.assertEqual(third.base_service_id, root.pk)
        self.assertEqual(third.moderation_status, Service.Moderation.PENDING)

    def test_superadmin_can_merge_proposal_into_existing_type(self):
        proposal = self._propose(self.api_rival, "Maysa o'rish", "maysa", 150000)
        resp = self.api_super.post(
            f"/api/v1/admin/services/{proposal.pk}/approve/",
            {"base_service": self.root.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        proposal.refresh_from_db()
        self.assertEqual(proposal.base_service_id, self.root.pk)
        offers = self.client.get(f"/api/v1/services/{self.root.slug}/offers/").json()["data"]
        self.assertIn("Gulzor", {o["firm"]["name"] for o in offers if o["firm"]})

    def test_price_change_sends_offer_back_to_review(self):
        resp = self.api_firm.patch(
            f"/api/v1/admin/services/{self.offer.pk}/", {"price": 270000}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.moderation_status, Service.Moderation.PENDING)
        self.assertEqual(self.offer.price_from, Decimal("270000"))

    def test_catalog_lists_roots_with_offer_price_range(self):
        rows = self.client.get("/api/v1/services/").json()["results"]
        row = next(r for r in rows if r["id"] == self.root.pk)
        self.assertEqual(row["offers_count"], 1)
        self.assertEqual((row["price_min"], row["price_max"]), (250000, 250000))
        self.assertEqual(
            [(f["firm_name"], f["price"]) for f in row["firms"]], [("Yashil Bog'", 250000)]
        )
        self.assertNotIn(self.offer.pk, [r["id"] for r in rows])

        offers = self.client.get(f"/api/v1/services/{self.root.slug}/offers/").json()["data"]
        self.assertEqual([o["firm"]["name"] for o in offers], ["Yashil Bog'"])

    def test_partners_filtered_by_service_show_firm_price_and_socials(self):
        rows = self.client.get(f"/api/v1/partners/?service={self.root.pk}").json()["results"]
        firm_row = next(r for r in rows if r["id"] == self.firm.pk)
        self.assertEqual(firm_row["offer"]["price"], 250000)
        self.assertEqual(firm_row["telegram"], "https://t.me/yashilbog")
        self.assertNotIn(self.rival.pk, [r["id"] for r in rows])

    def test_order_with_firm_uses_firm_offer_and_price(self):
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {
                "service_id": self.root.pk,
                "firm_id": self.firm.pk,
                "area_size": "300",
                "address": "Jizzax",
                "scheduled_date": "2026-10-05T00:00:00.000",
                "time_slot": "09:00 – 12:00",
                "lat": 40.1158011223,
                "lng": 67.8422000111,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        order = Order.objects.get(pk=resp.json()["data"]["id"])
        self.assertEqual(order.organization_id, self.firm.pk)
        self.assertEqual(order.service_id, self.offer.pk)
        self.assertEqual(order.quoted_price, Decimal("250000"))
        self.assertEqual(order.scheduled_date, date(2026, 10, 5))

    def test_order_for_firm_without_offer_is_rejected(self):
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {"service_id": self.root.pk, "firm_id": self.rival.pk, "address": "Jizzax"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class OrderStageTests(PortalTestBase):
    def _paid_order(self) -> Order:
        resp = self.api_customer.post(
            "/api/v1/orders/",
            {"service_id": self.offer.pk, "address": "Jizzax"},
            format="json",
        )
        order = Order.objects.get(pk=resp.json()["data"]["id"])
        PaymentService.start(order, "click")
        PaymentService.confirm(order, actor=self.superadmin)
        return order

    def test_stage_requires_payment(self):
        resp = self.api_customer.post(
            "/api/v1/orders/", {"service_id": self.offer.pk, "address": "Jizzax"}, format="json"
        )
        order_id = resp.json()["data"]["id"]
        resp = self.api_firm.post(
            f"/api/v1/admin/orders/{order_id}/stage/", {"stage": "accepted"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "order_payment_required")

    def test_full_stage_flow_notifies_customer_and_keeps_escrow_held(self):
        order = self._paid_order()
        url = f"/api/v1/admin/orders/{order.pk}/stage/"
        resp = self.api_firm.post(
            url,
            {
                "stage": "accepted",
                "distance_km": "12.5",
                "eta_minutes": 35,
                "assigned_worker_id": self.worker.pk,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()["data"]
        self.assertEqual(data["status"], "in_review")
        self.assertEqual(data["work_stage"], "accepted")
        self.assertEqual(data["eta_minutes"], 35)

        for stage in ("on_the_way", "arrived", "working"):
            resp = self.api_firm.post(url, {"stage": stage}, format="json")
            self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["data"]["status"], "contacted")

        resp = self.api_firm.post(url, {"stage": "accepted"}, format="json")
        self.assertEqual(resp.status_code, 400)

        resp = self.api_firm.post(url, {"stage": "finished"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.COMPLETED)
        self.assertEqual(order.escrow.status, OrderEscrow.Status.HELD)

        titles = list(
            UserNotification.objects.filter(user=self.customer, kind="order").values_list(
                "title", flat=True
            )
        )
        self.assertEqual(len(titles), 5)
        self.assertTrue(any("Yo'lga chiqdi" in t for t in titles))

        inbox = self.api_customer.get("/api/v1/notifications/").json()["results"]
        self.assertEqual(inbox[0]["type"], "order")

        stages = [h["stage"] for h in self.api_super.get(f"/api/v1/admin/orders/{order.pk}/").json()["status_history"]]
        self.assertIn("on_the_way", stages)

    def test_rival_firm_cannot_touch_order(self):
        order = self._paid_order()
        resp = self.api_rival.post(
            f"/api/v1/admin/orders/{order.pk}/stage/", {"stage": "accepted"}, format="json"
        )
        self.assertEqual(resp.status_code, 404)


class ChatTests(PortalTestBase):
    def test_customer_and_firm_chat_in_private_room(self):
        room = self.api_customer.post(
            "/api/v1/chats/open/", {"firm_id": self.firm.pk}, format="json"
        ).json()["data"]
        resp = self.api_customer.post(
            f"/api/v1/chats/{room['id']}/send/", {"body": "Salom, narx qancha?"}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.content)

        rooms = self.api_firm.get("/api/v1/admin/chats/").json()["results"]
        self.assertEqual(rooms[0]["unread"], 1)
        self.assertEqual(self.api_firm.get("/api/v1/admin/chats/unread/").json()["data"]["unread"], 1)
        self.assertEqual(self.api_rival.get("/api/v1/admin/chats/").json()["count"], 0)

        msgs = self.api_firm.get(f"/api/v1/admin/chats/{room['id']}/messages/").json()["data"]
        self.assertEqual(msgs[0]["body"], "Salom, narx qancha?")
        self.api_firm.post(
            f"/api/v1/admin/chats/{room['id']}/send/", {"body": "250 ming so'm"}, format="json"
        )
        self.assertEqual(ChatRoom.objects.get(pk=room["id"]).firm_unread, 0)

        after = msgs[-1]["id"]
        new = self.api_customer.get(f"/api/v1/chats/{room['id']}/messages/?after={after}").json()["data"]
        self.assertEqual([m["sender_name"] for m in new], ["Yashil Bog'"])
        self.assertTrue(UserNotification.objects.filter(user=self.customer, kind="chat").exists())

        self.api_super.post(
            f"/api/v1/admin/chats/{room['id']}/send/", {"body": "E-Makon nazoratida"}, format="json"
        )
        last = self.api_customer.get(f"/api/v1/chats/{room['id']}/messages/").json()["data"][-1]
        self.assertEqual(last["sender_role"], "platform")


class CareContractTests(PortalTestBase):
    def test_firm_creates_contract_superadmin_approves_and_visits_are_planned(self):
        start = date.today() + timedelta(days=1)
        resp = self.api_firm.post(
            "/api/v1/admin/care-contracts/",
            {
                "title": "Bog' yillik parvarishi",
                "client_type": "organization",
                "client_name": "Jizzax shahar hokimligi",
                "contact_person": "Aziz aka",
                "phone_number": "+998901112233",
                "address": "Jizzax",
                "frequency": "weekly",
                "preferred_weekdays": [0, 3],
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(days=27)).isoformat(),
                "price_per_visit": "150000",
                "assigned_worker_ids": [self.worker.pk],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        contract_id = resp.json()["id"] if "id" in resp.json() else resp.json()["data"]["id"]
        contract = CareContract.objects.get(pk=contract_id)
        self.assertEqual(contract.status, CareContract.Status.PENDING)
        self.assertEqual(contract.total_amount, Decimal("150000") * 8)

        resp = self.api_firm.post(f"/api/v1/admin/care-contracts/{contract.pk}/approve/")
        self.assertEqual(resp.status_code, 403)
        resp = self.api_super.post(
            f"/api/v1/admin/care-contracts/{contract.pk}/approve/", {"note": "Shartlar mos"}
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()["data"]
        self.assertEqual(data["status"], "active")
        self.assertEqual(len(data["visits"]), 8)

        resp = self.api_firm.patch(
            f"/api/v1/admin/care-contracts/{contract.pk}/", {"price_per_visit": "1"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "care_locked")

        visit_id = data["visits"][0]["id"]
        resp = self.api_firm.post(
            f"/api/v1/admin/care-contracts/{contract.pk}/visits/{visit_id}/",
            {"status": "done", "report_notes": "Daraxtlar kesildi"},
            format="json",
        )
        self.assertEqual(resp.json()["data"]["visits_done"], 1)
        self.assertEqual(
            self.api_rival.get(f"/api/v1/admin/care-contracts/{contract.pk}/").status_code, 404
        )


class EmployeeAndCustomerTests(PortalTestBase):
    def test_dismissed_employee_cannot_log_in_or_be_assigned(self):
        resp = self.api_firm.post(
            f"/api/v1/admin/employees/{self.worker_profile.pk}/set-status/",
            {"status": "dismissed"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        resp = self.api_firm.post(
            f"/api/v1/admin/employees/{self.worker_profile.pk}/set-status/",
            {"status": "dismissed", "reason": "O'z xohishi bilan"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.worker.refresh_from_db()
        self.assertFalse(self.worker.is_active)

        card = self.api_firm.get(f"/api/v1/admin/employees/{self.worker_profile.pk}/card/").json()["data"]
        self.assertEqual(card["employee"]["employment_status"], "dismissed")
        self.assertIn("total_orders", card["stats"])

        self.api_firm.post(
            f"/api/v1/admin/employees/{self.worker_profile.pk}/set-status/",
            {"status": "active"},
            format="json",
        )
        self.worker.refresh_from_db()
        self.assertTrue(self.worker.is_active)

    def test_customer_segments(self):
        for _ in range(2):
            self.api_customer.post(
                "/api/v1/orders/", {"service_id": self.offer.pk, "address": "Jizzax"}, format="json"
            )
        counts = self.api_firm.get("/api/v1/admin/customers/segments/").json()["data"]
        self.assertEqual(counts["returning"], 1)
        rows = self.api_firm.get("/api/v1/admin/customers/?segment=active").json()["results"]
        self.assertEqual(rows[0]["orders_count"], 2)

    def test_firm_sets_social_links(self):
        resp = self.api_firm.patch(
            "/api/v1/admin/firms/me/",
            {"instagram": "@yashilbog_uz", "youtube": "yashilbog", "telegram_group": "yashilbog_chat"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        row = self.client.get(f"/api/v1/partners/{self.firm.pk}/").json()
        socials = {s["kind"]: s["url"] for s in row["socials"]}
        self.assertEqual(socials["instagram"], "https://instagram.com/yashilbog_uz")
        self.assertEqual(socials["youtube"], "https://youtube.com/@yashilbog")
        self.assertEqual(socials["telegram_group"], "https://t.me/yashilbog_chat")
