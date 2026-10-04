from __future__ import annotations

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User
from apps.core.exceptions import AppError
from apps.core.permissions import IsAdmin, IsCustomer
from apps.core.responses import success_response
from apps.organizations.mixins import OrganizationQuerysetMixin
from apps.organizations.models import Organization
from apps.organizations.permissions import RequiresAdminCapability
from apps.organizations.services import organization_id_for_queryset
from apps.support.models import ChatMessage, ChatRoom

MAX_BODY = 4000
PAGE = 200


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ("id", "room", "sender_role", "sender_name", "body", "order", "mine", "created_at")
        read_only_fields = fields

    def get_sender_name(self, obj: ChatMessage) -> str:
        if obj.sender_role == ChatMessage.SenderRole.PLATFORM:
            return "E-Makon"
        if obj.sender_role == ChatMessage.SenderRole.FIRM:
            return obj.room.organization.name
        if obj.sender_id:
            return obj.sender.display_name or obj.sender.phone
        return ""

    def get_mine(self, obj: ChatMessage) -> bool:
        request = self.context.get("request")
        return bool(request and obj.sender_id == request.user.pk)


class ChatRoomSerializer(serializers.ModelSerializer):
    firm_id = serializers.IntegerField(source="organization_id", read_only=True)
    firm_name = serializers.CharField(source="organization.name", read_only=True)
    firm_phone = serializers.CharField(source="organization.phone", read_only=True)
    customer_id = serializers.IntegerField(read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    unread = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            "id",
            "firm_id",
            "firm_name",
            "firm_phone",
            "customer_id",
            "customer_name",
            "customer_phone",
            "last_message_at",
            "last_message_preview",
            "customer_unread",
            "firm_unread",
            "unread",
            "created_at",
        )
        read_only_fields = fields

    def get_customer_name(self, obj: ChatRoom) -> str:
        return obj.customer.display_name or obj.customer.phone

    def get_unread(self, obj: ChatRoom) -> int:
        viewer = self.context.get("viewer", "customer")
        return obj.customer_unread if viewer == "customer" else obj.firm_unread


def _messages_payload(room: ChatRoom, request) -> list[dict]:
    qs = room.messages.select_related("sender", "room__organization")
    after = request.query_params.get("after")
    if after and str(after).isdigit():
        qs = qs.filter(pk__gt=int(after))
        rows = list(qs[:PAGE])
    else:
        rows = list(qs.order_by("-id")[:PAGE])[::-1]
    return ChatMessageSerializer(rows, many=True, context={"request": request}).data


@transaction.atomic
def post_message(room: ChatRoom, sender, role: str, body: str, order_id=None) -> ChatMessage:
    body = (body or "").strip()
    if not body:
        raise AppError("Xabar bo'sh.")
    if len(body) > MAX_BODY:
        raise AppError("Xabar juda uzun.")
    if order_id:
        from apps.orders.models import Order

        if not Order.objects.filter(
            pk=order_id, customer_id=room.customer_id, organization_id=room.organization_id
        ).exists():
            order_id = None
    msg = ChatMessage.objects.create(
        room=room, sender=sender, sender_role=role, body=body, order_id=order_id
    )
    updates = {
        "last_message_at": msg.created_at,
        "last_message_preview": body[:255],
        "updated_at": timezone.now(),
    }
    if role == ChatMessage.SenderRole.CUSTOMER:
        updates["firm_unread"] = F("firm_unread") + 1
    else:
        updates["customer_unread"] = F("customer_unread") + 1
    was_unread = room.customer_unread
    ChatRoom.objects.filter(pk=room.pk).update(**updates)
    if role != ChatMessage.SenderRole.CUSTOMER and not was_unread:
        from apps.notifications.services import notify_user

        notify_user(
            room.customer,
            kind="chat",
            title=f"{room.organization.name} sizga yozdi",
            body=body[:200],
            entity_type="chat_room",
            entity_id=room.pk,
        )
    return msg


class CustomerChatViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return ChatRoom.objects.filter(customer=self.request.user).select_related(
            "organization", "customer"
        )

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "viewer": "customer"}

    @action(detail=False, methods=["post"])
    def open(self, request):
        firm_id = request.data.get("firm_id")
        firm = Organization.objects.filter(pk=firm_id, status=Organization.Status.ACTIVE).first()
        if firm is None:
            raise AppError("Firma topilmadi.", status_code=404)
        room, _ = ChatRoom.objects.get_or_create(organization=firm, customer=request.user)
        return success_response(self.get_serializer(room).data)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        room = self.get_object()
        data = _messages_payload(room, request)
        if room.customer_unread:
            ChatRoom.objects.filter(pk=room.pk).update(customer_unread=0)
        return success_response(data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        room = self.get_object()
        msg = post_message(
            room,
            request.user,
            ChatMessage.SenderRole.CUSTOMER,
            request.data.get("body"),
            request.data.get("order"),
        )
        return success_response(
            ChatMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminChatViewSet(
    OrganizationQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Firma o'z mijozlari bilan; superadmin barcha xonalarni ko'radi va vositachi sifatida yozadi."""

    queryset = ChatRoom.objects.select_related("organization", "customer")
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated, IsAdmin, RequiresAdminCapability]
    required_capability = "can_manage_orders"
    search_fields = ("customer__phone", "customer__full_name", "organization__name", "last_message_preview")
    filterset_fields = ("organization",)

    def _is_super(self) -> bool:
        return getattr(self.request.user, "role", None) == User.Role.SUPERADMIN

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("unread") == "1":
            qs = qs.filter(firm_unread__gt=0)
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "viewer": "firm"}

    @action(detail=False, methods=["get"])
    def unread(self, request):
        total = super().get_queryset().aggregate(total=Sum("firm_unread"))["total"] or 0
        return success_response({"unread": int(total)})

    @action(detail=False, methods=["post"])
    def open(self, request):
        if self._is_super():
            raise AppError("Suhbatni firma admini ochadi.", status_code=403)
        org_id = organization_id_for_queryset(request.user)
        if org_id is None:
            raise AppError("Suhbatni firma admini ochadi.", status_code=403)
        if not Organization.objects.filter(pk=org_id, status=Organization.Status.ACTIVE).exists():
            raise AppError("Firma faol emas.", status_code=403)
        customer_id = request.data.get("customer_id")
        if not str(customer_id or "").isdigit():
            raise AppError("Mijoz topilmadi.", status_code=404)
        # Same relationship as /admin/customers/: an order with the firm, registered
        # under the firm, or an existing room. Unrelated customers look nonexistent.
        related = (
            Q(orders__organization_id=org_id)
            | Q(organization_id=org_id)
            | Q(chat_rooms__organization_id=org_id)
        )
        customer = (
            User.objects.filter(related, pk=int(customer_id), role=User.Role.CUSTOMER)
            .distinct()
            .first()
        )
        if customer is None:
            raise AppError("Mijoz topilmadi.", status_code=404)
        room, _ = ChatRoom.objects.get_or_create(organization_id=org_id, customer=customer)
        return success_response(self.get_serializer(room).data)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        room = self.get_object()
        data = _messages_payload(room, request)
        if room.firm_unread and not self._is_super():
            ChatRoom.objects.filter(pk=room.pk).update(firm_unread=0)
        return success_response(data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        room = self.get_object()
        role = ChatMessage.SenderRole.PLATFORM if self._is_super() else ChatMessage.SenderRole.FIRM
        msg = post_message(room, request.user, role, request.data.get("body"), request.data.get("order"))
        if role == ChatMessage.SenderRole.FIRM:
            ChatRoom.objects.filter(pk=room.pk).update(firm_unread=0)
        return success_response(
            ChatMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
