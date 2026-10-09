"""SuperAdmin yoki firma admin panel uchun login yaratadi / parolini yangilaydi.

    python manage.py ensure_panel_user superadmin +998900000001 PAROL
    python manage.py ensure_panel_user admin +998900000002 PAROL --firm-slug my-firm --firm-name "My Firm"
"""

from __future__ import annotations

from django.core.management import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.core.phone import normalize_phone
from apps.organizations.models import Organization
from apps.staff.models import AdminProfile


class Command(BaseCommand):
    help = "SuperAdmin / firma admin panel foydalanuvchisini yaratadi yoki parolini yangilaydi."

    def add_arguments(self, parser):
        parser.add_argument("role", choices=["superadmin", "admin"])
        parser.add_argument("phone")
        parser.add_argument("password")
        parser.add_argument("--full-name", default="")
        parser.add_argument("--firm-slug", default="")
        parser.add_argument("--firm-name", default="")

    @transaction.atomic
    def handle(self, *args, role, phone, password, full_name, firm_slug, firm_name, **options):
        if len(password) < 8:
            raise CommandError("Parol kamida 8 belgi bo'lishi kerak.")

        firm = None
        if role == "admin":
            if not firm_slug:
                raise CommandError("Firma admin uchun --firm-slug majburiy.")
            firm, _ = Organization.objects.get_or_create(
                slug=firm_slug,
                defaults={
                    "name": firm_name or firm_slug,
                    "status": Organization.Status.ACTIVE,
                    "is_active": True,
                },
            )

        user_role = User.Role.SUPERADMIN if role == "superadmin" else User.Role.ADMIN
        full_name = full_name or ("Bosh administrator" if role == "superadmin" else "Firma administratori")
        first, _, last = full_name.partition(" ")

        user = User.objects.filter(phone=normalize_phone(phone)).first()
        if user is None:
            user = User.objects.create_user(
                phone=phone,
                password=password,
                role=user_role,
                organization=firm,
                full_name=full_name,
                first_name=first,
                last_name=last,
                is_staff=True,
            )
        else:
            user.set_password(password)
            user.role = user_role
            user.organization = firm
            user.is_staff = True
            user.is_active = True
            user.save()

        if role == "superadmin":
            if not user.is_superuser:
                user.is_superuser = True
                user.save(update_fields=["is_superuser"])
        else:
            AdminProfile.objects.update_or_create(
                user=user,
                defaults={
                    "organization": firm,
                    "title": "Direktor",
                    "can_manage_orders": True,
                    "can_manage_staff": True,
                    "can_view_analytics": True,
                    "is_active": True,
                },
            )
            if firm.owner_id is None:
                firm.owner = user
                firm.save(update_fields=["owner"])

        org = f", firma: {firm.name} ({firm.slug})" if firm else ""
        self.stdout.write(self.style.SUCCESS(f"{user.role}: {user.phone}{org}"))
