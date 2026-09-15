# Generated manually for mobile order statuses

from django.db import migrations, models


STATUS_MAP = {
    "in_progress": "in_review",
    "accepted": "contacted",
    "done": "completed",
}


def forwards_status(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    History = apps.get_model("orders", "OrderStatusHistory")
    for old, new in STATUS_MAP.items():
        Order.objects.filter(status=old).update(status=new)
        History.objects.filter(from_status=old).update(from_status=new)
        History.objects.filter(to_status=old).update(to_status=new)


def backwards_status(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    History = apps.get_model("orders", "OrderStatusHistory")
    reverse = {v: k for k, v in STATUS_MAP.items()}
    for old, new in reverse.items():
        Order.objects.filter(status=old).update(status=new)
        History.objects.filter(from_status=old).update(from_status=new)
        History.objects.filter(to_status=old).update(to_status=new)


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="customer_first_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="order",
            name="customer_last_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.RunPython(forwards_status, backwards_status),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "Yangi"),
                    ("in_review", "Kelishilmoqda"),
                    ("contacted", "Bog'lanildi"),
                    ("completed", "Bajarildi"),
                    ("cancelled", "Bekor qilindi"),
                ],
                db_index=True,
                default="new",
                max_length=16,
            ),
        ),
    ]
