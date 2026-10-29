"use client";

import { usePathname } from "next/navigation";
import { getNavTitleKey, getWeatherLabelKey } from "@/lib/nav";
import { initials } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { useSearch } from "@/providers/SearchProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useWeather } from "@/providers/WeatherProvider";
import { currentSeason, seasonLabelKey } from "@/lib/weather/season";

type HeaderProps = {
  onMenuClick?: () => void;
};

const WEATHER_ICON: Record<string, string> = {
  sunny: "sunny",
  dry: "wb_sunny",
  wind: "air",
  rain: "rainy",
  snow: "weather_snowy",
  dew: "water_drop",
  forest: "forest",
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { t, locale, setLocale, locales } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { mood, live, loading: weatherLoading } = useWeather();
  const title = t(getNavTitleKey(pathname));
  const { user, logout } = useAuth();
  const { query, setQuery } = useSearch();
  const name = user?.full_name || user?.phone || "Admin";
  const roleKey =
    user?.role === "superadmin" ? "role.superadmin" : "role.admin";
  const placeKey =
    live?.place === "you" ? "weather.placeYou" : "weather.placeTashkent";
  const season = currentSeason();

  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-card-border/60 bg-card/85 px-4 py-2 text-ink backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-container-high md:hidden"
          aria-label={t("common.menu")}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink md:text-[32px] md:leading-10">
            {title}
          </h1>
          <p className="mt-0.5 hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
            <span className="material-symbols-outlined text-[14px] text-accent">
              {weatherLoading ? "progress_activity" : WEATHER_ICON[mood]}
            </span>
            <span>{t(getWeatherLabelKey(mood))}</span>
            {live ? (
              <>
                <span className="text-ink-muted/50">·</span>
                <span>
                  {Math.round(live.tempC)}°C · {t(placeKey)}
                </span>
              </>
            ) : null}
            <span className="text-ink-muted/50">·</span>
            <span>{t(seasonLabelKey(season))}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.search")}
            className="w-52 rounded-full border border-card-border bg-card py-2 pr-4 pl-10 text-sm text-ink placeholder:text-ink-muted transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none lg:w-64"
          />
        </div>

        <label className="relative inline-flex">
          <span className="sr-only">{t("common.language")}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="appearance-none rounded-full border border-card-border bg-card py-2 pl-3 pr-8 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
            title={t("common.language")}
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.short}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-ink-muted">
            expand_more
          </span>
        </label>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-card-border bg-card p-2 text-ink-muted transition-colors hover:bg-surface-container-high hover:text-primary"
          title={theme === "dark" ? t("common.themeLight") : t("common.themeDark")}
          aria-label={theme === "dark" ? t("common.themeLight") : t("common.themeDark")}
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>

        <div className="flex items-center gap-2 rounded-full border border-card-border bg-card py-1 pr-2 pl-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials(name)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs leading-tight font-medium text-ink">{name}</p>
            <p className="text-xs leading-tight text-ink-muted">{t(roleKey)}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full p-2 text-ink-muted hover:bg-surface-container-high hover:text-error"
            title={t("common.logout")}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
