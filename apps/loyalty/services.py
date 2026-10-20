from __future__ import annotations

from collections import deque
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.loyalty.models import LoyaltyReward, LoyaltySettings, PointTransaction
from apps.notifications.services import notify_user


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
        tx = PointTransaction.objects.create(
            user=locked,
            kind=PointTransaction.Kind.REDEEM,
            points=-reward.points_cost,
            reward=reward,
            redemption_status=PointTransaction.RedemptionStatus.PENDING,
            note=reward.name,
        )
        notify_user(
            locked,
            kind="bonus",
            title=f"Mukofot so'rovi: {reward.name}",
            body=(
                f"{reward.points_cost} ball ayirildi. "
                "Operator mukofotni tayyorlagach xabar beramiz."
            ),
            entity_type="loyalty_redeem",
            entity_id=tx.pk,
        )
        return tx

    @staticmethod
    @transaction.atomic
    def fulfill_redemption(tx: PointTransaction, *, actor=None, note: str = "") -> PointTransaction:
        locked = PointTransaction.objects.select_for_update().select_related("user", "reward").get(
            pk=tx.pk
        )
        if locked.kind != PointTransaction.Kind.REDEEM:
            raise AppError("Faqat almashtirish tranzaksiyasini bajarish mumkin.")
        if locked.redemption_status == PointTransaction.RedemptionStatus.FULFILLED:
            return locked
        if locked.redemption_status == PointTransaction.RedemptionStatus.CANCELLED:
            raise AppError("Bekor qilingan so'rovni bajarib bo'lmaydi.")
        locked.redemption_status = PointTransaction.RedemptionStatus.FULFILLED
        locked.fulfilled_at = timezone.now()
        if note:
            locked.note = f"{locked.note} · {note}".strip(" ·")
        locked.save(update_fields=["redemption_status", "fulfilled_at", "note", "updated_at"])
        reward_name = locked.reward.name if locked.reward_id else locked.note
        notify_user(
            locked.user,
            kind="bonus",
            title=f"Mukofot tayyor: {reward_name}",
            body=note or "Mukofotingiz berildi.",
            entity_type="loyalty_redeem",
            entity_id=locked.pk,
        )
        return locked

    @classmethod
    def expire_stale_points(cls) -> dict:
        """
        FIFO: eski (expire_months dan oshgan) ishlatilmagan ballarni yechadi.
        Cron: `manage.py run_scheduled_tasks`.
        """
        months = int(LoyaltySettings.load().expire_months or 0)
        if months <= 0:
            return {"users": 0, "points": 0}
        cutoff = timezone.now() - timedelta(days=months * 30)
        users = 0
        points_total = 0
        qs = User.objects.filter(loyalty_points__gt=0, role=User.Role.CUSTOMER).only("id")
        for user in qs.iterator():
            expired = cls._expire_user(user.pk, cutoff)
            if expired:
                users += 1
                points_total += expired
        return {"users": users, "points": points_total}

    @staticmethod
    @transaction.atomic
    def _expire_user(user_id: int, cutoff) -> int:
        locked = User.objects.select_for_update().get(pk=user_id)
        txs = list(
            PointTransaction.objects.filter(user_id=user_id).order_by("created_at", "id").only(
                "kind", "points", "created_at"
            )
        )
        lots: deque[list] = deque()
        for tx in txs:
            if tx.kind == PointTransaction.Kind.EARN or (
                tx.kind == PointTransaction.Kind.ADJUST and tx.points > 0
            ):
                lots.append([tx.points, tx.created_at])
                continue
            consume = -tx.points if tx.points < 0 else 0
            while consume > 0 and lots:
                lot_pts, _created = lots[0]
                take = min(lot_pts, consume)
                lots[0][0] -= take
                consume -= take
                if lots[0][0] <= 0:
                    lots.popleft()

        expired = sum(pts for pts, created in lots if created < cutoff and pts > 0)
        if expired <= 0:
            return 0
        expired = min(expired, locked.loyalty_points)
        if expired <= 0:
            return 0
        locked.loyalty_points -= expired
        locked.save(update_fields=["loyalty_points"])
        PointTransaction.objects.create(
            user=locked,
            kind=PointTransaction.Kind.EXPIRE,
            points=-expired,
            note=f"Ball muddati tugadi ({cutoff.date().isoformat()} gacha)",
        )
        notify_user(
            locked,
            kind="bonus",
            title=f"{expired} ball muddati tugadi",
            body="Ishlatilmagan ballaringiz muddati o'tgani uchun hisobdan yechildi.",
            entity_type="loyalty",
            entity_id=None,
        )
        return expired
