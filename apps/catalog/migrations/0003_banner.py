from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_service_mobile_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Banner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("image_url", models.URLField(blank=True, max_length=512)),
                ("image", models.ImageField(blank=True, null=True, upload_to="banners/")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Qoralama"),
                            ("scheduled", "Rejalashtirilgan"),
                            ("active", "Faol"),
                            ("archived", "Arxiv"),
                        ],
                        db_index=True,
                        default="draft",
                        max_length=16,
                    ),
                ),
                (
                    "placement",
                    models.CharField(
                        choices=[("home", "Bosh sahifa"), ("promo", "Promo")],
                        default="home",
                        max_length=16,
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                (
                    "link_service",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="banners",
                        to="catalog.service",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "-id"],
                "verbose_name": "Banner",
                "verbose_name_plural": "Bannerlar",
            },
        ),
    ]
