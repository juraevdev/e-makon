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
        return success_response(OrderSerializer(order, context={"request": request}).data)


class AdminOrderViewSet(OrganizationQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    queryset = (
        Order.objects.select_related("service", "customer", "assigned_worker")
        .prefetch_related("media", "status_history")
        .all()
    )
    filterset_fields = ("status", "service")
    search_fields = ("customer__phone", "customer__full_name", "phone_number", "address")
    ordering_fields = ("created_at", "quoted_price")

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "assigned_worker_id" in data and data["assigned_worker_id"]:
            worker_qs = User.objects.filter(pk=data["assigned_worker_id"], role=User.Role.WORKER)
            org_id = organization_id_for_queryset(request.user)
            if org_id is not None:
                worker_qs = worker_qs.filter(organization_id=org_id)
            worker = worker_qs.first()
            if worker is None:
                raise AppError("Xodim topilmadi.")
            order.assigned_worker = worker
            order.assigned_worker_name = worker.full_name
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
