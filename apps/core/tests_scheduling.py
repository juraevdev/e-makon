from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.care.models import CareContract, CareVisit
from apps.catalog.models import Service
from apps.core.parsing import parse_int
from apps.core.scheduling import expire_firm_trials, remind_care_visits
from apps.core.uploads import sniff_order_media
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction
from apps.loyalty.services import LoyaltyService
from apps.orders.schedule import parse_work_hours, work_window
from apps.organizations.models import Organization
from django.core.files.uploadedfile import SimpleUploadedFile


class ParseHelpersTests(TestCase):
    def test_parse_int_rejects_garbage(self):
        from apps.core.exceptions import AppError

        with self.assertRaises(AppError):
            parse_int("abc", field="Kunlar")
        self.assertEqual(parse_int("3", minimum=1, maximum=10), 3)

    def test_work_hours_parsing(self):
        self.assertEqual(parse_work_hours("09:00 – 18:00"), (9 * 60, 18 * 60))
        self.assertEqual(parse_work_hours("8:00-20:00"), (8 * 60, 20 * 60))
        self.assertEqual(parse_work_hours(""), (8 * 60, 20 * 60))

    def test_work_window_uses_firm_hours(self):
        firm = Organization.objects.create(
            name="Soat", slug="soat-firm", work_hours="10:00 – 16:00"
        )
        self.assertEqual(work_window(firm.pk), (10 * 60, 16 * 60))

    def test_media_magic_rejects_disguised_exe(self):
        fake = SimpleUploadedFile("photo.jpg", b"MZ\x90\x00", content_type="image/jpeg")
        self.assertIsNotNone(sniff_order_media(fake))
        ok = SimpleUploadedFile("photo.jpg", b"\xff\xd8\xff\xe0", content_type="image/jpeg")
        self.assertIsNone(sniff_order_media(ok))


class LoyaltyExpireAndRedeemTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone="+998901111001", role=User.Role.CUSTOMER)
        self.user.loyalty_points = 200
        self.user.save(update_fields=["loyalty_points"])
        LoyaltySettings.load()
        self.reward = LoyaltyReward.objects.create(name="Chegirma", points_cost=50)

    def test_redeem_creates_pending_fulfillment(self):
        tx = LoyaltyService.redeem(self.user, self.reward.pk)
        self.user.refresh_from_db()
        self.assertEqual(self.user.loyalty_points, 150)
        self.assertEqual(tx.redemption_status, PointTransaction.RedemptionStatus.PENDING)
        self.assertEqual(tx.reward_id, self.reward.pk)
        fulfilled = LoyaltyService.fulfill_redemption(tx)
        self.assertEqual(fulfilled.redemption_status, PointTransaction.RedemptionStatus.FULFILLED)

    def test_expire_stale_points_fifo(self):
        settings = LoyaltySettings.load()
        settings.expire_months = 1
        settings.save()
        old = timezone.now() - timedelta(days=60)
        PointTransaction.objects.create(
            user=self.user,
            kind=PointTransaction.Kind.EARN,
            points=200,
            created_at=old,
        )
        # Force created_at (auto_now_add may ignore on create in some versions)
        PointTransaction.objects.filter(user=self.user).update(created_at=old)
        result = LoyaltyService.expire_stale_points()
        self.user.refresh_from_db()
        self.assertEqual(result["points"], 200)
        self.assertEqual(self.user.loyalty_points, 0)
        self.assertTrue(
            PointTransaction.objects.filter(
                user=self.user, kind=PointTransaction.Kind.EXPIRE
            ).exists()
        )


class TrialAndCareScheduleTests(TestCase):
    def test_trial_expiry_suspends_firm(self):
        firm = Organization.objects.create(
            name="Trial",
            slug="trial-firm",
            status=Organization.Status.PENDING,
            trial_ends_at=timezone.now() - timedelta(hours=1),
        )
        result = expire_firm_trials()
        firm.refresh_from_db()
        self.assertEqual(result["firms"], 1)
        self.assertEqual(firm.status, Organization.Status.SUSPENDED)

    def test_care_reminder_marks_visit(self):
        org = Organization.objects.create(name="CareOrg", slug="care-org")
        customer = User.objects.create_user(phone="+998901111002", role=User.Role.CUSTOMER)
        service = Service.objects.create(name="Parvarish", slug="care-svc", organization=org)
        tomorrow = timezone.localdate() + timedelta(days=1)
        contract = CareContract.objects.create(
            customer=customer,
            organization=org,
            service=service,
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timedelta(days=90),
            status=CareContract.Status.ACTIVE,
            total_amount=Decimal("0"),
        )
        visit = CareVisit.objects.create(contract=contract, visit_date=tomorrow)
        result = remind_care_visits(days_ahead=1)
        visit.refresh_from_db()
        self.assertEqual(result["customers"], 1)
        self.assertEqual(visit.status, CareVisit.Status.REMINDED)
