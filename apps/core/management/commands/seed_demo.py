from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import LoyaltyReward, LoyaltySettings, PointTransaction, User
from apps.catalog.models import Banner, Service
from apps.orders.models import Order, OrderStatusHistory
from apps.staff.commission import calc_platform_share, suggest_commission_rate
from apps.staff.models import EmployeeProfile, Investor, PartnerFirm
from apps.support.models import SupportMessage, SupportTicket


class Command(BaseCommand):
    help = "Demo mijoz, firma, investor, buyurtma va banner ma'lumotlarini to'ldirish."

    def handle(self, *args, **options):
        LoyaltySettings.get()
        if not Service.objects.exists():
            self.stdout.write(self.style.WARNING("Avval: python manage.py seed_catalog"))
            return

        customers = self._customers()
        firms = self._firms()
        workers = self._workers(firms)
        self._investors()
        self._orders(customers, workers, firms)
        self._banners()
        self._loyalty()
        self._support(customers)
        self.stdout.write(self.style.SUCCESS("Demo ma'lumotlar tayyor."))

    def _firms(self) -> list[PartnerFirm]:
        specs = [
            {
                "name": "GreenLine Scapes",
                "legal_name": "GreenLine Scapes MChJ",
                "phone": "+998712004567",
                "region": "Toshkent",
                "district": "Chilonzor",
                "address": "Toshkent sh., Chilonzor tumani, Bunyodkor 42",
                "specialty": EmployeeProfile.Specialty.LANDSCAPE,
                "rating": Decimal("4.90"),
                "commission_rate": Decimal("0.3"),
                "status": PartnerFirm.Status.ACTIVE,
                "location_lat": Decimal("41.2910000"),
                "location_lng": Decimal("69.2100000"),
            },
            {
                "name": "AquaDrop Systems",
                "legal_name": "AquaDrop Systems MChJ",
                "phone": "+998662348901",
                "region": "Samarqand",
                "address": "Samarqand sh., Registon ko'chasi 18",
                "specialty": EmployeeProfile.Specialty.IRRIGATION,
                "rating": Decimal("4.70"),
                "commission_rate": Decimal("0.2"),
                "status": PartnerFirm.Status.ACTIVE,
                "location_lat": Decimal("39.6550000"),
                "location_lng": Decimal("66.9760000"),
            },
            {
                "name": "TerraBotanica",
                "phone": "+998901123456",
                "region": "Toshkent",
                "address": "Toshkent vil., Bo'stonliq",
                "specialty": EmployeeProfile.Specialty.GARDEN_CARE,
                "rating": Decimal("4.20"),
                "commission_rate": Decimal("0.1"),
                "status": PartnerFirm.Status.ENDED,
                "is_active": False,
                "exit_reason": "Shartnoma muddati tugadi, yangilash kelishilmadi",
                "ended_at": timezone.now() - timedelta(days=20),
                "location_lat": Decimal("41.3300000"),
                "location_lng": Decimal("69.7400000"),
            },
            {
                "name": "PathMaker Hardscapes",
                "phone": "+998735432198",
                "region": "Farg'ona",
                "address": "Farg'ona sh., Al-Farg'oniy 77",
                "specialty": EmployeeProfile.Specialty.PEST_CONTROL,
                "rating": Decimal("0.00"),
                "commission_rate": Decimal("0.2"),
                "status": PartnerFirm.Status.PENDING,
                "location_lat": Decimal("40.3864000"),
                "location_lng": Decimal("71.7864000"),
            },
        ]
        firms = []
        for spec in specs:
            firm, _ = PartnerFirm.objects.update_or_create(
                name=spec["name"],
                defaults=spec,
            )
            firms.append(firm)
        return firms

    def _investors(self) -> None:
        specs = [
            {
                "full_name": "Kamoliddin Norqobilov",
                "company_name": "Verdant Capital",
                "phone": "+998901111222",
                "investment_amount": Decimal("250000000"),
                "share_percent": Decimal("12.5"),
                "status": Investor.Status.ACTIVE,
            },
            {
                "full_name": "Shahnoza Ismoilova",
                "company_name": "Green Fund Asia",
                "phone": "+998933334455",
                "investment_amount": Decimal("100000000"),
                "share_percent": Decimal("5.0"),
                "status": Investor.Status.ACTIVE,
            },
            {
                "full_name": "Rustam Qodirov",
                "company_name": "Oasis Partners",
                "phone": "+998944445566",
                "investment_amount": Decimal("50000000"),
                "share_percent": Decimal("2.0"),
                "status": Investor.Status.ENDED,
                "is_active": False,
                "exit_reason": "Investitsiya muddati tugadi",
                "ended_at": timezone.now() - timedelta(days=40),
            },
        ]
        for spec in specs:
            Investor.objects.update_or_create(phone=spec["phone"], defaults=spec)

    def _customers(self) -> list[User]:
        specs = [
            {
                "phone": "+998901234567",
                "first_name": "Azizbek",
                "last_name": "Rustamov",
                "region": "Toshkent",
                "district": "Yunusobod",
                "street": "Amir Temur 42",
                "home_address": "Yunusobod, Toshkent",
                "location_lat": Decimal("41.3651000"),
                "location_lng": Decimal("69.2892000"),
                "loyalty_points": 1250,
            },
            {
                "phone": "+998977654321",
                "first_name": "Malika",
                "last_name": "Alieva",
                "region": "Toshkent",
                "district": "Mirzo Ulug'bek",
                "street": "Mustaqillik 18",
                "home_address": "Mirzo Ulug'bek, Toshkent",
                "location_lat": Decimal("41.3384000"),
                "location_lng": Decimal("69.3341000"),
                "loyalty_points": 840,
            },
            {
                "phone": "+998995551234",
                "first_name": "Timur",
                "last_name": "Kasimov",
                "region": "Toshkent",
                "district": "Chilonzor",
                "street": "Bunyodkor 7",
                "home_address": "Chilonzor, Toshkent",
                "location_lat": Decimal("41.2852000"),
                "location_lng": Decimal("69.2048000"),
                "loyalty_points": 120,
                "is_active": False,
            },
            {
                "phone": "+998948887766",
                "first_name": "Sardor",
                "last_name": "Jalolov",
                "region": "Toshkent",
                "district": "Sergeli",
                "street": "Yangihayot 15",
                "home_address": "Sergeli, Toshkent",
                "location_lat": Decimal("41.2214000"),
                "location_lng": Decimal("69.2183000"),
                "loyalty_points": 3100,
            },
            {
                "phone": "+998935551122",
                "first_name": "Dilnoza",
                "last_name": "Rashidova",
                "region": "Samarqand",
                "district": "Registon",
                "street": "Registon 3",
                "home_address": "Samarqand shahri",
                "location_lat": Decimal("39.6542000"),
                "location_lng": Decimal("66.9758000"),
                "loyalty_points": 420,
            },
        ]
        users = []
        for item in specs:
            spec = {**item}
            phone = spec.pop("phone")
            user, created = User.objects.get_or_create(
                phone=phone,
                defaults={"role": User.Role.CUSTOMER, **spec},
            )
            if not created:
                for key, value in spec.items():
                    setattr(user, key, value)
                user.role = User.Role.CUSTOMER
                user.save()
            users.append(user)
        return users

    def _workers(self, firms: list[PartnerFirm]) -> list[EmployeeProfile]:
        specs = [
            {
                "phone": "+998711234567",
                "first_name": "Jamshid",
                "last_name": "Karimov",
                "specialty": EmployeeProfile.Specialty.LANDSCAPE,
                "rating": Decimal("4.90"),
                "region": "Toshkent",
                "district": "Chilonzor",
                "street": "Bunyodkor 42",
                "home_address": "Toshkent sh., Chilonzor tumani",
                "location_lat": Decimal("41.2910000"),
                "location_lng": Decimal("69.2100000"),
                "firm": firms[0],
            },
            {
                "phone": "+998662348901",
                "first_name": "Nilufar",
                "last_name": "Saidova",
                "specialty": EmployeeProfile.Specialty.IRRIGATION,
                "rating": Decimal("4.70"),
                "region": "Samarqand",
                "district": "Registon",
                "street": "Registon 18",
                "home_address": "Samarqand sh., Registon ko'chasi 18",
                "location_lat": Decimal("39.6550000"),
                "location_lng": Decimal("66.9760000"),
                "firm": firms[1],
            },
            {
                "phone": "+998901112233",
                "first_name": "Bekzod",
                "last_name": "Toshmatov",
                "specialty": EmployeeProfile.Specialty.GARDEN_CARE,
                "rating": Decimal("4.20"),
                "is_active": False,
                "region": "Toshkent",
                "district": "Bo'stonliq",
                "home_address": "Toshkent vil., Bo'stonliq",
                "location_lat": Decimal("41.3300000"),
                "location_lng": Decimal("69.7400000"),
                "firm": firms[2],
            },
            {
                "phone": "+998735432198",
                "first_name": "Otabek",
                "last_name": "Yuldashev",
                "specialty": EmployeeProfile.Specialty.PEST_CONTROL,
                "rating": Decimal("0.00"),
                "is_active": False,
                "region": "Farg'ona",
                "district": "Farg'ona sh.",
                "home_address": "Farg'ona sh., Al-Farg'oniy 77",
                "location_lat": Decimal("40.3864000"),
                "location_lng": Decimal("71.7864000"),
                "firm": firms[3],
            },
        ]
        workers = []
        for item in specs:
            spec = {**item}
            phone = spec.pop("phone")
            specialty = spec.pop("specialty")
            rating = spec.pop("rating")
            is_active = spec.pop("is_active", True)
            firm = spec.pop("firm", None)
            user, _ = User.objects.get_or_create(
                phone=phone,
                defaults={"role": User.Role.WORKER, **spec},
            )
            user.role = User.Role.WORKER
            for key, value in spec.items():
                setattr(user, key, value)
            user.save()
            profile, _ = EmployeeProfile.objects.get_or_create(
                user=user,
                defaults={
                    "specialty": specialty,
                    "rating": rating,
                    "is_active": is_active,
                    "firm": firm,
                },
            )
            profile.specialty = specialty
            profile.rating = rating
            profile.is_active = is_active
            profile.firm = firm
            profile.save()
            if firm and not firm.owner_id:
                firm.owner = user
                firm.save(update_fields=["owner"])
            workers.append(profile)
        return workers

    def _orders(
        self, customers: list[User], workers: list[EmployeeProfile], firms: list[PartnerFirm]
    ) -> None:
        if Order.objects.exists():
            # Link missing firms on existing demo orders
            for order in Order.objects.filter(firm__isnull=True, assigned_worker__isnull=False):
                emp = getattr(order.assigned_worker, "employee_profile", None)
                if emp and emp.firm_id:
                    order.firm = emp.firm
                    order.firm_name = emp.firm.name
                    if order.status == Order.Status.COMPLETED and order.quoted_price is not None:
                        rate = emp.firm.commission_rate or suggest_commission_rate(order.quoted_price)
                        order.commission_rate_applied = rate
                        order.platform_share = calc_platform_share(order.quoted_price, rate)
                    order.save()
            return
        catalog = {s.slug: s for s in Service.objects.all()}
        now = timezone.now()
        rows = [
            {
                "customer": customers[3],
                "service": catalog.get("lawn-care"),
                "status": Order.Status.IN_REVIEW,
                "address": customers[3].home_address,
                "quoted_price": Decimal("480000"),
                "worker": workers[0],
                "firm": firms[0],
                "days_ago": 0,
                "area_size": "120 m²",
            },
            {
                "customer": customers[1],
                "service": catalog.get("landscape-design"),
                "status": Order.Status.COMPLETED,
                "address": customers[1].home_address,
                "quoted_price": Decimal("3200000"),
                "worker": workers[0],
                "firm": firms[0],
                "days_ago": 1,
                "area_size": "450 m²",
            },
            {
                "customer": customers[0],
                "service": catalog.get("irrigation"),
                "status": Order.Status.CONTACTED,
                "address": customers[0].home_address,
                "quoted_price": Decimal("950000"),
                "worker": workers[1],
                "firm": firms[1],
                "days_ago": 2,
                "area_size": "80 m²",
            },
            {
                "customer": customers[4],
                "service": catalog.get("tree-care"),
                "status": Order.Status.CANCELLED,
                "address": customers[4].home_address,
                "quoted_price": Decimal("1500000"),
                "worker": workers[0],
                "firm": firms[0],
                "days_ago": 3,
                "area_size": "6 daraxt",
            },
            {
                "customer": customers[2],
                "service": catalog.get("pest-control"),
                "status": Order.Status.COMPLETED,
                "address": customers[2].home_address,
                "quoted_price": Decimal("750000"),
                "worker": workers[3],
                "firm": firms[3],
                "days_ago": 4,
                "area_size": "200 m²",
            },
            {
                "customer": customers[0],
                "service": catalog.get("free-consultation"),
                "status": Order.Status.NEW,
                "address": customers[0].home_address,
                "quoted_price": None,
                "worker": None,
                "firm": None,
                "days_ago": 0,
                "area_size": "",
            },
            {
                "customer": customers[1],
                "service": catalog.get("lawn-care"),
                "status": Order.Status.COMPLETED,
                "address": customers[1].home_address,
                "quoted_price": Decimal("520000"),
                "worker": workers[0],
                "firm": firms[0],
                "days_ago": 5,
                "area_size": "90 m²",
            },
            {
                "customer": customers[3],
                "service": catalog.get("irrigation"),
                "status": Order.Status.COMPLETED,
                "address": customers[3].home_address,
                "quoted_price": Decimal("2100000"),
                "worker": workers[1],
                "firm": firms[1],
                "days_ago": 6,
                "area_size": "150 m²",
            },
        ]
        for row in rows:
            service = row["service"]
            if service is None:
                continue
            customer = row["customer"]
            worker = row["worker"]
            firm = row["firm"]
            created = now - timedelta(days=row["days_ago"], hours=3)
            platform_share = None
            rate_applied = None
            if row["status"] == Order.Status.COMPLETED and row["quoted_price"] is not None:
                rate_applied = (
                    firm.commission_rate if firm else suggest_commission_rate(row["quoted_price"])
                )
                platform_share = calc_platform_share(row["quoted_price"], rate_applied)
            order = Order.objects.create(
                customer=customer,
                service=service,
                status=row["status"],
                address=row["address"],
                area_size=row["area_size"],
                phone_number=customer.phone,
                customer_first_name=customer.first_name,
                customer_last_name=customer.last_name,
                quoted_price=row["quoted_price"],
                assigned_worker=worker.user if worker else None,
                assigned_worker_name=(worker.user.display_name if worker else ""),
                firm=firm,
                firm_name=(firm.name if firm else ""),
                platform_share=platform_share,
                commission_rate_applied=rate_applied,
            )
            Order.objects.filter(pk=order.pk).update(created_at=created, updated_at=created)
            OrderStatusHistory.objects.create(
                order=order,
                from_status="",
                to_status=row["status"],
                note="Demo",
            )

    def _banners(self) -> None:
        if Banner.objects.exists():
            return
        Banner.objects.bulk_create(
            [
                Banner(
                    title="Bahorgi ekish mavsumi",
                    description="Yangi mavsumiy ekish xizmatlari. Chegirmalar va ko'chat ekish kampaniyasi.",
                    image_url="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=640&h=360&fit=crop",
                    status=Banner.Status.ACTIVE,
                    placement=Banner.Placement.HOME,
                    sort_order=1,
                ),
                Banner(
                    title="Hasharotlarga qarshi dorilash",
                    description="Sertifikatlangan preparatlar bilan xavfsiz himoya. Mobil ilovada band qiling.",
                    image_url="https://images.unsplash.com/photo-1592419044706-39796d40f98c?w=640&h=360&fit=crop",
                    status=Banner.Status.ACTIVE,
                    placement=Banner.Placement.HOME,
                    sort_order=2,
                    link_service=Service.objects.filter(slug="pest-control").first(),
                ),
                Banner(
                    title="Kuzgi daraxt parvarishi",
                    description="Mavsumiy daraxt himoyasi. 20-oktabrdan boshlanadi.",
                    image_url="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=640&h=360&fit=crop",
                    status=Banner.Status.SCHEDULED,
                    placement=Banner.Placement.PROMO,
                    sort_order=3,
                ),
            ]
        )

    def _loyalty(self) -> None:
        if not LoyaltyReward.objects.exists():
            LoyaltyReward.objects.bulk_create(
                [
                    LoyaltyReward(name="Standart maysazorni o'rish", icon="grass", points_cost=150, sort_order=1),
                    LoyaltyReward(name="Tomchilatib sug'orish diagnostikasi", icon="water_drop", points_cost=200, sort_order=2),
                    LoyaltyReward(name="Daraxt sanitariya kesimi", icon="park", points_cost=350, sort_order=3),
                    LoyaltyReward(
                        name="Premium landshaft konsultatsiya",
                        icon="architecture",
                        points_cost=500,
                        is_active=False,
                        sort_order=4,
                    ),
                ]
            )
        if PointTransaction.objects.exists():
            return
        users = list(User.objects.filter(role=User.Role.CUSTOMER)[:4])
        if len(users) < 3:
            return
        order = Order.objects.filter(customer=users[0]).first()
        PointTransaction.objects.bulk_create(
            [
                PointTransaction(user=users[0], kind=PointTransaction.Kind.EARN, points=45, order=order, note="Demo"),
                PointTransaction(user=users[1], kind=PointTransaction.Kind.REDEEM, points=-150, note="Maysazor"),
                PointTransaction(user=users[3] if len(users) > 3 else users[0], kind=PointTransaction.Kind.EARN, points=120, note="Demo"),
            ]
        )

    def _support(self, customers: list[User]) -> None:
        if SupportTicket.objects.exists():
            return
        ticket = SupportTicket.objects.create(
            customer=customers[0],
            subject="Buyurtma vaqti haqida savol",
            status=SupportTicket.Status.OPEN,
            priority=SupportTicket.Priority.NORMAL,
        )
        SupportMessage.objects.create(
            ticket=ticket,
            sender=customers[0],
            body="Salom, gazon parvarishi uchun mutaxassis qachon keladi?",
        )
        ticket2 = SupportTicket.objects.create(
            customer=customers[1],
            subject="Sug'orish tizimi bo'yicha maslahat",
            status=SupportTicket.Status.IN_PROGRESS,
            priority=SupportTicket.Priority.HIGH,
        )
        SupportMessage.objects.create(
            ticket=ticket2,
            sender=customers[1],
            body="Hovlimizga avtomatik sug'orish o'rnatmoqchimiz.",
        )
