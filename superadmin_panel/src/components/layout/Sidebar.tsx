"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, asPage } from "@/lib/api/client";
import { navItems } from "@/lib/nav";

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
            SuperAdmin Portali
          </p>
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
                {item.href === "/xizmatlar" && pendingServices > 0 ? (
                  <span
                    className="ml-auto mr-3 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black"
                    title="Tekshiruvni kutayotgan firma xizmatlari"
                  >
                    {pendingServices}
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
