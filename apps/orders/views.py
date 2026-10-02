from __future__ import annotations

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsCustomer, IsSuperAdmin
from apps.core.responses import success_response
from apps.orders.finance import FinanceService
from apps.orders.models import Order
from apps.orders.payments import PaymentService
from apps.orders.serializers import (
    OrderCreateSerializer,
    OrderEscrowSerializer,
    OrderPaymentSerializer,
    OrderSerializer,
    OrderStageSerializer,
    OrderStatusUpdateSerializer,
)
from apps.orders.services import OrderService
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import organization_id_for_queryset


class CustomerOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsCustomer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ("status",)
    ordering_fields = ("created_at",)

    def get_queryset(self):
        return (
            Order.objects.filter(customer=self.request.user)
            .select_related("service", "customer")
            .prefetch_related("media", "status_history")
        )

    def create(self, request, *args, **kwargs):
        idempotency_key = (
            request.headers.get("Idempotency-Key")
            or request.headers.get("X-Idempotency-Key")
            or ""
        ).strip() or None
        if idempotency_key and len(idempotency_key) > 64:
            raise AppError("Idempotency-Key juda uzun.")

        serializer = OrderCreateSerializer(
            data=request.data,
            context={"request": request, "idempotency_key": idempotency_key},
        )
        serializer.is_valid(raise_exception=True)
        try:
            result = serializer.save()
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise AppError(str(exc)) from exc

        if isinstance(result, tuple):
            order, created = result
        else:
            order, created = result, True

        return success_response(
            OrderSerializer(order, context={"request": request}).data,
            message="Buyurtma yaratildi" if created else "Buyurtma allaqachon mavjud",
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in {Order.Status.COMPLETED, Order.Status.CANCELLED}:
            raise AppError("Bu buyurtmani bekor qilib bo'lmaydi.")
        OrderService.transition(
            order,
            Order.Status.CANCELLED,
            actor=request.user,
            note="Mijoz bekor qildi",
        )
        order.refresh_from_db()
        return success_response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        order = self.get_object()
        payment = PaymentService.start(order, str(request.data.get("provider") or "").lower())
        order.refresh_from_db()
        return success_response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "payment": OrderPaymentSerializer(payment).data,
            },
            message="To'lov yaratildi",
        )

    @action(detail=True, methods=["post"], url_path="payment-sent")
    def payment_sent(self, request, pk=None):
        order = self.get_object()
        PaymentService.submit(order)
        order.refresh_from_db()
        return success_response(
            OrderSerializer(order, context={"request": request}).data,
            message="To'lov tekshirilmoqda",
        )

    @action(detail=True, methods=["post"], url_path="test-pay")
    def test_pay(self, request, pk=None):
        order = self.get_object()
        PaymentService.pay_test(order, actor=request.user)
        order.refresh_from_db()
        return success_response(
            OrderSerializer(order, context={"request": request}).data,
            message="Sinov to'lovi qabul qilindi — buyurtma firmaga yuborildi",
        )


class AdminOrderViewSet(OrganizationQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    queryset = (
        Order.objects.select_related(
            "service", "customer", "assigned_worker", "organization", "escrow"
        )
        .prefetch_related("media", "status_history")
        .all()
    )
    filterset_fields = ("status", "service", "work_stage", "organization", "assigned_worker", "customer")
    search_fields = (
        "customer__phone",
        "customer__full_name",
        "phone_number",
        "address",
        "service__name",
        "organization__name",
    )
    ordering_fields = ("created_at", "quoted_price", "scheduled_date")

    def get_permissions(self):
        if self.action == "finance":
            return [IsAuthenticated(), IsSuperAdmin()]
        return super().get_permissions()

    def _assign_worker(self, order: Order, worker_id: int) -> None:
        worker_qs = User.objects.filter(pk=worker_id, role=User.Role.WORKER)
        org_id = order.organization_id or organization_id_for_queryset(self.request.user)
        if org_id is not None:
            worker_qs = worker_qs.filter(organization_id=org_id)
        worker = worker_qs.first()
        if worker is None:
            raise AppError("Xodim topilmadi.")
        profile = getattr(worker, "employee_profile", None)
        if profile is not None and profile.employment_status == "dismissed":
            raise AppError("Ishdan bo'shagan xodimni biriktirib bo'lmaydi.")
        order.assigned_worker = worker
        order.assigned_worker_name = worker.full_name or worker.phone

    @action(detail=True, methods=["post"])
    def stage(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("assigned_worker_id"):
            self._assign_worker(order, data["assigned_worker_id"])
            order.save(update_fields=["assigned_worker", "assigned_worker_name", "updated_at"])
        OrderService.set_stage(
            order,
            data["stage"],
            actor=request.user,
            distance_km=data.get("distance_km"),
            eta_minutes=data.get("eta_minutes"),
            note=data.get("note") or "",
        )
        order.refresh_from_db()
        return success_response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        price = data.get("quoted_price")
        if (
            price is not None
            and order.quoted_price is not None
            and price != order.quoted_price
            and request.user.role != User.Role.SUPERADMIN
            and (
                order.status != Order.Status.NEW
                or PaymentService.status(order) not in {"not_required", "unpaid", "rejected"}
            )
        ):
            raise AppError(
                "To'lov boshlangandan keyin narxni faqat tizim ma'muriyati o'zgartira oladi.",
                code="order_price_locked",
            )
        if "assigned_worker_id" in data and data["assigned_worker_id"]:
            self._assign_worker(order, data["assigned_worker_id"])
        if data.get("quoted_price") is not None:
            order.quoted_price = data["quoted_price"]
        if data.get("agreed_duration"):
            order.agreed_duration = data["agreed_duration"]
        order.save()
        OrderService.transition(
            order,
            data["status"],
            actor=request.user,
            note=data.get("note") or "",
        )
        order.refresh_from_db()
        return success_response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path=r"finance/(?P<finance_action>[\w]+)")
    def finance(self, request, pk=None, finance_action=None):
        order = self.get_object()
        note = request.data.get("note") or ""
        actor = request.user
        action_name = (finance_action or "").strip().lower()

        if action_name == "ensure":
            escrow = FinanceService.ensure(order, note=note, actor=actor)
        elif action_name == "mark_paid":
            escrow = PaymentService.confirm(order, note=note, actor=actor)
        elif action_name == "reject_payment":
            PaymentService.reject(order, note=note, actor=actor)
            escrow = PaymentService.escrow_of(order)
        elif action_name == "release":
            escrow = FinanceService.release(order, note=note, actor=actor)
        elif action_name == "refund":
            escrow = FinanceService.refund(
                order,
                note=note,
                punish_firm=bool(request.data.get("punish_firm")),
                actor=actor,
            )
        elif action_name == "dispute":
            escrow = FinanceService.dispute(order, note=note, actor=actor)
        elif action_name == "punish_firm":
            escrow = FinanceService.punish_firm(
                order,
                note=note,
                refund=bool(request.data.get("refund")),
                fine_amount=request.data.get("fine_amount") or 100000,
                sales_ban_days=int(request.data.get("sales_ban_days") or 0),
                actor=actor,
            )
        elif action_name == "punish_user":
            escrow = FinanceService.punish_user(
                order,
                note=note,
                block=bool(request.data.get("block")),
                release_to_firm=bool(request.data.get("release_to_firm")),
                actor=actor,
            )
        else:
            raise AppError(f"Noma'lum finance amali: {finance_action}")

        order.refresh_from_db()
        return success_response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "escrow": OrderEscrowSerializer(escrow).data if escrow else None,
            }
        )
