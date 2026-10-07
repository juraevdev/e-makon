"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
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
import { api, fetchAll, fetchPages } from "@/lib/api/client";
import type { Employee, Order, OrderStatus, WorkStage } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import {
  ESCROW_LABEL,
  nextWorkStage,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
  PAYMENT_TONE,
  WORK_STAGES,
} from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone, initials } from "@/lib/format";
import { directionsLink, distanceKm, mapsLink, suggestRoute } from "@/lib/geo";
import { useAsync } from "@/hooks/useAsync";
import { usePolling } from "@/hooks/usePolling";
import { useFirm } from "@/providers/FirmProvider";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId =
  | "all"
  | "payment"
  | "ready"
  | "on_the_way"
  | "on_site"
  | "awaiting"
  | "completed"
  | "cancelled";

const isAwaitingRelease = (o: Order) => o.status === "completed" && o.escrow?.status === "held";
const isPaymentPending = (o: Order) =>
  o.status === "new" && ["unpaid", "checking", "rejected"].includes(o.payment_status);
const priceEditable = (o: Order) =>
  o.status === "new" && ["not_required", "unpaid", "rejected"].includes(o.payment_status);
const isClosed = (o: Order) => o.status === "completed" || o.status === "cancelled";

const FILTERS: { id: FilterId; label: string; match: (o: Order) => boolean }[] = [
  { id: "all", label: "Barchasi", match: () => true },
  { id: "payment", label: "To'lov kutilmoqda", match: isPaymentPending },
  { id: "ready", label: "Qabul qilish kerak", match: (o) => o.status === "new" && !isPaymentPending(o) },
  {
    id: "on_the_way",
    label: "Qabul qilingan / yo'lda",
    match: (o) => !isClosed(o) && ["accepted", "on_the_way"].includes(o.work_stage),
  },
  { id: "on_site", label: "Joyida ishlayapti", match: (o) => !isClosed(o) && ["arrived", "working"].includes(o.work_stage) },
  { id: "awaiting", label: "Tasdiq kutilmoqda", match: isAwaitingRelease },
  { id: "completed", label: "Tugallangan", match: (o) => o.status === "completed" },
  { id: "cancelled", label: "Bekor qilingan", match: (o) => o.status === "cancelled" },
];

function stageTone(o: Order): "success" | "warning" | "info" | "neutral" | "error" {
  if (o.status === "cancelled") return "error";
  if (o.work_stage === "finished") return "success";
  if (o.work_stage) return "info";
  return "neutral";
}

function stageText(o: Order) {
  if (o.status === "cancelled") return "Bekor qilindi";
  if (!o.work_stage) return o.status === "new" ? "Kutilmoqda" : ORDER_STATUS_LABEL[o.status];
  return o.work_stage_label || WORK_STAGES.find((s) => s.key === o.work_stage)?.label || o.work_stage;
}

function etaText(o: Order) {
  if (!o.eta_at || !["accepted", "on_the_way"].includes(o.work_stage)) return null;
  const minutes = Math.round((new Date(o.eta_at).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "yetib borishi kerak edi";
  return `~${minutes} daq.`;
}

function paymentHint(o: Order): string | null {
  if (o.status !== "new") return null;
  switch (o.payment_status) {
    case "unpaid":
      return "Mijoz hali to'lov qilmagan. To'lov tizim hisobiga tushib tasdiqlangach, buyurtmani qabul qila olasiz.";
    case "checking":
      return "Mijoz to'lov qilganini bildirdi — tizim ma'muriyati tekshirmoqda.";
    case "rejected":
      return "To'lov tasdiqlanmadi. Mijoz qayta to'lov qilishi kerak.";
    default:
      return null;
  }
}

function stageTimes(o: Order) {
  const times: Partial<Record<WorkStage, string>> = {};
  for (const h of [...(o.status_history ?? [])].reverse()) {
    if (h.stage && !times[h.stage]) times[h.stage] = h.created_at;
  }
  return times;
}

const EMPTY_FORM = { quoted_price: "", agreed_duration: "", worker: "", note: "", distance_km: "", eta_minutes: "" };
const ORDER_PAGES = 5;

export default function BuyurtmalarPage() {
  const { query } = useSearch();
  const { firm } = useFirm();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, loading, error, reload } = useAsync(
    async () => fetchPages<Order>("/admin/orders/", { search: query || undefined }, ORDER_PAGES),
    [query],
    { keepPrevious: true },
  );
  usePolling(() => void reload(), 30000);

  const { data: employees } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { employment_status: "active" }),
    [],
  );

  const all = useMemo(() => data?.results ?? [], [data]);
  const orders = useMemo(() => {
    const conf = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
    return all.filter(conf.match);
  }, [all, filter]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.match).length])) as Record<FilterId, number>,
    [all],
  );
  const heldTotal = all
    .filter((o) => o.escrow?.status === "held")
    .reduce((sum, o) => sum + Number(o.escrow?.firm_payout || 0), 0);

  function routeFor(o: Order) {
    return suggestRoute(distanceKm(firm?.location_lat, firm?.location_lng, o.location_lat, o.location_lng));
  }

  function open(o: Order) {
    const route = routeFor(o);
    setSelected(o);
    setForm({
      quoted_price: o.quoted_price ? String(Math.round(Number(o.quoted_price))) : "",
      agreed_duration: o.agreed_duration || "",
      worker: o.assigned_worker_id ? String(o.assigned_worker_id) : "",
      note: "",
      distance_km: o.distance_km ? String(Number(o.distance_km)) : route ? String(route.km) : "",
      eta_minutes: o.eta_minutes ? String(o.eta_minutes) : route ? String(route.minutes) : "",
    });
  }

  async function run(path: string, body: Record<string, unknown>, successText: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const fresh = await api<Order>(`/admin/orders/${selected.id}/${path}/`, { method: "POST", body });
      open(fresh);
      showSuccess(successText);
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  function stageBody(stage: WorkStage) {
    const body: Record<string, unknown> = { stage, note: form.note };
    if (form.worker) body.assigned_worker_id = Number(form.worker);
    if (form.distance_km) body.distance_km = form.distance_km;
    if (form.eta_minutes) body.eta_minutes = Number(form.eta_minutes);
    return body;
  }

  function saveDetails() {
    if (!selected) return;
    const body: Record<string, unknown> = { status: selected.status, note: form.note };
    if (priceEditable(selected) && form.quoted_price) body.quoted_price = Number(form.quoted_price);
    if (form.agreed_duration) body.agreed_duration = form.agreed_duration;
    if (form.worker) body.assigned_worker_id = Number(form.worker);
    void run("transition", body, "Saqlandi");
  }

  function exportTable() {
    downloadCsv(
      `buyurtmalar-${new Date().toISOString().slice(0, 10)}`,
      ["#", "Sana", "Mijoz", "Telefon", "Xizmat", "Manzil", "Reja sanasi", "Vaqt", "Narx", "Xodim", "Bosqich", "To'lov", "Holat"],
      orders.map((o) => [
        o.id,
        formatDateTime(o.created_at),
        o.customer_name,
        o.phone_number || o.customer_phone,
        o.service_name,
        o.address,
        o.scheduled_date ?? "",
        o.time_slot,
        o.quoted_price ? Math.round(Number(o.quoted_price)) : "",
        o.assigned_worker_name,
        stageText(o),
        PAYMENT_LABEL[o.payment_status],
        ORDER_STATUS_LABEL[o.status],
      ]),
    );
  }

  const nextStage = selected ? nextWorkStage(selected.work_stage) : null;
  const blockedByPayment = selected ? isPaymentPending(selected) : false;
  const closed = selected ? isClosed(selected) : true;
  const times = selected ? stageTimes(selected) : {};
  const route = selected ? routeFor(selected) : null;
  const showEtaFields = selected ? !selected.work_stage || ["accepted", "on_the_way"].includes(selected.work_stage) : false;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-2 shadow-lg backdrop-blur-md sm:flex-row">
        <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:pb-0">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              count={counts[f.id]}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <SecondaryButton icon="download" onClick={exportTable} disabled={!orders.length}>
            Jadval (CSV)
          </SecondaryButton>
          <SecondaryButton icon="refresh" onClick={() => void reload()}>
            Yangilash
          </SecondaryButton>
        </div>
      </div>

      {data && data.count > all.length ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          Oxirgi {all.length} ta buyurtma ko&apos;rsatilmoqda (jami {data.count}). Eskilarini topish uchun qidiruvdan foydalaning.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {[
          { label: "Qabul qilish kerak", value: String(counts.ready ?? 0), suffix: "ta", icon: "fiber_new" },
          { label: "Yo'lda", value: String(counts.on_the_way ?? 0), suffix: "ta", icon: "local_shipping" },
          { label: "Joyida ishlayapti", value: String(counts.on_site ?? 0), suffix: "ta", icon: "construction" },
          { label: "Tizim hisobida (sizga tegishli)", value: formatMoney(heldTotal), suffix: "", icon: "account_balance" },
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
          <EmptyState
            icon="receipt_long"
            title="Buyurtmalar yo'q"
            description="Mijozlar mobil ilovada firmangiz xizmatlariga buyurtma berganda shu yerda ko'rinadi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#263b2a] text-xs uppercase text-on-surface-variant">
                  {["#", "Xizmat", "Reja", "Manzil", "Narx", "Xodim", "Ish bosqichi", "To'lov"].map((h) => (
                    <th key={h} className="px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263b2a]/40">
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => open(o)} className="cursor-pointer transition hover:bg-white/5">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container/30 text-xs font-bold text-primary">
                          {initials(o.customer_name || o.customer_phone)}
                        </div>
                        <div>
                          <div className="font-semibold text-primary">#{o.id} · {o.customer_name || "Mijoz"}</div>
                          <div className="text-xs text-on-surface-variant">{formatPhone(o.phone_number || o.customer_phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{o.service_name}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-on-surface-variant">
                      {o.scheduled_date ? formatDate(o.scheduled_date) : formatDate(o.created_at)}
                      {o.time_slot ? <div className="text-xs">{o.time_slot}</div> : null}
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-4 text-on-surface-variant">{o.address || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold">{formatMoney(o.quoted_price, o.currency)}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{o.assigned_worker_name || "—"}</td>
                    <td className="px-5 py-4">
                      {isAwaitingRelease(o) ? (
                        <StatusPill variant="warning">Tasdiq kutilmoqda</StatusPill>
                      ) : (
                        <StatusPill variant={stageTone(o)} pulse={!isClosed(o) && !!o.work_stage}>
                          {stageText(o)}
                        </StatusPill>
                      )}
                      {etaText(o) ? <div className="mt-1 text-xs text-on-surface-variant">{etaText(o)}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <StatusPill variant={PAYMENT_TONE[o.payment_status] ?? "neutral"}>
                        {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                      </StatusPill>
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
              <StatusPill variant={ORDER_STATUS_TONE[selected.status]} pulse={!closed}>
                {ORDER_STATUS_LABEL[selected.status]}
              </StatusPill>
              <StatusPill variant={PAYMENT_TONE[selected.payment_status]}>
                To&apos;lov: {PAYMENT_LABEL[selected.payment_status]}
              </StatusPill>
              <span className="text-xs text-on-surface-variant">{formatDateTime(selected.created_at)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="text-on-surface-variant">Mijoz: </span>{selected.customer_name || "—"}</p>
              <p>
                <span className="text-on-surface-variant">Telefon: </span>
                <a className="text-primary hover:underline" href={`tel:${selected.phone_number || selected.customer_phone}`}>
                  {formatPhone(selected.phone_number || selected.customer_phone)}
                </a>
              </p>
              <p><span className="text-on-surface-variant">Xizmat: </span>{selected.service_name}</p>
              <p><span className="text-on-surface-variant">Maydon: </span>{selected.area_size || "—"}</p>
              <p>
                <span className="text-on-surface-variant">Reja: </span>
                {selected.scheduled_date ? formatDate(selected.scheduled_date) : "—"}
                {selected.time_slot ? ` · ${selected.time_slot}` : ""}
              </p>
              <p><span className="text-on-surface-variant">Narx: </span>{formatMoney(selected.quoted_price, selected.currency)}</p>
              <p className="sm:col-span-2">
                <span className="text-on-surface-variant">Manzil: </span>
                {selected.address || "—"}
                {mapsLink(selected.location_lat, selected.location_lng, selected.address) ? (
                  <a
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                    href={directionsLink(firm?.location_lat, firm?.location_lng, selected.location_lat, selected.location_lng, selected.address) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    Yo&apos;nalish
                  </a>
                ) : null}
              </p>
              {selected.notes ? (
                <p className="sm:col-span-2"><span className="text-on-surface-variant">Mijoz izohi: </span>{selected.notes}</p>
              ) : null}
            </div>

            {selected.media?.length ? (
              <div className="flex gap-2 overflow-x-auto">
                {selected.media.map((m) =>
                  m.kind === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.file} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <video key={m.id} src={m.file} className="h-24 w-32 shrink-0 rounded-xl" controls />
                  ),
                )}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#263b2a] bg-[#0e1510] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">Ish bosqichlari</h3>
                <span className="text-xs text-on-surface-variant">Mijoz va tizim ma&apos;muriyati real vaqtda ko&apos;radi</span>
              </div>
              <ol className="grid grid-cols-5 gap-2">
                {WORK_STAGES.map((s, i) => {
                  const reachedIndex = selected.work_stage ? WORK_STAGES.findIndex((x) => x.key === selected.work_stage) : -1;
                  const done = i <= reachedIndex;
                  return (
                    <li key={s.key} className="flex flex-col items-center gap-1 text-center">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                          done
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-[#26352c] text-on-surface-variant"
                        } ${i === reachedIndex && !closed ? "animate-pulse" : ""}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
                      </span>
                      <span className={`text-[11px] font-semibold ${done ? "text-on-surface" : "text-on-surface-variant"}`}>{s.label}</span>
                      <span className="text-[10px] text-on-surface-variant">{times[s.key] ? formatDateTime(times[s.key]) : ""}</span>
                    </li>
                  );
                })}
              </ol>
              {selected.distance_km || selected.eta_minutes ? (
                <p className="mt-3 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined mr-1 align-middle text-[14px] text-primary">route</span>
                  {selected.distance_km ? `Masofa: ${Number(selected.distance_km)} km` : ""}
                  {selected.eta_minutes ? ` · Yetib borish: ~${selected.eta_minutes} daqiqa` : ""}
                  {selected.eta_at ? ` (${formatDateTime(selected.eta_at)} gacha)` : ""}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-4">
              <h3 className="mb-2 text-sm font-bold text-primary">Hisob-kitob</h3>
              {selected.escrow ? (
                <div className="mb-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-on-surface-variant">Holat</p>
                    <p className="font-semibold">{selected.escrow.status_label || ESCROW_LABEL[selected.escrow.status]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Mijoz to&apos;lagan</p>
                    <p className="font-semibold">{formatMoney(selected.escrow.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Sizga o&apos;tadi</p>
                    <p className="font-semibold text-primary">{formatMoney(selected.escrow.firm_payout)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Platforma ulushi</p>
                    <p className="font-semibold">{formatMoney(selected.escrow.platform_fee)}</p>
                  </div>
                </div>
              ) : null}
              {paymentHint(selected) ? (
                <p className="text-xs text-on-surface-variant">{paymentHint(selected)}</p>
              ) : null}
              {isAwaitingRelease(selected) ? (
                <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Ish yakunlandi deb belgilandi. Tizim ma&apos;muriyati tasdiqlagach pul firmangiz hisobiga o&apos;tkaziladi.
                </p>
              ) : null}
              {selected.escrow?.status === "released" ? (
                <p className="mt-2 text-xs text-primary">Pul firmangiz hisobiga o&apos;tkazilgan.</p>
              ) : null}
            </div>

            {!closed ? (
              <div className="rounded-2xl border border-[#263b2a] bg-[#0e1510] p-4">
                <h3 className="mb-3 text-sm font-bold">Ishchi guruh va yo&apos;nalish</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Mas'ul xodim / brigadir">
                    <select className={inputClass} value={form.worker} onChange={(e) => setForm({ ...form, worker: e.target.value })}>
                      <option value="">Tanlanmagan</option>
                      {(employees ?? []).map((e) => (
                        <option key={e.id} value={e.user.id}>
                          {e.user.full_name || e.user.phone}
                          {e.active_orders ? ` · ${e.active_orders} ta faol` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Izoh (mijozga ham ko'rinadi)">
                    <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </Field>
                  {showEtaFields ? (
                    <>
                      <Field label="Masofa (km)">
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          value={form.distance_km}
                          onChange={(e) => setForm({ ...form, distance_km: e.target.value.replace(/[^\d.]/g, "") })}
                        />
                      </Field>
                      <Field label="Yetib borish vaqti (daqiqa)">
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          value={form.eta_minutes}
                          onChange={(e) => setForm({ ...form, eta_minutes: e.target.value.replace(/\D/g, "") })}
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
                {showEtaFields ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {route
                      ? `Tizim hisobi: firma manzilidan ~${route.km} km, taxminan ${route.minutes} daqiqa. Kerak bo'lsa o'zgartiring.`
                      : "Masofani avtomatik hisoblash uchun firma profilida joylashuvni va mijoz manzilini belgilang."}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {nextStage ? (
                    <PrimaryButton
                      icon={nextStage.icon}
                      disabled={busy || blockedByPayment}
                      onClick={() => void run("stage", stageBody(nextStage.key), nextStage.action)}
                    >
                      {nextStage.action}
                    </PrimaryButton>
                  ) : null}
                  {selected.work_stage && showEtaFields ? (
                    <SecondaryButton
                      icon="schedule"
                      disabled={busy}
                      onClick={() => void run("stage", stageBody(selected.work_stage as WorkStage), "Yetib borish vaqti yangilandi")}
                    >
                      Vaqtni yangilash
                    </SecondaryButton>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmCancel(true)}
                    className="rounded-full border border-error/40 px-4 py-2 text-sm text-error disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                </div>
                {blockedByPayment ? (
                  <p className="mt-2 text-xs text-amber-200">To&apos;lov tasdiqlanmaguncha buyurtmani qabul qilib bo&apos;lmaydi.</p>
                ) : null}

                <details className="mt-4 rounded-xl border border-[#26352c] p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-on-surface-variant">Narx va muddat</summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Narx (UZS)">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={form.quoted_price}
                        disabled={!priceEditable(selected)}
                        onChange={(e) => setForm({ ...form, quoted_price: e.target.value.replace(/\D/g, "") })}
                      />
                    </Field>
                    <Field label="Kelishilgan muddat">
                      <input
                        className={inputClass}
                        placeholder="Masalan: 2 kun"
                        value={form.agreed_duration}
                        onChange={(e) => setForm({ ...form, agreed_duration: e.target.value })}
                      />
                    </Field>
                  </div>
                  {!priceEditable(selected) ? (
                    <p className="mt-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined mr-1 align-middle text-[14px]">lock</span>
                      To&apos;lov boshlangani uchun narxni faqat tizim ma&apos;muriyati o&apos;zgartira oladi.
                    </p>
                  ) : null}
                  <SecondaryButton className="mt-3" icon="save" disabled={busy} onClick={saveDetails}>
                    Saqlash
                  </SecondaryButton>
                </details>
              </div>
            ) : null}

            {(selected.status_history?.length ?? 0) > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Harakatlar tarixi</h3>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {selected.status_history.map((h) => (
                    <div key={h.id} className="rounded-xl border border-[#263b2a] bg-[#0e1510] px-3 py-2 text-xs">
                      <p className="font-medium">
                        {h.from_status === h.to_status && h.stage_label
                          ? h.stage_label
                          : `${ORDER_STATUS_LABEL[h.from_status as OrderStatus] || h.from_status || "—"} → ${
                              ORDER_STATUS_LABEL[h.to_status as OrderStatus] || h.to_status
                            }`}
                      </p>
                      {h.note ? <p className="mt-0.5 text-on-surface-variant">{h.note}</p> : null}
                      <p className="mt-0.5 text-on-surface-variant">
                        {formatDateTime(h.created_at)}
                        {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <SecondaryButton onClick={() => setSelected(null)}>Yopish</SecondaryButton>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmCancel}
        title="Buyurtmani bekor qilasizmi?"
        description="Mijoz to'lov qilgan bo'lsa, pul unga to'liq qaytariladi. Asossiz bekor qilishlar firma reytingiga ta'sir qiladi."
        confirmText="Ha, bekor qilish"
        cancelText="Yo'q"
        variant="danger"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void run("transition", { status: "cancelled", note: form.note }, "Buyurtma bekor qilindi");
        }}
      />
    </div>
  );
}
