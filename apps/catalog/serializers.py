from __future__ import annotations

from rest_framework import serializers

from apps.catalog.models import Banner, Service
from apps.catalog.services import find_catalog_type, is_catalog_type, is_type_proposal


class ServiceFeatureSerializer(serializers.Serializer):
    icon = serializers.CharField(max_length=64)
    label = serializers.CharField(max_length=120)


class ServiceSerializer(serializers.ModelSerializer):
    detail_description = serializers.CharField(read_only=True)
    price_min = serializers.SerializerMethodField()
    price_max = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    offers_count = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True, default="")
    base_service_name = serializers.CharField(
        source="base_service.name", read_only=True, default=""
    )
    moderation_label = serializers.CharField(
        source="get_moderation_status_display", read_only=True
    )
    image = serializers.SerializerMethodField()
    firms = serializers.SerializerMethodField()
    is_catalog_type = serializers.SerializerMethodField()
    is_type_proposal = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = (
            "id",
            "organization_id",
            "organization_name",
            "base_service",
            "base_service_name",
            "is_catalog_type",
            "is_type_proposal",
            "image",
            "moderation_status",
            "moderation_label",
            "moderation_note",
            "moderated_at",
            "offers_count",
            "firms",
            "price",
            "name",
            "slug",
            "emoji",
            "icon",
            "category",
            "short_description",
            "description",
            "long_description",
            "detail_description",
            "cover_image",
            "hero_image_url",
            "gallery_images",
            "price_label",
            "duration",
            "features",
            "sort_order",
            "is_active",
            "price_from",
            "price_to",
            "price_min",
            "price_max",
            "currency",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id",)

    def get_image(self, obj: Service) -> str:
        if obj.cover_image:
            try:
                url = obj.cover_image.url
            except ValueError:
                url = ""
            request = self.context.get("request")
            if url:
                return request.build_absolute_uri(url) if request else url
        return obj.hero_image_url or ""

    def get_is_catalog_type(self, obj: Service) -> bool:
        return is_catalog_type(obj)

    def get_is_type_proposal(self, obj: Service) -> bool:
        return is_type_proposal(obj)

    def _own_prices(self, obj: Service) -> list[int]:
        values = [int(v) for v in (obj.price_from, obj.price_to) if v]
        return values

    def get_price(self, obj: Service) -> int:
        return int(obj.price_from or obj.price_to or 0)

    def get_offers_count(self, obj: Service) -> int:
        firms = self._firm_prices(obj)
        if firms is not None:
            return len(firms)
        return int(getattr(obj, "offers_count_anno", 0) or 0)

    def _firm_prices(self, obj: Service) -> list[dict] | None:
        table = self.context.get("firm_prices")
        return None if table is None else table.get(obj.pk, [])

    def get_firms(self, obj: Service) -> list[dict]:
        return self._firm_prices(obj) or []

    def _offer_range(self, obj: Service) -> tuple[int, int] | None:
        firms = self._firm_prices(obj)
        if firms is not None:
            prices = [f["price"] for f in firms if f["price"]]
            return (min(prices), max(prices)) if prices else None
        lo, hi = getattr(obj, "offers_min_anno", None), getattr(obj, "offers_max_anno", None)
        if lo or hi:
            return int(lo or hi), int(hi or lo)
        return None

    def get_price_min(self, obj: Service) -> int:
        offer_range = self._offer_range(obj)
        if offer_range:
            return offer_range[0]
        own = self._own_prices(obj)
        return own[0] if own else 0

    def get_price_max(self, obj: Service) -> int:
        offer_range = self._offer_range(obj)
        if offer_range:
            return offer_range[1]
        own = self._own_prices(obj)
        return own[-1] if own else 0


class AdminServiceSerializer(ServiceSerializer):
    """Firma o'z xizmatini bitta qat'iy narx bilan kiritadi; tizim tekshiruvidan keyin ilovaga chiqadi."""

    price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, write_only=True
    )
    base_service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(base_service__isnull=True), required=False, allow_null=True
    )

    class Meta(ServiceSerializer.Meta):
        read_only_fields = (
            "id",
            "organization_id",
            "moderation_status",
            "moderation_note",
            "moderated_at",
            "offers_count",
            "price_from",
            "price_to",
            "created_at",
            "updated_at",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["price"] = int(instance.price_from or instance.price_to or 0)
        return data

    def validate_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Narx manfiy bo'lishi mumkin emas.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        is_super = getattr(getattr(request, "user", None), "role", None) == "superadmin"
        price = attrs.get("price", serializers.empty)
        if not is_super and self.instance is None and (price is serializers.empty or not price):
            raise serializers.ValidationError({"price": "Xizmatning aniq narxini kiriting."})
        org = self.context.get("organization")
        if "base_service" in attrs:
            base = attrs["base_service"]
        else:
            base = self.instance.base_service if self.instance is not None else None
        if not is_super and base is None:
            name = attrs.get("name") or (self.instance.name if self.instance is not None else "")
            exclude = self.instance.pk if self.instance is not None else None
            match = find_catalog_type(name, exclude_pk=exclude)
            if match is not None:
                base = attrs["base_service"] = match
        if base is not None and not is_catalog_type(base):
            raise serializers.ValidationError(
                {"base_service": "Faqat katalogdagi xizmat turini tanlash mumkin."}
            )
        if base is not None and org is not None:
            dupes = Service.objects.filter(organization=org, base_service=base)
            if self.instance is not None:
                dupes = dupes.exclude(pk=self.instance.pk)
            if dupes.exists():
                raise serializers.ValidationError(
                    {"base_service": "Bu turdagi xizmatingiz allaqachon mavjud."}
                )
        return attrs

    def _apply_price(self, validated_data):
        price = validated_data.pop("price", serializers.empty)
        if price is not serializers.empty:
            validated_data["price_from"] = price
            validated_data["price_to"] = price
            validated_data["price_label"] = "Qat'iy narx" if price else "Bepul"
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_price(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_price(validated_data))


class BannerSerializer(serializers.ModelSerializer):
    image_src = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = (
            "id",
            "title",
            "description",
            "image_url",
            "image",
            "image_src",
            "status",
            "placement",
            "link_service",
            "service_name",
            "sort_order",
            "starts_at",
            "ends_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "image_src", "service_name", "created_at", "updated_at")

    def get_image_src(self, obj: Banner) -> str:
        src = obj.image_src
        request = self.context.get("request")
        if obj.image and request and src and src.startswith("/"):
            return request.build_absolute_uri(src)
        return src

    def get_service_name(self, obj: Banner) -> str | None:
        if obj.link_service_id:
            return obj.link_service.name
        return None
