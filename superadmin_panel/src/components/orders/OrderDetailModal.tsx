"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog, Field, inputClass, Modal, PrimaryButton, SecondaryButton, StatusPill } from "@/components/ui";
import { api, ApiError } from "@/lib/api/client";
import type { Order, OrderEscrow, OrderStatus, PaymentStatus } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, WORK_STAGES } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { fakeEntry, fakeReason } from "./fake";

export const ESCROW_LABEL: Record<OrderEscrow["status"], string> = {
  awaiting_payment: "To'lov kutilmoqda",
  held: "E-Makonda ushlab turilgan",
  released: "Firmaga o'tkazilgan",
  refunded: "Userga qaytarilgan",
  disputed: "Nizoli",
  frozen: "Muzlatilgan",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_required: "Talab qilinmaydi",
  unpaid: "To'lanmagan",
  checking: "Tekshirilmoqda",
  rejected: "Rad etilgan",
  paid: "Tizim hisobida",
  released: "Firmaga o'tkazilgan",
  refunded: "Qaytarilgan",
};

export const PAYMENT_TONE: Record<PaymentStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  not_required: "neutral",
  unpaid: "warning",
  checking: "info",
  rejected: "error",
  paid: "success",
  released: "success",
  refunded: "neutral",
};

type PendingFinance = {
  action: string;
  title: string;
  description: string;
  variant: "danger" | "primary" | "warning";
  body?: Record<string, unknown>;
};

/** Buyurtma tafsiloti + superadmin moliya amallari. Ota komponent `key={order.id}` beradi. */
export function OrderDetailModal({
  order,
  catalogName,
  customerBlocked,
  onClose,
  onUpdated,
  onBlock,
  onUnblock,
}: {
  order: Order;
  catalogName?: string;
  customerBlocked: boolean;
  onClose: () => void;
  onUpdated: (order: Order) => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [financeErr, setFinanceErr] = useState("");
  const [financeNote, setFinanceNote] = useState("");
  const [pending, setPending] = useState<PendingFinance | null>(null);
  const [fine, setFine] = useState("100000");
  const [banDays, setBanDays] = useState("7");
  const [blockUser, setBlockUser] = useState(false);
  const selected = order;
  const fake = fakeEntry(order);

  function askFinance(next: PendingFinance) {
    setFinanceErr("");
    setPending(next);
  }

  function confirmFinance() {
    if (!pending) return;
    let body = pending.body ?? {};
    if (pending.action === "punish_firm") {
      const fineAmount = Number(fine);
      const days = Number(banDays);
      if (!Number.isFinite(fineAmount) || fineAmount < 0 || !Number.isInteger(days) || days < 0 || days > 365) {
        setFinanceErr("Jarima 0 yoki musbat, taqiq 0–365 kun bo'lsin");
        setPending(null);
        return;
      }
      body = { ...body, fine_amount: fineAmount, sales_ban_days: days };
    }
    if (pending.action === "punish_user") body = { ...body, block: blockUser };
    const action = pending.action;
    setPending(null);
    void financeAction(action, body);
  }

  async function financeAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setFinanceErr("");
    try {
      const res = await api<{ order: Order; escrow: OrderEscrow | null }>(`/admin/orders/${selected.id}/finance/${action}/`, {
        method: "POST",
        body: { note: financeNote, ...body },
      });
      setFinanceNote("");
      onUpdated(res.order);
    } catch (e) {
      setFinanceErr(e instanceof ApiError || e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={`Buyurtma #${selected.id}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill variant={ORDER_STATUS_TONE[selected.status]} pulse>
            {ORDER_STATUS_LABEL[selected.status]}
          </StatusPill>
          {fake ? <StatusPill variant="error">Soxta zayavka</StatusPill> : null}
          {customerBlocked ? <StatusPill variant="error">Mijoz bloklangan</StatusPill> : null}
          <span className="text-xs">{formatDateTime(selected.created_at)}</span>
        </span>
      }
      onClose={onClose}
      footer={
        <SecondaryButton onClick={onClose} className="justify-center">
          Yopish
        </SecondaryButton>
      }
    >
      <div className="space-y-5">
        {fake ? (
          <div className="rounded-2xl border border-error/50 bg-error/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-error">
                  <span className="material-symbols-outlined text-[20px]">report</span>
                  Firma bu zayavkani soxta deb belgiladi
                </p>
                <p className="mt-1 text-sm text-on-surface">{fakeReason(selected) || "Sabab ko'rsatilmagan"}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {formatDateTime(fake.created_at)}
                  {fake.changed_by_name ? ` · ${fake.changed_by_name}` : ""}
                  {selected.firm_name ? ` · ${selected.firm_name}` : ""}
                </p>
              </div>
              {customerBlocked ? (
                <SecondaryButton icon="lock_open" onClick={onUnblock} className="shrink-0 justify-center">
                  Blokdan chiqarish
                </SecondaryButton>
              ) : (
                <button
                  type="button"
                  onClick={onBlock}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-error/60 bg-error/15 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/25"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  Mijozni bloklash
                </button>
              )}
            </div>
          </div>
        ) : null}

        {selected.status !== "cancelled" ? (
          <div className="rounded-2xl border border-[#263b2a] bg-[#0e1510] p-4">
            <div className="flex items-start justify-between gap-1 overflow-x-auto">
              {WORK_STAGES.map((s, i) => {
                const current = WORK_STAGES.findIndex((x) => x.key === selected.work_stage);
                const done = current >= i;
                const at = selected.status_history?.find((h) => h.stage === s.key)?.created_at;
                return (
                  <div key={s.key} className="flex min-w-[64px] flex-1 flex-col items-center text-center">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                        done ? "border-primary bg-primary/20 text-primary" : "border-[#263b2a] text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                    </span>
                    <span className={`mt-1 text-[11px] ${done ? "font-semibold" : "text-on-surface-variant"}`}>{s.label}</span>
                    {at ? <span className="text-[10px] text-on-surface-variant">{formatDateTime(at)}</span> : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              {selected.assigned_worker_name ? `Mas'ul: ${selected.assigned_worker_name} · ` : ""}
              {selected.distance_km ? `Masofa: ${Number(selected.distance_km).toFixed(1)} km · ` : ""}
              {selected.eta_minutes ? `Yetib borish: ~${selected.eta_minutes} daq` : ""}
              {selected.eta_at ? ` (${formatDateTime(selected.eta_at)})` : ""}
              {selected.scheduled_date ? ` · Reja: ${formatDate(selected.scheduled_date)} ${selected.time_slot || ""}` : ""}
              {selected.scheduled_start && selected.duration_minutes
                ? ` (${selected.duration_minutes >= 60 ? `${selected.duration_minutes / 60} soat` : `${selected.duration_minutes} daq`})`
                : ""}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-on-surface-variant">Mijoz: </span>
            {selected.customer_name || "—"}
            {customerBlocked && !fake ? <span className="ml-2 text-xs font-semibold text-error">(bloklangan)</span> : null}
          </p>
          <p>
            <span className="text-on-surface-variant">Telefon: </span>
            <a href={`tel:${selected.phone_number || selected.customer_phone}`} className="text-primary hover:underline">
              {formatPhone(selected.phone_number || selected.customer_phone || "")}
            </a>
          </p>
          <p>
            <span className="text-on-surface-variant">Xizmat: </span>
            {selected.service_name}
            {catalogName && catalogName !== selected.service_name ? <span className="text-on-surface-variant"> · {catalogName}</span> : null}
          </p>
          <p><span className="text-on-surface-variant">Maydon: </span>{selected.area_size || "—"}</p>
          <p>
            <span className="text-on-surface-variant">Firma: </span>
            {selected.firm_id ? (
              <Link href={`/firmalar/${selected.firm_id}`} className="text-primary hover:underline">
                {selected.firm_name}
              </Link>
            ) : (
              "Tayinlanmagan"
            )}
          </p>
          <p><span className="text-on-surface-variant">Narx: </span>{formatMoney(selected.quoted_price, selected.currency)}</p>
          <p><span className="text-on-surface-variant">Kampaniya ulushi: </span>{formatMoney(selected.platform_share)}</p>
          <p><span className="text-on-surface-variant">Stavka: </span>{selected.commission_rate_applied ? `${selected.commission_rate_applied}%` : "—"}</p>
          <p className="sm:col-span-2"><span className="text-on-surface-variant">Manzil: </span>{selected.address || "—"}</p>
          {selected.notes ? <p className="sm:col-span-2"><span className="text-on-surface-variant">Izoh: </span>{selected.notes}</p> : null}
        </div>

        {selected.payment_status !== "not_required" ? (
          <div className="rounded-2xl border border-[#263b2a] bg-[#0e1510] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Mijoz to&apos;lovi</h3>
              <StatusPill variant={PAYMENT_TONE[selected.payment_status]} pulse={selected.payment_status === "checking"}>
                {PAYMENT_LABEL[selected.payment_status]}
              </StatusPill>
            </div>
            {selected.payment ? (
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-on-surface-variant">Usul</p>
                  <p className="font-semibold">{selected.payment.provider_label}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Summa</p>
                  <p className="font-semibold">{formatMoney(selected.payment.amount, selected.payment.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Mijoz &quot;to&apos;ladim&quot; dedi</p>
                  <p className="font-semibold">{selected.payment.submitted_at ? formatDateTime(selected.payment.submitted_at) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Urinish holati</p>
                  <p className="font-semibold">{selected.payment.status_label}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">Mijoz hali to&apos;lov usulini tanlamagan.</p>
            )}
            {["unpaid", "checking", "rejected"].includes(selected.payment_status) ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                Pul Click/Payme hisobiga tushganini tekshiring. Tasdiqlangach buyurtma ishga ruxsat oladi.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-4">
          <h3 className="mb-2 text-sm font-bold text-primary">Escrow / hisob-kitob</h3>
          <p className="mb-3 text-xs text-on-surface-variant">
            User E-Makonga to&apos;laydi → pul ushlanadi → ish tugagach firmaga (ulush platformada). Firmaning ishsiz pul talabi = userga
            qaytarish + jazo.
          </p>
          {selected.escrow ? (
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-on-surface-variant">Holat</p>
                <p className="font-semibold">{selected.escrow.status_label || ESCROW_LABEL[selected.escrow.status]}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Summa</p>
                <p className="font-semibold">{formatMoney(selected.escrow.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Firmaga</p>
                <p className="font-semibold">{formatMoney(selected.escrow.firm_payout)}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Ulush</p>
                <p className="font-semibold text-primary">{formatMoney(selected.escrow.platform_fee)}</p>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-sm text-on-surface-variant">Escrow hali ochilmagan.</p>
          )}
          {selected.status === "completed" && selected.escrow?.status === "held" ? (
            <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Firma ishni yakunlandi deb belgiladi. Mijoz bilan tasdiqlang va &quot;Firmaga o&apos;tkazish&quot; tugmasini bosing — pul shundan
              keyin firma hisobiga o&apos;tadi.
            </p>
          ) : null}
          <Field label="Izoh / sabab">
            <input className={inputClass} value={financeNote} onChange={(e) => setFinanceNote(e.target.value)} />
          </Field>
          {financeErr ? <p className="mt-2 text-sm text-error">{financeErr}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton disabled={busy || !selected.quoted_price} onClick={() => void financeAction("ensure")}>
              Escrow ochish
            </SecondaryButton>
            <PrimaryButton
              disabled={busy}
              onClick={() =>
                askFinance({
                  action: "mark_paid",
                  title: "To'lov tushganini tasdiqlaysizmi?",
                  description: `#${selected.id} bo'yicha ${formatMoney(selected.quoted_price)} E-Makon hisobiga tushganini bank/provayderda tekshirdingizmi? Buyurtma firmaga yuboriladi.`,
                  variant: "primary",
                })
              }
            >
              To&apos;lov hisobga tushdi — tasdiqlash
            </PrimaryButton>
            {selected.payment && ["pending", "submitted"].includes(selected.payment.status) ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-error/40 px-4 py-2 text-sm text-error disabled:opacity-50"
                onClick={() =>
                  askFinance({
                    action: "reject_payment",
                    title: "To'lov rad etilsinmi?",
                    description: "Mijozga to'lov tushmagani haqida xabar boradi va u qayta to'lashi kerak bo'ladi.",
                    variant: "danger",
                  })
                }
              >
                To&apos;lov tushmadi — rad etish
              </button>
            ) : null}
            <SecondaryButton
              disabled={busy}
              onClick={() =>
                askFinance({
                  action: "release",
                  title: "Pul firmaga o'tkazilsinmi?",
                  description: "Firma ulushi uning hisobiga o'tadi. Bu amalni qaytarib bo'lmaydi.",
                  variant: "warning",
                })
              }
            >
              Firmaga o&apos;tkazish
            </SecondaryButton>
            <SecondaryButton
              disabled={busy}
              onClick={() =>
                askFinance({
                  action: "refund",
                  title: "Pul mijozga qaytarilsinmi?",
                  description: "To'lov mijozga qaytariladi va firma jazo hisobiga yoziladi.",
                  variant: "danger",
                  body: { punish_firm: true },
                })
              }
            >
              Userga qaytarish + firma jazo
            </SecondaryButton>
            <SecondaryButton
              disabled={busy}
              onClick={() =>
                askFinance({
                  action: "dispute",
                  title: "Nizo ochilsinmi?",
                  description: "Pul muzlatiladi — firma ham, mijoz ham olmaydi, to'g'ri qaror qabul qilinmaguncha.",
                  variant: "warning",
                })
              }
            >
              Nizo
            </SecondaryButton>
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-error/40 px-4 py-2 text-sm text-error disabled:opacity-50"
              onClick={() =>
                askFinance({
                  action: "punish_firm",
                  title: "Firmani jazolash",
                  description: "To'lov mijozga qaytariladi, firmaga jarima yoziladi va sotuv vaqtincha to'xtatiladi.",
                  variant: "danger",
                  body: { refund: true },
                })
              }
            >
              Firma jazosi (refund)
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-amber-500/40 px-4 py-2 text-sm text-amber-300 disabled:opacity-50"
              onClick={() => {
                setBlockUser(false);
                askFinance({
                  action: "punish_user",
                  title: "Mijozni jazolash",
                  description:
                    selected.status === "completed"
                      ? "Pul firmaga o'tkaziladi va mijozdan 50 ballgacha yechiladi."
                      : "Mijozdan 50 ballgacha yechiladi.",
                  variant: "warning",
                  body: { release_to_firm: selected.status === "completed" },
                });
              }}
            >
              User jazosi
            </button>
          </div>
        </div>

        {(selected.status_history?.length ?? 0) > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Holat tarixi</h3>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {selected.status_history.map((h) => (
                <div
                  key={h.id}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    fake?.id === h.id ? "border-error/50 bg-error/10" : "border-[#263b2a] bg-[#0e1510]"
                  }`}
                >
                  <p className="font-medium">
                    {h.stage_label ||
                      `${ORDER_STATUS_LABEL[h.from_status as OrderStatus] || h.from_status || "—"} → ${
                        ORDER_STATUS_LABEL[h.to_status as OrderStatus] || h.to_status
                      }`}
                  </p>
                  {h.note ? <p className={`mt-0.5 ${fake?.id === h.id ? "text-error" : "text-on-surface-variant"}`}>{h.note}</p> : null}
                  <p className="mt-0.5 text-on-surface-variant">
                    {formatDateTime(h.created_at)}
                    {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ""}
        variant={pending?.variant ?? "primary"}
        busy={busy}
        confirmText="Tasdiqlash"
        cancelText="Bekor"
        onCancel={() => setPending(null)}
        onConfirm={confirmFinance}
        description={
          <div className="space-y-3">
            <p>{pending?.description}</p>
            {pending?.action === "punish_firm" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jarima (UZS)">
                  <input className={inputClass} inputMode="numeric" value={fine} onChange={(e) => setFine(e.target.value)} />
                </Field>
                <Field label="Sotuv taqiqi (kun)">
                  <input className={inputClass} inputMode="numeric" value={banDays} onChange={(e) => setBanDays(e.target.value)} />
                </Field>
              </div>
            ) : null}
            {pending?.action === "punish_user" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={blockUser} onChange={(e) => setBlockUser(e.target.checked)} />
                Mijoz akkauntini bloklash
              </label>
            ) : null}
            {financeNote ? <p className="text-xs">Izoh: {financeNote}</p> : null}
          </div>
        }
      />
    </Modal>
  );
}
