import type { Order, OrderHistory } from "@/lib/api/types";

/** Firma paneli soxta zayavkani bekor qilganda izohni "SOXTA" bilan boshlaydi. */
const FAKE_NOTE = /^[\s[(#*\-–—:]*soxta/i;

export function fakeEntry(order: Order): OrderHistory | null {
  if (order.status !== "cancelled") return null;
  const history = order.status_history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (FAKE_NOTE.test(history[i].note || "")) return history[i];
  }
  return null;
}

export const isFakeOrder = (order: Order) => fakeEntry(order) !== null;

/** "SOXTA: sabab" → "sabab" */
export function fakeReason(order: Order) {
  const note = fakeEntry(order)?.note ?? "";
  return note.replace(/^[\s[(#*\-–—:]*soxta[\])\s:.\-–—]*/i, "").trim();
}
