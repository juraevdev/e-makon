from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_order_mobile_statuses"),
        ("staff", "0002_firms_investors"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="firm",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to="staff.partnerfirm",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="firm_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="order",
            name="platform_share",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="commission_rate_applied",
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True),
        ),
    ]
