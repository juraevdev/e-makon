from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("staff", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PartnerFirm",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("legal_name", models.CharField(blank=True, max_length=255)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.CharField(blank=True, max_length=512)),
                ("region", models.CharField(blank=True, max_length=120)),
                ("district", models.CharField(blank=True, max_length=120)),
                (
                    "specialty",
                    models.CharField(
                        choices=[
                            ("general", "Umumiy"),
                            ("landscape", "Landshaft"),
                            ("garden_care", "Bog' parvarishi"),
                            ("ornamental", "Manzarali o'simliklar"),
                            ("irrigation", "Sug'orish"),
                            ("pest_control", "Dorilash"),
                        ],
                        default="general",
                        max_length=32,
                    ),
                ),
                ("description", models.TextField(blank=True)),
                ("rating", models.DecimalField(decimal_places=2, default=0, max_digits=3)),
                (
                    "commission_rate",
                    models.DecimalField(
                        decimal_places=1,
                        default=0.3,
                        help_text="Foiz (0.1 — 0.5). Avtomatik tavsiya aylanmaga qarab beriladi.",
                        max_digits=3,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Faol"),
                            ("pending", "Kutilmoqda"),
                            ("suspended", "To'xtatilgan"),
                            ("ended", "Kelishuv tugagan"),
                        ],
                        db_index=True,
                        default="active",
                        max_length=16,
                    ),
                ),
                ("exit_reason", models.CharField(blank=True, max_length=512)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("location_lat", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("location_lng", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        limit_choices_to={"role": "worker"},
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="owned_firms",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Firma",
                "verbose_name_plural": "Firmalar",
                "ordering": ["name", "id"],
            },
        ),
        migrations.CreateModel(
            name="Investor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("full_name", models.CharField(max_length=255)),
                ("company_name", models.CharField(blank=True, max_length=255)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.CharField(blank=True, max_length=512)),
                ("investment_amount", models.DecimalField(decimal_places=2, default=0, max_digits=16)),
                ("currency", models.CharField(default="UZS", max_length=8)),
                ("share_percent", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Faol"),
                            ("pending", "Kutilmoqda"),
                            ("ended", "Tugatilgan"),
                        ],
                        default="active",
                        max_length=16,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("exit_reason", models.CharField(blank=True, max_length=512)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Investor",
                "verbose_name_plural": "Investorlar",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="employeeprofile",
            name="firm",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employees",
                to="staff.partnerfirm",
            ),
        ),
    ]
