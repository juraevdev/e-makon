"""Taqdimot/demo uchun ma'lumotlar: firmalar, xodimlar, takliflar, buyurtmalar, sharhlar.

Faqat lokal/dev bazada ishlating. Qayta ishga tushirilsa, mavjud yozuvlar takrorlanmaydi.
"""

from __future__ import annotations

from datetime import time, timedelta
from decimal import Decimal

from django.core.management import BaseCommand, call_command
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.catalog.models import Service
from apps.orders import schedule
from apps.orders.finance import FinanceService
from apps.orders.models import Order
from apps.orders.payments import PaymentService
from apps.orders.services import STAGE_SEQUENCE, OrderService
from apps.organizations.models import FirmReview, Organization
from apps.organizations.services import ReviewService, get_or_create_default_organization
from apps.staff.models import AdminProfile, EmployeeProfile

SUPERADMIN = ("+998900000001", "admin12345", "Bosh administrator")

FIRMS = [
    {
        "slug": "yashil-bog-servis",
        "name": "Yashil Bog' Servis",
        "admin": ("+998900000002", "firma12345", "Akmal Rahimov"),
        "phone": "+998901112233",
        "address": "Toshkent, Yunusobod tumani, Amir Temur ko'chasi 108",
        "region": "Toshkent",
        "district": "Yunusobod",
        "lat": "41.3650000",
        "lng": "69.2890000",
        "description": "Bog' parvarishi, daraxt kesish va landshaft dizayni bo'yicha 8 yillik tajriba.",
        "specialty": "garden_care",
        "instagram": "yashilbog.uz",
        "telegram_channel": "yashilbog_uz",
        "discount": 0.0,
        "workers": [
            ("+998900000011", "Bekzod Tursunov", "landscape"),
            ("+998900000012", "Sardor Aliyev", "garden_care"),
            ("+998900000013", "Jamshid Karimov", "irrigation"),
        ],
    },
    {
        "slug": "gulzor-landshaft",
        "name": "Gulzor Landshaft",
        "admin": ("+998900000003", "firma12345", "Dilnoza Yusupova"),
        "phone": "+998935554433",
        "address": "Toshkent, Mirzo Ulug'bek tumani, Buyuk Ipak Yo'li 52",
        "region": "Toshkent",
        "district": "Mirzo Ulug'bek",
        "lat": "41.3260000",
        "lng": "69.3350000",
        "description": "Manzarali o'simliklar, gazon va sug'orish tizimlari.",
        "specialty": "landscape",
        "instagram": "gulzor.landshaft",
        "telegram_channel": "gulzor_landshaft",
        "discount": 0.1,
        "workers": [
            ("+998900000021", "Otabek Nazarov", "ornamental"),
            ("+998900000022", "Farrux Ismoilov", "pest_control"),
        ],
    },
]

CUSTOMERS = [
    ("+998901000101", "Aziz", "Qodirov", "Toshkent, Chilonzor 9-kvartal"),
    ("+998901000102", "Malika", "Saidova", "Toshkent, Yakkasaroy, Bobur ko'chasi 14"),
    ("+998901000103", "Rustam", "Ergashev", "Toshkent, Sergeli, Yangi Sergeli 3"),
    ("+998901000104", "Nodira", "Hamidova", "Toshkent, Shayxontohur, Navoiy 30"),
    ("+998901000105", "Javohir", "Usmonov", "Toshkent, Olmazor, Qorasaroy 7"),
    ("+998901000106", "Gulnora", "Rasulova", "Toshkent, Mirobod, Shahrisabz 21"),
]

REVIEWS = [
    (5, "Juda tez kelishdi, bog'imiz tanib bo'lmas darajada chiroyli bo'ldi!"),
    (5, "Narxi ilovada oldindan ko'rindi, ortiqcha to'lov bo'lmadi."),
    (4, "Yaxshi ishlashdi, faqat 20 daqiqa kechikishdi."),
    (5, "Ilovadan bandlikni ko'rib qulay vaqtni tanladim."),
]


def _user(phone: str, role: str, full_name: str, *, password: str | None = None, org=None, **extra):
    first, _, last = full_name.partition(" ")
    user = User.objects.filter(phone=phone).first()
    if user is None:
        user = User.objects.create_user(
            phone=phone,
            password=password,
            role=role,
            organization=org,
            full_name=full_name,
            first_name=first,
            last_name=last,
            **extra,
        )
    elif password:
        user.set_password(password)
        user.save(update_fields=["password"])
    return user


class Command(BaseCommand):
    help = "Investor taqdimoti uchun demo ma'lumotlar (firmalar, buyurtmalar, bandlik jadvali)."

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_catalog")
        get_or_create_default_organization()
        _user(SUPERADMIN[0], User.Role.SUPERADMIN, SUPERADMIN[2], password=SUPERADMIN[1], is_staff=True)

        roots = list(
            Service.objects.filter(base_service__isnull=True, organization__slug="default", is_active=True)
        )
        customers = [
            _user(phone, User.Role.CUSTOMER, f"{first} {last}", home_address=address)
            for phone, first, last, address in CUSTOMERS
        ]

        for spec in FIRMS:
            firm = self._firm(spec, roots)
            if not Order.objects.filter(organization=firm).exists():
                self._orders(firm, customers)

        self.stdout.write(self.style.SUCCESS("Demo ma'lumotlar tayyor."))
        self.stdout.write(f"Super admin:  {SUPERADMIN[0]} / {SUPERADMIN[1]}  (http://localhost:3000)")
        for spec in FIRMS:
            phone, password, _ = spec["admin"]
            self.stdout.write(f"Firma admin:  {phone} / {password}  ({spec['name']}, http://localhost:3002)")
        self.stdout.write(f"Mijoz (mobil): {CUSTOMERS[0][0]} — SMS kod ekranda chiqadi")

    def _firm(self, spec: dict, roots: list[Service]) -> Organization:
        firm, _ = Organization.objects.update_or_create(
            slug=spec["slug"],
            defaults={
                "name": spec["name"],
                "phone": spec["phone"],
                "address": spec["address"],
                "region": spec["region"],
                "district": spec["district"],
                "description": spec["description"],
                "specialty": spec["specialty"],
                "instagram": spec["instagram"],
                "telegram_channel": spec["telegram_channel"],
                "work_hours": "08:00 – 20:00",
                "location_lat": Decimal(spec["lat"]),
                "location_lng": Decimal(spec["lng"]),
                "status": Organization.Status.ACTIVE,
                "is_active": True,
                "commission_rate": Decimal("0.30"),
                "subscription_plan": Organization.SubscriptionPlan.MONTHLY,
            },
        )
        phone, password, name = spec["admin"]
        admin = _user(phone, User.Role.ADMIN, name, password=password, org=firm, is_staff=True)
        AdminProfile.objects.update_or_create(
            user=admin,
            defaults={
                "organization": firm,
                "title": "Direktor",
                "can_manage_orders": True,
                "can_manage_staff": True,
                "can_view_analytics": True,
            },
        )
        if firm.owner_id is None:
            firm.owner = admin
            firm.save(update_fields=["owner", "updated_at"])

        for w_phone, w_name, specialty in spec["workers"]:
            worker = _user(w_phone, User.Role.WORKER, w_name, org=firm)
            EmployeeProfile.objects.update_or_create(
                user=worker,
                defaults={
                    "organization": firm,
                    "specialty": specialty,
                    "position": "Bog'bon",
                    "rating": Decimal("4.80"),
                },
            )

        now = timezone.now()
        for root in roots:
            low = int(root.price_from or 0)
            price = int(low * (1 - spec["discount"])) if low else 0
            Service.objects.update_or_create(
                organization=firm,
                slug=f"{root.slug}-{firm.slug}"[:64],
                defaults={
                    "base_service": root,
                    "name": root.name,
                    "emoji": root.emoji,
                    "icon": root.icon,
                    "category": root.category,
                    "short_description": root.short_description,
                    "description": root.description,
                    "duration": root.duration,
                    "price_from": Decimal(price) if price else None,
                    "price_to": root.price_to,
                    "is_active": True,
                    "moderation_status": Service.Moderation.APPROVED,
                    "moderated_at": now,
                },
            )
        return firm

    def _offer(self, firm: Organization, slug: str) -> Service:
        return Service.objects.get(organization=firm, base_service__slug=slug)

    def _orders(self, firm: Organization, customers: list[User]) -> None:
        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)
        workers = list(User.objects.filter(organization=firm, role=User.Role.WORKER))

        def make(customer, slug, *, day, start=None, minutes=60, area="120", price=None):
            service = self._offer(firm, slug)
            amount = price if price is not None else int(service.price_from or 0)
            order = Order.objects.create(
                customer=customer,
                organization=firm,
                service=service,
                phone_number=customer.phone,
                customer_first_name=customer.first_name,
                customer_last_name=customer.last_name,
                address=customer.home_address,
                area_size=area,
                notes="Bog' holati rasmda ko'rsatilgan.",
                quoted_price=Decimal(amount) if amount else None,
                scheduled_date=day,
                scheduled_start=start,
                duration_minutes=minutes,
                time_slot=schedule.format_slot(start, minutes) if start else "",
                location_lat=firm.location_lat - Decimal("0.0150"),
                location_lng=firm.location_lng + Decimal("0.0120"),
            )
            return order

        def advance(order, stage, worker=None):
            order = Order.objects.get(pk=order.pk)
            if worker is not None:
                order.assigned_worker = worker
                order.assigned_worker_name = worker.full_name
                order.save(update_fields=["assigned_worker", "assigned_worker_name"])
            for s in STAGE_SEQUENCE[: STAGE_SEQUENCE.index(stage) + 1]:
                OrderService.set_stage(order, s, distance_km=4.2 if s == "on_the_way" else None,
                                       eta_minutes=18 if s == "on_the_way" else None)

        # O'tgan 4 hafta: yakunlangan va pul firmaga o'tkazilgan buyurtmalar (hisobot/grafiklar uchun).
        history = ["lawn-care", "tree-care", "fertilizing", "pest-control", "pine-shaping",
                   "lawn-care", "irrigation", "tree-care", "landscape-design", "lawn-care"]
        for i, slug in enumerate(history):
            customer = customers[i % len(customers)]
            day = today - timedelta(days=3 + i * 2)
            order = make(customer, slug, day=day, start=time(9 + i % 8, 0), area=str(80 + i * 25))
            if order.quoted_price:
                PaymentService.pay_test(order)
            advance(order, "finished", workers[i % len(workers)] if workers else None)
            order = Order.objects.get(pk=order.pk)
            if PaymentService.status(order) == "paid":
                FinanceService.release(order, note="Mijoz ishni tasdiqladi")
            Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(days=4 + i * 2))
            if i < len(REVIEWS) and not FirmReview.objects.filter(order=order).exists():
                score, comment = REVIEWS[i]
                ReviewService.submit(firm, customer, score=score, comment=comment, order_id=order.pk)

        # Ertangi kun: bandlik jadvali (qizil/yashil) ko'rinishi uchun.
        capacity = schedule.firm_capacity(firm.pk)
        plan = [(time(9, 0), 60)] * capacity + [(time(10, 0), 60), (time(13, 0), 120)]
        plan += [(time(13, 0), 60)] * max(capacity - 1, 0) + [(time(16, 0), 90)]
        slugs = ["lawn-care", "tree-care", "fertilizing", "pest-control", "pine-shaping", "lawn-care"]
        for i, (start, minutes) in enumerate(plan):
            order = make(customers[i % len(customers)], slugs[i % len(slugs)], day=tomorrow, start=start,
                         minutes=minutes)
            if order.quoted_price and i % 3 != 2:
                PaymentService.pay_test(order)
                advance(order, "accepted", workers[i % len(workers)] if workers else None)
            if i > 1:
                Order.objects.filter(pk=order.pk).update(
                    created_at=timezone.now() - timedelta(days=1 + i % 6, hours=i)
                )

        # Bugun: jarayondagi buyurtmalar (yo'lda / ishlayapti) va yangi to'lanmagan buyurtma.
        now_hour = max(timezone.localtime().hour, schedule.WORK_START_HOUR)
        active = [("tree-care", "on_the_way"), ("lawn-care", "working")]
        for i, (slug, stage) in enumerate(active):
            order = make(customers[(i + 2) % len(customers)], slug, day=today,
                         start=time(min(now_hour, 19), 0), minutes=120)
            PaymentService.pay_test(order)
            advance(order, stage, workers[i % len(workers)] if workers else None)
        make(customers[5], "landscape-design", day=today + timedelta(days=2), start=time(11, 0), minutes=180,
             area="400")
