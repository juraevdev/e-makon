from __future__ import annotations

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.organizations.models import Organization
from apps.staff.models import AdminProfile, EmployeeProfile


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


class FirmScheduleTests(TestCase):
    def setUp(self):
        self.firm = Organization.objects.create(name="Yashil Bog'", slug="yashil-bog-schedule")
        self.service = Service.objects.create(
            name="Maslahat", slug="schedule-free", is_active=True, organization=self.firm
        )
        self.customer = User.objects.create_user(phone="+998901300001", role=User.Role.CUSTOMER)
        self.admin = User.objects.create_user(
            phone="+998901300002",
            password="x",
            role=User.Role.ADMIN,
            is_staff=True,
            organization=self.firm,
        )
        AdminProfile.objects.create(user=self.admin, organization=self.firm, can_manage_orders=True)
        self.superadmin = User.objects.create_user(
            phone="+998901300003", password="x", role=User.Role.SUPERADMIN, is_staff=True
        )
        self.customer_client = _auth_client(self.customer)
        self.admin_client = _auth_client(self.admin)
        self.super_client = _auth_client(self.superadmin)
        self.day = (timezone.localdate() + timedelta(days=1)).isoformat()

    def _hire(self, phone: str):
        worker = User.objects.create_user(phone=phone, role=User.Role.WORKER, organization=self.firm)
        EmployeeProfile.objects.create(user=worker, organization=self.firm)

    def _order(self, start: str, day: str | None = None):
        return self.customer_client.post(
            "/api/v1/orders/",
            {
                "service_id": self.service.pk,
                "address": "Toshkent",
                "scheduled_date": day or self.day,
                "scheduled_start": start,
            },
            format="json",
        )

    def _public_slots(self) -> dict[str, dict]:
        resp = self.client.get(f"/api/v1/partners/{self.firm.pk}/availability/", {"date": self.day})
        self.assertEqual(resp.status_code, 200, resp.content)
        return {s["start"]: s for s in resp.json()["data"]["slots"]}

    def test_booked_hour_turns_busy_and_rejects_second_order(self):
        self.assertEqual(self._public_slots()["10:00"]["status"], "free")
        first = self._order("10:00")
        self.assertEqual(first.status_code, 201, first.content)
        data = first.json()["data"]
        self.assertEqual(data["time_slot"], "10:00 – 11:00")
        self.assertEqual(data["duration_minutes"], 60)
        self.assertEqual(data["scheduled_end"], "11:00")

        slots = self._public_slots()
        self.assertEqual(slots["10:00"]["status"], "busy")
        self.assertEqual(slots["11:00"]["status"], "free")
        self.assertNotIn("orders", slots["10:00"])

        second = self._order("10:00")
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["code"], "slot_busy")
        self.assertEqual(self._order("11:00").status_code, 201)

    def test_capacity_follows_active_employees(self):
        self._hire("+998901300010")
        self._hire("+998901300011")
        self.assertEqual(self._order("09:00").status_code, 201)
        self.assertEqual(self._public_slots()["09:00"]["status"], "free")
        self.assertEqual(self._order("09:00").status_code, 201)
        slot = self._public_slots()["09:00"]
        self.assertEqual((slot["busy_count"], slot["capacity"], slot["status"]), (2, 2, "busy"))
        self.assertEqual(self._order("09:00").status_code, 400)

    def test_firm_extends_duration_and_next_hour_becomes_busy(self):
        order_id = self._order("14:00").json()["data"]["id"]
        resp = self.admin_client.post(
            f"/api/v1/admin/orders/{order_id}/schedule/", {"extend_minutes": 60}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()["data"]
        self.assertEqual(data["duration_minutes"], 120)
        self.assertEqual(data["time_slot"], "14:00 – 16:00")
        slots = self._public_slots()
        self.assertEqual(slots["14:00"]["status"], "busy")
        self.assertEqual(slots["15:00"]["status"], "busy")
        self.assertEqual(self._order("15:00").json()["code"], "slot_busy")

    def test_moving_to_busy_hour_is_rejected(self):
        self.assertEqual(self._order("10:00").status_code, 201)
        other = self._order("12:00").json()["data"]["id"]
        resp = self.admin_client.post(
            f"/api/v1/admin/orders/{other}/schedule/", {"scheduled_start": "10:00"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "slot_busy")

    def test_cancelled_order_frees_the_hour(self):
        order_id = self._order("16:00").json()["data"]["id"]
        self.customer_client.post(f"/api/v1/orders/{order_id}/cancel/")
        self.assertEqual(self._public_slots()["16:00"]["status"], "free")
        self.assertEqual(self._order("16:00").status_code, 201)

    def test_past_and_out_of_hours_rejected(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        self.assertEqual(self._order("10:00", day=yesterday).json()["code"], "slot_in_past")
        self.assertEqual(self._order("22:00").json()["code"], "slot_outside_hours")

    def test_admin_availability_lists_orders_and_superadmin_needs_firm(self):
        order_id = self._order("10:00").json()["data"]["id"]
        resp = self.admin_client.get("/api/v1/admin/orders/availability/", {"date": self.day})
        self.assertEqual(resp.status_code, 200, resp.content)
        slot = next(s for s in resp.json()["data"]["slots"] if s["start"] == "10:00")
        self.assertEqual([o["id"] for o in slot["orders"]], [order_id])

        self.assertEqual(
            self.super_client.get("/api/v1/admin/orders/availability/", {"date": self.day}).status_code,
            400,
        )
        resp = self.super_client.get(
            "/api/v1/admin/orders/availability/", {"date": self.day, "organization": self.firm.pk}
        )
        self.assertEqual(resp.status_code, 200)
