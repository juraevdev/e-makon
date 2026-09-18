from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_profile_fields"),
        ("orders", "0002_order_mobile_statuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="loyalty_points",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="LoyaltySettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uzs_per_point", models.PositiveIntegerField(default=100000)),
                ("min_redeem_points", models.PositiveIntegerField(default=50)),
                ("expire_months", models.PositiveSmallIntegerField(default=12)),
            ],
            options={
                "verbose_name": "Ball sozlamasi",
                "verbose_name_plural": "Ball sozlamalari",
            },
        ),
        migrations.CreateModel(
            name="LoyaltyReward",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("icon", models.CharField(default="redeem", max_length=64)),
                ("points_cost", models.PositiveIntegerField()),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "ordering": ["sort_order", "id"],
                "verbose_name": "Ball mukofoti",
                "verbose_name_plural": "Ball mukofotlari",
            },
        ),
        migrations.CreateModel(
            name="PointTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("earn", "Hisobga olindi"),
                            ("redeem", "Almashtirildi"),
                            ("expire", "Muddati o'tdi"),
                            ("adjust", "Tuzatish"),
                        ],
                        max_length=16,
                    ),
                ),
                ("points", models.IntegerField()),
                ("note", models.CharField(blank=True, max_length=255)),
                (
                    "order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="point_transactions",
                        to="orders.order",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="point_transactions",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Ball tranzaksiyasi",
                "verbose_name_plural": "Ball tranzaksiyalari",
            },
        ),
    ]
