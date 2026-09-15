from __future__ import annotations

from rest_framework import serializers

from apps.care.models import CareContract, CareVisit


class CareVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareVisit
        fields = (
            "id",
            "visit_date",
            "status",
            "assigned_worker_name",
            "report_notes",
            "created_at",
        )


class CareContractSerializer(serializers.ModelSerializer):
    visits = CareVisitSerializer(many=True, read_only=True)

    class Meta:
        model = CareContract
        fields = (
            "id",
            "order",
            "status",
            "preferred_weekdays",
            "area_size",
            "start_date",
            "end_date",
            "visits",
            "created_at",
        )
        read_only_fields = fields
