"""Flutter web ilovasini telefon o'lchamida boshqarish: python mobile_step.py <amallar...>

Amallar: goto:/path  click:x,y  type:matn  key:Enter  wait:ms  shot:nomi  scroll:dy
Profil pitch/.edge-profile ichida saqlanadi (kirish holati qoladi).
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5600"
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "shots")

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        os.path.join(HERE, ".edge-profile"),
        channel="msedge",
        headless=True,
        viewport={"width": 400, "height": 860},
        device_scale_factor=2.5,
        is_mobile=True,
        has_touch=False,
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    captured = {}

    def on_response(resp):
        if "/auth/" in resp.url and resp.request.method == "POST":
            try:
                code = (resp.json().get("data") or {}).get("debug_code")
            except Exception:
                code = None
            if code:
                captured["otp"] = code

    page.on("response", on_response)
    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(4000)
    for action in sys.argv[1:]:
        kind, _, arg = action.partition(":")
        if kind == "goto":
            page.goto(BASE + "/#" + arg if not arg.startswith("http") else arg, wait_until="networkidle")
            page.wait_for_timeout(3000)
        elif kind == "click":
            x, y = map(float, arg.split(","))
            page.mouse.click(x, y)
            page.wait_for_timeout(900)
        elif kind == "type":
            page.keyboard.type(arg, delay=40)
            page.wait_for_timeout(500)
        elif kind == "otp":
            page.keyboard.type(captured.get("otp", ""), delay=80)
            page.wait_for_timeout(800)
        elif kind == "key":
            page.keyboard.press(arg)
            page.wait_for_timeout(700)
        elif kind == "wait":
            page.wait_for_timeout(int(arg))
        elif kind == "scroll":
            page.mouse.move(200, 500)
            page.mouse.wheel(0, float(arg))
            page.wait_for_timeout(1200)
        elif kind == "shot":
            page.screenshot(path=os.path.join(OUT, arg + ".png"))
            print("saved", arg)
    print("url", page.url)
    ctx.close()
