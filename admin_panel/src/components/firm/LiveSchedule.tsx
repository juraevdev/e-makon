"use client";

import { useState } from "react";
import { LiveBadge } from "@/components/ui";
import type { ScheduleSlot } from "@/lib/api/types";
import { useAsync } from "@/hooks/useAsync";
import { fetchAvailability, localIso, shiftDay } from "./schedule";

const TONE: Record<ScheduleSlot["status"], string> = {
  free: "border-emerald-500/50 bg-emerald-500/10",
  busy: "border-red-500/60 bg-red-500/15",
  past: "border-[#26352c] bg-[#0e1510] opacity-60",
};

const BAR: Record<ScheduleSlot["status"], string> = {
  free: "bg-emerald-400",
  busy: "bg-red-400",
  past: "bg-[#40493d]",
};

function hhmm(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Firma kunlik bandligi — har 3 soniyada jonli yangilanadi, yangi buyurtmalar yonib turadi. */
export function LiveSchedule({
  onOpenOrder,
  highlightIds,
}: {
  onOpenOrder?: (orderId: number) => void;
  highlightIds?: ReadonlySet<number>;
}) {
  const [date, setDate] = useState(() => localIso(new Date()));
  const { data, loading, error, updatedAt, refreshing } = useAsync(() => fetchAvailability(date), [date], {
    keepPrevious: true,
    live: 3000,
  });

  const slots = data?.slots ?? [];
  const busyHours = slots.filter((s) => s.status === "busy").length;
  const freeHours = slots.filter((s) => s.status === "free").length;
  const booked = new Set(slots.flatMap((s) => (s.orders ?? []).map((o) => o.id))).size;
  const isToday = updatedAt ? date === localIso(new Date(updatedAt)) : false;
  const nowLabel = updatedAt ? hhmm(updatedAt) : "";

  return (
    <section className="rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-4 shadow-lg sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary">calendar_clock</span>
            Vaqtlar taqsimoti
            <LiveBadge updatedAt={updatedAt} />
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Ish vaqti {data?.work_start ?? "08:00"} – {data?.work_end ?? "20:00"}. Bir soatda{" "}
            <b className="text-on-surface">{data?.capacity ?? "—"} ta</b> buyurtma (faol xodimlar soni). Mijoz ilovada faqat
            yashil vaqtlarni tanlay oladi.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
            className="rounded-full border border-[#26352c] px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
          >
            Bugun
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Bo&apos;sh · {freeHours} soat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Band · {busyHours} soat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#40493d]" /> O&apos;tgan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
          Rejadagi buyurtmalar · {booked} ta
        </span>
        {refreshing ? <span className="text-xs text-primary">Yangilanmoqda…</span> : null}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Yuklanmoqda...</p>
      ) : error && !data ? (
        <p className="py-8 text-center text-sm text-error">{error}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          <div className="grid min-w-[720px] grid-cols-6 gap-2 xl:min-w-0 xl:grid-cols-12">
            {slots.map((slot) => {
              const current = isToday && slot.start <= nowLabel && nowLabel < slot.end;
              const pct = Math.min(100, Math.round((slot.busy_count / Math.max(1, slot.capacity)) * 100));
              return (
                <div
                  key={slot.start}
                  className={`relative flex min-h-[104px] flex-col rounded-xl border p-2.5 transition-colors ${TONE[slot.status]} ${
                    current ? "ring-2 ring-primary/70" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-on-surface">{slot.start}</span>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {slot.busy_count}/{slot.capacity}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/30">
                    <div className={`h-full rounded-full ${BAR[slot.status]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="mt-1 text-xs text-on-surface-variant">
                    {current ? "Hozir" : slot.status === "busy" ? "Band" : slot.status === "free" ? "Bo'sh" : "O'tgan"}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(slot.orders ?? []).map((o) => {
                      const fresh = highlightIds?.has(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          title={`${o.customer_name || "Mijoz"} · ${o.service_name} · ${o.time_slot}${
                            o.assigned_worker_name ? ` · ${o.assigned_worker_name}` : " · xodim biriktirilmagan"
                          }`}
                          onClick={() => onOpenOrder?.(o.id)}
                          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold transition ${
                            fresh
                              ? "animate-pulse bg-amber-400 text-black"
                              : o.assigned_worker_name
                                ? "bg-black/30 text-on-surface hover:bg-black/50"
                                : "border border-dashed border-amber-400/60 bg-black/20 text-amber-200 hover:bg-black/40"
                          }`}
                        >
                          #{o.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-on-surface-variant">
        Uzuq chiziqli raqam — xodim biriktirilmagan buyurtma. Sariq yonib-o&apos;chayotgani — yangi kelgan buyurtma. Raqamni
        bosing — buyurtma ochiladi.
      </p>
    </section>
  );
}
