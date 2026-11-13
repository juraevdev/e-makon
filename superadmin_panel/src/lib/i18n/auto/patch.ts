import { autoLocale, translateText } from "./translate";

const ATTRS = ["placeholder", "title", "aria-label", "alt", "label"] as const;
const SKIP_TAGS = new Set(["script", "style", "code", "pre", "textarea", "input"]);

function child(c: unknown): unknown {
  return typeof c === "string" ? translateText(c) : c;
}

/**
 * Matn bolalarini (har qanday element uchun — `next/link` kabi kutubxona komponentlari ham
 * o'z ichida DOM elementini bizning runtime'siz yaratadi) va DOM elementlarining
 * ko'rinadigan atributlarini tarjima qiladi.
 */
export function patchProps(type: unknown, props: Record<string, unknown> | null) {
  if (!props || autoLocale() === "uz") return props;
  const host = typeof type === "string";
  let next: Record<string, unknown> | null = null;
  const set = (k: string, v: unknown) => {
    if (!next) next = { ...props };
    next[k] = v;
  };
  if (host) {
    for (const a of ATTRS) {
      const v = props[a];
      if (typeof v === "string") {
        const tr = translateText(v);
        if (tr !== v) set(a, tr);
      }
    }
    if (SKIP_TAGS.has(type as string)) return next ?? props;
    const cls = props.className;
    if (typeof cls === "string" && cls.includes("material-symbols")) return next ?? props;
  }
  const ch = props.children;
  if (typeof ch === "string") {
    const tr = translateText(ch);
    if (tr !== ch) set("children", tr);
  } else if (Array.isArray(ch) && ch.some((c) => typeof c === "string")) {
    const mapped = ch.map(child);
    if (mapped.some((c, i) => c !== ch[i])) set("children", mapped);
  }
  return next ?? props;
}
