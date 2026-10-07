"use client";

import { useCallback, useMemo } from "react";
import { api, ApiError, asPage } from "@/lib/api/client";
import { useAsync } from "@/hooks/useAsync";
import type { FirmOption } from "./types";

type Query = Record<string, string | number | boolean | undefined | null>;

/** Backend `max_page_size = 100` — barcha sahifalarni ketma-ket yig'adi. */
export async function fetchAllPages<T>(path: string, query: Query = {}, maxPages = 30): Promise<T[]> {
  const pageSize = 100;
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { count, results } = asPage<T>(await api(path, { query: { ...query, page, page_size: pageSize } }));
    out.push(...results);
    if (results.length < pageSize || out.length >= count) break;
  }
  return out;
}

export function errorMessage(e: unknown, fallback = "Xatolik yuz berdi") {
  if (e instanceof ApiError || e instanceof Error) return e.message || fallback;
  return fallback;
}

/** `/admin/firms/` — firma tanlash va `organization_id` → nom moslashtirish uchun. */
export function useFirmOptions() {
  const { data, loading } = useAsync(
    async () =>
      (await fetchAllPages<FirmOption>("/admin/firms/")).map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        region: f.region,
      })),
    [],
    { live: 30000 },
  );
  const firms = useMemo(() => data ?? [], [data]);
  const byId = useMemo(() => new Map(firms.map((f) => [f.id, f])), [firms]);
  const firmName = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined) return "Biriktirilmagan";
      return byId.get(id)?.name ?? `Firma #${id}`;
    },
    [byId],
  );
  return { firms, firmName, loading };
}
