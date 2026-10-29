"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";
import { api, asPage } from "@/lib/api/client";
import { navItems } from "@/lib/nav";
import { FIRM_STATUS_LABEL } from "@/lib/domain";
import { useFirm } from "@/providers/FirmProvider";
import { useLocale } from "@/providers/LocaleProvider";

const COLLAPSE_KEY = "emakon-sidebar-collapsed";

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { firm } = useFirm();
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: chat } = useAsync(
    () => api<{ unread: number }>("/admin/chats/unread/").catch(() => ({ unread: 0 })),
    [],
    { live: 5000 },
  );
  const { data: newOrders } = useAsync(
    async () =>
      asPage(
        await api("/admin/orders/", { query: { status: "new", page_size: 1 } }).catch(() => []),
      ).count,
    [],
    { live: 5000 },
  );
  const badges: Record<string, number> = {
    "/aloqa": chat?.unread ?? 0,
    "/buyurtmalar": newOrders ?? 0,
  };

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
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] max-w-[85vw] flex-col border-r border-white/10 bg-sidebar py-5 text-white transition-all duration-300 ease-in-out md:sticky md:z-30 md:max-w-none md:translate-x-0 ${
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 hover:bg-sidebar-hover md:hidden"
              aria-label={t("common.closeMenu")}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
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
        </div>

        <div
          className={`mb-4 overflow-hidden px-4 transition-all duration-300 ease-in-out ${
            isCollapsed ? "md:mb-0 md:h-0 md:opacity-0 md:px-0" : "opacity-100"
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
            {t("portal.firm")}
          </p>
          {firm ? (
            <div className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-white">{firm.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                <span
                  className={`h-2 w-2 rounded-full ${
                    firm.status === "active" && !firm.is_sales_banned
                      ? "bg-primary-fixed"
                      : "bg-error"
                  }`}
                />
                {firm.is_sales_banned
                  ? t("firm.salesBanned")
                  : FIRM_STATUS_LABEL[firm.status]}
                {Number(firm.rating) > 0
                  ? ` · ★ ${Number(firm.rating).toFixed(1)}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-white/55">{t("nature.tagline")}</p>
          )}
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const badge = badges[item.href] ?? 0;
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
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
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
                {badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      item.href === "/buyurtmalar"
                        ? "animate-pulse bg-amber-400 text-black"
                        : "bg-white text-sidebar"
                    } ${isCollapsed ? "absolute -right-0.5 -top-0.5 md:px-1.5" : "ml-auto"}`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                {isCollapsed ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 md:block md:group-hover:opacity-100"
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
