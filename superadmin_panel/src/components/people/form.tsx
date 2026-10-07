"use client";

import { useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui";
import { useSearch } from "@/providers/SearchProvider";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** +998 XX XXX XX XX yoki 9 xonali mahalliy raqam. */
export function isValidUzPhone(value: string) {
  const d = onlyDigits(value);
  return (d.length === 12 && d.startsWith("998")) || d.length === 9;
}

export function normalizeUzPhone(value: string) {
  const d = onlyDigits(value);
  if (d.length === 9) return `+998${d}`;
  return d ? `+${d}` : "";
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-error">
      <span className="material-symbols-outlined text-[14px]">error</span>
      {message}
    </span>
  );
}

export function errorRing(message?: string) {
  return message ? " border-error/70 focus:border-error focus:ring-error" : "";
}

export function FormSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#26352c] bg-[#101412] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-on-surface">{title}</h4>
            {description ? <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  invalid,
  allowGenerate = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  allowGenerate?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-[#1a231d] hover:text-primary disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <input
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          className={`${inputClass} pr-20 font-mono${invalid ? errorRing("x") : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          <button
            type="button"
            className={iconBtn}
            onClick={() => setVisible((v) => !v)}
            title={visible ? "Yashirish" : "Ko'rsatish"}
            aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
          >
            <span className="material-symbols-outlined text-[18px]">{visible ? "visibility_off" : "visibility"}</span>
          </button>
          <button type="button" className={iconBtn} disabled={!value} onClick={() => void copy()} title="Nusxalash" aria-label="Parolni nusxalash">
            <span className="material-symbols-outlined text-[18px]">{copied ? "check" : "content_copy"}</span>
          </button>
        </div>
      </div>
      {allowGenerate ? (
        <button
          type="button"
          onClick={() => {
            onChange(generatePassword());
            setVisible(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20"
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          Yaratish
        </button>
      ) : null}
    </div>
  );
}

export function passwordStrength(value: string) {
  if (!value) return { score: 0, label: "", tone: "" };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (score <= 1) return { score, label: "Zaif", tone: "bg-error" };
  if (score <= 3) return { score, label: "O'rtacha", tone: "bg-amber-400" };
  return { score, label: "Kuchli", tone: "bg-primary" };
}

export function StrengthMeter({ value }: { value: string }) {
  const s = passwordStrength(value);
  if (!value) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="flex flex-1 gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < s.score ? s.tone : "bg-[#26352c]"}`} />
        ))}
      </span>
      <span className="shrink-0 text-[11px] text-on-surface-variant">{s.label}</span>
    </span>
  );
}

/** Sarlavhadagi global qidiruv bilan sinxron (mobilda sarlavha qidiruvi yashirin). */
export function SearchBox({ placeholder = "Qidirish...", className = "" }: { placeholder?: string; className?: string }) {
  const { query, setQuery } = useSearch();
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant">
        search
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-10`}
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant hover:text-on-surface"
          aria-label="Tozalash"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      ) : null}
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  icon,
  className = "",
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  icon?: string;
  className?: string;
  label: string;
}) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      {icon ? (
        <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant">
          {icon}
        </span>
      ) : null}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${icon ? "pl-10" : ""}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ViewToggle({ value, onChange }: { value: "grid" | "table"; onChange: (v: "grid" | "table") => void }) {
  return (
    <div className="hidden shrink-0 items-center gap-1 rounded-xl border border-[#26352c] bg-[#0f1311] p-1 md:inline-flex" role="group" aria-label="Ko'rinish">
      {(
        [
          ["table", "table_rows", "Jadval"],
          ["grid", "grid_view", "Kartalar"],
        ] as const
      ).map(([id, icon, label]) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
            value === id ? "bg-[#1f3324] text-primary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#26352c] bg-[#0d100f] px-4 py-3 text-left transition-colors hover:border-[#384f40]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span> : null}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary/80" : "bg-[#2a332d]"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-center">
      <span className="material-symbols-outlined mb-2 text-3xl text-error">error</span>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#26352c] bg-[#151c18] px-4 py-2 text-sm font-medium text-on-surface hover:bg-[#1f2922]"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        Qayta urinish
      </button>
    </div>
  );
}

export function MiniStat({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  active,
  onClick,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "primary" | "amber" | "error" | "sky" | "neutral";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    primary: "border-primary/25 bg-primary/10 text-primary",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    error: "border-error/25 bg-error/10 text-error",
    sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    neutral: "border-white/10 bg-surface-container-high text-on-surface-variant",
  };
  const body = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-on-surface-variant">{label}</span>
        <span className="block truncate text-2xl font-bold tracking-tight text-on-surface">{value}</span>
        {hint ? <span className="block truncate text-[11px] text-on-surface-variant">{hint}</span> : null}
      </span>
    </>
  );
  const cls = `flex min-w-0 items-center gap-3.5 rounded-2xl border bg-card/90 p-4 text-left shadow-lg shadow-black/20 transition-all ${
    active ? "border-primary/50 shadow-[0_0_15px_rgba(46,125,50,0.2)]" : "border-card-border hover:border-[#384c3e]"
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
