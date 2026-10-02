from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user
from apps.staff.models import AdminProfile, EmployeeProfile
from apps.staff.serializers import AdminUserSerializer, EmployeeSerializer


ACTIVE_ORDER_STATUSES = ("new", "in_review", "contacted")


class EmployeeViewSet(OrganizationQuerysetMixin, viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_staff"
    search_fields = ("user__full_name", "user__phone", "position")
    filterset_fields = ("specialty", "is_active", "employment_status")
    ordering_fields = ("user__full_name", "hired_at", "rating", "created_at")

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(
                active_orders_anno=Count(
                    "user__assigned_orders",
                    filter=Q(user__assigned_orders__status__in=ACTIVE_ORDER_STATUSES),
                    distinct=True,
                ),
                completed_orders_anno=Count(
                    "user__assigned_orders",
                    filter=Q(user__assigned_orders__status="completed"),
                    distinct=True,
                ),
            )
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["organization"] = resolve_organization_for_user(self.request.user)
        return ctx

    def destroy(self, request, *args, **kwargs):
        raise AppError(
            "Xodimni o'chirib bo'lmaydi — tarix saqlanishi uchun \"Ishdan bo'shatish\"dan foydalaning."
        )

    def _payload(self, profile: EmployeeProfile):
        profile = self.get_queryset().filter(pk=profile.pk).first() or profile
        return EmployeeSerializer(profile, context=self.get_serializer_context()).data

    @action(detail=True, methods=["get"])
    def card(self, request, pk=None):
        from apps.care.models import CareVisit
        from apps.orders.models import Order
        from apps.orders.serializers import OrderSerializer

        profile = self.get_object()
        orders = Order.objects.filter(assigned_worker=profile.user).select_related(
            "service", "customer", "organization", "escrow"
        )
        completed = orders.filter(status=Order.Status.COMPLETED)
        revenue = completed.aggregate(total=Sum("quoted_price"))["total"] or Decimal("0")
        visits = CareVisit.objects.filter(planned_worker=profile.user)
        return success_response(
            {
                "employee": self._payload(profile),
                "stats": {
                    "total_orders": orders.count(),
                    "active_orders": orders.filter(status__in=ACTIVE_ORDER_STATUSES).count(),
                    "completed_orders": completed.count(),
                    "cancelled_orders": orders.filter(status=Order.Status.CANCELLED).count(),
                    "revenue": str(revenue),
                    "care_visits_done": visits.filter(status=CareVisit.Status.DONE).count(),
                    "care_visits_planned": visits.filter(
                        status=CareVisit.Status.SCHEDULED, visit_date__gte=timezone.localdate()
                    ).count(),
                },
                "recent_orders": OrderSerializer(
                    orders.order_by("-created_at")[:10], many=True, context={"request": request}
                ).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        profile = self.get_object()
        status = (request.data.get("status") or "").strip()
        if status not in EmployeeProfile.EmploymentStatus.values:
            raise AppError("Noto'g'ri holat.")
        reason = (request.data.get("reason") or "").strip()
        user = profile.user
        if status == EmployeeProfile.EmploymentStatus.DISMISSED:
            if not reason:
                raise AppError("Ishdan bo'shatish sababini yozing.")
            profile.dismissed_at = timezone.localdate()
            profile.dismissal_reason = reason
            user.is_active = False
        else:
            if profile.employment_status == EmployeeProfile.EmploymentStatus.DISMISSED:
                profile.dismissed_at = None
                profile.dismissal_reason = ""
                profile.hired_at = timezone.localdate()
            user.is_active = True
        profile.employment_status = status
        profile.is_active = status == EmployeeProfile.EmploymentStatus.ACTIVE
        if reason and status != EmployeeProfile.EmploymentStatus.DISMISSED:
            stamp = timezone.localdate().isoformat()
            profile.notes = f"{profile.notes}\n[{stamp}] {reason}".strip()
        profile.save()
        user.save(update_fields=["is_active"])
        return success_response(self._payload(profile))


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.select_related("user", "organization").order_by("-created_at")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    search_fields = ("user__full_name", "user__phone")
    filterset_fields = ("is_active",)
    ordering = ("-created_at",)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["default_organization"] = get_or_create_default_organization()
        return ctx
