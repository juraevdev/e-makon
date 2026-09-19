# Generated manually for Telegram Bot MVP

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0002_order_mobile_statuses"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrderIdempotency",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key", models.CharField(db_index=True, max_length=64)),
                (
                    "customer",
                    models.ForeignKey(
                        limit_choices_to={"role": "customer"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="order_idempotency_keys",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="idempotency_records",
                        to="orders.order",
                    ),
                ),
            ],
            options={
                "verbose_name": "Order idempotency",
                "verbose_name_plural": "Order idempotency keys",
            },
        ),
        migrations.AddConstraint(
            model_name="orderidempotency",
            constraint=models.UniqueConstraint(
                fields=("customer", "key"),
                name="uniq_order_idempotency_customer_key",
            ),
        ),
    ]
