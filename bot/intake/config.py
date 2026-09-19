from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IntakeField:
    key: str  # maps to Order API field or special: media, address, phone
    prompt: str
    required: bool = True
    field_type: str = "text"  # text | media | location | phone


# Temporary centralized intake — keyed by service slug (NOT display name).
# Migrate later to GET /services/{slug}/intake/ shared with Mobile.
INTAKE_BY_SLUG: dict[str, list[IntakeField]] = {
    "lawn-care": [
        IntakeField("area_size", "Maydon o'lchamini yozing (masalan: 2 sotix):"),
        IntakeField("media", "Hudud fotosuratini yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "tree-care": [
        IntakeField("plant_category", "Daraxt turi / sonini yozing:"),
        IntakeField("notes", "Qo'shimcha izoh (ixtiyoriy):", required=False),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "pine-shaping": [
        IntakeField("plant_category", "Archa / o'simlik haqida yozing:"),
        IntakeField("notes", "Qo'shimcha izoh (ixtiyoriy):", required=False),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "pest-control": [
        IntakeField("area_size", "Maydon / o'simlik soni:"),
        IntakeField("notes", "Muammo haqida qisqacha yozing:", required=False),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "fertilizing": [
        IntakeField("area_size", "Maydon o'lchamini yozing:"),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "irrigation": [
        IntakeField("notes", "Loyiha / ehtiyoj haqida yozing:"),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "landscape-design": [
        IntakeField("notes", "Loyiha tavsifini yozing:"),
        IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "free-consultation": [
        IntakeField("notes", "Savolingizni yozing:", required=False),
        IntakeField("address", "Manzil (ixtiyoriy) yoki /skip:", required=False, field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
    "warranty": [
        IntakeField("area_size", "Maydon o'lchamini yozing:"),
        IntakeField("notes", "Qo'shimcha ma'lumot (ixtiyoriy):", required=False),
        IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
        IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
    ],
}

DEFAULT_INTAKE: list[IntakeField] = [
    IntakeField("notes", "Buyurtma haqida qisqacha yozing:", required=False),
    IntakeField("media", "Fotosurat yuboring (yoki /skip):", required=False, field_type="media"),
    IntakeField("address", "Manzilni yozing yoki 📍 lokatsiya yuboring:", field_type="location"),
    IntakeField("phone", "Telefon raqamingizni tasdiqlang yoki yangilang:", field_type="phone"),
]


def get_intake_fields(slug: str) -> list[IntakeField]:
    return list(INTAKE_BY_SLUG.get(slug, DEFAULT_INTAKE))
