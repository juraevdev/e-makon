"use client";

import { useMemo, useState } from "react";
import { EmbedMap, GOOGLE_MAPS_KEY, GoogleMap, type MapPoint } from "@/components/map/GoogleMap";
import { FilterChip, LoadingBlock, StatusPill } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { MapPayload } from "@/lib/api/types";
import { CARE_CLIENT_TYPE_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SPECIALTY_LABEL } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { directionsLink, distanceKm } from "@/lib/geo";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";
import { useFirm } from "@/providers/FirmProvider";

type Layer = "all" | "orders" | "workers" | "care";

const COLORS = { firm: "#42a5f5", order: "#ffb300", worker: "#66bb6a", care: "#ab47bc" };
const DEFAULT_CENTER = { lat: 40.1158, lng: 67.8422 };

export default function XaritaPage() {
  const { firm } = useFirm();
  const [layer, setLayer] = useState<Layer>("all");
  const [focus, setFocus] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(() => api<MapPayload>("/admin/map/"), [], { keepPrevious: true });
  usePolling(() => void reload(), 30000);

  const firmLat = firm?.location_lat != null ? Number(firm.location_lat) : null;
  const firmLng = firm?.location_lng != null ? Number(firm.location_lng) : null;
  const center = firmLat !== null && firmLng !== null ? { lat: firmLat, lng: firmLng } : DEFAULT_CENTER;

  const points = useMemo<MapPoint[]>(() => {
    if (!data) return [];
    const list: MapPoint[] = [];
    if (firmLat !== null && firmLng !== null && firm) {
      list.push({ key: "firm", lat: firmLat, lng: firmLng, title: firm.name, subtitle: "Firma bazasi", color: COLORS.firm });
    }
    if (layer === "all" || layer === "orders") {
      data.orders.forEach((o) => {
        if (o.lat == null || o.lng == null) return;
        list.push({
          key: `o-${o.id}`,
          lat: o.lat,
          lng: o.lng,
          title: `#${o.id} · ${o.service}`,
          subtitle: `${o.customer} · ${o.work_stage_label || ORDER_STATUS_LABEL[o.status]}`,
          color: COLORS.order,
        });
      });
    }
    if (layer === "all" || layer === "workers") {
      data.workers.forEach((w) => {
        if (w.lat == null || w.lng == null) return;
        list.push({ key: `w-${w.id}`, lat: w.lat, lng: w.lng, title: w.name, subtitle: formatPhone(w.phone), color: COLORS.worker });
      });
    }
    if (layer === "all" || layer === "care") {
      (data.care ?? []).forEach((c) => {
        list.push({
          key: `c-${c.id}`,
          lat: c.lat,
          lng: c.lng,
          title: c.title,
          subtitle: `Parvarish · ${CARE_CLIENT_TYPE_LABEL[c.client_type]}`,
          color: COLORS.care,
        });
      });
    }
    return list;
  }, [data, layer, firm, firmLat, firmLng]);

  const focused = points.find((p) => p.key === focus) ?? null;
  const embedTarget = focused ?? points.find((p) => p.key !== "firm") ?? points[0] ?? { ...center };

  if (loading) return <LoadingBlock />;
  if (error || !data) return <p className="p-8 text-error">{error}</p>;

  const missing = data.orders.filter((o) => o.lat == null || o.lng == null).length;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="relative h-[460px] flex-1 border-b border-surface-variant bg-[#0c1210] lg:h-auto lg:border-b-0 lg:border-r">
        {GOOGLE_MAPS_KEY ? (
          <GoogleMap points={points} focusKey={focus} onSelect={setFocus} fallbackCenter={center} />
        ) : (
          <EmbedMap lat={embedTarget.lat} lng={embedTarget.lng} zoom={focused ? 16 : 13} />
        )}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-2xl border border-[#26352c] bg-[#0c0f0f]/90 p-3 text-xs">
          {[
            ["Firma", COLORS.firm, firm ? 1 : 0],
            ["Faol buyurtmalar", COLORS.order, data.orders_active],
            ["Xodimlar", COLORS.worker, data.workers_active],
            ["Parvarish obyektlari", COLORS.care, data.care?.length ?? 0],
          ].map(([label, color, n]) => (
            <p key={String(label)} className="flex items-center gap-2 py-0.5">
              <span className="h-3 w-3 rounded-full border-2 border-white" style={{ background: String(color) }} />
              <span className="flex-1">{label}</span>
              <b>{n}</b>
            </p>
          ))}
        </div>
      </div>

      <aside className="z-10 flex h-full w-full flex-col overflow-hidden bg-surface lg:w-[400px]">
        <div className="border-b border-[#26352c] p-4">
          <h2 className="text-lg font-semibold">Jonli xarita</h2>
          <p className="mt-1 text-xs text-outline">
            Buyurtmalar, xodimlar va parvarish obyektlari. Har 30 soniyada yangilanadi.
            {!GOOGLE_MAPS_KEY ? " Ro'yxatdan nuqtani tanlang — xarita o'sha joyga o'tadi." : ""}
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip label="Barchasi" active={layer === "all"} onClick={() => setLayer("all")} />
            <FilterChip label="Buyurtmalar" count={data.orders.length} active={layer === "orders"} onClick={() => setLayer("orders")} />
            <FilterChip label="Xodimlar" count={data.workers.length} active={layer === "workers"} onClick={() => setLayer("workers")} />
            <FilterChip label="Parvarish" count={data.care?.length ?? 0} active={layer === "care"} onClick={() => setLayer("care")} />
          </div>
          {missing ? (
            <p className="mt-2 text-[11px] text-amber-200">{missing} ta buyurtmada geolokatsiya yo&apos;q — faqat ro&apos;yxatda ko&apos;rinadi.</p>
          ) : null}
        </div>
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
          {(layer === "all" || layer === "orders") &&
            data.orders.map((o) => {
              const key = `o-${o.id}`;
              const km = o.distance_km ?? distanceKm(firmLat, firmLng, o.lat, o.lng);
              const route = directionsLink(firmLat, firmLng, o.lat, o.lng, o.address);
              return (
                <div
                  key={key}
                  onClick={() => o.lat != null && setFocus(key)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    focus === key ? "border-amber-400 bg-amber-500/10" : "border-amber-500/20 bg-[#1a1910]/90 hover:border-amber-500/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold">#{o.id} · {o.service}</h3>
                    <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{o.work_stage_label || ORDER_STATUS_LABEL[o.status]}</StatusPill>
                  </div>
                  <p className="text-xs text-outline">{o.customer}{o.assigned_worker ? ` · ${o.assigned_worker}` : ""}</p>
                  <p className="truncate text-xs">{o.address || "Manzil yo'q"}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">
                      {km != null ? `${Number(km).toFixed(1)} km` : "—"}
                      {o.eta_minutes ? ` · ~${o.eta_minutes} daq` : ""}
                    </span>
                    {route ? (
                      <a href={route} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                        Yo&apos;nalish →
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          {(layer === "all" || layer === "workers") &&
            data.workers.map((w) => {
              const key = `w-${w.id}`;
              return (
                <div
                  key={key}
                  onClick={() => w.lat != null && setFocus(key)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    focus === key ? "border-primary bg-primary/10" : "border-[#26352c] bg-[#131916]/90 hover:border-primary/40"
                  }`}
                >
                  <h3 className="font-bold text-on-surface">{w.name}</h3>
                  <p className="text-xs text-outline">{SPECIALTY_LABEL[w.specialty] || w.specialty}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{formatPhone(w.phone)}</p>
                  <p className="truncate text-xs text-on-surface-variant">{w.address || "Geo kiritilmagan"}</p>
                </div>
              );
            })}
          {(layer === "all" || layer === "care") &&
            (data.care ?? []).map((c) => {
              const key = `c-${c.id}`;
              return (
                <div
                  key={key}
                  onClick={() => setFocus(key)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    focus === key ? "border-purple-400 bg-purple-500/10" : "border-purple-500/20 bg-[#18121b]/90 hover:border-purple-500/50"
                  }`}
                >
                  <h3 className="font-bold">{c.title}</h3>
                  <p className="text-xs text-outline">Parvarish · {CARE_CLIENT_TYPE_LABEL[c.client_type]}</p>
                  <p className="truncate text-xs">{c.address}</p>
                </div>
              );
            })}
        </div>
      </aside>
    </div>
  );
}
