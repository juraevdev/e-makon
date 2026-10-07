"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";
import { api, asPage } from "@/lib/api/client";
import { navItems } from "@/lib/nav";
import { FIRM_STATUS_LABEL } from "@/lib/domain";
import { useFirm } from "@/providers/FirmProvider";

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { firm } = useFirm();
  const { data: chat } = useAsync(
    () => api<{ unread: number }>("/admin/chats/unread/").catch(() => ({ unread: 0 })),
    [],
    { live: 5000 },
  );
  const { data: newOrders } = useAsync(
    async () => asPage(await api("/admin/orders/", { query: { status: "new", page_size: 1 } }).catch(() => [])).count,
    [],
    { live: 5000 },
  );
  const badges: Record<string, number> = { "/aloqa": chat?.unread ?? 0, "/buyurtmalar": newOrders ?? 0 };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[260px] max-w-[85vw] flex-col border-r border-white/5 bg-surface-container py-6 transition-transform md:sticky md:z-30 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between gap-3 px-6">
          <span className="text-2xl font-bold text-primary">E-MAKON</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden"
            aria-label="Menyuni yopish"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="mb-6 px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Firma portali</p>
          {firm ? (
            <div className="mt-3 rounded-xl border border-[#263b2a] bg-[#131b15] px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-on-surface">{firm.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span
                  className={`h-2 w-2 rounded-full ${
                    firm.status === "active" && !firm.is_sales_banned ? "bg-primary" : "bg-error"
                  }`}
                />
                {firm.is_sales_banned ? "Sotuv taqiqlangan" : FIRM_STATUS_LABEL[firm.status]}
                {Number(firm.rating) > 0 ? ` · ★ ${Number(firm.rating).toFixed(1)}` : ""}
              </p>
            </div>
          ) : null}
        </div>
        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const badge = badges[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-r-lg border-l-4 py-3 pl-4 transition-colors ${
                  active
                    ? "border-primary-container bg-surface-container-highest font-bold text-primary"
                    : "border-transparent text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="truncate text-sm font-semibold tracking-wide">{item.label}</span>
                {badge ? (
                  <span
                    className={`ml-auto mr-3 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      item.href === "/buyurtmalar" ? "animate-pulse bg-amber-400 text-black" : "bg-primary text-black"
                    }`}
                  >
                    {badge > 99 ? "99+" : badge}
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
