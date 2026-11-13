/**
 * Avtomatik tarjima: kodda o'zbekcha yozilgan UI matnlari render paytida lug'at orqali
 * tanlangan tilga o'giriladi (qarang: ./jsx-runtime.ts). Lug'atda yo'q matn o'zbekcha qoladi.
 *
 * Yangi matn qo'shilganda: `node tools/i18n-extract.cjs <panel>` bilan yig'ib, dict.ts ga
 * tarjimasini qo'shing. Kalit — o'zbekcha matnning o'zi; `{}` — o'zgaruvchi qism.
 */
import type { Locale } from "../messages";
import { DICT } from "./dict";

let current: Locale = "uz";

export function setAutoLocale(locale: Locale) {
  current = locale;
}

export function autoLocale(): Locale {
  return current;
}

/** Lotin → kirill. Brend va texnik so'zlar o'zgarmaydi. */
const KEEP = /^(E-?MAKON|E-?Makon|Excel|PDF|UZS|Click|Payme|Telegram|Instagram|YouTube|Facebook|SMS|ID|GPS|URL|Email|OTP|API|QR|PNG|JPG|WebP|lat|lng|VIP|KPI|IP)$/;
const PAIRS: [RegExp, string][] = [
  [/O[ʻ‘'’`]/g, "Ў"], [/o[ʻ‘'’`]/g, "ў"], [/G[ʻ‘'’`]/g, "Ғ"], [/g[ʻ‘'’`]/g, "ғ"],
  [/Sh/g, "Ш"], [/SH/g, "Ш"], [/sh/g, "ш"], [/Ch/g, "Ч"], [/CH/g, "Ч"], [/ch/g, "ч"],
  [/Yo/g, "Ё"], [/yo/g, "ё"], [/Yu/g, "Ю"], [/yu/g, "ю"], [/Ya/g, "Я"], [/ya/g, "я"],
  [/Ye/g, "Е"], [/ye/g, "е"], [/Ts/g, "Ц"], [/ts/g, "ц"],
  [/(^|[^\p{L}])E/gu, "$1Э"], [/(^|[^\p{L}])e/gu, "$1э"],
];
const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з",
  c: "с", w: "в",
};
function cyrWord(word: string): string {
  if (KEEP.test(word) || /^[@#]/.test(word) || /\d/.test(word)) return word;
  let s = word;
  for (const [re, to] of PAIRS) s = s.replace(re, to);
  s = s.replace(/[ʻ‘'’`]/g, "ъ");
  return s.replace(/[A-Za-z]/g, (ch) => {
    const low = SINGLE[ch.toLowerCase()];
    if (!low) return ch;
    return ch === ch.toLowerCase() ? low : low.toUpperCase();
  });
}
function toCyrillic(text: string): string {
  // `{}` / `{n}` o'rinlari o'zgarmasligi kerak.
  return text
    .split(/(\{n?\})/)
    .map((part) => (/^\{n?\}$/.test(part) ? part : cyrPart(part)))
    .join("");
}
function cyrPart(text: string): string {
  return text.replace(/[\p{L}\p{N}@#ʻ‘'’`-]+/gu, (w) => cyrWord(w));
}

const COL: Partial<Record<Locale, 0 | 1>> = { ru: 0, en: 1 };

function entry(key: string): string | undefined {
  const row = DICT[key];
  if (!row) return undefined;
  if (current === "uzCyrl") return toCyrillic(key);
  const col = COL[current];
  return col == null ? undefined : row[col] || undefined;
}

/** `{}` (matn) va `{n}` (son) li kalitlar: o'zgaruvchi qismli matnlar uchun andozalar. */
type Pattern = { key: string; re: RegExp; kinds: string[] };
const HOLE = /\{n?\}/g;
let patterns: Pattern[] | null = null;
function getPatterns(): Pattern[] {
  if (patterns) return patterns;
  patterns = Object.keys(DICT)
    .filter((k) => /\{n?\}/.test(k))
    .sort((a, b) => b.length - a.length)
    .map((key) => {
      const kinds = key.match(HOLE) ?? [];
      const parts = key.split(HOLE).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      let src = parts[0];
      kinds.forEach((kind, i) => {
        src += (kind === "{n}" ? "(\\d[\\d\\s.,]*?)" : "([\\s\\S]+?)") + parts[i + 1];
      });
      return { key, kinds, re: new RegExp("^" + src + "$") };
    });
  return patterns;
}

const cache = new Map<string, string>();
let cacheLocale: Locale = "uz";

/** Sana qisqartmalari: lib/format.ts dagi UZ_MONTHS bilan bir xil tartibda. */
const UZ_MON = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
const MON: Partial<Record<Locale, string[]>> = {
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  uzCyrl: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ной", "дек"],
};
const DATE_RE = new RegExp(`(\\d{1,2}) (${UZ_MON.join("|")})(?=[\\s,.]|$)`, "g");
function localizeDates(text: string): string {
  const names = MON[current];
  if (!names) return text;
  return text.replace(DATE_RE, (_m, day: string, mon: string) => `${day} ${names[UZ_MON.indexOf(mon)]}`);
}

/** "Manzil:", "· Sinov to'lovi", "Xodimlar (2)" kabi: chetdagi belgilarni ajratib, o'zagini qidiradi. */
const AFFIX = /^([\s·:—–\-•*(]*)([\s\S]*?)((?:\s*\(\d+\))?[\s·:—–\-•*).,!?…]*)$/;

function core(text: string, depth: number): string {
  const exact = entry(text);
  if (exact !== undefined) return exact;
  if (depth > 2 || text.length > 400) return text;
  const a = AFFIX.exec(text);
  if (a && a[2] && a[2] !== text) {
    const inner = entry(a[2]);
    if (inner !== undefined) return a[1] + inner + a[3];
  }
  for (const { key, re, kinds } of getPatterns()) {
    const m = re.exec(text);
    if (!m) continue;
    const tpl = entry(key);
    if (tpl === undefined) continue;
    // Tarjimada tartib o'zgarishi mumkin: har tur o'z navbati bo'yicha olinadi.
    const pool: Record<string, string[]> = { "{}": [], "{n}": [] };
    kinds.forEach((kind, i) => pool[kind].push(String(m[i + 1] ?? "")));
    return tpl.replace(HOLE, (kind) => {
      const v = pool[kind].shift() ?? "";
      return kind === "{n}" ? v : core(v, depth + 1);
    });
  }
  return text;
}

/** Matnni joriy tilga o'giradi; chetidagi bo'shliqlar saqlanadi. */
export function translateText(text: string): string {
  if (current === "uz" || !text) return text;
  if (cacheLocale !== current) {
    cache.clear();
    cacheLocale = current;
  }
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  let out = text;
  if (/\p{L}/u.test(text)) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
    const body = m[2].replace(/\s+/g, " ");
    const tr = core(body, 0);
    out = tr === body ? text : m[1] + tr + m[3];
    out = localizeDates(out);
  }
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}
