"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AdminCapabilityKey,
  type AdminCapabilityState,
  hasRouteAccess,
  loadAdminCapabilities,
} from "@/lib/permissions";
import { userFacingError } from "@/lib/api/errors";
import { useAuth } from "@/providers/AuthProvider";

type AdminAccessContextValue = {
  capabilities: AdminCapabilityState | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  can: (key: AdminCapabilityKey) => boolean;
  canPath: (pathname: string) => boolean;
};

const INACTIVE: AdminCapabilityState = {
  profileActive: false,
  can_manage_staff: false,
  can_manage_orders: false,
  can_view_analytics: false,
};

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [capabilities, setCapabilities] = useState<AdminCapabilityState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setCapabilities(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const caps = await loadAdminCapabilities();
      setCapabilities(caps);
    } catch (err) {
      setCapabilities(INACTIVE);
      setError(userFacingError(err, "Huquqlar tekshirilmadi"));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mountdan keyin brauzer holatini sinxronlash (SSR hydration uchun ataylab)
      setCapabilities(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [authLoading, user, reload]);

  const can = useCallback(
    (key: AdminCapabilityKey) => Boolean(capabilities?.profileActive && capabilities[key]),
    [capabilities],
  );

  const canPath = useCallback(
    (pathname: string) =>
      capabilities ? hasRouteAccess(pathname, capabilities) : false,
    [capabilities],
  );

  const value = useMemo(
    () => ({
      capabilities,
      loading: authLoading || loading,
      error,
      reload,
      can,
      canPath,
    }),
    [capabilities, authLoading, loading, error, reload, can, canPath],
  );

  return (
    <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error("useAdminAccess AdminAccessProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
