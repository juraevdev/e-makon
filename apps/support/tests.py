from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders.models import Order
from apps.organizations.models import Organization
from apps.organizations.services import get_or_create_default_organization
from apps.staff.models import AdminProfile
from apps.support.models import ChatRoom

OPEN_URL = "/api/v1/admin/chats/open/"


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class AdminChatOpenAuthorizationTests(TestCase):
    def setUp(self):
        self.platform = get_or_create_default_organization()
        self.firm = Organization.objects.create(name="Yashil Bog'", slug="yashil-bog")
        self.rival = Organization.objects.create(name="Gulzor", slug="gulzor")
        self.firm_admin = self._admin("+998901200001", self.firm)
        self.rival_admin = self._admin("+998901200002", self.rival)
        self.superadmin = User.objects.create_user(
            phone="+998901200003", password="x", role=User.Role.SUPERADMIN, is_staff=True
        )

        self.own_customer = self._customer("+998901200011", "Own Customer")
        self.rival_customer = self._customer("+998901200012", "Rival Customer")
        self.unrelated_customer = self._customer("+998901200013", "Secret Person")
        self._order(self.own_customer, self.firm)
        self._order(self.rival_customer, self.rival)

    def _admin(self, phone: str, org: Organization, **profile) -> User:
        user = User.objects.create_user(
            phone=phone, password="x", role=User.Role.ADMIN, is_staff=True, organization=org
        )
        AdminProfile.objects.create(user=user, organization=org, **profile)
        return user

    def _customer(self, phone: str, name: str, org: Organization | None = None) -> User:
        first, last = name.split()
        return User.objects.create_user(
            phone=phone,
            role=User.Role.CUSTOMER,
            organization=org or self.platform,
            first_name=first,
            last_name=last,
            full_name=name,
        )

    def _order(self, customer: User, org: Organization) -> Order:
        service, _ = Service.objects.get_or_create(
            slug=f"svc-{org.slug}", defaults={"organization": org, "name": "Gazon"}
        )
        return Order.objects.create(customer=customer, organization=org, service=service)

    def _open(self, user: User, customer_id):
        return _auth_client(user).post(OPEN_URL, {"customer_id": customer_id}, format="json")

    def _assert_hidden(self, resp, customer: User):
        self.assertEqual(resp.status_code, 404, resp.content)
        body = resp.content.decode()
        self.assertNotIn(customer.phone, body)
        self.assertNotIn(customer.full_name, body)
        self.assertNotIn(customer.first_name, body)

    def test_admin_opens_chat_with_own_firm_customer(self):
        resp = self._open(self.firm_admin, self.own_customer.pk)
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()["data"]
        self.assertEqual(data["firm_id"], self.firm.pk)
        self.assertEqual(data["customer_phone"], self.own_customer.phone)
        self.assertTrue(
            ChatRoom.objects.filter(organization=self.firm, customer=self.own_customer).exists()
        )

    def test_admin_cannot_open_customer_of_another_firm(self):
        resp = self._open(self.firm_admin, self.rival_customer.pk)
        self._assert_hidden(resp, self.rival_customer)
        self.assertFalse(ChatRoom.objects.filter(customer=self.rival_customer).exists())

    def test_admin_cannot_open_unrelated_customer(self):
        resp = self._open(self.firm_admin, self.unrelated_customer.pk)
        self._assert_hidden(resp, self.unrelated_customer)
        self.assertFalse(ChatRoom.objects.filter(customer=self.unrelated_customer).exists())

    def test_unrelated_and_missing_customers_are_indistinguishable(self):
        unrelated = self._open(self.firm_admin, self.unrelated_customer.pk)
        missing = self._open(self.firm_admin, 999999)
        invalid = self._open(self.firm_admin, "abc")
        self.assertEqual(unrelated.status_code, missing.status_code)
        self.assertEqual(unrelated.status_code, invalid.status_code)
        self.assertEqual(unrelated.json()["message"], missing.json()["message"])
        self.assertEqual(unrelated.json()["message"], invalid.json()["message"])

    def test_customer_registered_under_firm_is_allowed(self):
        registered = self._customer("+998901200014", "Firm Client", org=self.firm)
        resp = self._open(self.firm_admin, registered.pk)
        self.assertEqual(resp.status_code, 200, resp.content)

    def test_inactive_admin_profile_is_denied(self):
        inactive = self._admin("+998901200004", self.firm, is_active=False)
        resp = self._open(inactive, self.own_customer.pk)
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn(self.own_customer.phone, resp.content.decode())

    def test_admin_without_order_capability_is_denied(self):
        limited = self._admin("+998901200005", self.firm, can_manage_orders=False)
        self.assertEqual(self._open(limited, self.own_customer.pk).status_code, 403)

    def test_admin_of_suspended_firm_is_denied(self):
        self.firm.status = Organization.Status.SUSPENDED
        self.firm.save()
        resp = self._open(self.firm_admin, self.own_customer.pk)
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(ChatRoom.objects.filter(customer=self.own_customer).exists())

    def test_customer_and_worker_roles_are_denied(self):
        worker = User.objects.create_user(
            phone="+998901200006", password="x", role=User.Role.WORKER, organization=self.firm
        )
        self.assertEqual(self._open(self.own_customer, self.own_customer.pk).status_code, 403)
        self.assertEqual(self._open(worker, self.own_customer.pk).status_code, 403)

    def test_superadmin_cannot_open_chats_as_firm(self):
        resp = self._open(self.superadmin, self.unrelated_customer.pk)
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(ChatRoom.objects.filter(customer=self.unrelated_customer).exists())

    def test_customer_initiated_chat_remains_usable_by_firm(self):
        prospect = self._customer("+998901200015", "New Prospect")
        api_customer = _auth_client(prospect)
        room = api_customer.post(
            "/api/v1/chats/open/", {"firm_id": self.firm.pk}, format="json"
        ).json()["data"]
        sent = api_customer.post(
            f"/api/v1/chats/{room['id']}/send/", {"body": "Narx qancha?"}, format="json"
        )
        self.assertEqual(sent.status_code, 201, sent.content)

        reopened = self._open(self.firm_admin, prospect.pk)
        self.assertEqual(reopened.status_code, 200, reopened.content)
        self.assertEqual(reopened.json()["data"]["id"], room["id"])

        api_firm = _auth_client(self.firm_admin)
        reply = api_firm.post(
            f"/api/v1/admin/chats/{room['id']}/send/", {"body": "250 ming"}, format="json"
        )
        self.assertEqual(reply.status_code, 201, reply.content)
        msgs = api_customer.get(f"/api/v1/chats/{room['id']}/messages/").json()["data"]
        self.assertEqual(msgs[-1]["body"], "250 ming")

        self._assert_hidden(self._open(self.rival_admin, prospect.pk), prospect)
