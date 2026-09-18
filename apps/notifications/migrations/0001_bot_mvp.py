# Generated manually for Telegram Bot MVP

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="NotificationDelivery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("event_id", models.CharField(db_index=True, max_length=128, unique=True)),
                ("event_type", models.CharField(max_length=64)),
                ("user_id", models.PositiveIntegerField()),
                ("telegram_id", models.BigIntegerField(blank=True, null=True)),
                ("entity_type", models.CharField(blank=True, max_length=32)),
                ("entity_id", models.PositiveIntegerField(blank=True, null=True)),
                ("status", models.CharField(default="queued", help_text="queued|sent|failed|skipped", max_length=16)),
                ("detail", models.CharField(blank=True, max_length=255)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
