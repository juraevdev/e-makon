from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0010_order_items"),
        ("orders", "0010_order_scheduled_start_duration"),
    ]

    operations = []
