"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { SearchProvider } from "@/providers/SearchProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SearchProvider>{children}</SearchProvider>
    </AuthProvider>
  );
}
