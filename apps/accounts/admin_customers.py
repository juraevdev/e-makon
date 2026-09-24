from __future__ import annotations

from django.db.models import Count, Max
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.core.permissions import IsAdmin
from apps.core.phone import normalize_phone
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user


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
    ordering_fields = ("date_joined", "full_name")
    ordering = ("-date_joined",)

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            orders_count_anno=Count("orders"),
            last_order_at_anno=Max("orders__created_at"),
        )
        return qs

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
