"use client";

import { usePathname } from "next/navigation";
import { getNavTitle } from "@/lib/nav";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/domain";
import { useAuth } from "@/providers/AuthProvider";
import { useSearch } from "@/providers/SearchProvider";
import { NotificationCenter } from "./NotificationCenter";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = getNavTitle(pathname);
  const { user, logout } = useAuth();
  const { query, setQuery } = useSearch();
  const name = user?.full_name || user?.phone || "Admin";

  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-white/5 bg-background/85 px-4 py-2.5 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
          aria-label="Menyu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="truncate text-xl font-bold tracking-tight text-on-surface md:text-2xl">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish..."
            className="rounded-full border border-surface-variant bg-surface-container-low py-2 pl-10 pr-4 text-sm text-on-surface transition-all placeholder:text-on-surface-variant focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container sm:w-40 lg:w-56 xl:w-64"
          />
        </div>
        <NotificationCenter />
        <div className="flex items-center gap-2 rounded-full border border-surface-variant bg-surface-container-low py-1 pl-1 pr-1 sm:gap-3 sm:pl-2 sm:pr-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials(name)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="max-w-[140px] truncate text-xs font-medium leading-tight text-on-surface">{name}</p>
            <p className="text-xs leading-tight text-on-surface-variant">{ROLE_LABEL[user?.role || "admin"]}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
            title="Chiqish"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
