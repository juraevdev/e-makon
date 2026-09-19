from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.catalog.models import Service
from apps.organizations.services import get_or_create_default_organization

_DEFAULT_FEATURES = [
    {"icon": "verified_outlined", "label": "Kafolat"},
    {"icon": "eco_outlined", "label": "Sifatli dori"},
    {"icon": "groups_outlined", "label": "Ekspertlar"},
    {"icon": "schedule_outlined", "label": "Tezkorlik"},
]

_SPRAY_HERO = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800"
_SPRAY_GALLERY = [
    "https://images.unsplash.com/photo-1592419044706-39796d40f98c?w=600",
    "https://images.unsplash.com/photo-1585320806297-9794b1703bda?w=600",
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600",
]

# Mobile `kServices` / string id → API slug (underscore → hyphen)
SERVICES = [
    {
        "slug": "free-consultation",
        "name": "Bepul maslahat",
        "emoji": "📞",
        "icon": "phone_in_talk",
        "category": "Maslahat",
        "sort_order": 1,
        "short_description": "Bog' bo'yicha bepul maslahat va ko'rik",
        "description": "Bog' bo'yicha bepul maslahat va ko'rik",
        "duration": "O'rtacha vaqt: 30 daqiqa",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "landscape-design",
        "name": "Landshaft dizayn",
        "emoji": "📐",
        "icon": "architecture",
        "category": "Dizayn",
        "sort_order": 2,
        "short_description": "Bog'ingiz uchun professional loyiha va 3D vizualizatsiya",
        "description": "Bog'ingiz uchun professional loyiha va 3D vizualizatsiya",
        "duration": "O'rtacha vaqt: 2 - 3 kun",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "tree-care",
        "name": "Daraxt parvarishi",
        "emoji": "🌳",
        "icon": "park",
        "category": "Parvarish",
        "sort_order": 3,
        "short_description": "Daraxtlarni kesish, shakllantirish va parvarish qilish",
        "description": "Daraxtlarni kesish, shakllantirish va parvarish qilish",
        "duration": "O'rtacha vaqt: 2 - 4 soat",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "lawn-care",
        "name": "Gazon parvarish",
        "emoji": "✂️",
        "icon": "content_cut",
        "category": "Parvarish",
        "sort_order": 4,
        "short_description": "Gazon kesish, parvarish va tiklash xizmatlari",
        "description": "Gazon kesish, parvarish va tiklash xizmatlari",
        "duration": "O'rtacha vaqt: 1 - 2 soat",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "pine-shaping",
        "name": "Archaga shakl",
        "emoji": "🌲",
        "icon": "forest",
        "category": "Parvarish",
        "sort_order": 5,
        "short_description": "Archa va ignabargli daraxtlarni shakllantirish",
        "description": "Archa va ignabargli daraxtlarni shakllantirish",
        "duration": "O'rtacha vaqt: 2 - 3 soat",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "pest-control",
        "name": "Hasharotlarga qarshi dorilash",
        "emoji": "🧪",
        "icon": "science",
        "category": "Parvarish",
        "sort_order": 6,
        "short_description": "O'simliklarni hasharot va kasalliklardan himoya qilish",
        "description": "O'simliklarni hasharot va kasalliklardan himoya qilish",
        "long_description": (
            "O'simliklaringizni hasharotlar va kasalliklardan himoya qilish uchun "
            "xavfsiz va samarali usullardan foydalanamiz. Faqat sertifikatlangan "
            "preparatlar qo'llaniladi."
        ),
        "hero_image_url": _SPRAY_HERO,
        "gallery_images": _SPRAY_GALLERY,
        "duration": "O'rtacha vaqt: 1.5 - 2 soat",
        "price_label": "Kelishilgan narxda",
        "features": _DEFAULT_FEATURES,
    },
    {
        "slug": "fertilizing",
        "name": "Ozuqalash",
        "emoji": "🧬",
        "icon": "grain",
        "category": "Parvarish",
        "sort_order": 7,
        "short_description": "O'simliklarni o'g'itlash va ozuqa berish",
        "description": "O'simliklarni o'g'itlash va ozuqa berish",
        "duration": "O'rtacha vaqt: 1 - 2 soat",
        "price_label": "Kelishilgan narxda",
    },
    {
        "slug": "warranty",
        "name": "1 yillik kafolat",
        "emoji": "📋",
        "icon": "verified_user",
        "category": "Kafolat",
        "sort_order": 8,
        "short_description": "Barcha xizmatlar uchun 1 yillik kafolat",
        "description": "Barcha xizmatlar uchun 1 yillik kafolat",
        "duration": "1 yil davomida",
        "price_label": "Bepul kafolat",
    },
    {
        "slug": "irrigation",
        "name": "Sug'orish tizim",
        "emoji": "💧",
        "icon": "water_drop",
        "category": "Infratuzilma",
        "sort_order": 9,
        "short_description": "Avtomatik sug'orish tizimini loyihalash va o'rnatish",
        "description": "Avtomatik sug'orish tizimini loyihalash va o'rnatish",
        "duration": "O'rtacha vaqt: 1 - 2 kun",
        "price_label": "Kelishilgan narxda",
    },
]

# Eski slug → yangi slug (mobile id lariga mos)
SLUG_ALIASES = {
    "free-consult": "free-consultation",
    "tree-planting": "tree-care",
    "topiary": "pine-shaping",
    "yearly-care": "warranty",
}


class Command(BaseCommand):
    help = "Seed catalog services (mobile kServices + Stitch home grid)."

    def handle(self, *args, **options):
        org = get_or_create_default_organization()

        for old_slug, new_slug in SLUG_ALIASES.items():
            Service.objects.filter(organization=org, slug=old_slug).exclude(
                pk__in=Service.objects.filter(organization=org, slug=new_slug).values("pk")
            ).update(slug=new_slug)

        created = 0
        for item in SERVICES:
            payload = {
                **item,
                "organization": org,
                "long_description": item.get("long_description", ""),
                "hero_image_url": item.get("hero_image_url", ""),
                "gallery_images": item.get("gallery_images", []),
                "features": item.get("features", []),
            }
            _, was_created = Service.objects.update_or_create(
                organization=org,
                slug=item["slug"],
                defaults=payload,
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(
                f"Services ready. created={created} total={Service.objects.count()}"
            )
        )
