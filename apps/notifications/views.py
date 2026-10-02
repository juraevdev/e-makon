from __future__ import annotations

from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.core.responses import success_response
from apps.notifications.models import UserNotification


class UserNotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="kind", read_only=True)
    read = serializers.BooleanField(source="is_read", read_only=True)

    class Meta:
        model = UserNotification
        fields = ("id", "type", "title", "body", "entity_type", "entity_id", "read", "created_at")
        read_only_fields = fields


class UserNotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = UserNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserNotification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        self.get_queryset().filter(pk=pk).update(is_read=True)
        return success_response({"ok": True})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return success_response({"ok": True})
