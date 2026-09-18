from __future__ import annotations

from django.db.models import Prefetch

from apps.support.models import SupportMessage


def public_messages_prefetch() -> Prefetch:
    """Prefetch only customer-visible (non-internal) support messages."""
    return Prefetch(
        "messages",
        queryset=SupportMessage.objects.filter(is_internal=False).select_related("sender"),
    )
