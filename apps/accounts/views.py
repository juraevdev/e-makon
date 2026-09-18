from __future__ import annotations

from rest_framework import generics, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import LoyaltyReward, LoyaltySettings, PointTransaction, User
from apps.accounts.serializers import (
    AdminCustomerSerializer,
    AdminPasswordLoginSerializer,
    LoyaltyRewardSerializer,
    LoyaltySettingsSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    PointTransactionSerializer,
    ProfileUpdateSerializer,
    UserSerializer,
)
from apps.accounts.services.otp import OTPService
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response


class OTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = OTPService.request_code(
            serializer.validated_data["phone"],
            serializer.validated_data.get("purpose") or "login",
        )
        return success_response(data, message="OTP yuborildi")


class OTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = OTPService.verify_and_issue_tokens(
            phone=serializer.validated_data["phone"],
            code=serializer.validated_data["code"],
            purpose=serializer.validated_data.get("purpose") or "login",
            full_name=serializer.validated_data.get("full_name") or "",
            first_name=serializer.validated_data.get("first_name") or "",
            last_name=serializer.validated_data.get("last_name") or "",
        )
        return success_response(
            {
                "access": result["access"],
                "refresh": result["refresh"],
                "is_new_user": result["created"],
                "user": UserSerializer(result["user"], context={"request": request}).data,
            },
            message="Tasdiqlandi",
        )


class AdminLoginView(APIView):
    """Superadmin / admin panel login (telefon + parol)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AdminPasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(phone=serializer.validated_data["phone"])
        except User.DoesNotExist as exc:
            raise AuthenticationFailed("Login yoki parol noto'g'ri.") from exc

        if not user.check_password(serializer.validated_data["password"]):
            raise AuthenticationFailed("Login yoki parol noto'g'ri.")
        if user.role not in {User.Role.ADMIN, User.Role.SUPERADMIN}:
            raise PermissionDenied("Admin huquqi yo'q.")
        if not user.is_active:
            raise PermissionDenied("Hisob faol emas.")

        refresh = RefreshToken.for_user(user)
        return success_response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={"request": request}).data,
            },
            message="Kirish muvaffaqiyatli",
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        return success_response(UserSerializer(request.user, context={"request": request}).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(request.user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(UserSerializer(request.user, context={"request": request}).data)


class AdminCustomerViewSet(viewsets.ModelViewSet):
    """Mobil ilova mijozlari — admin boshqaruvi."""

    serializer_class = AdminCustomerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    search_fields = ("phone", "full_name", "first_name", "last_name", "home_address", "region")
    filterset_fields = ("is_active", "region")
    ordering_fields = ("date_joined", "full_name", "loyalty_points")

    def get_queryset(self):
        from django.db.models import Count, Max

        return User.objects.filter(role=User.Role.CUSTOMER).annotate(
            orders_count=Count("orders"),
            last_order_at=Max("orders__created_at"),
        )

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return success_response(
            AdminCustomerSerializer(user, context={"request": request}).data,
            message="Mijoz bloklandi",
        )

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return success_response(
            AdminCustomerSerializer(user, context={"request": request}).data,
            message="Blokdan ochildi",
        )


class LoyaltySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        return success_response(LoyaltySettingsSerializer(LoyaltySettings.get()).data)

    def patch(self, request):
        settings = LoyaltySettings.get()
        serializer = LoyaltySettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(serializer.data, message="Ball qoidalari saqlandi")


class LoyaltyRewardViewSet(viewsets.ModelViewSet):
    queryset = LoyaltyReward.objects.all()
    serializer_class = LoyaltyRewardSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filterset_fields = ("is_active",)


class PointTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PointTransaction.objects.select_related("user", "order").all()
    serializer_class = PointTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filterset_fields = ("kind", "user")
    search_fields = ("user__full_name", "user__phone", "note")
    ordering_fields = ("created_at", "points")
