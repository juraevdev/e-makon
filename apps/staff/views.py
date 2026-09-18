from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.core.responses import success_response
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.staff.commission import suggest_commission_rate, subscription_fee_usd
from apps.staff.models import (
    AdminProfile,
    EmployeeProfile,
    FirmFine,
    FirmMessage,
    FirmModerationLog,
    FirmReview,
    Investor,
    PartnerFirm,
)
from apps.staff.serializers import (
    AdminUserSerializer,
    EmployeeSerializer,
    FirmFineSerializer,
    FirmMessageSerializer,
    FirmModerationLogSerializer,
    FirmReviewSerializer,
    InvestorSerializer,
    PartnerFirmSerializer,
    log_moderation,
)


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.select_related("user", "firm").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("user__full_name", "user__phone", "firm__name")
    filterset_fields = ("specialty", "is_active", "firm")


class PartnerFirmViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerFirmSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("name", "legal_name", "phone", "region", "address")
    filterset_fields = ("status", "specialty", "is_active", "region", "subscription_plan")

    def get_queryset(self):
        return PartnerFirm.objects.annotate(
            orders_count=Count("orders"),
            revenue_sum=Sum(
                "orders__quoted_price",
                filter=Q(orders__status=Order.Status.COMPLETED),
            ),
        ).all()

    def perform_update(self, serializer):
        old_rate = serializer.instance.commission_rate
        firm = serializer.save()
        if firm.commission_rate != old_rate and firm.commission_rate > old_rate:
            log_moderation(
                firm,
                FirmModerationLog.Action.RATE_HIKE,
                user=self.request.user,
                note=f"Ulush {old_rate}% → {firm.commission_rate}%",
                meta={"from": str(old_rate), "to": str(firm.commission_rate)},
            )
            from apps.finance.services import EscrowService

            EscrowService.record_rate_hike(
                firm,
                old_rate=old_rate,
                new_rate=firm.commission_rate,
                actor=self.request.user,
            )

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        firm = self.get_object()
        completed = Order.objects.filter(firm=firm, status=Order.Status.COMPLETED)
        revenue = completed.aggregate(total=Sum("quoted_price"))["total"] or 0
        share = completed.aggregate(total=Sum("platform_share"))["total"] or 0
        unpaid_fines = (
            firm.fines.filter(is_paid=False).aggregate(total=Sum("amount"))["total"] or 0
        )
        by_service = list(
            Order.objects.filter(firm=firm)
            .values("service_id", "service__name", "service__icon")
            .annotate(orders=Count("id"), revenue=Sum("quoted_price"))
            .order_by("-orders")
        )
        recent = (
            Order.objects.filter(firm=firm)
            .select_related("customer", "service", "firm")
            .order_by("-created_at")[:20]
        )
        reviews = firm.reviews.select_related("customer").order_by("-created_at")[:30]
        messages = firm.messages.select_related("sender").order_by("-created_at")[:30]
        fines = firm.fines.select_related("created_by").order_by("-created_at")[:30]
        logs = firm.moderation_logs.select_related("created_by").order_by("-created_at")[:40]
        suggested = suggest_commission_rate(revenue)
        fee = subscription_fee_usd(firm.subscription_plan, firm.subscription_units)
        # Firma daromadi = aylanma; kampaniya daromadi = ulush; qarz = debt + unpaid fines
        debt_total = Decimal(str(firm.debt_amount or 0)) + Decimal(str(unpaid_fines))
        neighbors = list(PartnerFirm.objects.order_by("name", "id").values_list("id", flat=True))
        prev_id = next_id = None
        if firm.id in neighbors:
            idx = neighbors.index(firm.id)
            if idx > 0:
                prev_id = neighbors[idx - 1]
            if idx < len(neighbors) - 1:
                next_id = neighbors[idx + 1]
        return success_response(
            {
                "firm": PartnerFirmSerializer(firm, context={"request": request}).data,
                "revenue": str(revenue),
                "platform_share": str(share),
                "debt_total": str(debt_total),
                "unpaid_fines": str(unpaid_fines),
                "subscription_fee_usd": str(fee),
                "suggested_rate": str(suggested),
                "orders_total": Order.objects.filter(firm=firm).count(),
                "orders_completed": completed.count(),
                "prev_id": prev_id,
                "next_id": next_id,
                "by_service": [
                    {
                        "id": row["service_id"],
                        "name": row["service__name"],
                        "icon": row["service__icon"] or "eco",
                        "orders": row["orders"],
                        "revenue": str(row["revenue"] or 0),
                    }
                    for row in by_service
                ],
                "recent_orders": OrderSerializer(
                    recent, many=True, context={"request": request}
                ).data,
                "reviews": FirmReviewSerializer(reviews, many=True).data,
                "messages": FirmMessageSerializer(messages, many=True).data,
                "fines": FirmFineSerializer(fines, many=True).data,
                "moderation_logs": FirmModerationLogSerializer(logs, many=True).data,
            }
        )

    @action(detail=True, methods=["post"])
    def apply_suggested_rate(self, request, pk=None):
        firm = self.get_object()
        revenue = (
            Order.objects.filter(firm=firm, status=Order.Status.COMPLETED).aggregate(
                total=Sum("quoted_price")
            )["total"]
            or 0
        )
        firm.commission_rate = suggest_commission_rate(revenue)
        firm.save(update_fields=["commission_rate", "updated_at"])
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Ulush avtomatik yangilandi",
        )

    @action(detail=True, methods=["post"])
    def end_agreement(self, request, pk=None):
        firm = self.get_object()
        reason = (request.data.get("exit_reason") or "").strip()
        firm.status = PartnerFirm.Status.ENDED
        firm.is_active = False
        firm.exit_reason = reason
        firm.ended_at = timezone.now()
        firm.save(
            update_fields=["status", "is_active", "exit_reason", "ended_at", "updated_at"]
        )
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Kelishuv yakunlandi",
        )

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        firm = self.get_object()
        reason = (request.data.get("exit_reason") or request.data.get("reason") or "").strip()
        firm.status = PartnerFirm.Status.SUSPENDED
        firm.is_active = False
        if reason:
            firm.exit_reason = reason
        firm.save(update_fields=["status", "is_active", "exit_reason", "updated_at"])
        log_moderation(
            firm,
            FirmModerationLog.Action.BLOCK,
            user=request.user,
            note=reason or "Bloklandi",
        )
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Firma bloklandi",
        )

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        firm = self.get_object()
        firm.status = PartnerFirm.Status.ACTIVE
        firm.is_active = True
        firm.exit_reason = ""
        firm.save(update_fields=["status", "is_active", "exit_reason", "updated_at"])
        log_moderation(
            firm, FirmModerationLog.Action.UNBLOCK, user=request.user, note="Blokdan chiqarildi"
        )
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Firma faollashtirildi",
        )

    @action(detail=True, methods=["post"])
    def set_trial(self, request, pk=None):
        firm = self.get_object()
        days = request.data.get("days")
        trial_ends_at = request.data.get("trial_ends_at")
        if trial_ends_at:
            firm.trial_ends_at = trial_ends_at
        elif days is not None:
            try:
                n = int(days)
            except (TypeError, ValueError) as exc:
                raise AppError("Noto'g'ri kunlar soni.") from exc
            if n <= 0:
                firm.trial_ends_at = None
            else:
                firm.trial_ends_at = timezone.now() + timezone.timedelta(days=n)
        else:
            firm.trial_ends_at = None
        firm.save(update_fields=["trial_ends_at", "updated_at"])
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Sinov muddati yangilandi",
        )

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        firm = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            raise AppError("Xabar matni majburiy.")
        kind = request.data.get("kind") or FirmMessage.Kind.MESSAGE
        if kind not in {c.value for c in FirmMessage.Kind}:
            kind = FirmMessage.Kind.MESSAGE
        subject = (request.data.get("subject") or "").strip()
        msg = FirmMessage.objects.create(
            firm=firm,
            sender=request.user,
            kind=kind,
            subject=subject,
            body=body,
        )
        action_map = {
            FirmMessage.Kind.WARNING: FirmModerationLog.Action.WARNING,
            FirmMessage.Kind.MESSAGE: FirmModerationLog.Action.MESSAGE,
            FirmMessage.Kind.REPORT: FirmModerationLog.Action.MESSAGE,
        }
        if kind == FirmMessage.Kind.WARNING:
            firm.warnings_count = (firm.warnings_count or 0) + 1
            firm.save(update_fields=["warnings_count", "updated_at"])
        log_moderation(
            firm,
            action_map.get(kind, FirmModerationLog.Action.MESSAGE),
            user=request.user,
            note=subject or body[:200],
            meta={"message_id": msg.id, "kind": kind},
        )
        return success_response(
            FirmMessageSerializer(msg).data,
            message="Xabar yuborildi",
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def add_fine(self, request, pk=None):
        firm = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount") or "0"))
        except Exception as exc:  # noqa: BLE001
            raise AppError("Jarima summasi noto'g'ri.") from exc
        if amount <= 0:
            raise AppError("Jarima 0 dan katta bo'lishi kerak.")
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            raise AppError("Jarima sababi majburiy.")
        # Hisobot / ogohlantirishdan keyin beriladi
        if firm.warnings_count < 1 and not firm.messages.filter(
            kind__in=[FirmMessage.Kind.WARNING, FirmMessage.Kind.REPORT]
        ).exists():
            raise AppError(
                "Avval hisobot yoki ogohlantirish yuboring, keyin jarima belgilang."
            )
        fine = FirmFine.objects.create(
            firm=firm,
            amount=amount,
            currency=request.data.get("currency") or "UZS",
            reason=reason,
            created_by=request.user,
        )
        log_moderation(
            firm,
            FirmModerationLog.Action.FINE,
            user=request.user,
            note=reason,
            meta={"fine_id": fine.id, "amount": str(amount)},
        )
        from apps.finance.services import EscrowService

        EscrowService.record_fine(
            firm,
            amount=amount,
            reason=reason,
            actor=request.user,
            fine_id=fine.id,
        )
        return success_response(
            FirmFineSerializer(fine).data,
            message="Jarima belgilandi",
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def ban_sales(self, request, pk=None):
        firm = self.get_object()
        try:
            days = int(request.data.get("days") or 7)
        except (TypeError, ValueError) as exc:
            raise AppError("Kunlar soni noto'g'ri.") from exc
        if days < 1:
            raise AppError("Kamida 1 kun.")
        reason = (request.data.get("reason") or "").strip()
        # Faqat ogohlantirish / hisobotdan keyin
        if firm.warnings_count < 1 and not firm.messages.filter(
            kind__in=[FirmMessage.Kind.WARNING, FirmMessage.Kind.REPORT]
        ).exists():
            raise AppError(
                "Savdo taqiqi faqat ogohlantirish yoki hisobotdan keyin beriladi."
            )
        firm.sales_banned_until = timezone.now() + timezone.timedelta(days=days)
        firm.save(update_fields=["sales_banned_until", "updated_at"])
        log_moderation(
            firm,
            FirmModerationLog.Action.SALES_BAN,
            user=request.user,
            note=reason or f"{days} kunlik savdo taqiqi",
            meta={"days": days, "until": firm.sales_banned_until.isoformat()},
        )
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message=f"Savdo {days} kunga taqiqlandi",
        )

    @action(detail=True, methods=["post"])
    def lift_sales_ban(self, request, pk=None):
        firm = self.get_object()
        firm.sales_banned_until = None
        firm.save(update_fields=["sales_banned_until", "updated_at"])
        log_moderation(
            firm,
            FirmModerationLog.Action.SALES_UNBAN,
            user=request.user,
            note="Savdo taqiqi olib tashlandi",
        )
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Savdo ochildi",
        )

    @action(detail=True, methods=["post"])
    def adjust_debt(self, request, pk=None):
        firm = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount") or "0"))
        except Exception as exc:  # noqa: BLE001
            raise AppError("Summa noto'g'ri.") from exc
        firm.debt_amount = amount
        if request.data.get("currency"):
            firm.debt_currency = str(request.data["currency"])[:8]
        firm.save(update_fields=["debt_amount", "debt_currency", "updated_at"])
        return success_response(
            PartnerFirmSerializer(firm, context={"request": request}).data,
            message="Qarz yangilandi",
        )

    @action(detail=True, methods=["get"])
    def reviews(self, request, pk=None):
        firm = self.get_object()
        qs = firm.reviews.select_related("customer").order_by("-created_at")
        return success_response(FirmReviewSerializer(qs, many=True).data)


class InvestorViewSet(viewsets.ModelViewSet):
    queryset = Investor.objects.all()
    serializer_class = InvestorSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("full_name", "company_name", "phone", "email")
    filterset_fields = ("status", "is_active")

    @action(detail=True, methods=["post"])
    def end_agreement(self, request, pk=None):
        inv = self.get_object()
        reason = (request.data.get("exit_reason") or "").strip()
        inv.status = Investor.Status.ENDED
        inv.is_active = False
        inv.exit_reason = reason
        inv.ended_at = timezone.now()
        inv.save(
            update_fields=["status", "is_active", "exit_reason", "ended_at", "updated_at"]
        )
        return success_response(
            InvestorSerializer(inv).data, message="Investor kelishuvi yakunlandi"
        )


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.select_related("user").all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("is_active",)
