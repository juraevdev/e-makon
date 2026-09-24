from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response
from apps.orders.models import Order
from apps.organizations.models import Organization, Investor
from apps.organizations.serializers import (
    FirmFineSerializer,
    FirmMessageSerializer,
    FirmModerationLogSerializer,
    FirmReviewSerializer,
    InvestorSerializer,
    PartnerFirmSerializer,
)
from apps.organizations.services import FirmService, InvestorService, firm_revenue_totals


class FirmViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerFirmSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]
    search_fields = ("name", "legal_name", "phone", "email", "region", "district")
    filterset_fields = ("status", "specialty", "subscription_plan")
    ordering_fields = ("name", "created_at", "rating", "commission_rate")
    ordering = ("name", "id")

    def get_queryset(self):
        qs = Organization.objects.select_related("owner").annotate(
            orders_count_anno=Count("orders"),
        ).order_by("name", "id")
        user = self.request.user
        if getattr(user, "role", None) == User.Role.SUPERADMIN:
            return qs
        org_id = getattr(user, "organization_id", None)
        if org_id:
            return qs.filter(pk=org_id)
        return qs.none()

    def _firm_payload(self, firm: Organization):
        firm = self.get_queryset().filter(pk=firm.pk).first() or firm
        return PartnerFirmSerializer(firm, context=self.get_serializer_context()).data

    @action(detail=True, methods=["post"])
    def set_trial(self, request, pk=None):
        firm = self.get_object()
        days = int(request.data.get("days") or 0)
        FirmService.set_trial(firm, days, actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def apply_suggested_rate(self, request, pk=None):
        firm = self.get_object()
        FirmService.apply_suggested_rate(firm, actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def adjust_debt(self, request, pk=None):
        firm = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except Exception as exc:  # noqa: BLE001
            raise AppError("Noto'g'ri summa.") from exc
        FirmService.adjust_debt(firm, amount, actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        firm = self.get_object()
        FirmService.block(firm, reason=request.data.get("reason") or "", actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        firm = self.get_object()
        FirmService.unblock(firm, actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def end_agreement(self, request, pk=None):
        firm = self.get_object()
        FirmService.end_agreement(
            firm,
            exit_reason=request.data.get("exit_reason") or "",
            actor=request.user,
        )
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        firm = self.get_object()
        FirmService.send_message(
            firm,
            kind=request.data.get("kind") or "message",
            subject=request.data.get("subject") or "",
            body=request.data.get("body") or "",
            actor=request.user,
        )
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def add_fine(self, request, pk=None):
        firm = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except Exception as exc:  # noqa: BLE001
            raise AppError("Noto'g'ri summa.") from exc
        if amount <= 0:
            raise AppError("Jarima summasi musbat bo'lishi kerak.")
        FirmService.add_fine(
            firm,
            amount,
            reason=request.data.get("reason") or "",
            actor=request.user,
        )
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def ban_sales(self, request, pk=None):
        firm = self.get_object()
        days = int(request.data.get("days") or 7)
        FirmService.ban_sales(
            firm,
            days,
            reason=request.data.get("reason") or "",
            actor=request.user,
        )
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["post"])
    def lift_sales_ban(self, request, pk=None):
        firm = self.get_object()
        FirmService.lift_sales_ban(firm, actor=request.user)
        return success_response(self._firm_payload(firm))

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        firm = self.get_object()
        from apps.orders.serializers import OrderSerializer

        completed = firm.orders.filter(status=Order.Status.COMPLETED)
        revenue, platform = firm_revenue_totals(firm)
        firm_data = PartnerFirmSerializer(firm, context=self.get_serializer_context()).data

        by_service = (
            firm.orders.values("service_id", "service__name", "service__icon")
            .annotate(
                orders=Count("id"),
                revenue=Sum("quoted_price"),
            )
            .order_by("-orders")[:20]
        )
        qs = self.get_queryset().order_by("id")
        ids = list(qs.values_list("id", flat=True))
        try:
            idx = ids.index(firm.pk)
        except ValueError:
            idx = -1
        prev_id = ids[idx - 1] if idx > 0 else None
        next_id = ids[idx + 1] if 0 <= idx < len(ids) - 1 else None

        recent = (
            firm.orders.select_related("service", "customer", "assigned_worker", "organization")
            .prefetch_related("media", "status_history", "escrow")
            .order_by("-created_at")[:10]
        )
        data = {
            "firm": firm_data,
            "revenue": str(revenue),
            "platform_share": str(platform),
            "debt_total": str(firm.debt_amount or 0),
            "unpaid_fines": str(firm.unpaid_fines or 0),
            "subscription_fee_usd": firm_data["subscription_fee_usd"],
            "suggested_rate": firm_data["suggested_rate"],
            "orders_total": firm.orders.count(),
            "orders_completed": completed.count(),
            "prev_id": prev_id,
            "next_id": next_id,
            "by_service": [
                {
                    "id": row["service_id"],
                    "name": row["service__name"] or "",
                    "icon": row["service__icon"] or "",
                    "orders": row["orders"],
                    "revenue": str(row["revenue"] or 0),
                }
                for row in by_service
            ],
            "recent_orders": OrderSerializer(
                recent, many=True, context=self.get_serializer_context()
            ).data,
            "reviews": FirmReviewSerializer(
                firm.reviews.select_related("customer").all()[:50], many=True
            ).data,
            "messages": FirmMessageSerializer(
                firm.messages.select_related("sender").all()[:50], many=True
            ).data,
            "fines": FirmFineSerializer(firm.fines.all()[:50], many=True).data,
            "moderation_logs": FirmModerationLogSerializer(
                firm.moderation_logs.select_related("created_by").all()[:50], many=True
            ).data,
        }
        return success_response(data)

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        firm = self.get_object()
        from apps.orders.models import LedgerEntry, OrderEscrow
        from apps.orders.serializers import LedgerEntrySerializer, OrderEscrowSerializer

        escrows = OrderEscrow.objects.filter(order__organization=firm).select_related("order")
        ledger = LedgerEntry.objects.filter(firm=firm).order_by("-created_at")[:100]

        held = escrows.filter(status=OrderEscrow.Status.HELD).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        paid = escrows.filter(status=OrderEscrow.Status.RELEASED).aggregate(
            total=Sum("firm_payout")
        )["total"] or Decimal("0")
        fees = escrows.filter(status=OrderEscrow.Status.RELEASED).aggregate(
            total=Sum("platform_fee")
        )["total"] or Decimal("0")
        refunded = escrows.filter(status=OrderEscrow.Status.REFUNDED).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")

        data = {
            "held_in_escrow": str(held),
            "paid_to_firm": str(paid),
            "platform_fees": str(fees),
            "refunded": str(refunded),
            "debt": str(firm.debt_amount or 0),
            "ledger": LedgerEntrySerializer(ledger, many=True).data,
            "escrows": OrderEscrowSerializer(escrows.order_by("-created_at")[:50], many=True).data,
        }
        return success_response(data)


class InvestorViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Investor.objects.all()
    serializer_class = InvestorSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    search_fields = ("full_name", "company_name", "phone", "email")
    filterset_fields = ("status", "is_active")

    @action(detail=True, methods=["post"])
    def end_agreement(self, request, pk=None):
        investor = self.get_object()
        InvestorService.end_agreement(
            investor,
            exit_reason=request.data.get("exit_reason") or "",
        )
        return success_response(
            InvestorSerializer(investor, context=self.get_serializer_context()).data
        )
