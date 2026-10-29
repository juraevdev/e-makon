"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { WeatherEffects } from "@/components/weather/WeatherEffects";
import { useSearch } from "@/providers/SearchProvider";
import { useWeather } from "@/providers/WeatherProvider";
import { getPageRoot } from "@/lib/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarPath, setSidebarPath] = useState<string | null>(null);
  const sidebarOpen = sidebarPath === pathname;
  const { setQuery } = useSearch();
  const { mood, live } = useWeather();
  const pageRoot = getPageRoot(pathname);

  useEffect(() => {
    setQuery("");
  }, [pathname, setQuery]);

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background text-ink">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarPath(null)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarPath(pathname)} />
        <main
          data-page={pageRoot}
          data-weather={mood}
          className="page-atmosphere relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {/* Fon sabit — skrol faqat kontentda */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
            <WeatherEffects mood={mood} windKmh={live?.windKmh ?? 0} />
          </div>
          <div className="page-scroll relative z-[1] min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
