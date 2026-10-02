from __future__ import annotations

from django.db.models import Count, Max, Min, Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.catalog.models import Banner, Service
from apps.catalog.serializers import AdminServiceSerializer, BannerSerializer, ServiceSerializer
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.models import Organization
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.serializers import PublicFirmSerializer
from apps.organizations.services import get_or_create_default_organization, resolve_organization_for_user

OFFER_FIELDS_TRIGGERING_REVIEW = (
    "name",
    "price",
    "base_service",
    "short_description",
    "description",
    "long_description",
)


def published_services():
    return Service.objects.filter(
        Q(organization__isnull=True) | Q(organization__status=Organization.Status.ACTIVE),
        is_active=True,
        moderation_status=Service.Moderation.APPROVED,
    )


def offers_for_root(root: Service):
    offers = list(
        published_services()
        .filter(base_service=root)
        .select_related("organization")
        .order_by("price_from", "id")
    )
    if root.organization_id and (root.price_from or root.price_to):
        offers.insert(0, root)
    offers.sort(key=lambda s: int(s.price_from or s.price_to or 0))
    return offers


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ("name", "description")
    ordering_fields = ("sort_order", "name")

    def get_queryset(self):
        qs = published_services().select_related("organization", "base_service")
        if self.request.query_params.get("all") == "1":
            return qs
        published_offer = Q(
            offers__is_active=True,
            offers__moderation_status=Service.Moderation.APPROVED,
            offers__organization__status=Organization.Status.ACTIVE,
        )
        return (
            qs.filter(base_service__isnull=True)
            .annotate(
                offers_count_anno=Count("offers", filter=published_offer, distinct=True),
                offers_min_anno=Min("offers__price_from", filter=published_offer),
                offers_max_anno=Max("offers__price_to", filter=published_offer),
            )
            .order_by("sort_order", "id")
        )

    def get_object(self):
        qs = self.filter_queryset(self.get_queryset())
        obj = qs.filter(slug=self.kwargs["slug"]).order_by("id").first()
        if obj is None:
            raise AppError("Xizmat topilmadi.", status_code=404)
        return obj

    @action(detail=True, methods=["get"])
    def offers(self, request, slug=None):
        root = self.get_object()
        rows = []
        for offer in offers_for_root(root):
            firm = offer.organization
            rows.append(
                {
                    "service_id": offer.pk,
                    "slug": offer.slug,
                    "name": offer.name,
                    "price": int(offer.price_from or offer.price_to or 0),
                    "duration": offer.duration,
                    "description": offer.short_description or offer.description,
                    "firm": PublicFirmSerializer(firm, context={"request": request}).data
                    if firm
                    else None,
                }
            )
        return success_response(rows)


class PublicFirmViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Ilovadagi "Hamkorlar": faol firmalar, ijtimoiy tarmoqlari va (ixtiyoriy) xizmat narxi."""

    serializer_class = PublicFirmSerializer
    permission_classes = [AllowAny]
    search_fields = ("name", "region", "district", "address")
    ordering_fields = ("rating", "name")

    def _service_filter(self):
        raw = self.request.query_params.get("service")
        if not raw:
            return None
        try:
            return Service.objects.get(pk=int(raw))
        except (ValueError, Service.DoesNotExist):
            raise AppError("Xizmat topilmadi.", status_code=404) from None

    def get_queryset(self):
        qs = Organization.objects.filter(status=Organization.Status.ACTIVE).annotate(
            services_count_anno=Count(
                "services",
                filter=Q(
                    services__is_active=True,
                    services__moderation_status=Service.Moderation.APPROVED,
                ),
                distinct=True,
            )
        )
        root = self._service_filter()
        if root is not None:
            root = root.base_service or root
            firm_ids = [s.organization_id for s in offers_for_root(root) if s.organization_id]
            qs = qs.filter(pk__in=firm_ids)
        return qs.order_by("-rating", "name")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        root = self._service_filter()
        if root is not None:
            root = root.base_service or root
            ctx["offers_by_firm"] = {
                s.organization_id: s for s in offers_for_root(root) if s.organization_id
            }
        return ctx


class AdminServiceViewSet(OrganizationQuerysetMixin, viewsets.ModelViewSet):
    queryset = Service.objects.select_related("organization", "base_service").all()
    serializer_class = AdminServiceSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    search_fields = ("name", "slug", "organization__name")
    filterset_fields = ("is_active", "moderation_status", "organization", "base_service")
    ordering_fields = ("created_at", "price_from", "name", "sort_order")

    def get_permissions(self):
        if self.action in {"approve", "reject"}:
            return [IsAuthenticated(), IsSuperAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("roots") == "1":
            qs = qs.filter(base_service__isnull=True)
        approved_offer = Q(offers__moderation_status=Service.Moderation.APPROVED, offers__is_active=True)
        return qs.annotate(
            offers_count_anno=Count("offers", filter=approved_offer, distinct=True),
            offers_min_anno=Min("offers__price_from", filter=approved_offer),
            offers_max_anno=Max("offers__price_to", filter=approved_offer),
        ).order_by("-created_at")

    def _is_super(self) -> bool:
        return getattr(self.request.user, "role", None) == "superadmin"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["organization"] = resolve_organization_for_user(self.request.user)
        return ctx

    def perform_create(self, serializer):
        org = resolve_organization_for_user(self.request.user)
        if org is None:
            org = get_or_create_default_organization()
        if self._is_super():
            serializer.save(
                organization=org,
                moderation_status=Service.Moderation.APPROVED,
                moderated_at=timezone.now(),
                moderated_by=self.request.user,
            )
        else:
            serializer.save(organization=org, moderation_status=Service.Moderation.PENDING)

    def perform_update(self, serializer):
        if self._is_super():
            serializer.save()
            return
        needs_review = any(f in serializer.validated_data for f in OFFER_FIELDS_TRIGGERING_REVIEW)
        if needs_review:
            serializer.save(moderation_status=Service.Moderation.PENDING, moderation_note="")
        else:
            serializer.save()

    def _moderate(self, request, status: str):
        service = self.get_object()
        note = (request.data.get("note") or "").strip()
        if status == Service.Moderation.REJECTED and not note:
            raise AppError("Rad etish sababini yozing.")
        service.moderation_status = status
        service.moderation_note = note
        service.moderated_at = timezone.now()
        service.moderated_by = request.user
        service.save(
            update_fields=[
                "moderation_status",
                "moderation_note",
                "moderated_at",
                "moderated_by",
                "updated_at",
            ]
        )
        if service.organization_id:
            from apps.organizations.models import FirmMessage

            approved = status == Service.Moderation.APPROVED
            FirmMessage.objects.create(
                firm_id=service.organization_id,
                sender=request.user,
                kind=FirmMessage.Kind.MESSAGE if approved else FirmMessage.Kind.WARNING,
                subject=(
                    f"Xizmat tasdiqlandi: {service.name}"
                    if approved
                    else f"Xizmat rad etildi: {service.name}"
                ),
                body=note
                or "Xizmatingiz tekshiruvdan o'tdi va ilovada mijozlarga ko'rinadi.",
            )
        return success_response(self.get_serializer(service).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._moderate(request, Service.Moderation.APPROVED)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._moderate(request, Service.Moderation.REJECTED)


class AdminBannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.select_related("link_service").all()
    serializer_class = BannerSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    search_fields = ("title", "description")
    filterset_fields = ("status", "placement")
    ordering_fields = ("sort_order", "created_at")
