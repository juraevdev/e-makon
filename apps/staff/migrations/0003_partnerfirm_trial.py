from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("staff", "0002_firms_investors"),
    ]

    operations = [
        migrations.AddField(
            model_name="partnerfirm",
            name="trial_ends_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Sinov muddati tugash sanasi. Bo'sh bo'lsa doimiy hamkorlik.",
                null=True,
            ),
        ),
    ]
