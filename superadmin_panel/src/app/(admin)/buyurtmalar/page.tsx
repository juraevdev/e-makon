"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/ui";
import { api, ApiError, asPage } from "@/lib/api/client";
import type { Order, OrderEscrow, OrderStatus } from "@/lib/api/types";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";

const FILTERS: { id: "all" | "active" | "completed" | "cancelled"; label: string; status?: OrderStatus[] }[] = [
  { id: "all", label: "Barchasi" },
  { id: "active", label: "Faol", status: ["new", "in_review", "contacted"] },
  { id: "completed", label: "Tugallangan", status: ["completed"] },
  { id: "cancelled", label: "Bekor qilingan", status: ["cancelled"] },
];

const ESCROW_LABEL: Record<OrderEscrow["status"], string> = {
  awaiting_payment: "To'lov kutilmoqda",
  held: "E-Makonda ushlab turilgan",
  released: "Firmaga o'tkazilgan",
  refunded: "Userga qaytarilgan",
  disputed: "Nizoli",
  frozen: "Muzlatilgan",
};

export default function BuyurtmalarPage() {
  const { query } = useSearch();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [financeErr, setFinanceErr] = useState("");
  const [financeNote, setFinanceNote] = useState("");

  const { data, loading, error, reload } = useAsync(async () => {
    const ordersRaw = await api("/admin/orders/", {
      query: { page_size: 50, search: query || undefined },
    });
    return asPage<Order>(ordersRaw);
  }, [query]);

  const orders = useMemo(() => {
    const list = data?.results ?? [];
    const conf = FILTERS.find((f) => f.id === filter);
    if (!conf?.status) return list;
    return list.filter((o) => conf.status!.includes(o.status));
  }, [data, filter]);

  const today = (data?.results ?? []).filter((o) => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const active = (data?.results ?? []).filter((o) =>
    ["new", "in_review", "contacted"].includes(o.status),
  );
  const todayRevenue = today
    .filter((o) => o.quoted_price)
    .reduce((sum, o) => sum + Number(o.quoted_price), 0);

  async function financeAction(action: string, body: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(true);
    setFinanceErr("");
    try {
      const res = await api<{ order: Order; escrow: OrderEscrow | null }>(
        `/admin/orders/${selected.id}/finance/${action}/`,
        { method: "POST", body: { note: financeNote, ...body } },
      );
      setSelected(res.order);
      setFinanceNote("");
      await reload();
    } catch (e) {
      setFinanceErr(e instanceof ApiError || e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-2 shadow-lg backdrop-blur-md sm:flex-row">
        <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:pb-0">
          {FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
        </div>
        <SecondaryButton icon="refresh" onClick={() => void reload()}>
          Yangilash
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          { label: "Bugungi buyurtmalar", value: String(today.length), suffix: "ta", icon: "shopping_bag" },
          { label: "Jarayondagi", value: String(active.length), suffix: "faol", icon: "autorenew" },
          { label: "Bugungi kelishilgan narx", value: formatMoney(todayRevenue), suffix: "", icon: "payments" },
        ].map((card) => (
          <div
            key={card.label}
            className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-5 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-on-surface-variant">{card.label}</p>
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-bold">
              {card.value}
              {card.suffix ? <span className="ml-1 text-sm font-normal text-on-surface-variant">{card.suffix}</span> : null}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 shadow-lg">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="p-6 text-error">{error}</p>
        ) : !orders.length ? (
          <EmptyState icon="receipt_long" title="Buyurtmalar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#263b2a] text-xs uppercase text-on-surface-variant">
                  {["#", "Mijoz", "Firma", "Sana", "Manzil", "Narx", "Ulush", "Escrow", "Holat"].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263b2a]/40">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setSelected(o);
                      setFinanceErr("");
                      setFinanceNote("");
                    }}
                    className="cursor-pointer transition hover:bg-white/5"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container/30 text-xs font-bold text-primary">
                          {initials(o.customer_name || o.customer_phone)}
                        </div>
                        <div>
                          <div className="font-semibold text-primary">#{o.id}</div>
                          <div className="text-xs text-on-surface-variant">{formatPhone(o.phone_number || o.customer_phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{o.customer_name || "—"}</td>
                    <td className="px-5 py-4">
                      {o.firm_id ? (
                        <Link
                          href={`/firmalar/${o.firm_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {o.firm_name || "Firma"}
                        </Link>
                      ) : (
                        <span className="text-on-surface-variant">Tayinlanmagan</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-on-surface-variant">{formatDate(o.created_at)}</td>
                    <td className="max-w-[180px] truncate px-5 py-4 text-on-surface-variant">{o.address || "—"}</td>
                    <td className="px-5 py-4 font-semibold">{formatMoney(o.quoted_price, o.currency)}</td>
                    <td className="px-5 py-4 text-primary">{formatMoney(o.platform_share)}</td>
                    <td className="px-5 py-4 text-xs">
                      {o.escrow ? (
                        <span className="rounded-md bg-primary-container/20 px-2 py-1 text-primary">
                          {ESCROW_LABEL[o.escrow.status]}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selected} title={selected ? `Buyurtma #${selected.id}` : ""} onClose={() => setSelected(null)} wide>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill variant={ORDER_STATUS_TONE[selected.status]} pulse>
                {ORDER_STATUS_LABEL[selected.status]}
              </StatusPill>
              <span className="text-xs text-on-surface-variant">{formatDateTime(selected.created_at)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="text-on-surface-variant">Mijoz: </span>{selected.customer_name || "—"}</p>
              <p><span className="text-on-surface-variant">Telefon: </span>{formatPhone(selected.phone_number || selected.customer_phone)}</p>
              <p><span className="text-on-surface-variant">Xizmat: </span>{selected.service_name}</p>
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

            <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-4">
              <h3 className="mb-2 text-sm font-bold text-primary">Escrow / hisob-kitob</h3>
              <p className="mb-3 text-xs text-on-surface-variant">
                User E-Makonga to&apos;laydi → pul ushlanadi → ish tugagach firmaga (ulush platformada).
                Firmaning ishsiz pul talabi = userga qaytarish + jazo.
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
              <Field label="Izoh / sabab">
                <input className={inputClass} value={financeNote} onChange={(e) => setFinanceNote(e.target.value)} />
              </Field>
              {financeErr ? <p className="mt-2 text-sm text-error">{financeErr}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton disabled={busy || !selected.quoted_price} onClick={() => void financeAction("ensure")}>
                  Escrow ochish
                </SecondaryButton>
                <PrimaryButton disabled={busy} onClick={() => void financeAction("mark_paid")}>
                  User to&apos;ladi (E-Makonga)
                </PrimaryButton>
                <SecondaryButton disabled={busy} onClick={() => void financeAction("release")}>
                  Firmaga o&apos;tkazish
                </SecondaryButton>
                <SecondaryButton disabled={busy} onClick={() => void financeAction("refund", { punish_firm: true })}>
                  Userga qaytarish + firma jazo
                </SecondaryButton>
                <SecondaryButton disabled={busy} onClick={() => void financeAction("dispute")}>
                  Nizo
                </SecondaryButton>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-error/40 px-3 py-2 text-sm text-error"
                  onClick={() =>
                    void financeAction("punish_firm", {
                      refund: true,
                      fine_amount: 100000,
                      sales_ban_days: 7,
                    })
                  }
                >
                  Firma jazosi (refund)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-300"
                  onClick={() =>
                    void financeAction("punish_user", {
                      block: false,
                      release_to_firm: selected.status === "completed",
                    })
                  }
                >
                  User jazosi
                </button>
              </div>
            </div>

            {(selected.status_history?.length ?? 0) > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Holat tarixi</h3>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {selected.status_history.map((h) => (
                    <div key={h.id} className="rounded-xl border border-[#263b2a] bg-[#0e1510] px-3 py-2 text-xs">
                      <p className="font-medium">
                        {ORDER_STATUS_LABEL[h.from_status as OrderStatus] || h.from_status || "—"}
                        {" → "}
                        {ORDER_STATUS_LABEL[h.to_status as OrderStatus] || h.to_status}
                      </p>
                      {h.note ? <p className="mt-0.5 text-on-surface-variant">{h.note}</p> : null}
                      <p className="mt-0.5 text-on-surface-variant">{formatDateTime(h.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <SecondaryButton onClick={() => setSelected(null)}>Yopish</SecondaryButton>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
