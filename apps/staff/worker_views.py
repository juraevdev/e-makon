from __future__ import annotations

from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.care.models import CareVisit
from apps.core.exceptions import AppError
from apps.core.permissions import IsWorker
from apps.core.responses import success_response
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer, OrderStageSerializer
from apps.orders.services import OrderService
from apps.staff.models import EmployeeProfile


ORDER_PREFETCH = ("media", "status_history__changed_by", "items__service", "payments")


class WorkerOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Xodimga biriktirilgan buyurtmalar — bosqich yangilash."""

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsWorker]
    filterset_fields = ("status", "work_stage")
    ordering_fields = ("scheduled_date", "created_at", "work_stage_at")

    def get_queryset(self):
        return (
            Order.objects.filter(assigned_worker=self.request.user)
            .select_related("service", "customer", "organization", "escrow")
            .prefetch_related(*ORDER_PREFETCH)
        )

    def _assert_active_employee(self):
        profile = getattr(self.request.user, "employee_profile", None)
        if profile is None:
            raise AppError("Xodim profili topilmadi.", status_code=403)
        if (
            not profile.is_active
            or profile.employment_status == EmployeeProfile.EmploymentStatus.DISMISSED
        ):
            raise AppError("Hisobingiz faol emas.", status_code=403)
        return profile

    def list(self, request, *args, **kwargs):
        self._assert_active_employee()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._assert_active_employee()
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def stage(self, request, pk=None):
        self._assert_active_employee()
        order = self.get_object()
        serializer = OrderStageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
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

    @action(detail=False, methods=["get"])
    def me(self, request):
        profile = self._assert_active_employee()
        today = timezone.localdate()
        active = self.get_queryset().exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        )
        return success_response(
            {
                "profile": {
                    "id": profile.pk,
                    "specialty": profile.specialty,
                    "position": profile.position,
                    "employment_status": profile.employment_status,
                    "organization_id": profile.organization_id,
                },
                "user": {
                    "id": request.user.pk,
                    "full_name": request.user.display_name,
                    "phone": request.user.phone,
                },
                "active_orders": active.count(),
                "visits_today": CareVisit.objects.filter(
                    planned_worker=request.user, visit_date=today
                )
                .exclude(status=CareVisit.Status.DONE)
                .count(),
            }
        )


class WorkerCareVisitViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Xodimga rejalashtirilgan parvarish tashriflari."""

    permission_classes = [IsAuthenticated, IsWorker]
    filterset_fields = ("status", "visit_date")
    ordering_fields = ("visit_date", "id")

    def get_queryset(self):
        return (
            CareVisit.objects.filter(planned_worker=self.request.user)
            .select_related(
                "contract",
                "contract__customer",
                "contract__organization",
                "contract__service",
            )
            .order_by("visit_date", "id")
        )

    def list(self, request, *args, **kwargs):
        profile = getattr(request.user, "employee_profile", None)
        if profile is None or not profile.is_active:
            raise AppError("Xodim profili topilmadi.", status_code=403)
        qs = self.filter_queryset(self.get_queryset())
        day = request.query_params.get("date")
        if day:
            qs = qs.filter(visit_date=day)
        page = self.paginate_queryset(qs)
        rows = page if page is not None else qs
        data = [
            {
                "id": v.pk,
                "visit_date": v.visit_date.isoformat(),
                "status": v.status,
                "status_label": v.get_status_display(),
                "report_notes": v.report_notes,
                "contract_id": v.contract_id,
                "client_name": v.contract.client_name or (
                    v.contract.customer.display_name if v.contract.customer_id else ""
                ),
                "address": v.contract.address,
                "phone_number": v.contract.phone_number,
                "title": v.contract.title,
            }
            for v in rows
        ]
        if page is not None:
            return self.get_paginated_response(data)
        return success_response(data)

    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        visit = self.get_queryset().filter(pk=pk).first()
        if visit is None:
            raise AppError("Tashrif topilmadi.", status_code=404)
        status = request.data.get("status")
        if status:
            if status not in CareVisit.Status.values:
                raise AppError("Noto'g'ri holat.")
            visit.status = status
        if "report_notes" in request.data:
            visit.report_notes = (request.data.get("report_notes") or "").strip()
            if visit.report_notes:
                visit.report_sent_at = timezone.now()
        visit.save()
        if visit.status == CareVisit.Status.DONE and visit.contract.customer_id:
            from apps.notifications.services import notify_user

            notify_user(
                visit.contract.customer,
                kind="care",
                title=f"Parvarish tashrifi bajarildi ({visit.visit_date:%d.%m.%Y})",
                body=visit.report_notes or "Rejalashtirilgan parvarish ishlari bajarildi.",
                entity_type="care_contract",
                entity_id=visit.contract_id,
            )
        return success_response(
            {
                "id": visit.pk,
                "status": visit.status,
                "report_notes": visit.report_notes,
            }
        )
