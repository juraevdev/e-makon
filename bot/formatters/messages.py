from __future__ import annotations

STATUS_LABELS = {
    "new": "Yangi",
    "in_review": "Kelishilmoqda",
    "contacted": "Bog'lanildi",
    "completed": "Bajarildi",
    "cancelled": "Bekor qilindi",
}

BTN_ORDER = "🛠 Xizmat buyurtma qilish"
BTN_MY_ORDERS = "📦 Buyurtmalarim"
BTN_ADDRESS = "📍 Manzilim"
BTN_SUPPORT = "💬 Murojaat"
BTN_PROFILE = "👤 Profil"
BTN_BACK = "⬅️ Orqaga"
BTN_CANCEL = "❌ Bekor qilish"
BTN_CONFIRM = "✅ Tasdiqlash"
BTN_SKIP = "O'tkazib yuborish"
BTN_RETRY = "Qayta urinish"
BTN_YES_CANCEL = "✅ Ha, bekor qilish"
BTN_NO = "❌ Yo'q"
BTN_VIEW_ORDER = "📦 Buyurtmani ko'rish"
BTN_VIEW_SUPPORT = "💬 Murojaatni ko'rish"
BTN_NEW_SUPPORT = "➕ Yangi murojaat"
BTN_SHARE_CONTACT = "📱 Kontaktni ulashish"
BTN_CONFIRM_PHONE = "✅ Shu raqamni tasdiqlash"
BTN_SEND_LOCATION = "📍 Lokatsiya yuborish"
BTN_USE_SAVED_ADDRESS = "✅ Saqlangan manzil"

# Reply-keyboard labels that must never be stored as answers
NAV_BUTTON_TEXTS = frozenset(
    {
        BTN_BACK,
        BTN_CANCEL,
        BTN_SKIP,
        BTN_SHARE_CONTACT,
        BTN_CONFIRM_PHONE,
        BTN_SEND_LOCATION,
        BTN_USE_SAVED_ADDRESS,
        BTN_ORDER,
        BTN_MY_ORDERS,
        BTN_ADDRESS,
        BTN_SUPPORT,
        BTN_PROFILE,
    }
)


def status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status)


def welcome() -> str:
    return (
        "🌳 <b>E-Makon</b>ga xush kelibsiz!\n\n"
        "Bog' va landshaft xizmatlarini Telegram orqali buyurtma qiling."
    )


def ask_phone() -> str:
    return (
        "Telefon raqamingizni yuboring.\n"
        "Tugma orqali kontakt ulashing yoki +998XXXXXXXXX formatida yozing."
    )


def ask_otp() -> str:
    return "SMS orqali kelgan 6 xonali kodni kiriting."


def main_menu_text() -> str:
    return "Asosiy menyu. Kerakli bo'limni tanlang:"


def service_unavailable() -> str:
    return "Bu xizmat hozir mavjud emas."


def order_summary(data: dict) -> str:
    lines = [
        "<b>Buyurtma xulosasi</b>",
        f"Xizmat: {data.get('service_name', '—')}",
    ]
    if data.get("area_size"):
        lines.append(f"Maydon: {data['area_size']}")
    if data.get("plant_category"):
        lines.append(f"Tur/soni: {data['plant_category']}")
    if data.get("notes"):
        lines.append(f"Izoh: {data['notes']}")
    lines.append(f"Manzil: {data.get('address') or '—'}")
    lines.append(f"Telefon: {data.get('phone_number') or '—'}")
    lines.append(f"Media: {data.get('media_count', 0)} ta")
    lines.append("\nTasdiqlaysizmi?")
    return "\n".join(lines)


def order_created(order: dict) -> str:
    return (
        "✅ <b>Buyurtma qabul qilindi</b>\n\n"
        f"Raqam: #{order.get('id')}\n"
        f"Xizmat: {order.get('service_name') or (order.get('service') or {}).get('name', '—')}\n"
        f"Holat: {status_label(order.get('status', ''))}\n"
    )


def order_card(order: dict) -> str:
    service = order.get("service_name") or (order.get("service") or {}).get("name", "—")
    lines = [
        f"<b>Buyurtma #{order.get('id')}</b>",
        f"Xizmat: {service}",
        f"Holat: {status_label(order.get('status', ''))}",
        f"Manzil: {order.get('address') or '—'}",
    ]
    if order.get("area_size"):
        lines.append(f"Maydon: {order['area_size']}")
    if order.get("quoted_price") is not None:
        lines.append(f"Narx: {order['quoted_price']} {order.get('currency') or 'UZS'}")
    if order.get("assigned_worker_name"):
        lines.append(f"Xodim: {order['assigned_worker_name']}")
    if order.get("agreed_duration"):
        lines.append(f"Muddat: {order['agreed_duration']}")
    if order.get("notes"):
        lines.append(f"Izoh: {order['notes']}")
    return "\n".join(lines)


def notify_order_created(payload: dict) -> str:
    return (
        "✅ Yangi buyurtma yaratildi.\n"
        f"#{payload.get('order_id')} — {payload.get('service_name', '')}\n"
        f"Holat: {status_label(payload.get('status', 'new'))}"
    )


def notify_status_changed(payload: dict) -> str:
    return (
        "🔔 Buyurtmangiz holati o'zgardi.\n"
        f"#{payload.get('order_id')} — {status_label(payload.get('to_status') or payload.get('status', ''))}"
    )


def notify_cancelled(payload: dict) -> str:
    return f"❌ Buyurtma #{payload.get('order_id')} bekor qilindi."


def notify_support_reply(payload: dict) -> str:
    return (
        "💬 Murojaatingizga javob keldi.\n"
        f"Mavzu: {payload.get('subject', '')}"
    )


def err_generic() -> str:
    return "Xatolik yuz berdi. Qayta urinib ko'ring."


def err_api_down() -> str:
    return "Xizmat vaqtincha ishlamayapti. Bir ozdan keyin qayta urinib ko'ring."


def err_session() -> str:
    return "Seansingiz tugagan. Qaytadan tizimga kirishingiz kerak."


def err_validation() -> str:
    return "Kiritilgan ma'lumotlarni tekshiring."


def err_conflict() -> str:
    return "Bu amal allaqachon bajarilgan."


def err_forbidden() -> str:
    return "Bu amalga ruxsat yo'q."


def err_not_found() -> str:
    return "Ma'lumot topilmadi."


def err_rate_limit() -> str:
    return "Juda ko'p so'rov. Biroz kutib turing."


def flow_lost() -> str:
    return "Buyurtma jarayoni yakunlanmagan. Yangidan boshlashingiz mumkin."


def map_api_error(status_code: int | None, message: str | None = None) -> str:
    if status_code == 401:
        return err_session()
    if status_code == 403:
        return err_forbidden()
    if status_code == 404:
        return err_not_found()
    if status_code == 409:
        return err_conflict()
    if status_code == 429:
        return err_rate_limit()
    if status_code and status_code >= 500:
        return err_api_down()
    if status_code in (400, 422):
        return message or err_validation()
    return message or err_generic()
