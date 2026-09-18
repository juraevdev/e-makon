from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from bot.formatters import messages as msg
from bot.intake.config import IntakeField


def main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=msg.BTN_ORDER)],
            [KeyboardButton(text=msg.BTN_MY_ORDERS), KeyboardButton(text=msg.BTN_ADDRESS)],
            [KeyboardButton(text=msg.BTN_SUPPORT), KeyboardButton(text=msg.BTN_PROFILE)],
        ],
        resize_keyboard=True,
    )


def phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=msg.BTN_SHARE_CONTACT, request_contact=True)],
            [KeyboardButton(text=msg.BTN_CANCEL)],
        ],
        resize_keyboard=True,
    )


def cancel_only() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=msg.BTN_CANCEL)]],
        resize_keyboard=True,
    )


def back_cancel() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=msg.BTN_BACK), KeyboardButton(text=msg.BTN_CANCEL)],
        ],
        resize_keyboard=True,
    )


def phone_confirm_keyboard(*, show_confirm: bool = False) -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = [
        [KeyboardButton(text=msg.BTN_SHARE_CONTACT, request_contact=True)],
    ]
    if show_confirm:
        rows.append([KeyboardButton(text=msg.BTN_CONFIRM_PHONE)])
    rows.append(
        [KeyboardButton(text=msg.BTN_BACK), KeyboardButton(text=msg.BTN_CANCEL)]
    )
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def location_keyboard(
    *,
    show_saved: bool = False,
    allow_skip: bool = False,
) -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = [
        [KeyboardButton(text=msg.BTN_SEND_LOCATION, request_location=True)],
    ]
    if show_saved:
        rows.append([KeyboardButton(text=msg.BTN_USE_SAVED_ADDRESS)])
    if allow_skip:
        rows.append([KeyboardButton(text=msg.BTN_SKIP)])
    rows.append(
        [KeyboardButton(text=msg.BTN_BACK), KeyboardButton(text=msg.BTN_CANCEL)]
    )
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def media_keyboard(*, allow_skip: bool = True) -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = []
    if allow_skip:
        rows.append([KeyboardButton(text=msg.BTN_SKIP)])
    rows.append(
        [KeyboardButton(text=msg.BTN_BACK), KeyboardButton(text=msg.BTN_CANCEL)]
    )
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def skip_back_cancel() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=msg.BTN_SKIP)],
            [KeyboardButton(text=msg.BTN_BACK), KeyboardButton(text=msg.BTN_CANCEL)],
        ],
        resize_keyboard=True,
    )


def intake_keyboard(
    field: IntakeField,
    *,
    phone: str = "",
    saved_address: str = "",
) -> ReplyKeyboardMarkup:
    """Pick the reply keyboard that matches the intake field action."""
    if field.field_type == "phone":
        return phone_confirm_keyboard(show_confirm=bool(phone))
    if field.field_type == "location":
        return location_keyboard(
            show_saved=bool(saved_address.strip()),
            allow_skip=not field.required,
        )
    if field.field_type == "media":
        return media_keyboard(allow_skip=not field.required)
    if not field.required:
        return skip_back_cancel()
    return back_cancel()


def summary_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=msg.BTN_CONFIRM, callback_data="order:confirm")],
            [
                InlineKeyboardButton(text=msg.BTN_BACK, callback_data="order:back"),
                InlineKeyboardButton(text=msg.BTN_CANCEL, callback_data="order:abort"),
            ],
        ]
    )


def services_keyboard(services: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for s in services:
        title = f"{s.get('emoji', '')} {s.get('name', s.get('slug'))}".strip()
        rows.append(
            [InlineKeyboardButton(text=title[:64], callback_data=f"svc:v:{s.get('slug')}")]
        )
    rows.append([InlineKeyboardButton(text=msg.BTN_CANCEL, callback_data="nav:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def service_detail_keyboard(slug: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🛒 Buyurtma qilish", callback_data=f"svc:o:{slug}")],
            [InlineKeyboardButton(text=msg.BTN_BACK, callback_data="svc:list")],
        ]
    )


def orders_keyboard(orders: list[dict]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=f"#{o.get('id')} — {msg.status_label(o.get('status', ''))}",
                callback_data=f"order:view:{o.get('id')}",
            )
        ]
        for o in orders[:20]
    ]
    rows.append([InlineKeyboardButton(text=msg.BTN_CANCEL, callback_data="nav:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def order_detail_keyboard(order_id: int, can_cancel: bool) -> InlineKeyboardMarkup:
    rows = []
    if can_cancel:
        rows.append(
            [InlineKeyboardButton(text="Bekor qilish", callback_data=f"order:cancel:{order_id}")]
        )
    rows.append([InlineKeyboardButton(text=msg.BTN_BACK, callback_data="order:list")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def cancel_confirm_keyboard(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=msg.BTN_YES_CANCEL, callback_data=f"order:cancelok:{order_id}"
                )
            ],
            [InlineKeyboardButton(text=msg.BTN_NO, callback_data=f"order:view:{order_id}")],
        ]
    )


def support_list_keyboard(tickets: list[dict]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=f"#{t.get('id')} {t.get('subject', '')}"[:64],
                callback_data=f"support:view:{t.get('id')}",
            )
        ]
        for t in tickets[:20]
    ]
    rows.append(
        [InlineKeyboardButton(text=msg.BTN_NEW_SUPPORT, callback_data="support:new")]
    )
    rows.append([InlineKeyboardButton(text=msg.BTN_CANCEL, callback_data="nav:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def view_order_keyboard(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=msg.BTN_VIEW_ORDER, callback_data=f"order:view:{order_id}"
                )
            ]
        ]
    )


def view_support_keyboard(ticket_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=msg.BTN_VIEW_SUPPORT, callback_data=f"support:view:{ticket_id}"
                )
            ]
        ]
    )


def remove_kb() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()
