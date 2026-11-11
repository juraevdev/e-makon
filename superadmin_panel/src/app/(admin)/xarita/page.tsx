"use client";

import { useMemo, useState } from "react";
import { YandexMap, type MapPoint } from "@/components/map/YandexMap";
import { ExcelButton, FilterChip, LiveBadge, LoadingBlock } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { MapPayload } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, SPECIALTY_LABEL } from "@/lib/domain";
import { downloadExcel, type ExcelSheet } from "@/lib/excel";
import { formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

/** Toshkent — nuqta bo'lmaganda xarita markazi. */
const DEFAULT_CENTER = { lat: 41.2995, lng: 69.2401 };

export default function XaritaPage() {
  const [filter, setFilter] = useState<"all" | "workers" | "orders">("all");
  const [focus, setFocus] = useState<string | null>(null);
  const { data, loading, error, updatedAt } = useAsync(() => api<MapPayload>("/admin/map/"), []);

  function exportExcel() {
    if (!data) return;
    const sheets: ExcelSheet[] = [];
    if (filter !== "orders") {
      sheets.push({
        name: "Hamkorlar",
        headers: ["ID", "Ism", "Telefon", "Mutaxassislik", "Reyting", "Faol", "Manzil", "Lat", "Lng"],
        rows: data.workers.map((w) => [
          w.id,
          w.name,
          formatPhone(w.phone),
          SPECIALTY_LABEL[w.specialty] || w.specialty,
          Number(w.rating) || 0,
          w.is_active ? "Ha" : "Yo'q",
          w.address,
          w.lat,
          w.lng,
        ]),
      });
    }
    if (filter !== "workers") {
      sheets.push({
        name: "Buyurtmalar",
        headers: ["ID", "Xizmat", "Mijoz", "Firma", "Holat", "Bosqich", "Hamkor", "Manzil", "Masofa (km)", "ETA (daq)", "Lat", "Lng"],
        rows: data.orders.map((o) => [
          o.id,
          o.service,
          o.customer,
          o.firm ?? "",
          ORDER_STATUS_LABEL[o.status] ?? o.status,
          o.work_stage_label ?? "",
          o.assigned_worker,
          o.address,
          o.distance_km ?? "",
          o.eta_minutes ?? "",
          o.lat,
          o.lng,
        ]),
      });
    }
    downloadExcel("xarita", sheets);
  }

  const points = useMemo<MapPoint[]>(() => {
    if (!data) return [];
    const list: MapPoint[] = [];
    if (filter === "all") {
      (data.firms ?? []).forEach((f) => {
        if (f.lat == null || f.lng == null) return;
        list.push({ key: `f-${f.id}`, kind: "firm", lat: f.lat, lng: f.lng, title: f.name, subtitle: f.address });
      });
    }
    if (filter !== "orders") {
      data.workers.forEach((w) => {
        if (w.lat == null || w.lng == null) return;
        list.push({ key: `w-${w.id}`, kind: "worker", lat: w.lat, lng: w.lng, title: w.name, subtitle: formatPhone(w.phone) });
      });
    }
    if (filter !== "workers") {
      data.orders.forEach((o) => {
        if (o.lat == null || o.lng == null) return;
        list.push({ key: `o-${o.id}`, kind: "order", lat: o.lat, lng: o.lng, title: `#${o.id} · ${o.service}`, subtitle: o.address });
      });
    }
    return list;
  }, [data, filter]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="relative z-0 h-[460px] shrink-0 border-b border-surface-variant bg-surface-container-low lg:h-[calc(100dvh-5rem)] lg:flex-1 lg:border-r lg:border-b-0">
        <YandexMap points={points} focusKey={focus} onSelect={setFocus} fallbackCenter={DEFAULT_CENTER} />
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 min-w-[220px] rounded-2xl border border-card-border bg-card/90 p-4">
          <h3 className="mb-3 text-[11px] font-bold tracking-wider text-primary uppercase">Holat belgisi</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Faol hamkorlar</span>
              <span className="text-primary">{data.workers_active}</span>
            </div>
            <div className="flex justify-between">
              <span>Faol buyurtmalar</span>
              <span className="text-amber-300">{data.orders_active}</span>
            </div>
          </div>
        </div>
      </div>

      <aside className="z-10 flex h-full w-full flex-col overflow-hidden bg-surface lg:w-[400px]">
        <div className="border-b border-card-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Jonli xarita</h2>
            <LiveBadge updatedAt={updatedAt || undefined} />
          </div>
          <p className="mt-1 text-xs text-outline">Mijoz geo nuqtalari va hamkorlar</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip label="Barchasi" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Hamkorlar" count={data.workers.length} active={filter === "workers"} onClick={() => setFilter("workers")} />
            <FilterChip label="Buyurtmalar" count={data.orders.length} active={filter === "orders"} onClick={() => setFilter("orders")} />
          </div>
          <ExcelButton className="mt-3 w-full justify-center" onClick={exportExcel} disabled={!data.workers.length && !data.orders.length} />
        </div>
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {(filter === "orders" ? [] : data.workers).map((w) => (
            <div key={w.id} className="rounded-2xl border border-card-border bg-card/90 p-4">
              <h3 className="font-bold text-on-surface">{w.name}</h3>
              <p className="text-xs text-outline">{SPECIALTY_LABEL[w.specialty] || w.specialty}</p>
              <p className="mt-2 text-xs text-on-surface-variant">{formatPhone(w.phone)}</p>
              <p className="truncate text-xs text-on-surface-variant">{w.address || "Geo kiritilmagan"}</p>
            </div>
          ))}
          {(filter === "workers" ? [] : data.orders).map((o) => (
            <div key={`o-${o.id}`} className="rounded-2xl border border-amber-500/20 bg-amber-500/10/90 p-4">
              <h3 className="font-bold">#{o.id} · {o.service}</h3>
              <p className="text-xs text-outline">{o.customer} · {ORDER_STATUS_LABEL[o.status]}</p>
              <p className="truncate text-xs">{o.address}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
