from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0001_initial"),
        ("staff", "0003_partnerfirm_trial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="partnerfirm",
            name="commission_rate",
            field=models.DecimalField(
                decimal_places=1,
                default=0.3,
                help_text="Foiz (0.1 — 3.0). Ogohlantirishlardan keyin oshirilishi mumkin.",
                max_digits=3,
            ),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="ratings_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="subscription_plan",
            field=models.CharField(
                choices=[
                    ("none", "Obuna yo'q"),
                    ("monthly", "Oylik ($9 / o'rin)"),
                    ("yearly", "Yillik ($90 / o'rin)"),
                ],
                default="none",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="subscription_units",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Obuna o'rinlari soni. Oylik $9, yillik $90 (12×$9=$108).",
            ),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="debt_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="debt_currency",
            field=models.CharField(default="UZS", max_length=8),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="warnings_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="partnerfirm",
            name="sales_banned_until",
            field=models.DateTimeField(
                blank=True,
                help_text="Shu sanagacha yangi buyurtma qabul qilish taqiqlanadi.",
                null=True,
            ),
        ),
        migrations.CreateModel(
            name="FirmReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("score", models.PositiveSmallIntegerField()),
                ("comment", models.TextField(blank=True)),
                (
                    "customer",
                    models.ForeignKey(
                        limit_choices_to={"role": "customer"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="firm_reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "firm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviews",
                        to="staff.partnerfirm",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="firm_reviews",
                        to="orders.order",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="FirmMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("message", "Xabar"),
                            ("warning", "Ogohlantirish"),
                            ("report", "Hisobot"),
                        ],
                        default="message",
                        max_length=16,
                    ),
                ),
                ("subject", models.CharField(blank=True, max_length=255)),
                ("body", models.TextField()),
                ("is_read", models.BooleanField(default=False)),
                (
                    "firm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="staff.partnerfirm",
                    ),
                ),
                (
                    "sender",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="firm_messages_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="FirmFine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("currency", models.CharField(default="UZS", max_length=8)),
                ("reason", models.CharField(max_length=512)),
                ("is_paid", models.BooleanField(default=False)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="firm_fines_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "firm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fines",
                        to="staff.partnerfirm",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="FirmModerationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("warning", "Ogohlantirish"),
                            ("fine", "Jarima"),
                            ("sales_ban", "Savdo taqiqi"),
                            ("sales_unban", "Savdo ochildi"),
                            ("block", "Blok"),
                            ("unblock", "Blokdan chiqarish"),
                            ("rate_hike", "Foiz oshirildi"),
                            ("message", "Xabar"),
                        ],
                        max_length=16,
                    ),
                ),
                ("note", models.TextField(blank=True)),
                ("meta", models.JSONField(blank=True, default=dict)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="firm_moderation_actions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "firm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moderation_logs",
                        to="staff.partnerfirm",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="firmreview",
            constraint=models.UniqueConstraint(
                fields=("firm", "customer", "order"),
                name="uniq_firm_customer_order_review",
            ),
        ),
    ]
