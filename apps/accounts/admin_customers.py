from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.core.phone import normalize_phone
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import (
    get_or_create_default_organization,
    organization_id_for_queryset,
    resolve_organization_for_user,
)


class AdminCustomerCreateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    home_address = serializers.CharField(max_length=512, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        phone = normalize_phone(value)
        if len(phone) < 10:
            raise serializers.ValidationError("Telefon raqam noto'g'ri.")
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("Bu telefon allaqachon ro'yxatdan o'tgan.")
        return phone

    def create(self, validated_data):
        request = self.context["request"]
        org = resolve_organization_for_user(request.user) or get_or_create_default_organization()
        return User.objects.create_user(
            phone=validated_data["phone"],
            first_name=validated_data.get("first_name") or "",
            last_name=validated_data.get("last_name") or "",
            home_address=validated_data.get("home_address") or "",
            role=User.Role.CUSTOMER,
            organization=org,
        )


class AdminCustomerViewSet(
    OrganizationQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    organization_field = "organization_id"
    queryset = User.objects.filter(role=User.Role.CUSTOMER).order_by("-date_joined")
    search_fields = ("phone", "full_name", "first_name", "last_name")
    filterset_fields = ("is_active",)
    ordering_fields = (
        "date_joined",
        "full_name",
        "orders_count_anno",
        "last_order_at_anno",
        "total_spent_anno",
    )

    def get_permissions(self):
        if self.action in {"block", "unblock"}:
            return [IsAuthenticated(), IsSuperAdmin()]
        return super().get_permissions()

    def _base_queryset(self):
        user = self.request.user
        if user.role == User.Role.SUPERADMIN:
            return self._annotate(super().get_queryset(), Q())
        org_id = organization_id_for_queryset(user)
        if org_id is None:
            return User.objects.none()
        firm_orders = Q(orders__organization_id=org_id)
        ids = User.objects.filter(
            Q(organization_id=org_id) | firm_orders, role=User.Role.CUSTOMER
        ).values("id")
        return self._annotate(User.objects.filter(pk__in=ids), firm_orders)

    def get_queryset(self):
        segment = (self.request.query_params.get("segment") or "").strip()
        return self._apply_segment(self._base_queryset(), segment)

    @staticmethod
    def _annotate(qs, order_filter: Q):
        completed = order_filter & Q(orders__status="completed")
        return qs.annotate(
            orders_count_anno=Count("orders", filter=order_filter, distinct=True),
            last_order_at_anno=Max("orders__created_at", filter=order_filter),
            first_order_at_anno=Min("orders__created_at", filter=order_filter),
            total_spent_anno=Sum("orders__quoted_price", filter=completed),
        )

    @staticmethod
    def _apply_segment(qs, segment: str):
        now = timezone.now()
        month_ago = now - timedelta(days=30)
        if segment == "new":
            qs = qs.filter(
                Q(first_order_at_anno__gte=month_ago)
                | Q(first_order_at_anno__isnull=True, date_joined__gte=month_ago)
            ).order_by("-date_joined")
        elif segment == "returning":
            qs = qs.filter(orders_count_anno__gte=2).order_by("-last_order_at_anno")
        elif segment == "active":
            qs = qs.filter(orders_count_anno__gte=1).order_by(
                "-orders_count_anno", "-total_spent_anno", "-last_order_at_anno"
            )
        elif segment == "inactive":
            qs = qs.filter(
                Q(last_order_at_anno__lt=now - timedelta(days=90)) | Q(orders_count_anno=0)
            ).order_by("last_order_at_anno")
        else:
            qs = qs.order_by("-date_joined")
        return qs

    @action(detail=False, methods=["get"])
    def segments(self, request):
        base = self._base_queryset()
        counts = {
            key or "all": self._apply_segment(base, key).count()
            for key in ("", "new", "returning", "active", "inactive")
        }
        return success_response(counts)

    def get_serializer_class(self):
        if self.action == "create":
            return AdminCustomerCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user = self.get_queryset().filter(pk=user.pk).first() or user
        return success_response(
            UserSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return success_response(UserSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return success_response(UserSerializer(user, context={"request": request}).data)
