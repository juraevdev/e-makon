"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { SearchProvider } from "@/providers/SearchProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { LocaleProvider } from "@/providers/LocaleProvider";
import { WeatherProvider } from "@/providers/WeatherProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <WeatherProvider>
          <AuthProvider>
            <ToastProvider>
              <SearchProvider>{children}</SearchProvider>
            </ToastProvider>
          </AuthProvider>
        </WeatherProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
