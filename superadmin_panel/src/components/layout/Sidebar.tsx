"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, asPage } from "@/lib/api/client";
import { navItems } from "@/lib/nav";
import { useLocale } from "@/providers/LocaleProvider";

const COLLAPSE_KEY = "emakon-sidebar-collapsed";

function usePendingServices(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api("/admin/services/", { query: { moderation_status: "pending", page_size: 1 } })
        .then((raw) => alive && setCount(asPage(raw).count))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);
  return count;
}

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const pendingServices = usePendingServices(pathname);
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-white/10 bg-sidebar py-5 text-white transition-all duration-300 ease-in-out md:sticky md:z-30 md:translate-x-0 ${
          isCollapsed ? "md:w-20" : "md:w-64"
        } w-64 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`mb-4 flex items-center gap-2 transition-all duration-300 ${
            isCollapsed ? "flex-col px-2" : "justify-between px-4"
          }`}
        >
          <div
            className={`flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-300 ${
              isCollapsed ? "md:hidden" : "w-auto opacity-100"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg">
              🌿
            </span>
            <span className="truncate text-xl font-bold tracking-tight text-white">
              {t("brand")}
            </span>
          </div>
          {isCollapsed ? (
            <span
              className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-lg md:flex"
              aria-hidden
            >
              🌿
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-sidebar-hover hover:text-white md:inline-flex"
            aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
            title={isCollapsed ? t("common.expand") : t("common.collapse")}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        <div
          className={`mb-4 overflow-hidden px-4 transition-all duration-300 ease-in-out ${
            isCollapsed ? "md:mb-0 md:h-0 md:opacity-0 md:px-0" : "opacity-100"
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
            {t("portal.super")}
          </p>
          <p className="mt-1 text-xs text-white/55">{t("nature.tagline")}</p>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={isCollapsed ? label : undefined}
                className={`group relative flex items-center rounded-xl py-2.5 transition-colors ${
                  isCollapsed ? "justify-center px-0" : "gap-3 px-3"
                } ${
                  active
                    ? "bg-sidebar-active font-semibold text-white shadow-sm"
                    : "text-white/85 hover:bg-sidebar-hover hover:text-white"
                }`}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={
                    active
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {item.icon}
                </span>
                <span
                  className={`truncate text-sm font-semibold tracking-wide transition-all duration-300 ${
                    isCollapsed ? "md:hidden" : "inline"
                  }`}
                >
                  {label}
                </span>
                {item.href === "/xizmatlar" && pendingServices > 0 ? (
                  <span
                    className={`rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black ${
                      isCollapsed ? "absolute -right-0.5 -top-0.5 md:px-1.5" : "ml-auto"
                    }`}
                    title={t("common.pendingServices")}
                  >
                    {pendingServices}
                  </span>
                ) : null}

                {isCollapsed ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-forest-deep px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 md:block md:group-hover:opacity-100"
                    style={{ backgroundColor: "var(--forest-deep)" }}
                  >
                    {label}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
