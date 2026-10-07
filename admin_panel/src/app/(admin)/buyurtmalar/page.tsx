"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ExcelButton,
  Field,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { InfoNote, MiniStat, PageBar } from "@/components/firm/PageBar";
import { LiveSchedule } from "@/components/firm/LiveSchedule";
import { durationLabel, fetchAvailability, findNearestFreeSlot, localIso } from "@/components/firm/schedule";
import { api, fetchAll, fetchPages } from "@/lib/api/client";
import type { Employee, Order, OrderStatus, WorkStage } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
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
import { useFirm } from "@/providers/FirmProvider";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId =
  | "all"
  | "payment"
  | "ready"
  | "unscheduled"
  | "on_the_way"
  | "on_site"
  | "awaiting"
  | "completed"
  | "cancelled";

const FAKE_PREFIX = "SOXTA:";
const FRESH_WINDOW_MS = 15 * 60 * 1000;

const isAwaitingRelease = (o: Order) => o.status === "completed" && o.escrow?.status === "held";
const isPaymentPending = (o: Order) =>
  o.status === "new" && ["unpaid", "checking", "rejected"].includes(o.payment_status);
const priceEditable = (o: Order) =>
  o.status === "new" && ["not_required", "unpaid", "rejected"].includes(o.payment_status);
const isClosed = (o: Order) => o.status === "completed" || o.status === "cancelled";
const isFake = (o: Order) =>
  o.status === "cancelled" && (o.status_history ?? []).some((h) => h.note?.trim().toUpperCase().startsWith("SOXTA"));

const FILTERS: { id: FilterId; label: string; icon: string; match: (o: Order) => boolean }[] = [
  { id: "all", label: "Barchasi", icon: "list", match: () => true },
  { id: "ready", label: "Qabul qilish kerak", icon: "fiber_new", match: (o) => o.status === "new" && !isPaymentPending(o) },
  { id: "payment", label: "To'lov kutilmoqda", icon: "hourglass_top", match: isPaymentPending },
  { id: "unscheduled", label: "Vaqtsiz", icon: "event_busy", match: (o) => !isClosed(o) && !o.scheduled_start },
  {
    id: "on_the_way",
    label: "Yo'lda",
    icon: "local_shipping",
    match: (o) => !isClosed(o) && ["accepted", "on_the_way"].includes(o.work_stage),
  },
  {
    id: "on_site",
    label: "Joyida",
    icon: "construction",
    match: (o) => !isClosed(o) && ["arrived", "working"].includes(o.work_stage),
  },
  { id: "awaiting", label: "Tasdiq kutilmoqda", icon: "verified", match: isAwaitingRelease },
  { id: "completed", label: "Tugallangan", icon: "task_alt", match: (o) => o.status === "completed" },
  { id: "cancelled", label: "Bekor qilingan", icon: "cancel", match: (o) => o.status === "cancelled" },
];

const FAKE_REASONS = [
  "Telefon javob bermadi / o'chirilgan",
  "Manzil mavjud emas",
  "Mijoz buyurtma bermaganini aytdi",
  "Test yoki hazil buyurtma",
  "Bir xil buyurtma qayta-qayta yuborilgan",
];

function stageTone(o: Order): "success" | "warning" | "info" | "neutral" | "error" {
  if (o.status === "cancelled") return "error";
  if (o.work_stage === "finished") return "success";
  if (o.work_stage) return "info";
  return "neutral";
}

function stageText(o: Order) {
  if (isFake(o)) return "Soxta zayavka";
  if (o.status === "cancelled") return "Bekor qilindi";
  if (!o.work_stage) return o.status === "new" ? "Kutilmoqda" : ORDER_STATUS_LABEL[o.status];
  return o.work_stage_label || WORK_STAGES.find((s) => s.key === o.work_stage)?.label || o.work_stage;
}

function etaText(o: Order, now: number) {
  if (!o.eta_at || !["accepted", "on_the_way"].includes(o.work_stage)) return null;
  const minutes = Math.round((new Date(o.eta_at).getTime() - now) / 60000);
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

const shortTime = (value: string | null) => (value ? value.slice(0, 5) : "");

const EMPTY_FORM = { quoted_price: "", agreed_duration: "", worker: "", note: "", distance_km: "", eta_minutes: "" };
const ORDER_PAGES = 5;

const START_TIMES = Array.from({ length: 24 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const DURATIONS = [60, 90, 120, 150, 180, 240, 300, 360, 480];

export default function BuyurtmalarPage() {
  const { query } = useSearch();
  const { firm } = useFirm();
  const { showSuccess, showError, showInfo } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [placingId, setPlacingId] = useState<number | null>(null);
  const [cancelNote, setCancelNote] = useState<string | null>(null);
  const [fakeReason, setFakeReason] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plan, setPlan] = useState({ date: "", start: "", duration: 60 });
  const [arrived, setArrived] = useState<ReadonlySet<number>>(() => new Set());
  const seen = useRef<{ query: string; maxId: number } | null>(null);

  function detectArrivals(list: Order[]) {
    const maxId = list.reduce((m, o) => Math.max(m, o.id), 0);
    const prev = seen.current;
    seen.current = { query, maxId: Math.max(maxId, prev?.query === query ? prev.maxId : 0) };
    if (!prev || prev.query !== query) return;
    const fresh = list.filter((o) => o.id > prev.maxId && o.status !== "cancelled");
    if (!fresh.length) return;
    setArrived((s) => new Set([...s, ...fresh.map((o) => o.id)]));
    const first = fresh[0];
    showInfo(
      fresh.length === 1
        ? `Yangi buyurtma #${first.id}: ${first.service_name} · ${first.customer_name || formatPhone(first.customer_phone)}`
        : `${fresh.length} ta yangi buyurtma keldi`,
    );
  }

  const { data, loading, error, updatedAt } = useAsync(
    async () => {
      const page = await fetchPages<Order>(
        "/admin/orders/",
        { search: query || undefined, ordering: "-created_at" },
        ORDER_PAGES,
      );
      detectArrivals(page.results);
      return page;
    },
    [query],
    { keepPrevious: true, live: 3000 },
  );

  const { data: employees } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { employment_status: "active" }),
    [],
  );

  const all = useMemo(() => data?.results ?? [], [data]);
  const highlight = useMemo(() => {
    const ids = new Set(arrived);
    for (const o of all) {
      if (o.status === "new" && updatedAt - new Date(o.created_at).getTime() < FRESH_WINDOW_MS) ids.add(o.id);
    }
    return ids;
  }, [all, arrived, updatedAt]);
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
  const unassigned = all.filter((o) => !isClosed(o) && !o.assigned_worker_id).length;

  const current = selected ? (all.find((o) => o.id === selected.id) ?? selected) : null;
  const closed = current ? isClosed(current) : true;

  const { data: planDay } = useAsync(
    async () => (current && !closed && plan.date ? fetchAvailability(plan.date) : null),
    [plan.date, current?.id, closed],
    { keepPrevious: true, live: 3000 },
  );

  function routeFor(o: Order) {
    return suggestRoute(distanceKm(firm?.location_lat, firm?.location_lng, o.location_lat, o.location_lng));
  }

  function open(o: Order) {
    const route = routeFor(o);
    setSelected(o);
    setArrived((s) => {
      if (!s.has(o.id)) return s;
      const next = new Set(s);
      next.delete(o.id);
      return next;
    });
    setForm({
      quoted_price: o.quoted_price ? String(Math.round(Number(o.quoted_price))) : "",
      agreed_duration: o.agreed_duration || "",
      worker: o.assigned_worker_id ? String(o.assigned_worker_id) : "",
      note: "",
      distance_km: o.distance_km ? String(Number(o.distance_km)) : route ? String(route.km) : "",
      eta_minutes: o.eta_minutes ? String(o.eta_minutes) : route ? String(route.minutes) : "",
    });
    setPlan({
      date: o.scheduled_date ?? localIso(new Date()),
      start: shortTime(o.scheduled_start),
      duration: o.duration_minutes || 60,
    });
  }

  async function openById(id: number) {
    const known = all.find((o) => o.id === id);
    if (known) return open(known);
    try {
      open(await api<Order>(`/admin/orders/${id}/`));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Buyurtma topilmadi");
    }
  }

  async function run(path: string, body: Record<string, unknown>, successText: string, target = current) {
    if (!target) return;
    setBusy(true);
    try {
      const fresh = await api<Order>(`/admin/orders/${target.id}/${path}/`, { method: "POST", body });
      if (selected?.id === fresh.id) open(fresh);
      showSuccess(successText);
      return fresh;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function autoPlace(o: Order) {
    setPlacingId(o.id);
    try {
      const duration = o.id === current?.id ? plan.duration : o.duration_minutes || 60;
      const slot = await findNearestFreeSlot({ orderId: o.id, duration, fromDate: o.scheduled_date });
      if (!slot) {
        showError("Yaqin 14 kun ichida bo'sh vaqt topilmadi. Xodim qo'shing yoki vaqtni qo'lda belgilang.");
        return;
      }
      const fresh = await api<Order>(`/admin/orders/${o.id}/schedule/`, {
        method: "POST",
        body: { scheduled_date: slot.date, scheduled_start: slot.start, duration_minutes: duration },
      });
      if (selected?.id === fresh.id) {
        setSelected(fresh);
        setPlan({ date: slot.date, start: slot.start, duration });
      }
      showSuccess(`#${o.id} joylandi: ${formatDate(slot.date)}, ${slot.start} – ${slot.end}. Mijozga xabar yuborildi.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Joylab bo'lmadi");
    } finally {
      setPlacingId(null);
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
    if (!current) return;
    const body: Record<string, unknown> = { status: current.status, note: form.note };
    if (priceEditable(current) && form.quoted_price) body.quoted_price = Number(form.quoted_price);
    if (form.agreed_duration) body.agreed_duration = form.agreed_duration;
    if (form.worker) body.assigned_worker_id = Number(form.worker);
    void run("transition", body, "Saqlandi");
  }

  function assignWorker() {
    if (!current || !form.worker) return;
    const worker = employees?.find((e) => String(e.user.id) === form.worker);
    void run(
      "transition",
      { status: current.status, assigned_worker_id: Number(form.worker), note: form.note },
      `Mas'ul xodim: ${worker?.user.full_name || worker?.user.phone || "biriktirildi"}`,
    );
  }

  function exportTable() {
    downloadExcel("buyurtmalar", {
      name: FILTERS.find((f) => f.id === filter)?.label ?? "Buyurtmalar",
      headers: [
        "#",
        "Yaratilgan",
        "Mijoz",
        "Telefon",
        "Xizmat",
        "Manzil",
        "Reja sanasi",
        "Vaqt",
        "Davomiylik (daq)",
        "Narx (UZS)",
        "Xodim",
        "Bosqich",
        "To'lov",
        "Holat",
      ],
      rows: orders.map((o) => [
        o.id,
        formatDateTime(o.created_at),
        o.customer_name,
        o.phone_number || o.customer_phone,
        o.service_name,
        o.address,
        o.scheduled_date ? formatDate(o.scheduled_date) : "",
        o.time_slot,
        o.duration_minutes,
        o.quoted_price ? Math.round(Number(o.quoted_price)) : "",
        o.assigned_worker_name,
        stageText(o),
        PAYMENT_LABEL[o.payment_status],
        isFake(o) ? "Soxta zayavka" : ORDER_STATUS_LABEL[o.status],
      ]),
    });
  }

  const nextStage = current ? nextWorkStage(current.work_stage) : null;
  const blockedByPayment = current ? isPaymentPending(current) : false;
  const times = current ? stageTimes(current) : {};
  const route = current ? routeFor(current) : null;
  const showEtaFields = current ? !current.work_stage || ["accepted", "on_the_way"].includes(current.work_stage) : false;
  const freeStarts = (planDay?.slots ?? []).filter(
    (s) => s.status !== "past" && s.busy_count - (s.orders?.some((o) => o.id === current?.id) ? 1 : 0) < s.capacity,
  );

  function rowSchedule(o: Order) {
    if (o.scheduled_date && o.scheduled_start) {
      return (
        <>
          <div>{formatDate(o.scheduled_date)}</div>
          <div className="text-xs text-on-surface-variant">{o.time_slot || shortTime(o.scheduled_start)}</div>
        </>
      );
    }
    if (isClosed(o)) return <span className="text-on-surface-variant">—</span>;
    return (
      <button
        type="button"
        disabled={placingId === o.id}
        onClick={(e) => {
          e.stopPropagation();
          void autoPlace(o);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
      >
        <span className={`material-symbols-outlined text-[16px] ${placingId === o.id ? "animate-spin" : ""}`}>
          {placingId === o.id ? "progress_activity" : "auto_fix_high"}
        </span>
        Bo&apos;sh vaqtga joylash
      </button>
    );
  }

  function stageCell(o: Order) {
    return (
      <>
        {isAwaitingRelease(o) ? (
          <StatusPill variant="warning">Tasdiq kutilmoqda</StatusPill>
        ) : (
          <StatusPill variant={stageTone(o)} pulse={!isClosed(o) && !!o.work_stage}>
            {stageText(o)}
          </StatusPill>
        )}
        {etaText(o, updatedAt) ? <div className="mt-1 text-xs text-on-surface-variant">{etaText(o, updatedAt)}</div> : null}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <PageBar
        updatedAt={updatedAt}
        description="Ilovadan kelgan buyurtmalar real vaqtda shu yerda paydo bo'ladi. Har bir buyurtmani bo'sh vaqtga joylang, mas'ul xodimni biriktiring va ish bosqichlarini belgilang — mijoz hammasini ilovada ko'radi."
        actions={<ExcelButton onClick={exportTable} disabled={!orders.length} />}
      />

      {arrived.size ? (
        <InfoNote icon="notifications_active" tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <b>{arrived.size} ta yangi buyurtma</b> keldi. Ularni ko&apos;rib chiqing va bo&apos;sh vaqtga joylang.
            </span>
            <button
              type="button"
              onClick={() => setFilter("ready")}
              className="rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
            >
              Ko&apos;rish
            </button>
          </div>
        </InfoNote>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Qabul qilish kerak"
          value={counts.ready ?? 0}
          icon="fiber_new"
          tone={counts.ready ? "warning" : "default"}
          active={filter === "ready"}
          onClick={() => setFilter("ready")}
        />
        <MiniStat
          label="Vaqt belgilanmagan"
          value={counts.unscheduled ?? 0}
          icon="event_busy"
          tone={counts.unscheduled ? "warning" : "default"}
          hint={unassigned ? `${unassigned} tasida xodim yo'q` : "Hammasiga xodim biriktirilgan"}
          active={filter === "unscheduled"}
          onClick={() => setFilter("unscheduled")}
        />
        <MiniStat
          label="Ishda (yo'lda / joyida)"
          value={(counts.on_the_way ?? 0) + (counts.on_site ?? 0)}
          icon="engineering"
          tone="primary"
        />
        <MiniStat label="Tizim hisobida (sizga)" value={formatMoney(heldTotal)} icon="account_balance" tone="primary" />
      </div>

      {data && data.count > all.length ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          Oxirgi {all.length} ta buyurtma ko&apos;rsatilmoqda (jami {data.count}). Eskilarini topish uchun qidiruvdan foydalaning.
        </p>
      ) : null}

      <LiveSchedule onOpenOrder={(id) => void openById(id)} highlightIds={highlight} />

      <TabBar
        tabs={FILTERS.map((f) => ({ id: f.id, label: f.label, icon: f.icon, count: counts[f.id] ?? 0 }))}
        value={filter}
        onChange={setFilter}
      />

      <div className="overflow-hidden rounded-2xl border border-[#263b2a] bg-[#131b15]/90 shadow-lg">
        {loading ? (
          <LoadingBlock />
        ) : error && !data ? (
          <p className="p-6 text-sm text-error">{error}</p>
        ) : !orders.length ? (
          <EmptyState
            icon="receipt_long"
            title="Buyurtmalar yo'q"
            description="Mijozlar E-MAKON ilovasida firmangiz xizmatlariga buyurtma berganda shu yerda darhol ko'rinadi."
          />
        ) : (
          <>
            <ul className="divide-y divide-[#263b2a]/50 md:hidden">
              {orders.map((o) => (
                <li key={o.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => open(o)}
                    onKeyDown={(e) => e.key === "Enter" && open(o)}
                    className={`flex flex-col gap-3 p-4 text-sm ${highlight.has(o.id) ? "bg-amber-400/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
                          #{o.id} · {o.customer_name || "Mijoz"}
                          {highlight.has(o.id) ? <NewBadge /> : null}
                        </p>
                        <p className="truncate text-on-surface">{o.service_name}</p>
                        <p className="text-xs text-on-surface-variant">{formatPhone(o.phone_number || o.customer_phone)}</p>
                      </div>
                      <p className="shrink-0 font-semibold">{formatMoney(o.quoted_price, o.currency)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">{stageCell(o)}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>{rowSchedule(o)}</div>
                      <span className={o.assigned_worker_name ? "text-on-surface-variant" : "text-amber-300"}>
                        {o.assigned_worker_name || (isClosed(o) ? "—" : "Xodim yo'q")}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#263b2a] text-xs uppercase tracking-wide text-on-surface-variant">
                    {["Buyurtma", "Xizmat", "Reja", "Xodim", "Ish bosqichi", "To'lov", "Narx"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-5 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263b2a]/40">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => open(o)}
                      className={`cursor-pointer transition hover:bg-white/5 ${highlight.has(o.id) ? "bg-amber-400/5" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container/30 text-xs font-bold text-primary">
                            {initials(o.customer_name || o.customer_phone)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-semibold text-primary">
                              <span className="truncate">#{o.id} · {o.customer_name || "Mijoz"}</span>
                              {highlight.has(o.id) ? <NewBadge /> : null}
                            </div>
                            <div className="text-xs text-on-surface-variant">
                              {formatPhone(o.phone_number || o.customer_phone)} · {formatDateTime(o.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-5 py-4">
                        <p className="truncate">{o.service_name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{o.address || "—"}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">{rowSchedule(o)}</td>
                      <td className="px-5 py-4">
                        {o.assigned_worker_name ? (
                          <span className="text-on-surface-variant">{o.assigned_worker_name}</span>
                        ) : isClosed(o) ? (
                          <span className="text-on-surface-variant">—</span>
                        ) : (
                          <span className="text-amber-300">Biriktirilmagan</span>
                        )}
                      </td>
                      <td className="px-5 py-4">{stageCell(o)}</td>
                      <td className="px-5 py-4">
                        <StatusPill variant={PAYMENT_TONE[o.payment_status] ?? "neutral"}>
                          {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                        </StatusPill>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold">{formatMoney(o.quoted_price, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!current}
        size="xl"
        title={current ? `Buyurtma #${current.id}` : ""}
        description={current ? `${current.service_name} · ${formatDateTime(current.created_at)}` : undefined}
        onClose={() => setSelected(null)}
        footer={<SecondaryButton onClick={() => setSelected(null)}>Yopish</SecondaryButton>}
      >
        {current ? (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill variant={ORDER_STATUS_TONE[current.status]} pulse={!closed}>
                {isFake(current) ? "Soxta zayavka" : ORDER_STATUS_LABEL[current.status]}
              </StatusPill>
              <StatusPill variant={PAYMENT_TONE[current.payment_status]}>
                To&apos;lov: {PAYMENT_LABEL[current.payment_status]}
              </StatusPill>
              {highlight.has(current.id) ? <NewBadge /> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow label="Mijoz" value={current.customer_name || "—"} />
              <InfoRow
                label="Telefon"
                value={
                  <a className="text-primary hover:underline" href={`tel:${current.phone_number || current.customer_phone}`}>
                    {formatPhone(current.phone_number || current.customer_phone)}
                  </a>
                }
              />
              <InfoRow label="Xizmat" value={current.service_name} />
              <InfoRow label="Maydon" value={current.area_size || "—"} />
              <InfoRow
                label="Reja"
                value={
                  current.scheduled_date
                    ? `${formatDate(current.scheduled_date)}${current.time_slot ? ` · ${current.time_slot}` : ""}${
                        current.scheduled_start ? ` (${durationLabel(current.duration_minutes)})` : ""
                      }`
                    : "Belgilanmagan"
                }
              />
              <InfoRow label="Narx" value={formatMoney(current.quoted_price, current.currency)} />
              <InfoRow
                className="sm:col-span-2"
                label="Manzil"
                value={
                  <>
                    {current.address || "—"}
                    {mapsLink(current.location_lat, current.location_lng, current.address) ? (
                      <a
                        className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                        href={
                          directionsLink(
                            firm?.location_lat,
                            firm?.location_lng,
                            current.location_lat,
                            current.location_lng,
                            current.address,
                          ) ?? "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="material-symbols-outlined text-[16px]">directions</span>
                        Yo&apos;nalish
                      </a>
                    ) : null}
                  </>
                }
              />
              {current.notes ? <InfoRow className="sm:col-span-2" label="Mijoz izohi" value={current.notes} /> : null}
            </div>

            {current.media?.length ? (
              <div className="flex gap-2 overflow-x-auto">
                {current.media.map((m) =>
                  m.kind === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.file} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <video key={m.id} src={m.file} className="h-24 w-32 shrink-0 rounded-xl" controls />
                  ),
                )}
              </div>
            ) : null}

            {!closed ? (
              <Panel
                title="1. Xizmat vaqti"
                hint={
                  current.time_slot
                    ? `Hozir: ${current.time_slot} · ${durationLabel(current.duration_minutes)}`
                    : "Vaqt belgilanmagan"
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <PrimaryButton
                    icon="auto_fix_high"
                    disabled={busy || placingId === current.id}
                    onClick={() => void autoPlace(current)}
                  >
                    {placingId === current.id ? "Qidirilmoqda..." : "Bo'sh vaqtga joylash"}
                  </PrimaryButton>
                  <span className="text-xs text-on-surface-variant">
                    Tizim eng yaqin bo&apos;sh vaqtni topib, buyurtmani o&apos;sha yerga qo&apos;yadi va mijozga xabar yuboradi.
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Sana">
                    <input
                      type="date"
                      className={inputClass}
                      value={plan.date}
                      onChange={(e) => setPlan({ ...plan, date: e.target.value })}
                    />
                  </Field>
                  <Field label="Boshlanish">
                    <select className={inputClass} value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })}>
                      <option value="">Tanlang</option>
                      {(START_TIMES.includes(plan.start) || !plan.start ? START_TIMES : [plan.start, ...START_TIMES]).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Davomiyligi">
                    <select
                      className={inputClass}
                      value={plan.duration}
                      onChange={(e) => setPlan({ ...plan, duration: Number(e.target.value) })}
                    >
                      {(DURATIONS.includes(plan.duration) ? DURATIONS : [...DURATIONS, plan.duration].sort((a, b) => a - b)).map(
                        (d) => (
                          <option key={d} value={d}>
                            {durationLabel(d)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                </div>
                {plan.date ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-on-surface-variant">
                      {formatDate(plan.date)} — bo&apos;sh soatlar (jonli):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {freeStarts.length ? (
                        freeStarts.map((s) => (
                          <button
                            key={s.start}
                            type="button"
                            onClick={() => setPlan({ ...plan, start: s.start })}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              plan.start === s.start
                                ? "border-primary bg-primary/20 text-primary"
                                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                            }`}
                          >
                            {s.start}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-error">Bu kunda bo&apos;sh soat qolmagan</span>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <SecondaryButton
                    icon="event_available"
                    disabled={busy || !plan.date || !plan.start}
                    onClick={() =>
                      void run(
                        "schedule",
                        {
                          scheduled_date: plan.date,
                          scheduled_start: plan.start,
                          duration_minutes: plan.duration,
                          note: form.note,
                        },
                        "Vaqt saqlandi",
                      )
                    }
                  >
                    Vaqtni saqlash
                  </SecondaryButton>
                  {current.scheduled_start ? (
                    <>
                      <SecondaryButton
                        icon="more_time"
                        disabled={busy}
                        onClick={() => void run("schedule", { extend_minutes: 30, note: form.note }, "Ish vaqti 30 daqiqaga uzaytirildi")}
                      >
                        +30 daqiqa
                      </SecondaryButton>
                      <SecondaryButton
                        icon="more_time"
                        disabled={busy}
                        onClick={() => void run("schedule", { extend_minutes: 60, note: form.note }, "Ish vaqti 1 soatga uzaytirildi")}
                      >
                        +1 soat
                      </SecondaryButton>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Ish cho&apos;zilsa uzaytiring — keyingi soatlar mijozlarga band (qizil) ko&apos;rinadi.
                </p>
              </Panel>
            ) : null}

            {!closed ? (
              <Panel title="2. Mas'ul xodim va ish bosqichi" hint="Mijoz va tizim ma'muriyati real vaqtda ko'radi">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Mas'ul xodim / brigadir">
                    <div className="flex gap-2">
                      <select
                        className={inputClass}
                        value={form.worker}
                        onChange={(e) => setForm({ ...form, worker: e.target.value })}
                      >
                        <option value="">Tanlanmagan</option>
                        {(employees ?? []).map((e) => (
                          <option key={e.id} value={e.user.id}>
                            {e.user.full_name || e.user.phone}
                            {e.active_orders ? ` · ${e.active_orders} ta faol` : " · bo'sh"}
                          </option>
                        ))}
                      </select>
                      <SecondaryButton
                        icon="person_check"
                        className="shrink-0"
                        disabled={busy || !form.worker || form.worker === String(current.assigned_worker_id ?? "")}
                        onClick={assignWorker}
                      >
                        Biriktirish
                      </SecondaryButton>
                    </div>
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

                <ol className="mt-4 grid grid-cols-5 gap-1 sm:gap-2">
                  {WORK_STAGES.map((s, i) => {
                    const reachedIndex = current.work_stage ? WORK_STAGES.findIndex((x) => x.key === current.work_stage) : -1;
                    const done = i <= reachedIndex;
                    return (
                      <li key={s.key} className="flex min-w-0 flex-col items-center gap-1 text-center">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full border sm:h-10 sm:w-10 ${
                            done ? "border-primary bg-primary/20 text-primary" : "border-[#26352c] text-on-surface-variant"
                          } ${i === reachedIndex ? "animate-pulse" : ""}`}
                        >
                          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">{s.icon}</span>
                        </span>
                        <span className={`text-xs font-semibold ${done ? "text-on-surface" : "text-on-surface-variant"}`}>
                          {s.label}
                        </span>
                        <span className="hidden text-[11px] text-on-surface-variant sm:block">
                          {times[s.key] ? formatDateTime(times[s.key]) : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>

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
                  {current.work_stage && showEtaFields ? (
                    <SecondaryButton
                      icon="schedule"
                      disabled={busy}
                      onClick={() =>
                        void run("stage", stageBody(current.work_stage as WorkStage), "Yetib borish vaqti yangilandi")
                      }
                    >
                      Vaqtni yangilash
                    </SecondaryButton>
                  ) : null}
                </div>
                {blockedByPayment ? (
                  <p className="mt-2 text-xs text-amber-200">To&apos;lov tasdiqlanmaguncha buyurtmani qabul qilib bo&apos;lmaydi.</p>
                ) : null}
                {current.distance_km || current.eta_minutes ? (
                  <p className="mt-3 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined mr-1 align-middle text-[14px] text-primary">route</span>
                    {current.distance_km ? `Masofa: ${Number(current.distance_km)} km` : ""}
                    {current.eta_minutes ? ` · Yetib borish: ~${current.eta_minutes} daqiqa` : ""}
                    {current.eta_at ? ` (${formatDateTime(current.eta_at)} gacha)` : ""}
                  </p>
                ) : null}
              </Panel>
            ) : null}

            <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-4">
              <h3 className="mb-2 text-base font-semibold text-primary">Hisob-kitob</h3>
              {current.escrow ? (
                <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InfoRow label="Holat" value={current.escrow.status_label || ESCROW_LABEL[current.escrow.status]} plain />
                  <InfoRow label="Mijoz to'lagan" value={formatMoney(current.escrow.amount)} plain />
                  <InfoRow
                    label="Sizga o'tadi"
                    value={<span className="text-primary">{formatMoney(current.escrow.firm_payout)}</span>}
                    plain
                  />
                  <InfoRow label="Platforma ulushi" value={formatMoney(current.escrow.platform_fee)} plain />
                </div>
              ) : null}
              {paymentHint(current) ? <p className="text-xs text-on-surface-variant">{paymentHint(current)}</p> : null}
              {isAwaitingRelease(current) ? (
                <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Ish yakunlandi deb belgilandi. Tizim ma&apos;muriyati tasdiqlagach pul firmangiz hisobiga o&apos;tkaziladi.
                </p>
              ) : null}
              {current.escrow?.status === "released" ? (
                <p className="mt-2 text-xs text-primary">Pul firmangiz hisobiga o&apos;tkazilgan.</p>
              ) : null}
              {!closed ? (
                <details className="mt-3 rounded-xl border border-[#26352c] bg-[#0e1510] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-on-surface-variant">Narx va muddatni o&apos;zgartirish</summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Narx (UZS)">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={form.quoted_price}
                        disabled={!priceEditable(current)}
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
                  {!priceEditable(current) ? (
                    <p className="mt-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined mr-1 align-middle text-[14px]">lock</span>
                      To&apos;lov boshlangani uchun narxni faqat tizim ma&apos;muriyati o&apos;zgartira oladi.
                    </p>
                  ) : null}
                  <SecondaryButton className="mt-3" icon="save" disabled={busy} onClick={saveDetails}>
                    Saqlash
                  </SecondaryButton>
                </details>
              ) : null}
            </div>

            {!closed ? (
              <Panel title="3. Bekor qilish yoki soxta zayavka" tone="danger">
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  <b className="text-on-surface">Bekor qilish</b> — mijoz bilan kelishib bekor qilinganda. <b className="text-on-surface">Soxta zayavka</b> — mijoz
                  bilan bog&apos;lanib bo&apos;lmasa, manzil yolg&apos;on yoki buyurtma hazil bo&apos;lsa. Soxta deb belgilangan buyurtma E-MAKON
                  superadminiga ko&apos;rib chiqish uchun yuboriladi; tasdiqlansa, mijoz ilovada bloklanadi.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCancelNote("")}
                    className="inline-flex items-center gap-2 rounded-full border border-error/40 px-4 py-2 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFakeReason("")}
                    className="inline-flex items-center gap-2 rounded-full border border-error/60 bg-error/10 px-4 py-2 text-sm font-semibold text-error hover:bg-error/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">report</span>
                    Soxta zayavka
                  </button>
                </div>
              </Panel>
            ) : isFake(current) ? (
              <InfoNote icon="report" tone="error">
                Bu buyurtma soxta zayavka deb belgilangan va E-MAKON superadminiga yuborilgan. Mijozni bloklash bo&apos;yicha
                qarorni superadmin qabul qiladi.
              </InfoNote>
            ) : null}

            {(current.status_history?.length ?? 0) > 0 ? (
              <div>
                <h3 className="mb-2 text-base font-semibold">Harakatlar tarixi</h3>
                <ol className="relative max-h-64 space-y-3 overflow-y-auto border-l border-[#26352c] pl-4">
                  {current.status_history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#131b15] bg-primary" />
                      <p className="font-medium">
                        {h.from_status === h.to_status && h.stage_label
                          ? h.stage_label
                          : `${ORDER_STATUS_LABEL[h.from_status as OrderStatus] || h.from_status || "—"} → ${
                              ORDER_STATUS_LABEL[h.to_status as OrderStatus] || h.to_status
                            }`}
                      </p>
                      {h.note ? (
                        <p className={`mt-0.5 text-xs ${h.note.toUpperCase().startsWith("SOXTA") ? "text-error" : "text-on-surface-variant"}`}>
                          {h.note}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {formatDateTime(h.created_at)}
                        {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelNote !== null}
        title="Buyurtmani bekor qilasizmi?"
        description={
          <div className="space-y-3">
            <p>Mijoz to&apos;lov qilgan bo&apos;lsa, pul unga to&apos;liq qaytariladi. Asossiz bekor qilishlar firma reytingiga ta&apos;sir qiladi.</p>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Sabab (mijozga yuboriladi)"
              value={cancelNote ?? ""}
              onChange={(e) => setCancelNote(e.target.value)}
            />
          </div>
        }
        confirmText="Ha, bekor qilish"
        cancelText="Yo'q"
        variant="danger"
        busy={busy}
        onCancel={() => setCancelNote(null)}
        onConfirm={async () => {
          const note = (cancelNote ?? "").trim();
          const done = await run("transition", { status: "cancelled", note }, "Buyurtma bekor qilindi");
          if (done) setCancelNote(null);
        }}
      />

      <ConfirmDialog
        open={fakeReason !== null}
        title="Soxta zayavka deb belgilash"
        description={
          <div className="space-y-3">
            <p>
              Buyurtma bekor qilinadi va <b className="text-on-surface">E-MAKON superadminiga</b> yuboriladi. Superadmin holatni
              tekshirib, mijozni ilovada bloklaydi. To&apos;lov bo&apos;lgan bo&apos;lsa, mijozga qaytariladi.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FAKE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFakeReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    fakeReason === r ? "border-error bg-error/15 text-error" : "border-[#26352c] text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Sabab (majburiy) — superadmin shu matnni ko'radi"
              value={fakeReason ?? ""}
              onChange={(e) => setFakeReason(e.target.value)}
            />
          </div>
        }
        confirmText="Soxta deb yuborish"
        cancelText="Bekor"
        variant="danger"
        busy={busy}
        onCancel={() => setFakeReason(null)}
        onConfirm={async () => {
          const reason = (fakeReason ?? "").trim();
          if (reason.length < 3) {
            showError("Soxta zayavka sababini yozing");
            return;
          }
          const done = await run(
            "transition",
            { status: "cancelled", note: `${FAKE_PREFIX} ${reason}` },
            "Soxta zayavka superadminga yuborildi. Mijoz tekshiruvdan so'ng bloklanadi.",
          );
          if (done) setFakeReason(null);
        }}
      />
    </div>
  );
}

function NewBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black">
      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-black" />
      Yangi
    </span>
  );
}

function InfoRow({
  label,
  value,
  className = "",
  plain = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <div className={`${plain ? "" : "rounded-xl border border-[#26352c] bg-[#0e1510] px-3.5 py-2.5"} min-w-0 ${className}`}>
      <p className="text-xs text-on-surface-variant">{label}</p>
      <div className="mt-0.5 break-words font-medium">{value}</div>
    </div>
  );
}

function Panel({
  title,
  hint,
  tone = "default",
  children,
}: {
  title: string;
  hint?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-4 ${tone === "danger" ? "border-error/30 bg-error/5" : "border-[#263b2a] bg-[#0e1510]"}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-base font-semibold ${tone === "danger" ? "text-error" : "text-on-surface"}`}>{title}</h3>
        {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
