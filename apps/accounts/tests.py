from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User


class OTPFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_otp_request_and_verify(self):
        req = self.client.post(
            "/api/v1/auth/otp/request/",
            {"phone": "901112233"},
            format="json",
        )
        self.assertEqual(req.status_code, 200)
        code = req.json()["data"]["debug_code"]

        verify = self.client.post(
            "/api/v1/auth/otp/verify/",
            {"phone": "901112233", "code": code, "full_name": "Aziz"},
            format="json",
        )
        self.assertEqual(verify.status_code, 200)
        body = verify.json()["data"]
        self.assertIn("access", body)
        self.assertTrue(User.objects.filter(phone="+998901112233").exists())
