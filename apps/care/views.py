from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.care.models import CareContract, CareVisit
from apps.care.serializers import CareContractSerializer
from apps.care.services import FIRM_EDITABLE, CareContractService, log
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsCustomer, IsSuperAdmin
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user


class CustomerCareContractViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return (
            CareContract.objects.filter(customer=self.request.user)
            .exclude(status__in=[CareContract.Status.DRAFT, CareContract.Status.REJECTED])
            .select_related("customer", "order", "order__service", "service", "organization")
            .prefetch_related("visits", "events__actor")
        )


class AdminCareContractViewSet(OrganizationQuerysetMixin, viewsets.ModelViewSet):
    queryset = CareContract.objects.select_related(
        "customer", "order", "order__service", "service", "organization"
    ).prefetch_related("visits", "events__actor", "assigned_workers")
    serializer_class = CareContractSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    filterset_fields = ("status", "client_type", "organization", "frequency")
    search_fields = ("title", "client_name", "contact_person", "phone_number", "address")
    ordering_fields = ("created_at", "start_date", "end_date", "total_amount")

    SUPER_ONLY = {"approve", "reject"}

    def get_permissions(self):
        if self.action in self.SUPER_ONLY:
            return [IsAuthenticated(), IsSuperAdmin()]
        return super().get_permissions()

    def _is_super(self) -> bool:
        return getattr(self.request.user, "role", None) == User.Role.SUPERADMIN

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if not self._is_super():
            ctx["organization"] = resolve_organization_for_user(self.request.user)
        return ctx

    def perform_create(self, serializer):
        org = resolve_organization_for_user(self.request.user) or get_or_create_default_organization()
        as_draft = str(self.request.data.get("draft", "")).lower() in {"1", "true", "yes"}
        status = CareContract.Status.DRAFT if as_draft else CareContract.Status.PENDING
        contract = serializer.save(organization=org, created_by=self.request.user, status=status)
        CareContractService.recalc_total(contract)
        contract.save(update_fields=["total_amount"])
        log(
            contract,
            "create",
            self.request.user,
            "Qoralama saqlandi" if as_draft else "Shartnoma yaratildi va tizim tasdig'iga yuborildi",
        )

    def perform_update(self, serializer):
        contract = serializer.instance
        if not self._is_super() and contract.status not in FIRM_EDITABLE:
            raise AppError(
                "Faol shartnoma shartlarini o'zgartirish uchun tizim ma'muriyatiga yozing.",
                code="care_locked",
            )
        contract = serializer.save()
        if "total_amount" not in self.request.data and contract.price_per_visit:
            contract.total_amount = 0
            CareContractService.recalc_total(contract)
            contract.save(update_fields=["total_amount"])
        if contract.status == CareContract.Status.ACTIVE:
            CareContractService.generate_visits(contract)
        log(contract, "update", self.request.user, "Shartnoma ma'lumotlari yangilandi")

    def destroy(self, request, *args, **kwargs):
        contract = self.get_object()
        if contract.status != CareContract.Status.DRAFT:
            raise AppError("Faqat qoralamani o'chirish mumkin; boshqalarini bekor qiling.")
        return super().destroy(request, *args, **kwargs)

    def _respond(self, contract: CareContract):
        contract = self.get_queryset().get(pk=contract.pk)
        return success_response(self.get_serializer(contract).data)

    def _note(self, request) -> str:
        return (request.data.get("note") or request.data.get("reason") or "").strip()

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.filter_queryset(self.get_queryset()).order_by()
        counts = qs.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=CareContract.Status.PENDING)),
            active=Count("id", filter=Q(status=CareContract.Status.ACTIVE)),
            households=Count("id", filter=Q(client_type=CareContract.ClientType.HOUSEHOLD)),
            organizations=Count("id", filter=Q(client_type=CareContract.ClientType.ORGANIZATION)),
        )
        today = timezone.localdate()
        visits = CareVisit.objects.filter(contract__in=qs)
        counts["visits_today"] = visits.filter(visit_date=today).count()
        counts["visits_week"] = visits.filter(
            visit_date__gte=today, visit_date__lte=today + timedelta(days=7)
        ).count()
        return success_response(counts)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._respond(CareContractService.submit(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._respond(CareContractService.approve(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._respond(CareContractService.reject(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._respond(CareContractService.pause(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._respond(CareContractService.resume(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._respond(CareContractService.complete(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._respond(CareContractService.cancel(self.get_object(), request.user, self._note(request)))

    @action(detail=True, methods=["post"])
    def comment(self, request, pk=None):
        contract = self.get_object()
        note = self._note(request)
        if not note:
            raise AppError("Izoh bo'sh.")
        log(contract, "comment", request.user, note)
        if self._is_super() and contract.organization_id:
            from apps.organizations.models import FirmMessage

            FirmMessage.objects.create(
                firm_id=contract.organization_id,
                sender=request.user,
                subject=f"Parvarish shartnomasi #{contract.pk} bo'yicha izoh",
                body=note,
            )
        return self._respond(contract)

    @action(detail=True, methods=["post"], url_path=r"visits/(?P<visit_id>\d+)")
    def visit(self, request, pk=None, visit_id=None):
        contract = self.get_object()
        visit = contract.visits.filter(pk=visit_id).first()
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
        if "visit_date" in request.data and request.data.get("visit_date"):
            try:
                visit.visit_date = date.fromisoformat(str(request.data["visit_date"]))
            except ValueError:
                raise AppError("Sana noto'g'ri.") from None
        worker_id = request.data.get("planned_worker")
        if worker_id:
            worker = User.objects.filter(
                pk=worker_id, role=User.Role.WORKER, organization_id=contract.organization_id
            ).first()
            if worker is None:
                raise AppError("Xodim topilmadi.")
            visit.planned_worker = worker
            visit.assigned_worker_name = worker.full_name or worker.phone
        visit.save()
        if visit.status == CareVisit.Status.DONE and contract.customer_id:
            from apps.notifications.services import notify_user

            notify_user(
                contract.customer,
                kind="care",
                title=f"Parvarish tashrifi bajarildi ({visit.visit_date:%d.%m.%Y})",
                body=visit.report_notes or "Rejalashtirilgan parvarish ishlari bajarildi.",
                entity_type="care_contract",
                entity_id=contract.pk,
            )
        return self._respond(contract)
