from __future__ import annotations

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsAdmin, IsCustomer
from apps.core.responses import success_response
from apps.support.models import SupportMessage, SupportTicket
from apps.support.serializers import (
    SupportMessageSerializer,
    SupportTicketCreateSerializer,
    SupportTicketSerializer,
)


class CustomerSupportTicketViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return SupportTicket.objects.filter(customer=self.request.user).prefetch_related("messages")

    def get_serializer_class(self):
        if self.action == "create":
            return SupportTicketCreateSerializer
        return SupportTicketSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return success_response(
            SupportTicketSerializer(ticket, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            from apps.core.exceptions import AppError

            raise AppError("Xabar bo'sh.")
        msg = SupportMessage.objects.create(ticket=ticket, sender=request.user, body=body)
        return success_response(SupportMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class AdminSupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.select_related("customer", "assigned_to").prefetch_related("messages")
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ("status", "priority")
    search_fields = ("subject", "customer__phone", "customer__full_name")

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        body = (request.data.get("body") or "").strip()
        is_internal = bool(request.data.get("is_internal"))
        msg = SupportMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            body=body,
            is_internal=is_internal,
        )
        if ticket.status == SupportTicket.Status.OPEN:
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.save(update_fields=["status", "updated_at"])
        return success_response(SupportMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
