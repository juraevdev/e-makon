"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import type { DayAvailability, ScheduleSlot } from "@/lib/api/types";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";

function localIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDay(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return localIso(new Date(y, m - 1, d + delta));
}

const TONE: Record<ScheduleSlot["status"], string> = {
  free: "border-emerald-500/60 bg-emerald-500/15 text-emerald-200",
  busy: "border-red-500/70 bg-red-500/20 text-red-200",
  past: "border-[#26352c] bg-[#0e1510] text-on-surface-variant opacity-60",
};

/** Firma kunlik bandligi: bo'sh soatlar yashil, band (hamma xodim ishda) soatlar qizil. */
export function ScheduleBoard({
  organizationId,
  onOpenOrder,
  refreshKey,
}: {
  organizationId?: number | null;
  onOpenOrder?: (orderId: number) => void;
  refreshKey?: unknown;
}) {
  const [date, setDate] = useState(() => localIso(new Date()));
  const needsFirm = organizationId === null;

  const { data, loading, error, reload } = useAsync<DayAvailability | null>(
    async () => {
      if (needsFirm) return null;
      return api<DayAvailability>("/admin/orders/availability/", {
        query: { date, organization: organizationId ?? undefined },
      });
    },
    [date, organizationId, refreshKey],
    { keepPrevious: true },
  );
  usePolling(() => void reload(), 30000);

  const busyHours = data?.slots.filter((s) => s.status === "busy").length ?? 0;
  const freeHours = data?.slots.filter((s) => s.status === "free").length ?? 0;

  return (
    <div className="rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-5 shadow-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <span className="material-symbols-outlined text-primary">calendar_clock</span>
            Bandlik jadvali
          </h3>
          <p className="text-xs text-on-surface-variant">
            Xizmat 1 soatdan boshlanadi, cho&apos;zilsa buyurtmada uzaytiriladi.
            {data ? ` Bir vaqtda ${data.capacity} ta buyurtma (faol xodimlar soni).` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDay(d, -1))}
            className="rounded-full border border-[#26352c] p-2 text-on-surface-variant hover:text-on-surface"
            aria-label="Oldingi kun"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-xl border border-[#26352c] bg-[#0d100f] px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setDate((d) => shiftDay(d, 1))}
            className="rounded-full border border-[#26352c] p-2 text-on-surface-variant hover:text-on-surface"
            aria-label="Keyingi kun"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={() => setDate(localIso(new Date()))}
            className="rounded-full border border-[#26352c] px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
          >
            Bugun
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Bo&apos;sh{data ? ` · ${freeHours} soat` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Band{data ? ` · ${busyHours} soat` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#40493d]" /> O&apos;tgan
        </span>
      </div>

      {needsFirm ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">Bandlikni ko&apos;rish uchun firmani tanlang.</p>
      ) : loading ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">Yuklanmoqda...</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-error">{error}</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {data.slots.map((slot) => (
            <div key={slot.start} className={`flex min-h-[86px] flex-col rounded-xl border p-2.5 ${TONE[slot.status]}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{slot.label}</span>
                <span className="text-[11px] font-semibold">
                  {slot.busy_count}/{slot.capacity}
                </span>
              </div>
              <span className="text-[11px]">
                {slot.status === "busy" ? "Band" : slot.status === "free" ? "Bo'sh" : "O'tgan"}
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(slot.orders ?? []).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    title={`${o.customer_name || "Mijoz"} · ${o.service_name} · ${o.time_slot}${
                      o.assigned_worker_name ? ` · ${o.assigned_worker_name}` : ""
                    }`}
                    onClick={() => onOpenOrder?.(o.id)}
                    className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-black/50"
                  >
                    #{o.id}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
