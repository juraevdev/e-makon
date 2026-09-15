# Generated manually for mobile service detail fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="category",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="service",
            name="duration",
            field=models.CharField(
                blank=True, default="O'rtacha vaqt: 1.5 - 2 soat", max_length=120
            ),
        ),
        migrations.AddField(
            model_name="service",
            name="features",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='[{"icon": "verified_outlined", "label": "Kafolat"}, ...]',
            ),
        ),
        migrations.AddField(
            model_name="service",
            name="gallery_images",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="service",
            name="hero_image_url",
            field=models.URLField(blank=True, max_length=512),
        ),
        migrations.AddField(
            model_name="service",
            name="long_description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="service",
            name="price_label",
            field=models.CharField(blank=True, default="Kelishilgan narxda", max_length=120),
        ),
    ]
