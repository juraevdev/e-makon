"use client";

import { useLocale } from "@/providers/LocaleProvider";

/** Shared UI string from i18n (safe default if key missing). */
export function UiText({ k, fallback = "" }: { k: string; fallback?: string }) {
  const { t } = useLocale();
  const value = t(k);
  return <>{value === k ? fallback || k : value}</>;
}

export function useUiT() {
  return useLocale().t;
}
