from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.core.scheduling import run_all


class Command(BaseCommand):
    help = (
        "Kunlik vazifalar: ball muddati, firma sinov muddati, parvarish eslatmalari. "
        "Cron: 0 7 * * * cd /app && python manage.py run_scheduled_tasks"
    )

    def handle(self, *args, **options):
        result = run_all()
        self.stdout.write(self.style.SUCCESS(f"OK {result}"))
