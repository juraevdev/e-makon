from __future__ import annotations

from aiogram.fsm.state import State, StatesGroup


class AuthStates(StatesGroup):
    phone = State()
    otp = State()


class OrderStates(StatesGroup):
    service = State()
    intake = State()
    summary = State()
    submitting = State()


class SupportStates(StatesGroup):
    create_subject = State()
    create_body = State()
    reply = State()


class ProfileStates(StatesGroup):
    address = State()
