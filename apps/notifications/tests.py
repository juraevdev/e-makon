from django.test import TestCase
from unittest.mock import patch

from apps.accounts.models import User
from apps.notifications.models import NotificationDelivery
from apps.notifications.services import NotificationService
from apps.organizations.services import get_or_create_default_organization


class NotificationDeliveryTests(TestCase):
    def setUp(self):
        org = get_or_create_default_organization()
        self.user = User.objects.create_user(
            phone="901555001",
            role=User.Role.CUSTOMER,
            organization=org,
            telegram_id=123456,
        )

    def test_enqueue_persists_skipped_without_redis(self):
        with patch("apps.notifications.services._redis_client", return_value=None):
            ok = NotificationService.enqueue(
                event_type="order.status",
                user_id=self.user.pk,
                telegram_id=self.user.telegram_id,
                entity_type="order",
                entity_id=1,
                delivery_key="test:order:1",
            )
        self.assertFalse(ok)
        row = NotificationDelivery.objects.get(event_id="test:order:1")
        self.assertEqual(row.status, "skipped")
        self.assertEqual(row.detail, "no_redis")
