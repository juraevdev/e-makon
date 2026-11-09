from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.db import connection

from apps.catalog.models import Service
from apps.core.phone import normalize_phone


class PhoneNormalizeTests(TestCase):
    def test_uz_local(self):
        self.assertEqual(normalize_phone("901234567"), "+998901234567")

    def test_uz_full(self):
        self.assertEqual(normalize_phone("998901234567"), "+998901234567")


class ServiceApiTests(TestCase):
    def setUp(self):
        Service.objects.create(
            slug="pest-control",
            name="Dorilash",
            icon="science",
            sort_order=1,
            is_active=True,
        )

    def test_list_services(self):
        response = self.client.get("/api/v1/services/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["results"])

    @override_settings(DEBUG=True)
    def test_list_services_bounded_queries(self):
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/v1/services/")
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(ctx), 4, [q["sql"] for q in ctx.captured_queries])
