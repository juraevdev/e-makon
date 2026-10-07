import { api } from "@/lib/api/client";
import type { DayAvailability, ScheduleSlot } from "@/lib/api/types";

export function localIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shiftDay(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return localIso(new Date(y, m - 1, d + delta));
}

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} soat` : "", m ? `${m} daq` : ""].filter(Boolean).join(" ") || "—";
}

export function fetchAvailability(date: string) {
  return api<DayAvailability>("/admin/orders/availability/", { query: { date } });
}

/** Oraliq shu buyurtmaning o'zini hisobga olmaganda bo'shmi. */
function slotFreeFor(slot: ScheduleSlot, orderId?: number) {
  if (slot.status === "past") return false;
  const own = orderId && slot.orders?.some((o) => o.id === orderId) ? 1 : 0;
  return slot.busy_count - own < slot.capacity;
}

export type FreeSlot = { date: string; start: string; end: string };

/**
 * `fromDate` dan boshlab `days` kun ichida `duration` daqiqaga sig'adigan eng yaqin bo'sh vaqtni topadi.
 * Backend `ensure_slot_available` bilan bir xil qoida: ketma-ket soatlik oraliqlarning hammasi bo'sh bo'lishi kerak.
 */
export async function findNearestFreeSlot({
  orderId,
  duration,
  fromDate,
  days = 14,
}: {
  orderId?: number;
  duration: number;
  fromDate?: string | null;
  days?: number;
}): Promise<FreeSlot | null> {
  const today = localIso(new Date());
  const start = fromDate && fromDate > today ? fromDate : today;
  for (let i = 0; i < days; i++) {
    const date = shiftDay(start, i);
    const data = await fetchAvailability(date);
    const need = Math.max(1, Math.ceil(duration / (data.slot_minutes || 60)));
    const slots = data.slots;
    for (let j = 0; j + need <= slots.length; j++) {
      const window = slots.slice(j, j + need);
      if (window.every((s) => slotFreeFor(s, orderId))) {
        return { date, start: slots[j].start, end: window[window.length - 1].end };
      }
    }
  }
  return null;
}
