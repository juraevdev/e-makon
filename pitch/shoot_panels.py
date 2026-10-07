"""Superadmin va firma panellaridan taqdimot uchun skrinshotlar oladi (Edge headless)."""

import os

import requests
from playwright.sync_api import sync_playwright

API = "http://127.0.0.1:8000/api/v1"
OUT = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT, exist_ok=True)
HIDE = "nextjs-portal{display:none!important}"


def tokens(phone, password):
    data = requests.post(f"{API}/auth/admin/login/", json={"phone": phone, "password": password}).json()
    data = data.get("data", data)
    return data["access"], data["refresh"]


def shoot(page, name, full=False):
    page.add_style_tag(content=HIDE)
    page.wait_for_timeout(1200)
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=full)
    print("saved", name)


def session(browser, base, phone, password):
    access, refresh = tokens(phone, password)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
    ctx.add_init_script(
        f"localStorage.setItem('emakon_access','{access}');localStorage.setItem('emakon_refresh','{refresh}');"
    )
    page = ctx.new_page()

    def go(path):
        page.goto(base + path, wait_until="networkidle")
        page.wait_for_timeout(1500)

    return page, go


def next_day(page):
    page.get_by_label("Keyingi kun").first.click()
    page.wait_for_timeout(1500)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)

    page, go = session(browser, "http://localhost:3000", "+998900000001", "admin12345")
    go("/")
    shoot(page, "sa_dashboard")
    go("/firmalar")
    shoot(page, "sa_firms")
    go("/buyurtmalar")
    sel = page.locator("select").filter(has_text="Yashil").first
    if sel.count():
        sel.select_option(label="Yashil Bog' Servis")
        page.wait_for_timeout(1000)
    next_day(page)
    shoot(page, "sa_schedule")
    go("/hisobotlar")
    shoot(page, "sa_reports")
    go("/xarita")
    page.wait_for_timeout(2500)
    shoot(page, "sa_map")

    page, go = session(browser, "http://localhost:3002", "+998900000002", "firma12345")
    go("/")
    shoot(page, "fa_dashboard")
    go("/buyurtmalar")
    next_day(page)
    shoot(page, "fa_schedule")
    go("/moliya")
    shoot(page, "fa_finance")
    go("/xodimlar")
    shoot(page, "fa_staff")

    browser.close()
