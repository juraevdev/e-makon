from __future__ import annotations

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsCustomer
from apps.core.responses import success_response
from apps.orders.models import Order
from apps.orders.serializers import (
    OrderCreateSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
)
from apps.orders.services import OrderService
from apps.staff.models import FirmReview, PartnerFirm


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
        serializer = OrderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            order = serializer.save()
        except Exception as exc:  # noqa: BLE001
            raise AppError(str(exc)) from exc
        return success_response(
            OrderSerializer(order, context={"request": request}).data,
            message="Buyurtma yaratildi",
            status=status.HTTP_201_CREATED,
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
        return success_response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def rate(self, request, pk=None):
        """Bajarilgan buyurtma firmasini baholash — firma reytingi yangilanadi."""
        order = self.get_object()
        if order.status != Order.Status.COMPLETED:
            raise AppError("Faqat bajarilgan buyurtmani baholash mumkin.")
        if not order.firm_id:
            raise AppError("Buyurtmaga firma biriktirilmagan.")
        try:
            score = int(request.data.get("score") or 0)
        except (TypeError, ValueError) as exc:
            raise AppError("Baho 1–5 oralig'ida bo'lishi kerak.") from exc
        if score < 1 or score > 5:
            raise AppError("Baho 1–5 oralig'ida bo'lishi kerak.")
        comment = (request.data.get("comment") or "").strip()
        review, created = FirmReview.objects.update_or_create(
            firm_id=order.firm_id,
            customer=request.user,
            order=order,
            defaults={"score": score, "comment": comment},
        )
        order.firm.recalculate_rating()
        from apps.staff.serializers import FirmReviewSerializer

        return success_response(
            FirmReviewSerializer(review).data,
            message="Baho saqlandi" if not created else "Rahmat! Baho qabul qilindi",
        )


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = (
        Order.objects.select_related("service", "customer", "assigned_worker", "firm", "escrow")
        .prefetch_related("media", "status_history")
        .all()
    )
    filterset_fields = ("status", "service", "firm")
    search_fields = (
        "customer__phone",
        "customer__full_name",
        "phone_number",
        "address",
        "firm_name",
        "firm__name",
    )
    ordering_fields = ("created_at", "quoted_price")

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "assigned_worker_id" in data and data["assigned_worker_id"]:
            worker = User.objects.filter(
                pk=data["assigned_worker_id"], role=User.Role.WORKER
            ).first()
            if worker is None:
                raise AppError("Xodim topilmadi.")
            order.assigned_worker = worker
            order.assigned_worker_name = worker.full_name
        if "firm_id" in data:
            firm_id = data["firm_id"]
            if firm_id:
                firm = PartnerFirm.objects.filter(pk=firm_id).first()
                if firm is None:
                    raise AppError("Firma topilmadi.")
                order.firm = firm
                order.firm_name = firm.name
            else:
                order.firm = None
                order.firm_name = ""
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
        return success_response(OrderSerializer(order, context={"request": request}).data)
