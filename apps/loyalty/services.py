from __future__ import annotations

from django.db import transaction
from django.db.models import F

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction


class LoyaltyService:
    @staticmethod
    def points_for_amount(amount) -> int:
        rate = LoyaltySettings.load().uzs_per_point
        if not rate or not amount:
            return 0
        return int(amount) // rate

    @classmethod
    @transaction.atomic
    def award_for_order(cls, order) -> PointTransaction | None:
        """Bajarilgan buyurtma uchun ball — har buyurtmaga faqat bir marta."""
        if PointTransaction.objects.filter(order=order, kind=PointTransaction.Kind.EARN).exists():
            return None
        points = cls.points_for_amount(order.quoted_price)
        if points <= 0:
            return None
        User.objects.filter(pk=order.customer_id).update(loyalty_points=F("loyalty_points") + points)
        tx = PointTransaction.objects.create(
            user_id=order.customer_id,
            kind=PointTransaction.Kind.EARN,
            points=points,
            order=order,
            note=f"Buyurtma #{order.pk} bajarildi",
        )
        from apps.notifications.services import notify_user

        notify_user(
            order.customer,
            kind="bonus",
            title=f"+{points} ball hisobingizga tushdi",
            body=f"Buyurtma #{order.pk} uchun.",
            entity_type="order",
            entity_id=order.pk,
        )
        return tx

    @staticmethod
    @transaction.atomic
    def redeem(user: User, reward_id) -> PointTransaction:
        reward = LoyaltyReward.objects.filter(pk=reward_id, is_active=True).first()
        if reward is None:
            raise AppError("Mukofot topilmadi.", status_code=404)
        settings_obj = LoyaltySettings.load()
        locked = User.objects.select_for_update().get(pk=user.pk)
        if locked.loyalty_points < settings_obj.min_redeem_points:
            raise AppError(
                f"Almashtirish uchun kamida {settings_obj.min_redeem_points} ball kerak.",
                code="loyalty_min_points",
            )
        if locked.loyalty_points < reward.points_cost:
            raise AppError("Ballaringiz yetarli emas.", code="loyalty_insufficient")
        locked.loyalty_points -= reward.points_cost
        locked.save(update_fields=["loyalty_points"])
        return PointTransaction.objects.create(
            user=locked,
            kind=PointTransaction.Kind.REDEEM,
            points=-reward.points_cost,
            note=reward.name,
        )
