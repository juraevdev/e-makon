"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { SearchProvider } from "@/providers/SearchProvider";
import { ToastProvider } from "@/providers/ToastProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SearchProvider>{children}</SearchProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
