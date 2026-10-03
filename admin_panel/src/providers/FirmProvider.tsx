"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { PartnerFirm } from "@/lib/api/types";

type FirmContextValue = {
  firm: PartnerFirm | null;
  error: string | null;
  refreshFirm: () => Promise<void>;
};

const FirmContext = createContext<FirmContextValue | null>(null);

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const [firm, setFirm] = useState<PartnerFirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshFirm = useCallback(async () => {
    try {
      setFirm(await api<PartnerFirm>("/admin/firms/me/"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma ma'lumoti yuklanmadi");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<PartnerFirm>("/admin/firms/me/")
      .then((data) => {
        if (!cancelled) setFirm(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Firma ma'lumoti yuklanmadi");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ firm, error, refreshFirm }), [firm, error, refreshFirm]);
  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>;
}

export function useFirm() {
  const ctx = useContext(FirmContext);
  if (!ctx) throw new Error("useFirm FirmProvider ichida ishlatilishi kerak");
  return ctx;
}
