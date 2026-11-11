"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LOCALES,
  type Locale,
  translate,
} from "@/lib/i18n/messages";
import { setAutoLocale } from "@/lib/i18n/auto/translate";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locales: typeof LOCALES;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "emakon-locale";

const HTML_LANG: Record<Locale, string> = {
  uz: "uz",
  uzCyrl: "uz-Cyrl",
  ru: "ru",
  en: "en",
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("uz");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && LOCALES.some((l) => l.code === stored)) {
      setAutoLocale(stored);
      setLocaleState(stored);
      document.documentElement.lang = HTML_LANG[stored];
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setAutoLocale(next);
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = HTML_LANG[next];
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = translate(locale, key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: LOCALES }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>
      {/* Til almashganda butun daraxt qayta chiziladi — avtomatik tarjima yangi tilni oladi. */}
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
