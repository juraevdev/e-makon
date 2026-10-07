"""E-MAKON investor taqdimoti (PPTX) generatori: python pitch/build_deck.py"""

import os

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "E-MAKON_investor_taqdimoti.pptx")

BG = RGBColor(0x0D, 0x11, 0x0F)
CARD = RGBColor(0x15, 0x1C, 0x17)
CARD_LINE = RGBColor(0x26, 0x35, 0x2C)
ACCENT = RGBColor(0x8B, 0xDA, 0x7F)
ACCENT_DARK = RGBColor(0x1F, 0x3A, 0x22)
WHITE = RGBColor(0xF2, 0xF5, 0xF2)
MUTED = RGBColor(0xA9, 0xB5, 0xAC)
RED = RGBColor(0xE5, 0x5B, 0x5B)
RED_DARK = RGBColor(0x3A, 0x1A, 0x1A)
AMBER = RGBColor(0xF2, 0xB8, 0x4B)
FONT = "Segoe UI"
FONT_BOLD = "Segoe UI Semibold"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]
TOTAL = 16


# ---------- yordamchilar ----------

def set_alpha(shape, alpha_pct: int):
    """Shakl to'ldirish rangiga shaffoflik (0-100, 100 = to'liq ko'rinadi)."""
    fill = shape.fill._xPr.find(qn("a:solidFill"))
    clr = fill[0]
    for old in clr.findall(qn("a:alpha")):
        clr.remove(old)
    a = etree.SubElement(clr, qn("a:alpha"))
    a.set("val", str(alpha_pct * 1000))


def rect(slide, x, y, w, h, color, *, line=None, radius=None, alpha=None, shape=None):
    kind = shape or (MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE)
    s = slide.shapes.add_shape(kind, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = color
    if line:
        s.line.color.rgb = line
        s.line.width = Pt(1)
    else:
        s.line.fill.background()
    if radius and kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    if alpha is not None:
        set_alpha(s, alpha)
    s.shadow.inherit = False
    s.text_frame.text = ""
    return s


def gradient_overlay(slide, x, y, w, h, *, angle, stops):
    """stops: [(pos 0-100, RGBColor, alpha 0-100), ...]"""
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.line.fill.background()
    s.shadow.inherit = False
    spPr = s.fill._xPr
    for tag in ("a:solidFill", "a:gradFill", "a:noFill"):
        for el in spPr.findall(qn(tag)):
            spPr.remove(el)
    grad = etree.SubElement(spPr, qn("a:gradFill"))
    grad.set("rotWithShape", "1")
    gs_lst = etree.SubElement(grad, qn("a:gsLst"))
    for pos, color, alpha in stops:
        gs = etree.SubElement(gs_lst, qn("a:gs"))
        gs.set("pos", str(pos * 1000))
        clr = etree.SubElement(gs, qn("a:srgbClr"))
        clr.set("val", str(color))
        al = etree.SubElement(clr, qn("a:alpha"))
        al.set("val", str(alpha * 1000))
    lin = etree.SubElement(grad, qn("a:lin"))
    lin.set("ang", str(angle * 60000))
    lin.set("scaled", "0")
    # gradFill ln dan oldin turishi kerak
    ln = spPr.find(qn("a:ln"))
    if ln is not None:
        spPr.remove(grad)
        ln.addprevious(grad)
    return s


def text(slide, x, y, w, h, value, *, size=16, color=WHITE, bold=False, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, font=None, line_spacing=1.1):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(0)
    tf.margin_top = tf.margin_bottom = Emu(0)
    tf.vertical_anchor = anchor
    lines = value if isinstance(value, list) else [value]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        runs = line if isinstance(line, list) else [(line, {})] if isinstance(line, str) else [line]
        for run_spec in runs:
            if isinstance(run_spec, str):
                run_spec = (run_spec, {})
            content, opts = run_spec
            r = p.add_run()
            r.text = content
            f = r.font
            f.size = Pt(opts.get("size", size))
            f.bold = opts.get("bold", bold)
            f.name = opts.get("font", font or (FONT_BOLD if opts.get("bold", bold) else FONT))
            f.color.rgb = opts.get("color", color)
    return tb


def picture_fill(slide, path, x, y, w, h):
    """Rasmni berilgan to'rtburchakni to'liq qoplaydigan qilib qirqib joylaydi."""
    with Image.open(path) as im:
        iw, ih = im.size
    target = w / h
    src = iw / ih
    pic = slide.shapes.add_picture(path, x, y, w, h)
    if src > target:
        excess = (1 - target / src) / 2
        pic.crop_left = pic.crop_right = excess
    else:
        excess = (1 - src / target) / 2
        pic.crop_top = pic.crop_bottom = excess
    return pic


def picture_fit_width(slide, path, x, y, w, *, max_h=None, crop_bottom_to=None):
    with Image.open(path) as im:
        iw, ih = im.size
    h = int(w * ih / iw)
    pic = slide.shapes.add_picture(path, x, y, w, h)
    if max_h and h > max_h:
        frac = 1 - max_h / h
        pic.crop_bottom = frac
        pic.height = max_h
    return pic


def screenshot(slide, name, x, y, w, *, max_h=None):
    """Brauzer oynasi ko'rinishidagi ramka bilan skrinshot."""
    path = os.path.join(SHOTS, name + ".png")
    bar = Inches(0.28)
    with Image.open(path) as im:
        iw, ih = im.size
    h = int(w * ih / iw)
    if max_h and h + bar > max_h:
        h = max_h - bar
    frame = rect(slide, x - Inches(0.04), y - Inches(0.04), w + Inches(0.08), h + bar + Inches(0.08),
                 RGBColor(0x1C, 0x24, 0x1F), line=CARD_LINE, radius=0.03)
    for i, c in enumerate((RGBColor(0xE5, 0x5B, 0x5B), AMBER, ACCENT)):
        rect(slide, x + Inches(0.12 + i * 0.17), y + Inches(0.09), Inches(0.1), Inches(0.1), c,
             shape=MSO_SHAPE.OVAL)
    pic = slide.shapes.add_picture(path, x, y + bar, w, int(w * ih / iw))
    full_h = int(w * ih / iw)
    if full_h > h:
        pic.crop_bottom = 1 - h / full_h
        pic.height = h
    return frame


def phone(slide, name, x, y, h, *, caption=None):
    path = os.path.join(SHOTS, name + ".png")
    with Image.open(path) as im:
        iw, ih = im.size
    w = int(h * iw / ih)
    pad = Inches(0.09)
    rect(slide, x - pad, y - pad, w + 2 * pad, h + 2 * pad, RGBColor(0x05, 0x07, 0x06),
         line=RGBColor(0x3A, 0x47, 0x3F), radius=0.09)
    slide.shapes.add_picture(path, x, y, w, h)
    if caption:
        text(slide, x - Inches(0.3), y + h + Inches(0.2), w + Inches(0.6), Inches(0.4), caption,
             size=13, color=MUTED, align=PP_ALIGN.CENTER)
    return w


def pill(slide, x, y, label, *, color=ACCENT, fill=ACCENT_DARK, size=11, w=None):
    width = w or Inches(0.16 + 0.085 * len(label))
    s = rect(slide, x, y, width, Inches(0.32), fill, radius=0.5)
    tf = s.text_frame
    tf.margin_left = tf.margin_right = Inches(0.08)
    tf.margin_top = tf.margin_bottom = Emu(0)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.name = FONT_BOLD
    r.font.color.rgb = color
    return s


def icon_badge(slide, x, y, glyph, *, size=Inches(0.62), fill=ACCENT_DARK, color=ACCENT, font_size=20):
    s = rect(slide, x, y, size, size, fill, radius=0.28)
    tf = s.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Emu(0)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = glyph
    r.font.size = Pt(font_size)
    r.font.name = "Segoe UI Emoji"
    r.font.color.rgb = color
    return s


def card(slide, x, y, w, h, *, fill=CARD, line=CARD_LINE):
    return rect(slide, x, y, w, h, fill, line=line, radius=0.06)


def new_slide(n, *, kicker=None, title=None, subtitle=None):
    slide = prs.slides.add_slide(BLANK)
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = BG
    if kicker:
        text(slide, Inches(0.7), Inches(0.5), Inches(8), Inches(0.3), kicker.upper(), size=12,
             color=ACCENT, bold=True)
    if title:
        text(slide, Inches(0.7), Inches(0.82), Inches(11.9), Inches(0.8), title, size=32, bold=True)
    if subtitle:
        text(slide, Inches(0.7), Inches(1.55), Inches(11.9), Inches(0.5), subtitle, size=15, color=MUTED)
    footer(slide, n)
    return slide


def footer(slide, n):
    text(slide, Inches(0.7), Inches(7.05), Inches(4), Inches(0.25),
         [[("E-MAKON", {"bold": True, "color": ACCENT}), ("  ·  Investorlar uchun taqdimot", {"color": MUTED})]],
         size=10)
    text(slide, Inches(11.6), Inches(7.05), Inches(1.03), Inches(0.25), f"{n:02d} / {TOTAL}", size=10,
         color=MUTED, align=PP_ALIGN.RIGHT)


def notes(slide, value):
    slide.notes_slide.notes_text_frame.text = value


# ---------- 1. Muqova ----------
s = prs.slides.add_slide(BLANK)
s.background.fill.solid()
s.background.fill.fore_color.rgb = BG
picture_fill(s, os.path.join(ASSETS, "cover.jpg"), 0, 0, SW, SH)
gradient_overlay(s, 0, 0, SW, SH, angle=0, stops=[(0, BG, 100), (38, BG, 92), (70, BG, 10), (100, BG, 0)])
gradient_overlay(s, 0, Inches(5.6), SW, Inches(1.9), angle=90, stops=[(0, BG, 0), (100, BG, 85)])
pill(s, Inches(0.8), Inches(1.6), "INVESTORLAR UCHUN TAQDIMOT", w=Inches(3.3))
text(s, Inches(0.8), Inches(2.15), Inches(6.5), Inches(1.2), "E-MAKON", size=72, bold=True, color=ACCENT)
text(s, Inches(0.8), Inches(3.35), Inches(6.2), Inches(1.4),
     "Bog' va landshaft xizmatlari uchun yagona raqamli platforma", size=28, bold=True)
text(s, Inches(0.8), Inches(4.75), Inches(5.8), Inches(0.9),
     "Mijoz · Firma · Platforma — bitta tizimda: qat'iy narx, bo'sh vaqtni ko'rish, xavfsiz to'lov va jonli kuzatuv.",
     size=16, color=MUTED, line_spacing=1.25)
text(s, Inches(0.8), Inches(6.55), Inches(6), Inches(0.35),
     [[("Toshkent · 2026", {"color": MUTED}), ("   |   ", {"color": CARD_LINE}),
       ("Mobil ilova · Firma paneli · Superadmin · Telegram bot", {"color": MUTED})]], size=12)
notes(s, "Salomlashish. E-MAKON — bog'dorchilik va landshaft xizmatlarini buyurtma qilish, bajarish va "
         "to'lashni bitta platformaga jamlagan loyiha. 10–12 daqiqada muammo, yechim, hozirgi holat va "
         "kelajak rejalarini ko'rsatamiz.")

# ---------- 2. Muammo ----------
s = new_slide(2)
picture_fill(s, os.path.join(ASSETS, "problem.jpg"), 0, 0, SW, SH)
gradient_overlay(s, 0, 0, SW, SH, angle=0, stops=[(0, BG, 0), (35, BG, 30), (55, BG, 92), (100, BG, 100)])
text(s, Inches(6.9), Inches(0.55), Inches(6), Inches(0.3), "MUAMMO", size=12, color=RED, bold=True)
text(s, Inches(6.9), Inches(0.85), Inches(6), Inches(1.0), "Bog' xizmatini buyurtma qilish — bugun hamon tavakkal",
     size=28, bold=True)
problems = [
    ("🔍", "Ishonchli usta topish qiyin", "Tanish-bilish, Telegram guruhlar va e'lonlar orqali — reyting va kafolat yo'q."),
    ("💸", "Narx noaniq", "Narx oldindan aytilmaydi, ish oxirida oshib ketadi; solishtirish imkoni yo'q."),
    ("⏰", "Vaqt kelishilmaydi", "Usta kechikadi yoki kelmaydi; firmaning bandligi mijozga ko'rinmaydi."),
    ("🛡", "To'lov himoyalanmagan", "Oldindan pul beriladi — ish sifatsiz bo'lsa, qaytarib olish deyarli imkonsiz."),
    ("📒", "Firmalar ham qiynaladi", "Buyurtmalar daftar va telefonda; xodimlar bandligi, daromad hisobi yo'q."),
]
y = Inches(2.05)
for glyph, head, body in problems:
    icon_badge(s, Inches(6.9), y, glyph, fill=RED_DARK, color=RED, size=Inches(0.56), font_size=18)
    text(s, Inches(7.65), y - Inches(0.02), Inches(5.2), Inches(0.35), head, size=16, bold=True)
    text(s, Inches(7.65), y + Inches(0.3), Inches(5.2), Inches(0.6), body, size=12.5, color=MUTED)
    y += Inches(0.95)
footer(s, 2)
notes(s, "Bugun hovli yoki dacha egasi bog'ini parvarish qildirmoqchi bo'lsa, ustani tanishlar orqali qidiradi. "
         "Narx, vaqt va sifat bo'yicha hech qanday kafolat yo'q. Firmalar esa buyurtmalarni daftarda yuritadi.")

# ---------- 3. Bozor va mijozlar ----------
s = new_slide(3, kicker="Bozor imkoniyati", title="Kimlar uchun?",
              subtitle="Talab doimiy va mavsumiy: bahor–kuz davrida har hafta, qishda daraxt kesish va rejalashtirish.")
segments = [
    ("🏡", "Xususiy uy va hovlilar", "Gazon, daraxt parvarishi, dorilash, o'g'itlash — muntazam xizmat."),
    ("🌳", "Dacha va kottej shaharchalari", "Mavsumiy katta buyurtmalar, landshaft dizayn, sug'orish tizimi."),
    ("🏢", "Korxona va ofis hududlari", "Yillik parvarish shartnomalari — barqaror, takroriy daromad."),
    ("🏘", "Mahalla, maktab, bog'chalar", "Obodonlashtirish va ko'kalamzorlashtirish loyihalari."),
]
for i, (glyph, head, body) in enumerate(segments):
    x = Inches(0.7) + i * Inches(3.05)
    card(s, x, Inches(2.25), Inches(2.85), Inches(2.65))
    icon_badge(s, x + Inches(0.3), Inches(2.5), glyph)
    text(s, x + Inches(0.3), Inches(3.25), Inches(2.4), Inches(0.7), head, size=16, bold=True,
         anchor=MSO_ANCHOR.BOTTOM)
    text(s, x + Inches(0.3), Inches(4.05), Inches(2.35), Inches(0.8), body, size=12, color=MUTED)
card(s, Inches(0.7), Inches(5.1), Inches(11.95), Inches(1.6), fill=RGBColor(0x12, 0x1A, 0x14))
text(s, Inches(1.0), Inches(5.3), Inches(11.4), Inches(0.35), "Bozor hajmi (manba bilan to'ldiring)", size=14,
     bold=True, color=ACCENT)
markets = [("[ ___ ] ming", "hovlili uy-joy (Toshkent)"), ("[ ___ ] mlrd so'm", "yillik bog' xizmatlari bozori"),
           ("[ ___ ] ta", "faol bog'dorchilik firmalari")]
for i, (num, label) in enumerate(markets):
    x = Inches(1.0) + i * Inches(3.9)
    text(s, x, Inches(5.7), Inches(3.6), Inches(0.5), num, size=24, bold=True)
    text(s, x, Inches(6.2), Inches(3.6), Inches(0.3), label, size=12, color=MUTED)
notes(s, "Bozor raqamlarini rasmiy statistika (stat.uz) yoki o'z tadqiqotingiz asosida kiriting. "
         "Taxminiy raqam aytmaslik — investorlar manbani so'raydi.")

# ---------- 4. Yechim ----------
s = new_slide(4, kicker="Yechim", title="E-MAKON — buyurtmadan to'lovgacha bitta platforma",
              subtitle="To'rt qism bitta backend va bitta ma'lumotlar bazasida ishlaydi — hamma bir xil holatni ko'radi.")
parts = [
    ("📱", "Mobil ilova", "Mijoz uchun", ["Xizmat va firma tanlash", "Qat'iy narx, bo'sh vaqt",
                                        "Rasm, to'lov, jonli holat", "Sharh va bonus ballar"]),
    ("🧑‍🌾", "Firma paneli", "Hamkor firma uchun", ["Buyurtmalarni qabul qilish", "Bandlik jadvali",
                                                  "Xodimlar va ish bosqichlari", "Moliya va PDF hisobotlar"]),
    ("🛡", "Superadmin", "Platforma uchun", ["Firma moderatsiyasi", "To'lovlar nazorati (escrow)",
                                           "Komissiya, obuna, jarima", "Xarita, bannerlar, ball tizimi"]),
    ("🤖", "Telegram bot", "Qo'shimcha kanal", ["Telegram orqali kirish", "Buyurtma berish va kuzatish",
                                             "Murojaat (support) tizimi", "Bildirishnomalar"]),
]
for i, (glyph, head, who, items) in enumerate(parts):
    x = Inches(0.7) + i * Inches(3.05)
    card(s, x, Inches(2.3), Inches(2.85), Inches(4.4))
    icon_badge(s, x + Inches(0.3), Inches(2.6), glyph)
    text(s, x + Inches(0.3), Inches(3.4), Inches(2.4), Inches(0.4), head, size=19, bold=True)
    text(s, x + Inches(0.3), Inches(3.82), Inches(2.4), Inches(0.3), who, size=12, color=ACCENT)
    yy = Inches(4.3)
    for item in items:
        text(s, x + Inches(0.3), yy, Inches(2.45), Inches(0.55),
             [[("✓  ", {"color": ACCENT, "bold": True}), (item, {"color": WHITE})]], size=12)
        yy += Inches(0.58)
notes(s, "Yechim — uch tomonni (mijoz, firma, platforma) bitta tizimga bog'lash. Telegram bot "
         "ilovani o'rnatmagan foydalanuvchilar uchun qo'shimcha kirish kanali.")

# ---------- 5. Mijoz tajribasi ----------
s = new_slide(5, kicker="Mobil ilova", title="Mijoz 1 daqiqada buyurtma beradi")
phones = [("m_home", "Bosh sahifa: xizmatlar va hamkorlar"), ("m_service", "Firmalar narxlari — qat'iy, solishtiriladi"),
          ("m_slots", "Bo'sh vaqt yashil, band vaqt qizil"), ("m_orders", "Buyurtma holati jonli kuzatiladi")]
ph_h = Inches(4.55)
x = Inches(0.95)
for name, cap in phones:
    w = phone(s, name, x, Inches(1.75), ph_h, caption=cap)
    x += w + Inches(1.05)
notes(s, "Mijoz xizmatni tanlaydi, bir nechta firmaning qat'iy narxini solishtiradi, firmaning bo'sh vaqtini "
         "ko'radi va buyurtma beradi. Kirish SMS-kod orqali.")

# ---------- 6. Qanday ishlaydi ----------
s = new_slide(6, kicker="Jarayon", title="Buyurtma qanday ishlaydi",
              subtitle="Pul mijozdan to'g'ridan-to'g'ri firmaga emas — avval E-MAKON hisobida ushlanadi (escrow).")
steps = [
    ("1", "Xizmat tanlash", "Katalogdan xizmat, rasm va maydon"),
    ("2", "Firma va narx", "Bir nechta firmaning qat'iy narxi"),
    ("3", "Bo'sh vaqt", "Yashil soatni tanlaydi (1 soatdan)"),
    ("4", "Xavfsiz to'lov", "Pul E-MAKON hisobida ushlanadi"),
    ("5", "Ish bajariladi", "Qabul qildi → yo'lda → ishlayapti"),
    ("6", "Tasdiq va baho", "Pul firmaga o'tadi, mijoz baho beradi"),
]
sw = Inches(1.83)
gap = Inches(0.19)
for i, (num, head, body) in enumerate(steps):
    x = Inches(0.7) + i * (sw + gap)
    card(s, x, Inches(2.4), sw, Inches(2.75), fill=CARD if i != 3 else ACCENT_DARK,
         line=CARD_LINE if i != 3 else ACCENT)
    circle = rect(s, x + Inches(0.25), Inches(2.75), Inches(0.55), Inches(0.55), ACCENT, shape=MSO_SHAPE.OVAL)
    tf = circle.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = num
    r.font.size = Pt(18)
    r.font.bold = True
    r.font.name = FONT_BOLD
    r.font.color.rgb = BG
    text(s, x + Inches(0.25), Inches(3.4), sw - Inches(0.4), Inches(0.6), head, size=15, bold=True,
         anchor=MSO_ANCHOR.BOTTOM)
    text(s, x + Inches(0.25), Inches(4.12), sw - Inches(0.4), Inches(0.9), body, size=12, color=MUTED)
    if i < len(steps) - 1:
        text(s, x + sw - Inches(0.02), Inches(3.55), gap + Inches(0.05), Inches(0.4), "›", size=26, color=ACCENT,
             bold=True, align=PP_ALIGN.CENTER)
facts = [("Qat'iy narx", "firma oldindan belgilaydi"), ("Escrow", "to'lov ish tasdiqlanguncha ushlanadi"),
         ("Jonli holat", "usta yo'lda, yetib keldi, ishlayapti"), ("Nizo", "pul qaytariladi yoki muzlatiladi")]
for i, (head, body) in enumerate(facts):
    x = Inches(0.7) + i * Inches(3.0)
    text(s, x, Inches(5.6), Inches(2.85), Inches(0.9),
         [[(head, {"bold": True, "color": ACCENT, "size": 15})], [(body, {"color": MUTED, "size": 12})]])
notes(s, "Asosiy farq — ishonch. Mijoz puli platformada turadi, ish bajarilib tasdiqlangandan keyingina "
         "firmaga o'tadi. Muammo bo'lsa — qaytariladi va firma jarimalanadi.")

# ---------- 7. Bandlik jadvali ----------
s = new_slide(7, kicker="Yangi funksiya", title="Bandlik jadvali: yashil — bo'sh, qizil — band")
screenshot(s, "fa_schedule", Inches(0.7), Inches(1.75), Inches(7.6), max_h=Inches(4.95))
phone(s, "m_slots", Inches(8.85), Inches(1.75), Inches(3.75))
text(s, Inches(10.75), Inches(1.75), Inches(1.95), Inches(4), [
    [("Mijoz ilovada", {"bold": True, "size": 14})],
    [("firmaning bo'sh soatlarini ko'radi va faqat yashil vaqtni band qiladi.", {"color": MUTED, "size": 11.5})],
    [("", {"size": 6})],
    [("Firma va superadmin", {"bold": True, "size": 14})],
    [("bir xil jadvalni ko'radi; xizmat 1 soatdan boshlanadi, kerak bo'lsa +30 daq / +1 soat uzaytiriladi.",
      {"color": MUTED, "size": 11.5})],
    [("", {"size": 6})],
    [("Sig'im", {"bold": True, "size": 14})],
    [("= faol xodimlar soni. Hamma xodim band bo'lsa — soat qizil.", {"color": MUTED, "size": 11.5})],
], line_spacing=1.15)
text(s, Inches(8.65), Inches(5.85), Inches(4), Inches(0.8), [
    [("● ", {"color": ACCENT}), ("Bo'sh   ", {"color": MUTED}), ("● ", {"color": RED}), ("Band   ", {"color": MUTED}),
     ("● ", {"color": RGBColor(0x55, 0x5E, 0x58)}), ("O'tgan", {"color": MUTED})],
    [("Ikki mijoz bir vaqtni band qila olmaydi — server tekshiradi.", {"color": MUTED, "size": 11})],
], size=12)
notes(s, "Bu funksiya usta kechikishi va ikki marta band qilish muammosini hal qiladi. Firma panelida, "
         "superadmin panelida va mijoz ilovasida bitta jadval.")

# ---------- 8. Firma paneli ----------
s = new_slide(8, kicker="Firma paneli", title="Hamkor firma biznesini bitta oynadan boshqaradi")
screenshot(s, "fa_dashboard", Inches(0.7), Inches(1.75), Inches(6.9), max_h=Inches(4.95))
screenshot(s, "fa_finance", Inches(7.95), Inches(1.75), Inches(4.7), max_h=Inches(3.35))
text(s, Inches(7.95), Inches(5.35), Inches(4.7), Inches(1.4), [
    [("✓  ", {"color": ACCENT, "bold": True}), ("Buyurtmalar, ish bosqichlari, xodim biriktirish", {})],
    [("✓  ", {"color": ACCENT, "bold": True}), ("Moliya: ushlangan / o'tkazilgan pul, platforma ulushi", {})],
    [("✓  ", {"color": ACCENT, "bold": True}), ("Xodimlar, mijozlar, xarita, PDF hisobotlar", {})],
], size=12.5, line_spacing=1.35)
notes(s, "Firma uchun bu bepul CRM: buyurtmalar, xodimlar, moliya va hisobotlar bir joyda.")

# ---------- 9. Superadmin ----------
s = new_slide(9, kicker="Superadmin paneli", title="Platforma ustidan to'liq nazorat")
screenshot(s, "sa_dashboard", Inches(0.7), Inches(1.75), Inches(6.9), max_h=Inches(4.95))
screenshot(s, "sa_firms", Inches(7.95), Inches(1.75), Inches(4.7), max_h=Inches(3.35))
text(s, Inches(7.95), Inches(5.35), Inches(4.7), Inches(1.4), [
    [("✓  ", {"color": ACCENT, "bold": True}), ("Firmalar: moderatsiya, reyting, obuna, blok", {})],
    [("✓  ", {"color": ACCENT, "bold": True}), ("Escrow: to'lovni chiqarish, qaytarish, jarima", {})],
    [("✓  ", {"color": ACCENT, "bold": True}), ("Aylanma va komissiya hisobotlari, bannerlar", {})],
], size=12.5, line_spacing=1.35)
notes(s, "Superadmin barcha firmalar, buyurtmalar va pul oqimini real vaqtda ko'radi.")

# ---------- 10. Ishonch ----------
s = new_slide(10, kicker="Ishonch va sifat", title="Nega mijoz va firma bizga ishonadi")
trust = [
    ("🔐", "Escrow to'lov", "To'lov ish tasdiqlanguncha platforma hisobida. Holatlar: kutilmoqda, ushlangan, "
                           "o'tkazilgan, qaytarilgan, nizoli, muzlatilgan. Har bir amal ikki tomonlama buxgalteriyada."),
    ("⭐", "Reyting va sharhlar", "Faqat ishi yakunlangan mijoz baho qoldiradi — soxta sharh yo'q."),
    ("⚖", "Jarima va taqiq", "Qoidabuzar firmaga 100 000 so'm jarima va 7 kunlik savdo taqig'i."),
    ("🎁", "Bonus ballar", "Har 10 000 so'm uchun 1 ball, 50 balldan almashtiriladi, 12 oy amal qiladi."),
    ("📲", "SMS orqali kirish", "6 xonali kod, 5 daqiqa amal qiladi, 5 urinish — parolsiz va xavfsiz."),
    ("🧾", "Shaffof narx", "Narxni firma oldindan belgilaydi, superadmin moderatsiya qiladi."),
]
for i, (glyph, head, body) in enumerate(trust):
    col, row = i % 3, i // 3
    x = Inches(0.7) + col * Inches(4.0)
    y = Inches(1.85) + row * Inches(2.5)
    card(s, x, y, Inches(3.8), Inches(2.3))
    icon_badge(s, x + Inches(0.3), y + Inches(0.3), glyph)
    text(s, x + Inches(1.1), y + Inches(0.4), Inches(2.5), Inches(0.4), head, size=16, bold=True)
    text(s, x + Inches(0.3), y + Inches(1.1), Inches(3.25), Inches(1.15), body, size=12, color=MUTED)
notes(s, "Bu mexanizmlarning barchasi kodda ishlaydi va avtomatik testlar bilan tekshirilgan.")

# ---------- 11. Biznes model ----------
s = new_slide(11, kicker="Biznes model", title="Daromad qanday keladi",
              subtitle="Stavkalar superadmin panelida sozlanadi — bozor sinovidan keyin optimallashtiriladi.")
models = [
    ("%", "Buyurtma komissiyasi", "0.1% – 3%", "Har bir yakunlangan buyurtmadan platforma ulushi. "
                                              "Firma qancha ko'p ishlasa, stavka shuncha past (sodiqlik)."),
    ("$", "Firma obunasi", "$9 / oy · $90 / yil", "Panel, CRM va platformadagi joy uchun. Yangi firmaga 30 kun bepul."),
    ("★", "Qo'shimcha daromad", "Reja", "Reklama bannerlari, ro'yxatda yuqori joy, yillik parvarish shartnomalari "
                                      "(korxona va mahallalar uchun)."),
]
for i, (glyph, head, value, body) in enumerate(models):
    x = Inches(0.7) + i * Inches(4.0)
    card(s, x, Inches(2.3), Inches(3.8), Inches(2.85), fill=CARD if i else ACCENT_DARK, line=CARD_LINE if i else ACCENT)
    icon_badge(s, x + Inches(0.3), Inches(2.6), glyph, fill=ACCENT if i == 0 else ACCENT_DARK,
               color=BG if i == 0 else ACCENT, font_size=20)
    text(s, x + Inches(1.1), Inches(2.7), Inches(2.6), Inches(0.4), head, size=16, bold=True)
    text(s, x + Inches(0.3), Inches(3.45), Inches(3.3), Inches(0.5), value, size=24, bold=True, color=ACCENT)
    text(s, x + Inches(0.3), Inches(4.05), Inches(3.3), Inches(1.0), body, size=12, color=MUTED)
card(s, Inches(0.7), Inches(5.4), Inches(11.95), Inches(1.35), fill=RGBColor(0x12, 0x1A, 0x14))
text(s, Inches(1.0), Inches(5.55), Inches(11.4), Inches(1.1), [
    [("Sodiqlik shkalasi (komissiya): ", {"bold": True, "color": ACCENT}),
     ("5 tagacha buyurtma — 0.30%  ·  5+ — 0.25%  ·  20+ — 0.20%  ·  50+ — 0.15%  ·  100+ — 0.10%", {})],
    [("Misol: ", {"bold": True, "color": ACCENT}),
     ("[ ___ ] firma × oyiga [ ___ ] buyurtma × o'rtacha chek [ ___ ] so'm = oylik aylanma [ ___ ] so'm", {"color": MUTED})],
], size=13, line_spacing=1.5)
notes(s, "MUHIM: hozirgi sozlamada komissiya 0.30% (foiz). Agar maqsad 30% bo'lsa — superadmin "
         "sozlamasida o'zgartiring va slaydni yangilang. Misol qatorini o'z prognozingiz bilan to'ldiring.")

# ---------- 12. Katalog ----------
s = new_slide(12, kicker="Xizmatlar katalogi", title="9 ta xizmat turi — boshlang'ich narxlar",
              subtitle="Narxlar so'mda; har bir firma o'z narxini belgilaydi, mijoz solishtirib tanlaydi.")
catalog = [
    ("📞", "Bepul konsultatsiya", "0"), ("📐", "Landshaft dizayn", "1.5 mln – 8.5 mln"),
    ("🌳", "Daraxt parvarishi", "250 ming – 1.2 mln"), ("✂", "Gazon parvarishi", "180 – 650 ming"),
    ("🌲", "Archaga shakl berish", "300 ming – 2 mln"), ("🧪", "Hasharotlardan himoya", "220 – 900 ming"),
    ("🌾", "O'g'itlash", "150 – 700 ming"), ("✅", "Kafolat xizmati", "0"),
    ("💧", "Sug'orish tizimi", "2.8 mln – 15 mln"),
]
for i, (glyph, name, price) in enumerate(catalog):
    col, row = i % 3, i // 3
    x = Inches(0.7) + col * Inches(4.0)
    y = Inches(2.3) + row * Inches(1.45)
    card(s, x, y, Inches(3.8), Inches(1.25))
    icon_badge(s, x + Inches(0.25), y + Inches(0.32), glyph, size=Inches(0.6))
    text(s, x + Inches(1.05), y + Inches(0.25), Inches(2.6), Inches(0.4), name, size=14.5, bold=True)
    text(s, x + Inches(1.05), y + Inches(0.67), Inches(2.6), Inches(0.4), price + (" so'm" if price != "0" else " — bepul"),
         size=13, color=ACCENT, bold=True)
notes(s, "Bepul konsultatsiya va kafolat — mijozni jalb qilish va ishonch uchun.")

# ---------- 13. Texnologiya ----------
s = new_slide(13, kicker="Texnologiya", title="Zamonaviy, kengayadigan arxitektura")
tech = [
    ("Backend", "Django 5 · Django REST · JWT", "Yagona API, rollar: mijoz, xodim, firma admin, superadmin"),
    ("Mobil ilova", "Flutter", "Bitta koddan Android, iOS va Web"),
    ("Web panellar", "Next.js 16 · React · Tailwind", "Firma paneli va superadmin paneli"),
    ("Telegram bot", "aiogram 3", "Kirish, buyurtma, murojaat, bildirishnoma"),
    ("Ma'lumotlar", "PostgreSQL · Redis", "Tranzaksiyalar, escrow buxgalteriyasi, kesh"),
    ("Infratuzilma", "Docker · Gunicorn", "Bir buyruq bilan serverga chiqarish"),
]
for i, (layer, stack, desc) in enumerate(tech):
    col, row = i % 2, i // 2
    x = Inches(0.7) + col * Inches(6.05)
    y = Inches(1.85) + row * Inches(1.32)
    card(s, x, y, Inches(5.85), Inches(1.15))
    text(s, x + Inches(0.3), y + Inches(0.2), Inches(1.8), Inches(0.4), layer, size=13, color=ACCENT, bold=True)
    text(s, x + Inches(2.1), y + Inches(0.18), Inches(3.6), Inches(0.4), stack, size=15, bold=True)
    text(s, x + Inches(2.1), y + Inches(0.6), Inches(3.6), Inches(0.45), desc, size=11.5, color=MUTED)
text(s, Inches(0.7), Inches(5.95), Inches(11.95), Inches(0.8), [
    [("99 ta avtomatik test", {"bold": True, "color": ACCENT}), ("  ·  OpenAPI (Swagger) hujjatlar  ·  "
     "Bandlikni server tekshiradi (bir vaqtni ikki kishi band qila olmaydi)  ·  Rollar bo'yicha ruxsatlar", {"color": MUTED})],
], size=13)
notes(s, "Arxitektura yangi shahar va xizmat turlarini qo'shishga tayyor; bitta Flutter kodi ikkala "
         "mobil platformani qoplaydi — xarajat ikki barobar kam.")

# ---------- 14. Hozirgi holat ----------
s = new_slide(14, kicker="Hozirgi holat", title="MVP tayyor va ishlayapti")
done = [
    "Mobil ilova: SMS-kod bilan kirish, katalog, buyurtma, rasm yuklash",
    "Firmalar narxini solishtirish va qat'iy narx",
    "Bandlik jadvali: yashil / qizil vaqtlar, vaqtni uzaytirish",
    "Escrow to'lov (sinov rejimi), qaytarish, nizo, jarima",
    "Firma paneli: buyurtma, xodim, moliya, hisobot (PDF)",
    "Superadmin: firmalar, komissiya, obuna, xarita, bannerlar",
    "Telegram bot: kirish, buyurtma, murojaatlar",
    "Reyting, sharhlar va bonus ball tizimi",
]
card(s, Inches(0.7), Inches(1.75), Inches(6.6), Inches(5.0))
text(s, Inches(1.0), Inches(1.95), Inches(6), Inches(0.4), "Bajarildi", size=16, bold=True, color=ACCENT)
yy = Inches(2.45)
for item in done:
    text(s, Inches(1.0), yy, Inches(6.1), Inches(0.5), [[("✓  ", {"color": ACCENT, "bold": True}), (item, {})]], size=13)
    yy += Inches(0.52)
stats = [("3", "platforma: ilova, 2 panel"), ("9", "xizmat turi"), ("4", "foydalanuvchi roli"), ("99", "avtomatik test")]
for i, (num, label) in enumerate(stats):
    col, row = i % 2, i // 2
    x = Inches(7.6) + col * Inches(2.6)
    y = Inches(1.75) + row * Inches(1.7)
    card(s, x, y, Inches(2.45), Inches(1.5), fill=ACCENT_DARK, line=ACCENT_DARK)
    text(s, x + Inches(0.3), y + Inches(0.2), Inches(2), Inches(0.7), num, size=36, bold=True, color=ACCENT)
    text(s, x + Inches(0.3), y + Inches(0.95), Inches(2), Inches(0.4), label, size=12, color=WHITE)
card(s, Inches(7.6), Inches(5.2), Inches(5.05), Inches(1.55))
text(s, Inches(7.9), Inches(5.35), Inches(4.6), Inches(1.3), [
    [("Pilot", {"bold": True, "color": AMBER, "size": 14})],
    [("[ ___ ] hamkor firma bilan kelishuv, [ ___ ] sinov buyurtma — o'z raqamlaringizni kiriting.",
      {"color": MUTED, "size": 12})],
], line_spacing=1.3)
notes(s, "Ko'rsatilgan skrinshotlar demo ma'lumotlar bilan olingan (2 firma, test buyurtmalar). "
         "Haqiqiy pilot raqamlari bo'lsa — ularni kiriting.")

# ---------- 15. Ustuvor vazifalar ----------
s = new_slide(15)
picture_fill(s, os.path.join(ASSETS, "future.jpg"), 0, 0, SW, SH)
gradient_overlay(s, 0, 0, SW, SH, angle=0, stops=[(0, BG, 97), (55, BG, 88), (100, BG, 45)])
text(s, Inches(0.7), Inches(0.5), Inches(8), Inches(0.3), "KELAJAKDAGI USTUVOR VAZIFALAR", size=12, color=ACCENT, bold=True)
text(s, Inches(0.7), Inches(0.82), Inches(11.9), Inches(0.8), "Yo'l xaritasi: 12 oy", size=32, bold=True)
phases = [
    ("0–1 oy", "Ishga tushirish", ["SMS provayder (Eskiz / Playmobile)", "Click va Payme to'liq integratsiya",
                                   "Push-bildirishnomalar (FCM)"]),
    ("1–3 oy", "Do'konlarga chiqish", ["Google Play va App Store", "Sharh, bonus, sevimlilar serverda",
                                       "Parvarish shartnomasi ekrani"]),
    ("3–6 oy", "O'sish", ["Toshkentda [ __ ]+ hamkor firma", "Obuna to'lovini avtomatlashtirish",
                          "Marketing va hamkorlik dasturi"]),
    ("6–12 oy", "Kengayish", ["Viloyat markazlariga chiqish", "B2B: korxona va mahalla shartnomalari",
                              "AI: rasm va maydon bo'yicha narx bahosi"]),
]
pw = Inches(2.85)
for i, (when, head, items) in enumerate(phases):
    x = Inches(0.7) + i * (pw + Inches(0.18))
    rect(s, x, Inches(2.05), pw, Inches(0.06), ACCENT if i == 0 else CARD_LINE)
    rect(s, x, Inches(1.93), Inches(0.3), Inches(0.3), ACCENT if i == 0 else CARD, line=ACCENT,
         shape=MSO_SHAPE.OVAL)
    c = card(s, x, Inches(2.5), pw, Inches(3.9), fill=CARD)
    set_alpha(c, 88)
    pill(s, x + Inches(0.25), Inches(2.75), when, w=Inches(1.15), fill=ACCENT if i == 0 else ACCENT_DARK,
         color=BG if i == 0 else ACCENT)
    text(s, x + Inches(0.25), Inches(3.25), pw - Inches(0.5), Inches(0.4), head, size=18, bold=True)
    yy = Inches(3.85)
    for item in items:
        text(s, x + Inches(0.25), yy, pw - Inches(0.45), Inches(0.75),
             [[("›  ", {"color": ACCENT, "bold": True}), (item, {})]], size=12.5)
        yy += Inches(0.78)
footer(s, 15)
notes(s, "Birinchi bosqich — haqiqiy to'lov va SMS: bular ishga tushirish uchun majburiy. Keyin do'konlarga "
         "chiqish va hamkor firmalar sonini oshirish.")

# ---------- 16. Investitsiya ----------
s = new_slide(16, kicker="Investitsiya", title="Biz nimani so'raymiz")
card(s, Inches(0.7), Inches(1.8), Inches(5.3), Inches(4.9), fill=ACCENT_DARK, line=ACCENT)
text(s, Inches(1.05), Inches(2.1), Inches(4.7), Inches(0.4), "Jalb qilinadigan mablag'", size=15, color=ACCENT, bold=True)
text(s, Inches(1.05), Inches(2.55), Inches(4.7), Inches(0.9), "$ [ ______ ]", size=40, bold=True)
text(s, Inches(1.05), Inches(3.5), Inches(4.7), Inches(0.4), "evaziga [ __ ]% ulush  ·  [ __ ] oyga yetadi", size=14,
     color=MUTED)
text(s, Inches(1.05), Inches(4.25), Inches(4.7), Inches(2.3), [
    [("Natija (12 oy):", {"bold": True, "color": WHITE})],
    [("›  [ __ ] hamkor firma", {"color": MUTED})],
    [("›  oyiga [ __ ] buyurtma", {"color": MUTED})],
    [("›  [ __ ] shaharda ishlash", {"color": MUTED})],
], size=13.5, line_spacing=1.4)
uses = [("Marketing va mijoz jalb qilish", "__%"), ("Dasturlash va integratsiyalar", "__%"),
        ("Jamoa (sotuv, qo'llab-quvvatlash)", "__%"), ("Server, litsenziya, operatsion", "__%")]
text(s, Inches(6.4), Inches(1.85), Inches(6), Inches(0.4), "Mablag' qayerga sarflanadi", size=15, color=ACCENT, bold=True)
for i, (label, pct) in enumerate(uses):
    y = Inches(2.4) + i * Inches(1.0)
    card(s, Inches(6.4), y, Inches(6.25), Inches(0.82))
    text(s, Inches(6.7), y + Inches(0.24), Inches(4.5), Inches(0.4), label, size=14, bold=True)
    text(s, Inches(11.2), y + Inches(0.22), Inches(1.2), Inches(0.4), pct, size=18, bold=True, color=ACCENT,
         align=PP_ALIGN.RIGHT)
text(s, Inches(6.4), Inches(6.45), Inches(6.25), Inches(0.35),
     "Kontakt: [ Ism Familiya ]  ·  [ +998 __ ___ __ __ ]  ·  [ email / Telegram ]", size=12, color=MUTED)
notes(s, "Qavs ichidagi barcha joylarni o'zingizning aniq raqamlaringiz bilan to'ldiring. Yakunda: "
         "'Savollaringiz bo'lsa, javob beramiz. Hozir jonli demo ko'rsatishimiz mumkin.'")

prs.save(OUT)
print(OUT)
