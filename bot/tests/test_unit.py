from __future__ import annotations

import os
import tempfile
import unittest

from bot.formatters import messages as msg
from bot.intake.config import get_intake_fields
from bot.services.domain import normalize_phone
from bot.storage.sessions import SessionStore


class NormalizePhoneTests(unittest.TestCase):
    def test_uz_local(self):
        self.assertEqual(normalize_phone("901234567"), "+998901234567")

    def test_plus(self):
        self.assertEqual(normalize_phone("+998901234567"), "+998901234567")


class IntakeConfigTests(unittest.TestCase):
    def test_lawn_care_has_area(self):
        fields = get_intake_fields("lawn-care")
        keys = [f.key for f in fields]
        self.assertIn("area_size", keys)
        self.assertIn("address", keys)

    def test_unknown_slug_default(self):
        fields = get_intake_fields("unknown-service-xyz")
        self.assertTrue(any(f.key == "address" for f in fields))


class SessionStoreTests(unittest.TestCase):
    def test_roundtrip_encrypted(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(fd)
        try:
            store = SessionStore(path=path, secret="unit-test-secret-key")
            store.save(
                telegram_id=42,
                user_id=7,
                refresh_token="refresh-secret",
                access_token="access-secret",
                phone="+998901112233",
            )
            session = store.get(42)
            self.assertIsNotNone(session)
            self.assertEqual(session.user_id, 7)
            self.assertEqual(session.refresh_token, "refresh-secret")
            self.assertEqual(session.access_token, "access-secret")
            store.delete(42)
            self.assertIsNone(store.get(42))
        finally:
            try:
                os.remove(path)
            except OSError:
                pass


class FormatterTests(unittest.TestCase):
    def test_status_labels(self):
        self.assertEqual(msg.status_label("new"), "Yangi")
        self.assertEqual(msg.status_label("in_review"), "Kelishilmoqda")

    def test_map_api_error(self):
        self.assertIn("Seans", msg.map_api_error(401))
        self.assertIn("ishlamayapti", msg.map_api_error(500))


class IntakeKeyboardTests(unittest.TestCase):
    def test_phone_has_contact_button(self):
        from bot.intake.config import IntakeField
        from bot.keyboards import common as kb

        field = IntakeField("phone", "Tel", field_type="phone")
        markup = kb.intake_keyboard(field, phone="+998901112233")
        texts = [btn.text for row in markup.keyboard for btn in row]
        self.assertIn(msg.BTN_SHARE_CONTACT, texts)
        self.assertIn(msg.BTN_CONFIRM_PHONE, texts)

    def test_location_has_request_location(self):
        from bot.intake.config import IntakeField
        from bot.keyboards import common as kb

        field = IntakeField("address", "Manzil", field_type="location")
        markup = kb.intake_keyboard(field, saved_address="Jizzax")
        self.assertTrue(markup.keyboard[0][0].request_location)
        texts = [btn.text for row in markup.keyboard for btn in row]
        self.assertIn(msg.BTN_USE_SAVED_ADDRESS, texts)

    def test_media_optional_has_skip(self):
        from bot.intake.config import IntakeField
        from bot.keyboards import common as kb

        field = IntakeField("media", "Foto", required=False, field_type="media")
        markup = kb.intake_keyboard(field)
        texts = [btn.text for row in markup.keyboard for btn in row]
        self.assertIn(msg.BTN_SKIP, texts)


class TokenRotationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(fd)
        self.store = SessionStore(path=self.path, secret="unit-test-secret-key")
        self.store.save(telegram_id=1, user_id=2, refresh_token="r-old", access_token="a-old")

    def tearDown(self):
        try:
            os.remove(self.path)
        except OSError:
            pass

    def _api(self, handler):
        import httpx

        from bot.api.client import EMakonAPIClient

        api = EMakonAPIClient()
        api._client = httpx.AsyncClient(
            base_url="http://api.test/api/v1", transport=httpx.MockTransport(handler)
        )
        return api

    async def test_rotated_refresh_token_is_persisted(self):
        import httpx

        from bot.services.domain import OrderFlowService

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/auth/token/refresh/"):
                return httpx.Response(200, json={"access": "a-new", "refresh": "r-new"})
            if request.headers.get("Authorization") == "Bearer a-new":
                return httpx.Response(200, json={"success": True, "message": "", "data": []})
            return httpx.Response(401, json={"detail": "expired"})

        api = self._api(handler)
        orders = OrderFlowService(api, self.store)
        self.assertEqual(await orders.list_orders(self.store.get(1)), [])
        session = self.store.get(1)
        self.assertEqual(session.access_token, "a-new")
        self.assertEqual(session.refresh_token, "r-new")
        await api.aclose()

    async def test_dead_refresh_token_drops_session(self):
        import httpx

        from bot.api.client import APIError
        from bot.services.domain import OrderFlowService

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"detail": "Token is blacklisted"})

        api = self._api(handler)
        orders = OrderFlowService(api, self.store)
        with self.assertRaises(APIError) as ctx:
            await orders.list_orders(self.store.get(1))
        self.assertEqual(ctx.exception.code, "session_expired")
        self.assertIsNone(self.store.get(1))
        await api.aclose()


class PaymentKeyboardTests(unittest.TestCase):
    def test_unpaid_order_offers_enabled_providers_only(self):
        from bot.keyboards import common as kb

        order = {
            "id": 9,
            "status": "new",
            "payment_status": "unpaid",
            "payment_options": {"click": True, "payme": False, "test": True},
        }
        data = [b.callback_data for row in kb.payment_rows(order) for b in row]
        self.assertEqual(data, ["order:pay:9:click", "order:testpay:9"])

    def test_paid_order_has_no_payment_buttons(self):
        from bot.keyboards import common as kb

        order = {"id": 9, "status": "new", "payment_status": "paid", "payment_options": {"click": True}}
        self.assertEqual(kb.payment_rows(order), [])


if __name__ == "__main__":
    unittest.main()
