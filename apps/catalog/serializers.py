from __future__ import annotations

from rest_framework import serializers

from apps.catalog.models import Service


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
