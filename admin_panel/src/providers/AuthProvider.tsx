"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ApiError,
  api,
  clearTokens,
  getAccessToken,
  logoutRequest,
  saveTokens,
} from "@/lib/api/client";
import type { User } from "@/lib/api/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_BOOT_TIMEOUT_MS = 5000;
const PANEL_ROLE: User["role"] = "admin";
const WRONG_ROLE_MESSAGE =
  "Bu panel firma adminlari uchun. Tizim ma'muriyati SuperAdmin paneldan foydalanadi.";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshMe = useCallback(async () => {
    const me = await api<User>("/auth/me/");
    if (me.role !== PANEL_ROLE) throw new Error(WRONG_ROLE_MESSAGE);
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!getAccessToken()) {
          if (!cancelled) setUser(null);
          return;
        }
        await Promise.race([
          refreshMe(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Auth timeout")), AUTH_BOOT_TIMEOUT_MS);
          }),
        ]);
      } catch (err) {
        const authRejected =
          (err instanceof ApiError && (err.status === 401 || err.status === 403)) ||
          (err instanceof Error && err.message === WRONG_ROLE_MESSAGE);
        if (authRejected) clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const data = await api<{ access: string; refresh: string; user: User }>(
        "/auth/admin/login/",
        { method: "POST", body: { phone, password }, auth: false },
      );
      if (!data?.access || !data?.refresh) {
        throw new Error("Server javobi noto'g'ri");
      }
      if (data.user?.role !== PANEL_ROLE) throw new Error(WRONG_ROLE_MESSAGE);
      saveTokens(data.access, data.refresh);
      setUser(data.user);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(() => {
    void logoutRequest();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
