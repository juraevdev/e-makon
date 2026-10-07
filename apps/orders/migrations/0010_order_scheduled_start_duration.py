import re
from datetime import time

from django.db import migrations, models

SLOT_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?")


def backfill_from_time_slot(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    for order in Order.objects.exclude(time_slot="").filter(scheduled_start__isnull=True):
        match = SLOT_RE.match(order.time_slot)
        if not match:
            continue
        start_h, start_m = int(match.group(1)), int(match.group(2))
        if start_h > 23 or start_m > 59:
            continue
        order.scheduled_start = time(start_h, start_m)
        if match.group(3):
            minutes = (int(match.group(3)) * 60 + int(match.group(4))) - (start_h * 60 + start_m)
            if minutes > 0:
                order.duration_minutes = minutes
        order.save(update_fields=["scheduled_start", "duration_minutes"])


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0009_orderpayment_test_provider"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="scheduled_start",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="duration_minutes",
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.RunPython(backfill_from_time_slot, migrations.RunPython.noop),
    ]
