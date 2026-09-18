"use client";

import { useMemo, useState } from "react";
import { FilterChip, LoadingBlock } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { MapPayload } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, SPECIALTY_LABEL } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";

function project(lat: number, lng: number) {
  const minLat = 39.4;
  const maxLat = 41.7;
  const minLng = 66.5;
  const maxLng = 72.2;
  const top = ((maxLat - lat) / (maxLat - minLat)) * 100;
  const left = ((lng - minLng) / (maxLng - minLng)) * 100;
  return {
    top: `${Math.min(92, Math.max(8, top))}%`,
    left: `${Math.min(92, Math.max(8, left))}%`,
  };
}

export default function XaritaPage() {
  const [filter, setFilter] = useState<"all" | "workers" | "orders">("all");
  const { data, loading, error } = useAsync(() => api<MapPayload>("/admin/map/"), []);

  const pins = useMemo(() => {
    if (!data) return [];
    const workerPins = data.workers
      .filter((w) => w.lat != null && w.lng != null)
      .map((w) => ({ kind: "worker" as const, ...w }));
    const orderPins = data.orders
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({ kind: "order" as const, ...o }));
    if (filter === "workers") return workerPins;
    if (filter === "orders") return orderPins;
    return [...workerPins, ...orderPins];
  }, [data, filter]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="relative z-0 h-[512px] flex-1 border-b border-surface-variant bg-[#0c1210] lg:h-auto lg:border-r lg:border-b-0">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #1b3824 0, transparent 40%), radial-gradient(circle at 80% 70%, #163024 0, transparent 35%)",
          }}
        />
        {pins.map((pin) => {
          const pos = project(pin.lat as number, pin.lng as number);
          return (
            <div key={`${pin.kind}-${pin.id}`} className="absolute z-10 -translate-x-1/2 -translate-y-full" style={pos}>
              <span
                className={`material-symbols-outlined text-3xl drop-shadow-lg ${pin.kind === "order" ? "text-amber-300" : "text-primary"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
                title={pin.kind === "worker" ? pin.name : `#${pin.id}`}
              >
                location_on
              </span>
            </div>
          );
        })}
        <div className="absolute bottom-4 left-4 z-10 min-w-[220px] rounded-2xl border border-[#26352c] bg-[#0c0f0f]/90 p-4">
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
        <div className="border-b border-[#26352c] p-4">
          <h2 className="text-lg font-bold">Jonli xarita</h2>
          <p className="mt-1 text-xs text-outline">Mijoz geo nuqtalari va hamkorlar</p>
          <div className="mt-3 flex gap-2">
            <FilterChip label="Barchasi" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Hamkorlar" count={data.workers.length} active={filter === "workers"} onClick={() => setFilter("workers")} />
            <FilterChip label="Buyurtmalar" count={data.orders.length} active={filter === "orders"} onClick={() => setFilter("orders")} />
          </div>
        </div>
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {data.workers.map((w) => (
            <div key={w.id} className="rounded-2xl border border-[#26352c] bg-[#131916]/90 p-4">
              <h3 className="font-bold text-on-surface">{w.name}</h3>
              <p className="text-xs text-outline">{SPECIALTY_LABEL[w.specialty] || w.specialty}</p>
              <p className="mt-2 text-xs text-on-surface-variant">{formatPhone(w.phone)}</p>
              <p className="truncate text-xs text-on-surface-variant">{w.address || "Geo kiritilmagan"}</p>
            </div>
          ))}
          {data.orders.map((o) => (
            <div key={`o-${o.id}`} className="rounded-2xl border border-amber-500/20 bg-[#1a1910]/90 p-4">
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
