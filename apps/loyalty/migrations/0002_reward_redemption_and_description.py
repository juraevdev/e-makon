from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("loyalty", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="loyaltyreward",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="pointtransaction",
            name="fulfilled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pointtransaction",
            name="redemption_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "—"),
                    ("pending", "Kutilmoqda"),
                    ("fulfilled", "Bajarildi"),
                    ("cancelled", "Bekor"),
                ],
                db_index=True,
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="pointtransaction",
            name="reward",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="redemptions",
                to="loyalty.loyaltyreward",
            ),
        ),
    ]
