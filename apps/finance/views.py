from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response
from apps.finance.models import LedgerEntry, OrderEscrow
from apps.finance.serializers import LedgerEntrySerializer, OrderEscrowSerializer
from apps.finance.services import EscrowService
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.staff.models import PartnerFirm


class OrderEscrowViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderEscrowSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("status",)
    search_fields = ("order__id", "order__firm_name", "note")

    def get_queryset(self):
        return OrderEscrow.objects.select_related("order", "order__firm", "order__customer").all()

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        held = qs.filter(status=OrderEscrow.Status.HELD).aggregate(t=Sum("amount"))["t"] or 0
        released = qs.filter(status=OrderEscrow.Status.RELEASED).aggregate(t=Sum("firm_payout"))["t"] or 0
        refunded = qs.filter(status=OrderEscrow.Status.REFUNDED).aggregate(t=Sum("amount"))["t"] or 0
        fees = qs.filter(status=OrderEscrow.Status.RELEASED).aggregate(t=Sum("platform_fee"))["t"] or 0
        return success_response(
            {
                "held_total": str(held),
                "released_to_firms": str(released),
                "refunded_to_users": str(refunded),
                "platform_fees": str(fees),
                "counts": {
                    s.value: qs.filter(status=s.value).count() for s in OrderEscrow.Status
                },
            }
        )


class LedgerEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LedgerEntrySerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("entry_type", "firm", "order", "user")
    search_fields = ("note",)

    def get_queryset(self):
        return LedgerEntry.objects.select_related("firm", "order", "user").all()


class OrderFinanceActionView(APIView):
    """Buyurtma escrow harakatlari."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, order_id: int, action_name: str):
        order = (
            Order.objects.select_related("firm", "customer", "escrow")
            .filter(pk=order_id)
            .first()
        )
        if order is None:
            raise AppError("Buyurtma topilmadi.")

        actor = request.user
        note = (request.data.get("note") or request.data.get("reason") or "").strip()

        if action_name == "ensure":
            escrow = EscrowService.ensure_escrow(order, actor=actor)
        elif action_name == "mark_paid":
            escrow = EscrowService.mark_user_paid(order, actor=actor, note=note)
        elif action_name == "release":
            if order.status != Order.Status.COMPLETED:
                # allow admin force-complete? No — require completed
                raise AppError("Avval buyurtmani 'Bajarildi' holatiga o'tkazing.")
            escrow = EscrowService.release_to_firm(order, actor=actor, note=note)
        elif action_name == "refund":
            punish = bool(request.data.get("punish_firm"))
            escrow = EscrowService.refund_to_user(
                order, actor=actor, note=note, punish_firm=punish
            )
        elif action_name == "dispute":
            escrow = EscrowService.open_dispute(order, actor=actor, reason=note)
        elif action_name == "punish_firm":
            if not order.firm_id:
                raise AppError("Firma biriktirilmagan.")
            fine = request.data.get("fine_amount")
            ban_days = int(request.data.get("sales_ban_days") or 0)
            # Agar escrow held — avtomatik userga qaytarish (ishsiz pul)
            auto_refund = request.data.get("refund", True)
            if (
                auto_refund
                and hasattr(order, "escrow")
                and order.escrow
                and order.escrow.status
                in {
                    OrderEscrow.Status.HELD,
                    OrderEscrow.Status.DISPUTED,
                    OrderEscrow.Status.FROZEN,
                }
            ):
                EscrowService.refund_to_user(
                    order,
                    actor=actor,
                    note=note or "Firma jazolandi — pul userga qaytarildi",
                    punish_firm=False,
                )
            EscrowService.punish_firm(
                order.firm,
                actor=actor,
                reason=note,
                order=order,
                fine_amount=Decimal(str(fine)) if fine not in (None, "") else None,
                sales_ban_days=ban_days,
            )
            order.refresh_from_db()
            escrow = getattr(order, "escrow", None)
            return success_response(
                {
                    "order": OrderSerializer(order, context={"request": request}).data,
                    "escrow": OrderEscrowSerializer(escrow).data if escrow else None,
                },
                message="Firma jazolandi",
            )
        elif action_name == "punish_user":
            block = bool(request.data.get("block"))
            EscrowService.punish_user(
                order.customer,
                actor=actor,
                reason=note,
                order=order,
                block=block,
            )
            # Agar firma ishni qilgan bo'lsa — holdan release mumkin
            if (
                request.data.get("release_to_firm")
                and order.status == Order.Status.COMPLETED
                and hasattr(order, "escrow")
                and order.escrow
                and order.escrow.status == OrderEscrow.Status.HELD
            ):
                EscrowService.release_to_firm(
                    order, actor=actor, note="User jazolandi — firmaga to'lov"
                )
            order.refresh_from_db()
            escrow = getattr(order, "escrow", None)
            return success_response(
                {
                    "order": OrderSerializer(order, context={"request": request}).data,
                    "escrow": OrderEscrowSerializer(escrow).data if escrow else None,
                },
                message="Foydalanuvchi jazolandi",
            )
        else:
            raise AppError("Noma'lum amal.")

        order.refresh_from_db()
        return success_response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "escrow": OrderEscrowSerializer(escrow).data,
            },
            message="OK",
            status=status.HTTP_200_OK,
        )


class FirmLedgerSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, firm_id: int):
        firm = PartnerFirm.objects.filter(pk=firm_id).first()
        if firm is None:
            raise AppError("Firma topilmadi.")
        entries = LedgerEntry.objects.filter(firm=firm).order_by("-created_at")[:50]
        escrows = OrderEscrow.objects.filter(order__firm=firm).select_related("order")
        held = escrows.filter(status=OrderEscrow.Status.HELD).aggregate(t=Sum("amount"))["t"] or 0
        paid_out = (
            escrows.filter(status=OrderEscrow.Status.RELEASED).aggregate(t=Sum("firm_payout"))["t"]
            or 0
        )
        fees = (
            escrows.filter(status=OrderEscrow.Status.RELEASED).aggregate(t=Sum("platform_fee"))["t"]
            or 0
        )
        refunded = (
            escrows.filter(status=OrderEscrow.Status.REFUNDED).aggregate(t=Sum("amount"))["t"] or 0
        )
        return success_response(
            {
                "held_in_escrow": str(held),
                "paid_to_firm": str(paid_out),
                "platform_fees": str(fees),
                "refunded": str(refunded),
                "debt": str(firm.debt_amount),
                "ledger": LedgerEntrySerializer(entries, many=True).data,
                "escrows": OrderEscrowSerializer(escrows.order_by("-created_at")[:30], many=True).data,
            }
        )
