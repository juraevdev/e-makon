"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { inputClass } from "@/components/ui";

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const { t, locale, setLocale, locales } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const [phone, setPhone] = useState("+998901000000");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-ink-muted">
        <span className="material-symbols-outlined animate-spin text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("login.failed");
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? t("login.apiDown")
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-atmosphere grid min-h-screen place-items-center px-4 py-10" data-page="/" data-weather="sunny">
      <div className="absolute right-4 top-4 flex gap-2">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
          className="rounded-full border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-ink"
        >
          {locales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-card-border bg-card p-2 text-ink-muted"
          aria-label={theme === "dark" ? t("common.themeLight") : t("common.themeDark")}
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>
      <div className="w-full max-w-[420px] rounded-3xl border border-card-border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-3xl font-bold text-primary">{t("brand")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("login.title")}</p>
          <p className="mt-1 text-xs text-ink-muted/80">{t("nature.tagline")}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">{t("login.phone")}</span>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">{t("login.password")}</span>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="btn-accent mt-2 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
          >
            {busy ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">login</span>
            )}
            {busy ? t("login.busy") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
