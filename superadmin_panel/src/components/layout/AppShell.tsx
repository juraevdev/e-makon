"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSearch } from "@/providers/SearchProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarPath, setSidebarPath] = useState<string | null>(null);
  const sidebarOpen = sidebarPath === pathname;
  const { setQuery } = useSearch();

  useEffect(() => {
    setQuery("");
  }, [pathname, setQuery]);

  return (
    <div className="flex min-h-screen bg-background text-on-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarPath(null)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarPath(pathname)} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
