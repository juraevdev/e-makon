#!/usr/bin/env python3
"""tools/i18n/*.tsv tarjimalaridan ikkala panel uchun dict.ts yaratadi.

tr-N.tsv:        <keys.json indeksi> TAB <ruscha> TAB <inglizcha>
tr-templates.tsv: <o'zbekcha andoza> TAB <ruscha> TAB <inglizcha>   ({} — matn, {n} — son)
"""
import glob, json, pathlib

root = pathlib.Path(__file__).resolve().parent
keys = json.load(open(root / "i18n" / "keys.json"))
entries = {}
for f in sorted(glob.glob(str(root / "i18n" / "tr-[0-9]*.tsv"))):
    for line in open(f, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        idx, ru, en = line.split("\t")
        entries[keys[int(idx)]] = (ru, en)
for line in open(root / "i18n" / "tr-templates.tsv", encoding="utf-8"):
    line = line.rstrip("\n")
    if line.strip():
        k, ru, en = line.split("\t")
        entries[k] = (ru, en)

body = "".join(
    f"  {json.dumps(k, ensure_ascii=False)}: [{json.dumps(ru, ensure_ascii=False)}, {json.dumps(en, ensure_ascii=False)}],\n"
    for k, (ru, en) in sorted(entries.items())
)
out = (
    "/* AVTOMATIK YARATILGAN — qo'lda tahrirlamang. Manba: tools/i18n/*.tsv, yaratuvchi: tools/i18n-build.py */\n"
    "/** Kalit — o'zbekcha matn; qiymat — [ruscha, inglizcha]. `{}` — matn, `{n}` — son o'rni. */\n"
    "export const DICT: Record<string, [string, string]> = {\n" + body + "};\n"
)
for panel in ("superadmin_panel", "admin_panel"):
    p = root.parent / panel / "src" / "lib" / "i18n" / "auto" / "dict.ts"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(out, encoding="utf-8")
print(len(entries), "ta yozuv")
