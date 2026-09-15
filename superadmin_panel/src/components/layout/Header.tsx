"use client";

import { usePathname } from "next/navigation";
import { getNavTitle } from "@/lib/nav";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = getNavTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between bg-background/80 px-4 py-2 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
          aria-label="Menyu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface md:text-[32px] md:leading-10">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-sm text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            placeholder="Qidirish..."
            className="w-64 rounded-full border border-surface-variant bg-surface-container-low py-2 pr-4 pl-10 text-sm text-on-surface placeholder:text-on-surface-variant transition-all focus:border-primary-container focus:ring-1 focus:ring-primary-container focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Bildirishnomalar"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
          </button>
          <div className="flex cursor-pointer items-center gap-3 rounded-full border border-surface-variant bg-surface-container-low py-1 pr-3 pl-2 transition-colors hover:bg-surface-container-high">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary">
              AU
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs leading-tight font-medium text-on-surface">
                Admin User
              </p>
              <p className="text-xs leading-tight text-on-surface-variant">
                SuperAdmin
              </p>
            </div>
            <span className="material-symbols-outlined hidden text-sm text-on-surface-variant sm:block">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
