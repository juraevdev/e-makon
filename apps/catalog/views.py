from __future__ import annotations

from django.db.models import Count, Max, Min, Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.catalog.models import Banner, Service
from apps.catalog.serializers import AdminServiceSerializer, BannerSerializer, ServiceSerializer
from apps.catalog.services import attach_to_catalog_type, is_catalog_type, platform_owned_q
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsSuperAdmin
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.models import Organization
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.serializers import PublicFirmSerializer
from apps.organizations.services import (
    DEFAULT_ORG_SLUG,
    get_or_create_default_organization,
    resolve_organization_for_user,
)

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
    """Xizmat turini ko'rsatadigan firmalar takliflari (platformaning o'zi firma sifatida chiqmaydi)."""
    offers = list(
        published_services()
        .filter(base_service=root)
        .exclude(platform_owned_q())
        .select_related("organization")
        .order_by("price_from", "id")
    )
    if not is_catalog_type(root) and (root.price_from or root.price_to):
        offers.insert(0, root)
    offers.sort(key=lambda s: int(s.price_from or s.price_to or 0))
    return offers


def firm_prices_by_root(roots) -> dict[int, list[dict]]:
    """Katalog ro'yxati uchun: har bir turda qaysi firma qancha narx qo'ygani (arzonidan)."""
    ids = [r.pk for r in roots]
    rows: dict[int, list[dict]] = {pk: [] for pk in ids}
    offers = (
        published_services()
        .filter(base_service_id__in=ids)
        .exclude(platform_owned_q())
        .select_related("organization")
        .order_by("price_from", "id")
    )
    for offer in offers:
        rows[offer.base_service_id].append(
            {
                "firm_id": offer.organization_id,
                "firm_name": offer.organization.name,
                "rating": float(offer.organization.rating or 0),
                "service_id": offer.pk,
                "price": int(offer.price_from or offer.price_to or 0),
            }
        )
    return rows


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
            qs.filter(platform_owned_q(), base_service__isnull=True)
            .annotate(
                offers_count_anno=Count("offers", filter=published_offer, distinct=True),
                offers_min_anno=Min("offers__price_from", filter=published_offer),
                offers_max_anno=Max("offers__price_to", filter=published_offer),
            )
            .order_by("sort_order", "id")
        )

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        items = list(page if page is not None else qs)
        context = {**self.get_serializer_context(), "firm_prices": firm_prices_by_root(items)}
        data = self.get_serializer(items, many=True, context=context).data
        return self.get_paginated_response(data) if page is not None else Response(data)

    def get_serializer(self, *args, **kwargs):
        kwargs.setdefault("context", self.get_serializer_context())
        return self.get_serializer_class()(*args, **kwargs)

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
        qs = Organization.objects.filter(status=Organization.Status.ACTIVE).exclude(
            slug=DEFAULT_ORG_SLUG
        ).annotate(
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
    parser_classes = [JSONParser, MultiPartParser, FormParser]
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
            service = serializer.save(organization=org, moderation_status=Service.Moderation.PENDING)
            self._notify_superadmins(service, created=True)

    def perform_update(self, serializer):
        if self._is_super():
            serializer.save()
            return
        needs_review = any(f in serializer.validated_data for f in OFFER_FIELDS_TRIGGERING_REVIEW)
        needs_review = needs_review or "cover_image" in serializer.validated_data
        if needs_review:
            service = serializer.save(moderation_status=Service.Moderation.PENDING, moderation_note="")
            self._notify_superadmins(service, created=False)
        else:
            serializer.save()

    @staticmethod
    def _notify_superadmins(service: Service, *, created: bool):
        from apps.accounts.models import User
        from apps.notifications.services import notify_user

        firm = service.organization.name if service.organization_id else "Firma"
        if service.base_service_id:
            what = f"\"{service.base_service.name}\" turiga taklif"
        else:
            what = "yangi xizmat turi"
        title = f"{firm}: {what} — {service.name}" if created else f"{firm} xizmatini o'zgartirdi — {service.name}"
        price = int(service.price_from or 0)
        for admin in User.objects.filter(role=User.Role.SUPERADMIN, is_active=True):
            notify_user(
                admin,
                title=title,
                body=f"Narx: {price:,} so'm. Tasdiqlash uchun Xizmatlar → Tekshiruv navbati.".replace(",", " "),
                entity_type="service",
                entity_id=service.pk,
            )

    def _moderate(self, request, status: str):
        service = self.get_object()
        note = (request.data.get("note") or "").strip()
        if status == Service.Moderation.REJECTED and not note:
            raise AppError("Rad etish sababini yozing.")
        if status == Service.Moderation.APPROVED:
            base = None
            raw_base = request.data.get("base_service")
            if raw_base:
                try:
                    base = Service.objects.select_related("organization").get(pk=int(raw_base))
                except (TypeError, ValueError, Service.DoesNotExist):
                    raise AppError("Katalog turi topilmadi.") from None
            attach_to_catalog_type(service, base=base, actor=request.user)
            service.refresh_from_db()
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
                or (
                    f"Xizmatingiz tekshiruvdan o'tdi va ilovada \"{service.base_service.name}\" "
                    "bo'limida boshqa firmalar qatorida mijozlarga ko'rinadi."
                    if service.base_service_id
                    else "Xizmatingiz tekshiruvdan o'tdi va ilovada mijozlarga ko'rinadi."
                ),
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
