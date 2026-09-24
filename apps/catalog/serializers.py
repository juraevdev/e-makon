from __future__ import annotations

from rest_framework import serializers

from apps.catalog.models import Banner, Service


class ServiceFeatureSerializer(serializers.Serializer):
    icon = serializers.CharField(max_length=64)
    label = serializers.CharField(max_length=120)


class ServiceSerializer(serializers.ModelSerializer):
    detail_description = serializers.CharField(read_only=True)

    class Meta:
        model = Service
        fields = (
            "id",
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
            "currency",
        )
        read_only_fields = ("id",)


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
