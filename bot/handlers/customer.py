from __future__ import annotations

import logging
import uuid
from typing import Any

from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.api.client import APIError
from bot.formatters import messages as msg
from bot.keyboards import common as kb
from bot.runtime import get_services
from bot.services.domain import (
    AuthService,
    CatalogService,
    OrderFlowService,
    ProfileService,
    SupportService,
    normalize_phone,
)
from bot.states.flow import AuthStates, OrderStates, ProfileStates, SupportStates

logger = logging.getLogger(__name__)
router = Router(name="customer")


def _services(_message: Message | None = None):
    return get_services()


async def _require_session(message: Message, state: FSMContext):
    svc: AuthService = _services(message)["auth"]
    session = svc.get_session(message.from_user.id)
    if not session:
        await state.set_state(AuthStates.phone)
        await message.answer(msg.ask_phone(), reply_markup=kb.phone_keyboard())
        return None
    return session


async def _handle_api_error(target: Message | CallbackQuery, exc: APIError) -> None:
    text = msg.map_api_error(exc.status_code, exc.message)
    if isinstance(target, CallbackQuery):
        await target.answer(text[:180], show_alert=True)
        if target.message:
            await target.message.answer(text)
    else:
        await target.answer(text)


# ─── /start & auth ───────────────────────────────────────────────


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    limiter = get_services()["limiter"]
    if not await limiter.allow(f"start:{message.from_user.id}", limit=10, window_sec=60):
        await message.answer(msg.err_rate_limit())
        return

    auth: AuthService = _services(message)["auth"]
    session = auth.get_session(message.from_user.id)
    if session:
        await message.answer(
            f"{msg.welcome()}\n\n{msg.main_menu_text()}",
            reply_markup=kb.main_menu(),
        )
        return

    await state.set_state(AuthStates.phone)
    await message.answer(
        f"{msg.welcome()}\n\n{msg.ask_phone()}",
        reply_markup=kb.phone_keyboard(),
    )


@router.message(AuthStates.phone, F.contact)
async def auth_contact(message: Message, state: FSMContext) -> None:
    phone = message.contact.phone_number if message.contact else ""
    await _start_otp(message, state, phone)


@router.message(AuthStates.phone, F.text)
async def auth_phone_text(message: Message, state: FSMContext) -> None:
    if message.text == msg.BTN_CANCEL:
        await state.clear()
        await message.answer("Bekor qilindi.", reply_markup=kb.remove_kb())
        return
    await _start_otp(message, state, message.text or "")


async def _start_otp(message: Message, state: FSMContext, phone_raw: str) -> None:
    phone = normalize_phone(phone_raw)
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) < 9:
        await message.answer(msg.err_validation())
        return
    auth: AuthService = _services(message)["auth"]
    limiter = _services(message)["limiter"]
    if not await limiter.allow(f"otp:{message.from_user.id}", limit=5, window_sec=300):
        await message.answer(msg.err_rate_limit())
        return
    try:
        await auth.request_otp(phone)
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.update_data(phone=phone)
    await state.set_state(AuthStates.otp)
    await message.answer(msg.ask_otp(), reply_markup=kb.cancel_only())


@router.message(AuthStates.otp, F.text)
async def auth_otp(message: Message, state: FSMContext) -> None:
    if message.text == msg.BTN_CANCEL:
        await state.clear()
        await message.answer("Bekor qilindi.", reply_markup=kb.remove_kb())
        return
    data = await state.get_data()
    phone = data.get("phone")
    code = (message.text or "").strip()
    auth: AuthService = _services(message)["auth"]
    try:
        await auth.verify_and_link(
            phone=phone,
            code=code,
            telegram_id=message.from_user.id,
            telegram_username=message.from_user.username or "",
            full_name=message.from_user.full_name or "",
        )
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.clear()
    await message.answer(
        f"✅ Tizimga kirdingiz.\n\n{msg.main_menu_text()}",
        reply_markup=kb.main_menu(),
    )


# ─── Main menu ───────────────────────────────────────────────────


@router.message(F.text == msg.BTN_ORDER)
async def menu_order(message: Message, state: FSMContext) -> None:
    session = await _require_session(message, state)
    if not session:
        return
    catalog: CatalogService = _services(message)["catalog"]
    try:
        services = await catalog.list_services()
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    if not services:
        await message.answer("Hozircha xizmatlar yo'q.")
        return
    await state.set_state(OrderStates.service)
    await message.answer("Xizmatni tanlang:", reply_markup=kb.services_keyboard(services))


@router.callback_query(F.data == "svc:list")
async def cb_svc_list(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    catalog: CatalogService = _services(callback.message)["catalog"]
    try:
        services = await catalog.list_services()
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    await state.set_state(OrderStates.service)
    await callback.message.edit_text(
        "Xizmatni tanlang:", reply_markup=kb.services_keyboard(services)
    )


@router.callback_query(F.data.startswith("svc:v:"))
async def cb_svc_view(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    slug = callback.data.split(":", 2)[2]
    catalog: CatalogService = _services(callback.message)["catalog"]
    try:
        service = await catalog.get_service(slug)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    text = (
        f"<b>{service.get('emoji', '')} {service.get('name')}</b>\n\n"
        f"{service.get('detail_description') or service.get('description') or service.get('short_description') or ''}\n\n"
        f"⏱ {service.get('duration') or ''}\n"
        f"💰 {service.get('price_label') or ''}"
    )
    await callback.message.edit_text(text, reply_markup=kb.service_detail_keyboard(slug))


@router.callback_query(F.data.startswith("svc:o:"))
async def cb_svc_order(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    slug = callback.data.split(":", 2)[2]
    catalog: CatalogService = _services(callback.message)["catalog"]
    orders: OrderFlowService = _services(callback.message)["orders"]
    try:
        service = await catalog.get_service(slug)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    fields = orders.intake_for(slug)
    phone, saved_address = await _profile_hints(callback.message)
    await state.set_state(OrderStates.intake)
    await state.update_data(
        service_id=service["id"],
        service_slug=slug,
        service_name=service.get("name"),
        intake_index=0,
        answers={},
        media=[],
        idempotency_key=str(uuid.uuid4()),
        submit_lock=False,
        hint_phone=phone,
        hint_address=saved_address,
    )
    await callback.message.answer(f"Buyurtma: <b>{service.get('name')}</b>")
    await _ask_intake_step(callback.message, state, fields, 0)


async def _profile_hints(message: Message) -> tuple[str, str]:
    """Return (phone, saved_address) for intake keyboards."""
    auth: AuthService = _services(message)["auth"]
    session = auth.get_session(message.from_user.id)
    if not session:
        return "", ""
    phone = session.phone or ""
    saved = ""
    profile: ProfileService = _services(message)["profile"]
    try:
        user = await profile.get(session)
        phone = phone or (user.get("phone") or "")
        saved = (
            user.get("home_address")
            or user.get("formatted_address")
            or ""
        ).strip()
    except APIError:
        pass
    return phone, saved


async def _ask_intake_step(message: Message, state: FSMContext, fields, index: int) -> None:
    if index >= len(fields):
        await _show_summary(message, state)
        return
    field = fields[index]
    data = await state.get_data()
    phone = (data.get("hint_phone") or "").strip()
    saved_address = (data.get("hint_address") or "").strip()
    if field.field_type in {"phone", "location"} and not (phone or saved_address):
        phone, saved_address = await _profile_hints(message)
        await state.update_data(hint_phone=phone, hint_address=saved_address)

    prompt = field.prompt
    if field.field_type == "phone":
        if phone:
            prompt = f"{field.prompt}\n\nJoriy: <b>{phone}</b>"
        else:
            prompt = (
                f"{field.prompt}\n\n"
                "📱 Kontakt ulashing yoki +998XXXXXXXXX yozing."
            )
    elif field.field_type == "location":
        if saved_address:
            prompt = f"{field.prompt}\n\nSaqlangan: <b>{saved_address}</b>"
        else:
            prompt = (
                f"{field.prompt}\n\n"
                "📍 tugma bilan lokatsiya yuboring yoki manzilni yozing."
            )
    elif field.field_type == "media":
        prompt = (
            f"{field.prompt}\n\n"
            "📎 qog'oz qisqich orqali foto/video yuboring."
        )

    markup = kb.intake_keyboard(
        field,
        phone=phone,
        saved_address=saved_address,
    )
    await state.update_data(intake_index=index)
    await message.answer(prompt, reply_markup=markup)


async def _show_summary(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    answers = data.get("answers") or {}
    media = data.get("media") or []
    await state.set_state(OrderStates.summary)
    text = msg.order_summary(
        {
            "service_name": data.get("service_name"),
            "area_size": answers.get("area_size"),
            "plant_category": answers.get("plant_category"),
            "notes": answers.get("notes"),
            "address": answers.get("address"),
            "phone_number": answers.get("phone_number"),
            "media_count": len(media),
        }
    )
    await message.answer(text, reply_markup=kb.summary_keyboard())


@router.message(OrderStates.intake, F.text == msg.BTN_CANCEL)
@router.message(OrderStates.summary, F.text == msg.BTN_CANCEL)
async def order_cancel_text(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("Buyurtma bekor qilindi.", reply_markup=kb.main_menu())


@router.message(OrderStates.intake, F.text == msg.BTN_BACK)
async def order_back(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    index = int(data.get("intake_index") or 0)
    orders: OrderFlowService = _services(message)["orders"]
    fields = orders.intake_for(data.get("service_slug") or "")
    if index <= 0:
        await state.clear()
        await menu_order(message, state)
        return
    new_index = index - 1
    # drop last answer for previous field
    prev = fields[new_index]
    answers = dict(data.get("answers") or {})
    if prev.key in answers:
        answers.pop(prev.key, None)
    if prev.field_type == "media":
        await state.update_data(media=[], intake_index=new_index, answers=answers)
    else:
        await state.update_data(intake_index=new_index, answers=answers)
    await _ask_intake_step(message, state, fields, new_index)


@router.message(OrderStates.intake, F.text == msg.BTN_SKIP)
@router.message(OrderStates.intake, F.text == "/skip")
async def order_skip(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    orders: OrderFlowService = _services(message)["orders"]
    fields = orders.intake_for(data.get("service_slug") or "")
    index = int(data.get("intake_index") or 0)
    field = fields[index]
    if field.required:
        await message.answer("Bu maydon majburiy.")
        return
    await state.update_data(intake_index=index + 1)
    await _ask_intake_step(message, state, fields, index + 1)


@router.message(OrderStates.intake, F.location)
async def order_location(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    orders: OrderFlowService = _services(message)["orders"]
    profile: ProfileService = _services(message)["profile"]
    auth: AuthService = _services(message)["auth"]
    fields = orders.intake_for(data.get("service_slug") or "")
    index = int(data.get("intake_index") or 0)
    field = fields[index]
    if field.field_type != "location":
        await message.answer("Hozir lokatsiya kutilmayapti.")
        return
    loc = message.location
    session = auth.get_session(message.from_user.id)
    address = data.get("answers", {}).get("address") or "Lokatsiya yuborildi"
    if session:
        try:
            await profile.update_address(
                session,
                home_address=address if address != "Lokatsiya yuborildi" else "",
                location_lat=loc.latitude,
                location_lng=loc.longitude,
            )
        except APIError:
            pass
    answers = dict(data.get("answers") or {})
    answers["address"] = address if address != "Lokatsiya yuborildi" else f"{loc.latitude:.5f}, {loc.longitude:.5f}"
    await state.update_data(answers=answers, intake_index=index + 1)
    await _ask_intake_step(message, state, fields, index + 1)


@router.message(OrderStates.intake, F.photo | F.video)
async def order_media(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    orders: OrderFlowService = _services(message)["orders"]
    fields = orders.intake_for(data.get("service_slug") or "")
    index = int(data.get("intake_index") or 0)
    field = fields[index]
    if field.field_type != "media":
        await message.answer("Hozir media kutilmayapti.")
        return

    try:
        if message.photo:
            file = await message.bot.get_file(message.photo[-1].file_id)
            content = await message.bot.download_file(file.file_path)
            raw = content.read()
            media_item = ("photo.jpg", raw, "image/jpeg")
        else:
            file = await message.bot.get_file(message.video.file_id)
            content = await message.bot.download_file(file.file_path)
            raw = content.read()
            if len(raw) > 10 * 1024 * 1024:
                await message.answer("Fayl juda katta (maks. 10 MB).")
                return
            media_item = ("video.mp4", raw, "video/mp4")
    except Exception:  # noqa: BLE001
        logger.exception("media_download_failed")
        await message.answer("Fayl yuklab olinmadi. Qayta urinib ko'ring yoki /skip.")
        return

    media = list(data.get("media") or [])
    media.append(media_item)
    await state.update_data(media=media, intake_index=index + 1)
    await message.answer("Media qabul qilindi.")
    await _ask_intake_step(message, state, fields, index + 1)


@router.message(OrderStates.intake, F.text | F.contact)
async def order_intake_text(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    orders: OrderFlowService = _services(message)["orders"]
    fields = orders.intake_for(data.get("service_slug") or "")
    index = int(data.get("intake_index") or 0)
    if index >= len(fields):
        await _show_summary(message, state)
        return
    field = fields[index]
    if field.field_type == "media":
        await message.answer(
            "Fotosurat/video yuboring (📎) yoki O'tkazib yuborish.",
            reply_markup=kb.media_keyboard(allow_skip=not field.required),
        )
        return
    if field.field_type == "location" and message.location:
        return  # handled elsewhere

    value = ""
    if message.contact:
        if field.field_type != "phone":
            await message.answer("Hozir telefon kutilmayapti.")
            return
        value = normalize_phone(message.contact.phone_number)
    elif (message.text or "").strip() == msg.BTN_CONFIRM_PHONE:
        if field.field_type != "phone":
            return
        data_phone = (data.get("hint_phone") or "").strip()
        auth: AuthService = _services(message)["auth"]
        session = auth.get_session(message.from_user.id)
        value = normalize_phone(data_phone or ((session.phone if session else "") or ""))
        if not value:
            await message.answer(
                "Profil telefoni topilmadi. Kontakt ulashing yoki raqam yozing.",
                reply_markup=kb.phone_confirm_keyboard(show_confirm=False),
            )
            return
    elif (message.text or "").strip() == msg.BTN_USE_SAVED_ADDRESS:
        if field.field_type != "location":
            return
        value = (data.get("hint_address") or "").strip()
        if not value:
            _phone, saved = await _profile_hints(message)
            value = saved
        if not value:
            await message.answer(
                "Saqlangan manzil yo'q. Lokatsiya yuboring yoki manzilni yozing.",
                reply_markup=kb.location_keyboard(
                    show_saved=False, allow_skip=not field.required
                ),
            )
            return
    else:
        value = (message.text or "").strip()
        if value in msg.NAV_BUTTON_TEXTS:
            return

    if field.field_type == "phone":
        value = normalize_phone(value)

    if field.required and not value:
        await message.answer(msg.err_validation())
        return

    answers = dict(data.get("answers") or {})
    if field.key == "phone":
        answers["phone_number"] = value
    elif field.key == "address":
        answers["address"] = value
    else:
        answers[field.key] = value

    await state.update_data(answers=answers, intake_index=index + 1)
    await _ask_intake_step(message, state, fields, index + 1)


@router.callback_query(F.data == "order:confirm")
async def order_confirm(callback: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    if data.get("submit_lock"):
        await callback.answer("Jarayon davom etmoqda…", show_alert=False)
        return
    await state.update_data(submit_lock=True)
    await state.set_state(OrderStates.submitting)
    await callback.answer()

    auth: AuthService = _services(callback.message)["auth"]
    orders: OrderFlowService = _services(callback.message)["orders"]
    session = auth.get_session(callback.from_user.id)
    if not session:
        await callback.message.answer(msg.err_session(), reply_markup=kb.phone_keyboard())
        await state.set_state(AuthStates.phone)
        return

    answers = data.get("answers") or {}
    try:
        order = await orders.submit(
            session=session,
            service_id=int(data["service_id"]),
            fields=answers,
            media=data.get("media") or [],
            idempotency_key=data.get("idempotency_key"),
        )
    except APIError as exc:
        await state.update_data(submit_lock=False)
        await state.set_state(OrderStates.summary)
        await _handle_api_error(callback, exc)
        return

    await state.clear()
    await callback.message.answer(
        msg.order_created(order),
        reply_markup=kb.view_order_keyboard(order["id"]),
    )
    await callback.message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())


@router.callback_query(F.data == "order:abort")
async def order_abort(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.answer("Buyurtma bekor qilindi.", reply_markup=kb.main_menu())
    await callback.answer()


@router.callback_query(F.data == "order:back")
async def order_summary_back(callback: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    orders: OrderFlowService = _services(callback.message)["orders"]
    fields = orders.intake_for(data.get("service_slug") or "")
    index = max(0, len(fields) - 1)
    await state.set_state(OrderStates.intake)
    await state.update_data(intake_index=index)
    await _ask_intake_step(callback.message, state, fields, index)
    await callback.answer()


# ─── My orders ───────────────────────────────────────────────────


@router.message(F.text == msg.BTN_MY_ORDERS)
async def my_orders(message: Message, state: FSMContext) -> None:
    session = await _require_session(message, state)
    if not session:
        return
    orders: OrderFlowService = _services(message)["orders"]
    try:
        items = await orders.list_orders(session)
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    if not items:
        await message.answer("Buyurtmalar yo'q.")
        return
    await message.answer("Buyurtmalaringsiz:", reply_markup=kb.orders_keyboard(items))


@router.callback_query(F.data == "order:list")
async def cb_order_list(callback: CallbackQuery, state: FSMContext) -> None:
    auth: AuthService = _services(callback.message)["auth"]
    session = auth.get_session(callback.from_user.id)
    if not session:
        await callback.answer(msg.err_session(), show_alert=True)
        return
    orders: OrderFlowService = _services(callback.message)["orders"]
    try:
        items = await orders.list_orders(session)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    await callback.message.edit_text(
        "Buyurtmalaringsiz:", reply_markup=kb.orders_keyboard(items)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("order:view:"))
async def cb_order_view(callback: CallbackQuery, state: FSMContext) -> None:
    order_id = int(callback.data.split(":")[2])
    auth: AuthService = _services(callback.message)["auth"]
    session = auth.get_session(callback.from_user.id)
    if not session:
        await callback.answer(msg.err_session(), show_alert=True)
        return
    orders: OrderFlowService = _services(callback.message)["orders"]
    try:
        order = await orders.get_order(session, order_id)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    can_cancel = order.get("status") not in {"completed", "cancelled"}
    await callback.message.edit_text(
        msg.order_card(order),
        reply_markup=kb.order_detail_keyboard(order_id, can_cancel),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("order:cancel:"))
async def cb_order_cancel_ask(callback: CallbackQuery) -> None:
    order_id = int(callback.data.split(":")[2])
    await callback.message.edit_text(
        "Buyurtmani bekor qilmoqchimisiz?",
        reply_markup=kb.cancel_confirm_keyboard(order_id),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("order:cancelok:"))
async def cb_order_cancel_ok(callback: CallbackQuery) -> None:
    order_id = int(callback.data.split(":")[2])
    auth: AuthService = _services(callback.message)["auth"]
    session = auth.get_session(callback.from_user.id)
    if not session:
        await callback.answer(msg.err_session(), show_alert=True)
        return
    orders: OrderFlowService = _services(callback.message)["orders"]
    try:
        order = await orders.cancel(session, order_id)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    await callback.message.edit_text(msg.order_card(order))
    await callback.answer("Bekor qilindi")


# ─── Support ─────────────────────────────────────────────────────


@router.message(F.text == msg.BTN_SUPPORT)
async def support_menu(message: Message, state: FSMContext) -> None:
    session = await _require_session(message, state)
    if not session:
        return
    support: SupportService = _services(message)["support"]
    try:
        tickets = await support.list_tickets(session)
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await message.answer("Murojaatlar:", reply_markup=kb.support_list_keyboard(tickets))


@router.callback_query(F.data == "support:new")
async def support_new(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(SupportStates.create_subject)
    await callback.message.answer("Murojaat mavzusini yozing:", reply_markup=kb.cancel_only())
    await callback.answer()


@router.message(SupportStates.create_subject, F.text)
async def support_subject(message: Message, state: FSMContext) -> None:
    if message.text == msg.BTN_CANCEL:
        await state.clear()
        await message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())
        return
    await state.update_data(support_subject=message.text.strip())
    await state.set_state(SupportStates.create_body)
    await message.answer("Xabaringizni yozing:")


@router.message(SupportStates.create_body, F.text)
async def support_body(message: Message, state: FSMContext) -> None:
    if message.text == msg.BTN_CANCEL:
        await state.clear()
        await message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())
        return
    data = await state.get_data()
    auth: AuthService = _services(message)["auth"]
    support: SupportService = _services(message)["support"]
    session = auth.get_session(message.from_user.id)
    if not session:
        await message.answer(msg.err_session())
        return
    try:
        ticket = await support.create(
            session, data.get("support_subject") or "Murojaat", message.text.strip()
        )
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.clear()
    await message.answer(
        f"✅ Murojaat yuborildi (#{ticket.get('id')})",
        reply_markup=kb.main_menu(),
    )


@router.callback_query(F.data.startswith("support:view:"))
async def support_view(callback: CallbackQuery, state: FSMContext) -> None:
    ticket_id = int(callback.data.split(":")[2])
    auth: AuthService = _services(callback.message)["auth"]
    support: SupportService = _services(callback.message)["support"]
    session = auth.get_session(callback.from_user.id)
    if not session:
        await callback.answer(msg.err_session(), show_alert=True)
        return
    try:
        ticket = await support.get_ticket(session, ticket_id)
    except APIError as exc:
        await _handle_api_error(callback, exc)
        return
    lines = [f"<b>#{ticket.get('id')} {ticket.get('subject')}</b>", f"Holat: {ticket.get('status')}"]
    for m in ticket.get("messages") or []:
        lines.append(f"\n{(m.get('sender_name') or '—')}: {m.get('body')}")
    await state.set_state(SupportStates.reply)
    await state.update_data(support_ticket_id=ticket_id)
    await callback.message.answer("\n".join(lines))
    await callback.message.answer("Javob yozing yoki Bekor:", reply_markup=kb.cancel_only())
    await callback.answer()


@router.message(SupportStates.reply, F.text)
async def support_reply(message: Message, state: FSMContext) -> None:
    if message.text == msg.BTN_CANCEL:
        await state.clear()
        await message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())
        return
    data = await state.get_data()
    ticket_id = int(data.get("support_ticket_id"))
    auth: AuthService = _services(message)["auth"]
    support: SupportService = _services(message)["support"]
    session = auth.get_session(message.from_user.id)
    if not session:
        await message.answer(msg.err_session())
        return
    try:
        await support.reply(session, ticket_id, message.text.strip())
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.clear()
    await message.answer("Javob yuborildi.", reply_markup=kb.main_menu())


# ─── Profile / Address ───────────────────────────────────────────


@router.message(F.text == msg.BTN_PROFILE)
async def profile(message: Message, state: FSMContext) -> None:
    session = await _require_session(message, state)
    if not session:
        return
    profile_svc: ProfileService = _services(message)["profile"]
    try:
        user = await profile_svc.get(session)
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    text = (
        f"<b>Profil</b>\n"
        f"Ism: {user.get('full_name') or user.get('first_name') or '—'}\n"
        f"Telefon: {user.get('phone')}\n"
        f"Manzil: {user.get('formatted_address') or user.get('home_address') or '—'}"
    )
    await message.answer(text, reply_markup=kb.main_menu())


@router.message(F.text == msg.BTN_ADDRESS)
async def address_start(message: Message, state: FSMContext) -> None:
    session = await _require_session(message, state)
    if not session:
        return
    await state.set_state(ProfileStates.address)
    phone, saved = await _profile_hints(message)
    _ = phone
    prompt = "Yangi manzilni yozing yoki 📍 lokatsiya yuboring:"
    if saved:
        prompt = f"{prompt}\n\nHozirgi: <b>{saved}</b>"
    await message.answer(
        prompt,
        reply_markup=kb.location_keyboard(show_saved=False, allow_skip=False),
    )


@router.message(ProfileStates.address, F.text == msg.BTN_CANCEL)
@router.message(ProfileStates.address, F.text == msg.BTN_BACK)
async def address_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())


@router.message(ProfileStates.address, F.location)
async def address_location(message: Message, state: FSMContext) -> None:
    auth: AuthService = _services(message)["auth"]
    profile_svc: ProfileService = _services(message)["profile"]
    session = auth.get_session(message.from_user.id)
    loc = message.location
    try:
        await profile_svc.update_address(
            session,
            home_address=f"{loc.latitude:.5f}, {loc.longitude:.5f}",
            location_lat=loc.latitude,
            location_lng=loc.longitude,
        )
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.clear()
    await message.answer("Manzil saqlandi.", reply_markup=kb.main_menu())


@router.message(ProfileStates.address, F.text)
async def address_text(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if text in msg.NAV_BUTTON_TEXTS:
        return
    auth: AuthService = _services(message)["auth"]
    profile_svc: ProfileService = _services(message)["profile"]
    session = auth.get_session(message.from_user.id)
    try:
        await profile_svc.update_address(session, home_address=text)
    except APIError as exc:
        await _handle_api_error(message, exc)
        return
    await state.clear()
    await message.answer("Manzil saqlandi.", reply_markup=kb.main_menu())


@router.callback_query(F.data == "nav:menu")
async def nav_menu(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.answer(msg.main_menu_text(), reply_markup=kb.main_menu())
    await callback.answer()
