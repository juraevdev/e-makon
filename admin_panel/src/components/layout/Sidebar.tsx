"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api/client";
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
  const { data: chat, reload: reloadChat } = useAsync(
    () => api<{ unread: number }>("/admin/chats/unread/").catch(() => ({ unread: 0 })),
    [pathname],
  );
  usePolling(() => void reloadChat(), 20000);
  const badges: Record<string, number> = { "/aloqa": chat?.unread ?? 0 };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-30 flex h-screen w-[260px] flex-col border-r border-white/5 bg-surface-container py-6 transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-6">
          <span className="text-2xl font-bold text-primary">E-MAKON</span>
        </div>
        <div className="mb-6 px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Firma Portali
          </p>
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
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
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
                  style={
                    active
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {item.icon}
                </span>
                <span className="text-sm font-semibold tracking-wide">
                  {item.label}
                </span>
                {badges[item.href] ? (
                  <span className="ml-auto mr-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-black">
                    {badges[item.href] > 99 ? "99+" : badges[item.href]}
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
