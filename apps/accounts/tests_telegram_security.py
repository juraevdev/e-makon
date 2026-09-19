from __future__ import annotations

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile
from apps.support.models import SupportMessage, SupportTicket


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@override_settings(EMAKON_BOT_SERVICE_KEY="test-bot-key")
class SupportInternalFilterTests(TestCase):
    def setUp(self):
        org = get_or_create_default_organization()
        self.customer = User.objects.create_user(
            phone="+998901000001",
            role=User.Role.CUSTOMER,
            first_name="Mijoz",
            organization=org,
        )
        self.admin = User.objects.create_user(
            phone="+998901000002",
            password="adminpass",
            role=User.Role.ADMIN,
            is_staff=True,
            first_name="Admin",
            organization=org,
        )
        AdminProfile.objects.create(
            user=self.admin,
            organization=org,
            can_manage_orders=True,
            can_manage_staff=True,
            can_view_analytics=True,
        )
        self.ticket = SupportTicket.objects.create(
            customer=self.customer, subject="Yordam", organization=org
        )
        SupportMessage.objects.create(
            ticket=self.ticket, sender=self.customer, body="Salom"
        )
        SupportMessage.objects.create(
            ticket=self.ticket,
            sender=self.admin,
            body="ICHKI ESLATMA",
            is_internal=True,
        )
        SupportMessage.objects.create(
            ticket=self.ticket, sender=self.admin, body="Javob", is_internal=False
        )

    def test_customer_cannot_see_internal_messages(self):
        client = _auth_client(self.customer)
        resp = client.get(f"/api/v1/support/{self.ticket.pk}/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        ticket = body.get("data") if isinstance(body.get("data"), dict) else body
        messages = ticket.get("messages") or []
        bodies = [m["body"] for m in messages]
        self.assertIn("Salom", bodies)
        self.assertIn("Javob", bodies)
        self.assertNotIn("ICHKI ESLATMA", bodies)
        for m in messages:
            self.assertNotIn("is_internal", m)

    def test_admin_can_see_internal_messages(self):
        client = _auth_client(self.admin)
        resp = client.get(f"/api/v1/admin/support/{self.ticket.pk}/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        messages = body.get("messages") or (body.get("data") or {}).get("messages") or []
        bodies = [m["body"] for m in messages]
        self.assertIn("ICHKI ESLATMA", bodies)


@override_settings(EMAKON_BOT_SERVICE_KEY="test-bot-key")
class ProfileTelegramWriteProtectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="+998901000010", role=User.Role.CUSTOMER, first_name="Aziz"
        )
        self.client = _auth_client(self.user)

    def test_cannot_set_telegram_id_via_profile(self):
        resp = self.client.patch(
            "/api/v1/auth/me/",
            {"telegram_id": 999888777, "first_name": "Azizbek"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.telegram_id)
        self.assertEqual(self.user.first_name, "Azizbek")

    def test_cannot_set_telegram_username_via_profile(self):
        resp = self.client.patch(
            "/api/v1/auth/me/",
            {"telegram_username": "hacker", "home_address": "Jizzax"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_username, "")
        self.assertEqual(self.user.home_address, "Jizzax")


@override_settings(EMAKON_BOT_SERVICE_KEY="test-bot-key")
class TelegramLinkTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="+998901000020", role=User.Role.CUSTOMER
        )
        self.other = User.objects.create_user(
            phone="+998901000021", role=User.Role.CUSTOMER, telegram_id=111222333
        )
        self.client = _auth_client(self.user)

    def _link(self, data, key="test-bot-key"):
        return self.client.post(
            "/api/v1/auth/telegram/link/",
            data,
            format="json",
            HTTP_X_BOT_SERVICE_KEY=key,
        )

    def test_successful_link(self):
        resp = self._link({"telegram_id": 555666777, "telegram_username": "aziz"})
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_id, 555666777)
        self.assertEqual(self.user.telegram_username, "aziz")

    def test_idempotent_same_user(self):
        self._link({"telegram_id": 555666777})
        resp = self._link({"telegram_id": 555666777})
        self.assertEqual(resp.status_code, 200)

    def test_conflict_other_user(self):
        resp = self._link({"telegram_id": 111222333})
        self.assertEqual(resp.status_code, 409)

    def test_invalid_bot_key(self):
        resp = self._link({"telegram_id": 555666777}, key="wrong")
        self.assertEqual(resp.status_code, 403)

    def test_invalid_jwt(self):
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/telegram/link/",
            {"telegram_id": 1},
            format="json",
            HTTP_X_BOT_SERVICE_KEY="test-bot-key",
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_inactive_user(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        # Inactive users typically cannot authenticate; if token still works, link rejects
        client = _auth_client(self.user)
        resp = client.post(
            "/api/v1/auth/telegram/link/",
            {"telegram_id": 999},
            format="json",
            HTTP_X_BOT_SERVICE_KEY="test-bot-key",
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_unlink(self):
        self._link({"telegram_id": 555666777})
        resp = self.client.post(
            "/api/v1/auth/telegram/unlink/",
            {},
            format="json",
            HTTP_X_BOT_SERVICE_KEY="test-bot-key",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.telegram_id)
