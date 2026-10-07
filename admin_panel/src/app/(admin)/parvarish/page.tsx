"use client";

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
import { api, fetchAll } from "@/lib/api/client";
import type {
  CareClientType,
  CareContract,
  CareFrequency,
  CareStatus,
  CareSummary,
  CareVisit,
  CareVisitStatus,
  Employee,
  Service,
} from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import {
  CARE_CLIENT_TYPE_LABEL,
  CARE_FREQUENCY_LABEL,
  CARE_STATUS_LABEL,
  CARE_STATUS_TONE,
  CARE_VISIT_STATUS_LABEL,
  WEEKDAY_SHORT,
} from "@/lib/domain";
import { formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { mapsLink } from "@/lib/geo";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId = "all" | "pending" | "active" | "paused" | "draft" | "rejected" | "archive";

const FILTERS: { id: FilterId; label: string; statuses?: CareStatus[] }[] = [
  { id: "all", label: "Barchasi" },
  { id: "active", label: "Faol", statuses: ["active"] },
  { id: "pending", label: "Tasdiqda", statuses: ["pending"] },
  { id: "paused", label: "To'xtatilgan", statuses: ["paused"] },
  { id: "draft", label: "Qoralama", statuses: ["draft"] },
  { id: "rejected", label: "Rad etilgan", statuses: ["rejected"] },
  { id: "archive", label: "Arxiv", statuses: ["completed", "cancelled"] },
];

const PAYMENT_LABEL = { monthly: "Har oy", quarterly: "Har chorak", upfront: "Oldindan to'liq" } as const;

const EVENT_LABEL: Record<string, string> = {
  create: "Yaratildi",
  update: "Tahrirlandi",
  submit: "Tasdiqqa yuborildi",
  approve: "E-Makon tasdiqladi",
  reject: "E-Makon rad etdi",
  pause: "To'xtatildi",
  resume: "Davom ettirildi",
  complete: "Yakunlandi",
  cancel: "Bekor qilindi",
  comment: "Izoh",
};

const VISIT_TONE: Record<CareVisitStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  scheduled: "info",
  reminded: "info",
  approved: "info",
  postponed: "warning",
  done: "success",
  not_done: "error",
  rejected: "error",
  awaiting_report: "warning",
};

type Form = {
  client_type: CareClientType;
  client_name: string;
  contact_person: string;
  phone_number: string;
  customer_phone_input: string;
  address: string;
  location_lat: string;
  location_lng: string;
  service: string;
  title: string;
  area_size: string;
  frequency: CareFrequency;
  preferred_weekdays: number[];
  start_date: string;
  end_date: string;
  price_per_visit: string;
  payment_terms: "monthly" | "quarterly" | "upfront";
  assigned_worker_ids: number[];
  terms: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function addMonths(start: string, months: number) {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}

function emptyForm(): Form {
  const start = iso(new Date());
  return {
    client_type: "household",
    client_name: "",
    contact_person: "",
    phone_number: "+998",
    customer_phone_input: "",
    address: "",
    location_lat: "",
    location_lng: "",
    service: "",
    title: "",
    area_size: "",
    frequency: "weekly",
    preferred_weekdays: [0],
    start_date: start,
    end_date: addMonths(start, 6),
    price_per_visit: "",
    payment_terms: "monthly",
    assigned_worker_ids: [],
    terms: "",
  };
}

function toForm(c: CareContract): Form {
  return {
    client_type: c.client_type,
    client_name: c.client_name,
    contact_person: c.contact_person,
    phone_number: c.phone_number || "+998",
    customer_phone_input: "",
    address: c.address,
    location_lat: c.location_lat ?? "",
    location_lng: c.location_lng ?? "",
    service: c.service ? String(c.service) : "",
    title: c.title,
    area_size: c.area_size,
    frequency: c.frequency,
    preferred_weekdays: c.preferred_weekdays ?? [],
    start_date: c.start_date,
    end_date: c.end_date,
    price_per_visit: c.price_per_visit ? String(Math.round(Number(c.price_per_visit))) : "",
    payment_terms: c.payment_terms,
    assigned_worker_ids: c.assigned_worker_ids ?? [],
    terms: c.terms,
  };
}

/** Backenddagi `visit_dates` bilan bir xil hisob: haftalik/2 haftalik — tanlangan kunlar, oylik — boshlanish kuni. */
function countVisits(f: Pick<Form, "frequency" | "preferred_weekdays" | "start_date" | "end_date">) {
  if (!f.start_date || !f.end_date) return 0;
  const start = new Date(`${f.start_date}T00:00:00Z`);
  const end = new Date(`${f.end_date}T00:00:00Z`);
  if (end < start) return 0;
  let n = 0;
  if (f.frequency === "monthly") {
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    const day = start.getUTCDate();
    while (n < 500) {
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const cur = new Date(Date.UTC(y, m, Math.min(day, last)));
      if (cur > end) break;
      if (cur >= start) n += 1;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return n;
  }
  const days = f.preferred_weekdays.length ? f.preferred_weekdays : [(start.getUTCDay() + 6) % 7];
  const step = f.frequency === "biweekly" ? 14 : 7;
  const weekStart = new Date(start);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  while (weekStart <= end && n < 500) {
    for (const wd of days) {
      const cur = new Date(weekStart);
      cur.setUTCDate(cur.getUTCDate() + wd);
      if (cur >= start && cur <= end) n += 1;
    }
    weekStart.setUTCDate(weekStart.getUTCDate() + step);
  }
  return Math.min(n, 500);
}

export default function ParvarishPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [clientType, setClientType] = useState<"" | CareClientType>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CareContract | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [tab, setTab] = useState<"visits" | "info" | "log">("visits");
  const [visitScope, setVisitScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [prompt, setPrompt] = useState<{ action: string; title: string; required: boolean; note: string } | null>(null);
  const [comment, setComment] = useState("");

  const { data, loading, error, reload } = useAsync(
    async () =>
      fetchAll<CareContract>("/admin/care-contracts/", {
        search: query || undefined,
        client_type: clientType || undefined,
      }),
    [query, clientType],
    { keepPrevious: true },
  );
  const { data: summary, reload: reloadSummary } = useAsync(() => api<CareSummary>("/admin/care-contracts/summary/"), []);
  const { data: workers } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { employment_status: "active" }),
    [],
  );
  const { data: services } = useAsync(async () => fetchAll<Service>("/admin/services/"), []);
  const { data: detail, reload: reloadDetail, setData: setDetail } = useAsync(
    async () => (detailId ? api<CareContract>(`/admin/care-contracts/${detailId}/`) : null),
    [detailId],
  );

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    return f?.statuses ? all.filter((c) => f.statuses!.includes(c.status)) : all;
  }, [all, filter]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, f.statuses ? all.filter((c) => f.statuses!.includes(c.status)).length : all.length]),
      ) as Record<FilterId, number>,
    [all],
  );

  const visits = countVisits(form);
  const total = visits * Number(form.price_per_visit || 0);
  const months = Math.max(1, Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (30.44 * 864e5)));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(c: CareContract) {
    setEditing(c);
    setForm(toForm(c));
    setFormOpen(true);
  }

  async function refreshAll() {
    await Promise.all([reload(), reloadSummary(), detailId ? reloadDetail() : Promise.resolve()]);
  }

  async function save(asDraft: boolean) {
    if (!form.client_name.trim()) return showError(form.client_type === "organization" ? "Tashkilot nomini kiriting" : "Mijoz ismini kiriting");
    if (!form.address.trim()) return showError("Obyekt manzilini kiriting");
    if (!Number(form.price_per_visit)) return showError("Bir tashrif narxini kiriting");
    if (!visits) return showError("Jadval bo'yicha birorta tashrif chiqmadi — sanalarni tekshiring");
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        ...form,
        title: form.title.trim() || `${form.client_name.trim()} — parvarish`,
        service: form.service ? Number(form.service) : null,
        location_lat: form.location_lat ? Number(form.location_lat) : null,
        location_lng: form.location_lng ? Number(form.location_lng) : null,
        price_per_visit: Number(form.price_per_visit),
        total_amount: total,
        preferred_weekdays: form.frequency === "monthly" ? [] : form.preferred_weekdays,
      };
      if (!form.customer_phone_input.trim()) delete body.customer_phone_input;
      let saved: CareContract;
      if (editing) {
        saved = await api<CareContract>(`/admin/care-contracts/${editing.id}/`, { method: "PATCH", body });
        if (!asDraft && (saved.status === "draft" || saved.status === "rejected")) {
          saved = await api<CareContract>(`/admin/care-contracts/${editing.id}/submit/`, { method: "POST", body: {} });
        }
      } else {
        saved = await api<CareContract>("/admin/care-contracts/", { method: "POST", body: { ...body, draft: asDraft } });
      }
      setFormOpen(false);
      showSuccess(asDraft ? "Qoralama saqlandi" : "Shartnoma E-Makon ma'muriyati tasdig'iga yuborildi");
      setDetailId(saved.id);
      await refreshAll();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string, note = "") {
    if (!detail) return;
    setBusy(true);
    try {
      if (action === "delete") {
        await api(`/admin/care-contracts/${detail.id}/`, { method: "DELETE" });
        setDetailId(null);
        showSuccess("Qoralama o'chirildi");
      } else {
        const fresh = await api<CareContract>(`/admin/care-contracts/${detail.id}/${action}/`, { method: "POST", body: { note } });
        setDetail(fresh);
        showSuccess("Bajarildi");
      }
      setPrompt(null);
      await Promise.all([reload(), reloadSummary()]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function updateVisit(v: CareVisit, body: Record<string, unknown>) {
    if (!detail) return;
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${detail.id}/visits/${v.id}/`, { method: "POST", body });
      setDetail(fresh);
      void reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Tashrif yangilanmadi");
    }
  }

  async function sendComment() {
    if (!comment.trim() || !detail) return;
    try {
      setDetail(await api<CareContract>(`/admin/care-contracts/${detail.id}/comment/`, { method: "POST", body: { note: comment } }));
      setComment("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Yuborilmadi");
    }
  }

  function exportTable() {
    downloadCsv(
      `parvarish-shartnomalari-${iso(new Date())}`,
      ["ID", "Nomi", "Mijoz turi", "Mijoz", "Telefon", "Manzil", "Chastota", "Boshlanish", "Tugash", "Tashrif narxi", "Jami", "Tashriflar", "Bajarilgan", "Holat"],
      rows.map((c) => [
        c.id,
        c.title,
        CARE_CLIENT_TYPE_LABEL[c.client_type],
        c.customer_name,
        c.customer_phone,
        c.address,
        CARE_FREQUENCY_LABEL[c.frequency],
        c.start_date,
        c.end_date,
        Number(c.price_per_visit),
        Number(c.total_amount),
        c.planned_visits,
        c.visits_done,
        CARE_STATUS_LABEL[c.status],
      ]),
    );
  }

  const today = iso(new Date());
  const visibleVisits = (detail?.visits ?? []).filter((v) =>
    visitScope === "all" ? true : visitScope === "upcoming" ? v.visit_date >= today : v.visit_date < today,
  );
  const workerName = (id: number) => workers?.find((w) => w.user.id === id)?.user.full_name || `#${id}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <p className="max-w-3xl text-sm text-on-surface-variant">
          Uy xo&apos;jaliklari va tashkilot/markazlar bilan uzoq muddatli parvarish hamkorligi. Har bir shartnoma{" "}
          <b className="text-on-surface">E-Makon ma&apos;muriyati vositachiligida</b> tasdiqlanadi, tashriflar jadvali avtomatik tuziladi.
        </p>
        <div className="flex gap-2">
          <SecondaryButton icon="download" onClick={exportTable} disabled={!rows.length}>
            CSV
          </SecondaryButton>
          <PrimaryButton icon="add" onClick={openCreate}>
            Yangi shartnoma
          </PrimaryButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Faol shartnomalar", value: summary?.active, icon: "verified", tone: "text-primary" },
          { label: "E-Makon tasdig'ida", value: summary?.pending, icon: "hourglass_top", tone: "text-amber-300" },
          { label: "Uy xo'jaliklari", value: summary?.households, icon: "home", tone: "text-on-surface" },
          { label: "Tashkilotlar", value: summary?.organizations, icon: "apartment", tone: "text-on-surface" },
          { label: "Bugun / 7 kun tashrif", value: summary ? `${summary.visits_today} / ${summary.visits_week}` : undefined, icon: "event", tone: "text-primary" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#26352c] bg-[#141816] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">{k.label}</span>
              <span className={`material-symbols-outlined ${k.tone}`}>{k.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{k.value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} count={counts[f.id]} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
        </div>
        <select
          className="rounded-xl border border-[#26352c] bg-[#121614] px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
          value={clientType}
          onChange={(e) => setClientType(e.target.value as "" | CareClientType)}
        >
          <option value="">Barcha mijoz turlari</option>
          <option value="household">Uy xo&apos;jaliklari</option>
          <option value="organization">Tashkilot / markazlar</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-error">{error}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-[#26352c] bg-[#141816]">
          <EmptyState
            icon="handshake"
            title="Shartnomalar yo'q"
            description="Uy egasi yoki tashkilot bilan uzoq muddatli parvarish shartnomasini tuzing."
            action={<PrimaryButton onClick={openCreate}>Shartnoma tuzish</PrimaryButton>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => {
            const pct = c.planned_visits ? Math.round((c.visits_done / c.planned_visits) * 100) : 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setDetailId(c.id);
                  setTab("visits");
                }}
                className="flex flex-col gap-3 rounded-2xl border border-[#26352c] bg-[#141816] p-5 text-left transition hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined">{c.client_type === "organization" ? "apartment" : "home"}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.title || c.customer_name}</p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {c.customer_name} · {CARE_CLIENT_TYPE_LABEL[c.client_type]}
                      </p>
                    </div>
                  </div>
                  <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending"}>
                    {CARE_STATUS_LABEL[c.status]}
                  </StatusPill>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-on-surface-variant">Chastota</p>
                    <p className="font-semibold">{CARE_FREQUENCY_LABEL[c.frequency]}</p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Muddat</p>
                    <p className="font-semibold">{formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-on-surface-variant">Jami</p>
                    <p className="font-semibold text-primary">{formatMoney(c.total_amount)}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-on-surface-variant">
                    <span>Tashriflar: {c.visits_done} / {c.planned_visits}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#0e1210]">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {c.status === "rejected" && c.rejection_reason ? (
                  <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">Rad sababi: {c.rejection_reason}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Shartnoma tafsiloti */}
      <Modal open={detailId !== null} title={detail ? `Shartnoma #${detail.id}` : "Shartnoma"} onClose={() => setDetailId(null)} wide>
        {!detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{detail.title || detail.customer_name}</p>
                <p className="text-sm text-on-surface-variant">
                  {detail.customer_name} · {CARE_CLIENT_TYPE_LABEL[detail.client_type]}
                  {detail.customer_phone ? ` · ${formatPhone(detail.customer_phone)}` : ""}
                </p>
              </div>
              <StatusPill variant={CARE_STATUS_TONE[detail.status]}>{CARE_STATUS_LABEL[detail.status]}</StatusPill>
            </div>

            {detail.status === "pending" ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                Shartnoma E-Makon ma&apos;muriyati tomonidan ko&apos;rib chiqilmoqda. Tasdiqlangach tashriflar jadvali avtomatik tuziladi va mijozga
                xabar boradi.
              </p>
            ) : null}
            {detail.status === "rejected" ? (
              <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error">
                Rad etildi: {detail.rejection_reason || "sabab ko'rsatilmagan"}. Shartlarni tuzatib qayta yuboring.
              </p>
            ) : null}
            {detail.platform_note ? (
              <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs">
                <b>E-Makon izohi:</b> {detail.platform_note}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(["draft", "pending", "rejected"] as CareStatus[]).includes(detail.status) ? (
                <SecondaryButton icon="edit" onClick={() => openEdit(detail)}>
                  Tahrirlash
                </SecondaryButton>
              ) : null}
              {detail.status === "draft" || detail.status === "rejected" ? (
                <PrimaryButton icon="send" disabled={busy} onClick={() => void runAction("submit")}>
                  Tasdiqqa yuborish
                </PrimaryButton>
              ) : null}
              {detail.status === "active" ? (
                <SecondaryButton icon="pause" onClick={() => setPrompt({ action: "pause", title: "Shartnomani to'xtatish", required: false, note: "" })}>
                  To&apos;xtatish
                </SecondaryButton>
              ) : null}
              {detail.status === "paused" ? (
                <PrimaryButton icon="play_arrow" disabled={busy} onClick={() => void runAction("resume")}>
                  Davom ettirish
                </PrimaryButton>
              ) : null}
              {detail.status === "active" || detail.status === "paused" ? (
                <SecondaryButton icon="task_alt" onClick={() => setPrompt({ action: "complete", title: "Shartnomani yakunlash", required: false, note: "" })}>
                  Yakunlash
                </SecondaryButton>
              ) : null}
              {!["completed", "cancelled", "draft"].includes(detail.status) ? (
                <SecondaryButton
                  icon="block"
                  className="!text-error"
                  onClick={() => setPrompt({ action: "cancel", title: "Shartnomani bekor qilish", required: true, note: "" })}
                >
                  Bekor qilish
                </SecondaryButton>
              ) : null}
              {detail.status === "draft" ? (
                <SecondaryButton
                  icon="delete"
                  className="!text-error"
                  onClick={() =>
                    setPrompt({ action: "delete", title: "Qoralamani butunlay o'chirasizmi? Bu amalni qaytarib bo'lmaydi.", required: false, note: "" })
                  }
                >
                  O&apos;chirish
                </SecondaryButton>
              ) : null}
            </div>

            {prompt ? (
              <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#0e1210] p-4">
                <p className="text-sm font-semibold">{prompt.title}</p>
                <Field label={prompt.required ? "Sabab" : "Izoh (ixtiyoriy)"} required={prompt.required}>
                  <textarea rows={2} className={inputClass} value={prompt.note} onChange={(e) => setPrompt({ ...prompt, note: e.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <PrimaryButton disabled={busy || (prompt.required && !prompt.note.trim())} onClick={() => void runAction(prompt.action, prompt.note)}>
                    Tasdiqlash
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setPrompt(null)}>Bekor</SecondaryButton>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 border-b border-[#26352c] pb-2">
              {[
                { id: "visits" as const, label: `Tashriflar (${detail.visits.length})`, icon: "event_available" },
                { id: "info" as const, label: "Shartlar", icon: "description" },
                { id: "log" as const, label: "Tarix va izohlar", icon: "forum" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${
                    tab === t.id ? "bg-primary/15 font-semibold text-primary" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "visits" ? (
              <div className="space-y-3">
                {!detail.visits.length ? (
                  <p className="text-sm text-on-surface-variant">Tashriflar shartnoma tasdiqlangach avtomatik rejalashtiriladi.</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      {(["upcoming", "past", "all"] as const).map((s) => (
                        <FilterChip
                          key={s}
                          label={s === "upcoming" ? "Kelgusi" : s === "past" ? "O'tgan" : "Barchasi"}
                          active={visitScope === s}
                          onClick={() => setVisitScope(s)}
                        />
                      ))}
                    </div>
                    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                      {visibleVisits.slice(0, 60).map((v) => (
                        <div key={v.id} className="rounded-xl border border-[#26352c] bg-[#0e1210] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{formatDate(v.visit_date)}</span>
                            <span className="text-xs text-on-surface-variant">
                              {WEEKDAY_SHORT[(new Date(`${v.visit_date}T00:00:00Z`).getUTCDay() + 6) % 7]}
                            </span>
                            <StatusPill variant={VISIT_TONE[v.status]}>{CARE_VISIT_STATUS_LABEL[v.status]}</StatusPill>
                            <select
                              className="ml-auto rounded-lg border border-[#26352c] bg-[#121614] px-2 py-1 text-xs"
                              value={v.planned_worker ?? ""}
                              onChange={(e) => e.target.value && void updateVisit(v, { planned_worker: Number(e.target.value) })}
                            >
                              <option value="">Xodim tanlang</option>
                              {(workers ?? []).map((w) => (
                                <option key={w.user.id} value={w.user.id}>{w.user.full_name || w.user.phone}</option>
                              ))}
                            </select>
                          </div>
                          {v.report_notes ? <p className="mt-2 text-xs text-on-surface-variant">Hisobot: {v.report_notes}</p> : null}
                          {detail.status === "active" && v.status !== "done" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                                onClick={() => {
                                  const note = window.prompt("Bajarilgan ishlar hisoboti (mijozga yuboriladi):", "") ?? "";
                                  void updateVisit(v, { status: "done", report_notes: note });
                                }}
                              >
                                Bajarildi
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-[#26352c] px-3 py-1 text-xs hover:border-error/50 hover:text-error"
                                onClick={() => void updateVisit(v, { status: "not_done" })}
                              >
                                Bajarilmadi
                              </button>
                              <label className="inline-flex items-center gap-1 rounded-full border border-[#26352c] px-3 py-1 text-xs">
                                Ko&apos;chirish:
                                <input
                                  type="date"
                                  className="bg-transparent text-xs outline-none"
                                  min={today}
                                  onChange={(e) => e.target.value && void updateVisit(v, { visit_date: e.target.value, status: "scheduled" })}
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {visibleVisits.length > 60 ? (
                        <p className="text-center text-xs text-on-surface-variant">Yana {visibleVisits.length - 60} ta tashrif bor</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {tab === "info" ? (
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Xizmat", detail.service_name || "—"],
                  ["Mas'ul shaxs", detail.contact_person || "—"],
                  ["Obyekt manzili", detail.address || "—"],
                  ["Maydon", detail.area_size || "—"],
                  ["Chastota", `${CARE_FREQUENCY_LABEL[detail.frequency]}${detail.preferred_weekdays?.length ? ` · ${detail.preferred_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : ""}`],
                  ["Muddat", `${formatDate(detail.start_date)} – ${formatDate(detail.end_date)}`],
                  ["Bir tashrif narxi", formatMoney(detail.price_per_visit)],
                  ["Jami summa", `${formatMoney(detail.total_amount)} (${detail.planned_visits} tashrif)`],
                  ["To'lov tartibi", PAYMENT_LABEL[detail.payment_terms] ?? detail.payment_terms],
                  ["Mas'ul xodimlar", detail.assigned_worker_ids?.length ? detail.assigned_worker_ids.map(workerName).join(", ") : "—"],
                  ["Ilovadagi mijoz", detail.customer ? "Bog'langan — tashriflar haqida xabar oladi" : "Bog'lanmagan"],
                  ["Tasdiqlangan", detail.approved_at ? formatDateTime(detail.approved_at) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3">
                    <p className="text-xs text-on-surface-variant">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
                {mapsLink(detail.location_lat, detail.location_lng) ? (
                  <a
                    href={mapsLink(detail.location_lat, detail.location_lng)!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline sm:col-span-2"
                  >
                    Obyektni Google Mapsda ochish →
                  </a>
                ) : null}
                {detail.terms ? (
                  <div className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 text-xs sm:col-span-2">
                    <p className="mb-1 text-on-surface-variant">Shartnoma shartlari</p>
                    {detail.terms}
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "log" ? (
              <div className="space-y-3">
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {[...detail.events].reverse().map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-xl border px-4 py-2.5 text-sm ${
                        e.actor_role === "superadmin" ? "border-amber-500/30 bg-amber-500/5" : "border-[#26352c] bg-[#0e1210]"
                      }`}
                    >
                      <p className="text-xs text-on-surface-variant">
                        <b className="text-on-surface">{EVENT_LABEL[e.action] || e.action}</b> ·{" "}
                        {e.actor_role === "superadmin" ? "E-Makon" : e.actor_name} · {formatDateTime(e.created_at)}
                      </p>
                      {e.note ? <p className="mt-1">{e.note}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="E-Makon ma'muriyatiga izoh yoki savol..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendComment()}
                  />
                  <PrimaryButton icon="send" disabled={!comment.trim()} onClick={() => void sendComment()}>
                    Yuborish
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Yaratish / tahrirlash */}
      <Modal open={formOpen} title={editing ? `Shartnomani tahrirlash #${editing.id}` : "Yangi parvarish shartnomasi"} onClose={() => setFormOpen(false)} wide>
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-sm font-semibold text-primary">1. Hamkor</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["household", "organization"] as CareClientType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, client_type: t })}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                    form.client_type === t ? "border-primary bg-primary/10 font-semibold text-primary" : "border-[#26352c] text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined">{t === "organization" ? "apartment" : "home"}</span>
                  {CARE_CLIENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={form.client_type === "organization" ? "Tashkilot / markaz nomi" : "Uy egasi (F.I.Sh)"} required>
                <input className={inputClass} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </Field>
              {form.client_type === "organization" ? (
                <Field label="Mas'ul shaxs">
                  <input className={inputClass} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                </Field>
              ) : null}
              <Field label="Aloqa telefoni">
                <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </Field>
              <Field label="Ilovadagi akkaunt telefoni (ixtiyoriy)">
                <input
                  className={inputClass}
                  placeholder="+998... — mijoz tashriflar haqida xabar oladi"
                  value={form.customer_phone_input}
                  onChange={(e) => setForm({ ...form, customer_phone_input: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Obyekt manzili" required>
                  <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
              </div>
              <Field label="Kenglik (lat)">
                <input className={inputClass} value={form.location_lat} onChange={(e) => setForm({ ...form, location_lat: e.target.value })} />
              </Field>
              <Field label="Uzunlik (lng)">
                <input className={inputClass} value={form.location_lng} onChange={(e) => setForm({ ...form, location_lng: e.target.value })} />
              </Field>
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-semibold text-primary">2. Xizmat va jadval</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Xizmat">
                <select className={inputClass} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                  <option value="">Umumiy parvarish</option>
                  {(services ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Shartnoma nomi">
                <input
                  className={inputClass}
                  placeholder="Masalan: Hovli va bog' yillik parvarishi"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Maydon / hajm">
                <input className={inputClass} placeholder="12 sotix, 40 daraxt" value={form.area_size} onChange={(e) => setForm({ ...form, area_size: e.target.value })} />
              </Field>
              <Field label="Chastota">
                <select className={inputClass} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as CareFrequency })}>
                  {(Object.keys(CARE_FREQUENCY_LABEL) as CareFrequency[]).map((f) => (
                    <option key={f} value={f}>{CARE_FREQUENCY_LABEL[f]}</option>
                  ))}
                </select>
              </Field>
              {form.frequency !== "monthly" ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-medium text-on-surface-variant">Tashrif kunlari</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_SHORT.map((d, i) => {
                      const on = form.preferred_weekdays.includes(i);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              preferred_weekdays: on ? form.preferred_weekdays.filter((x) => x !== i) : [...form.preferred_weekdays, i].sort(),
                            })
                          }
                          className={`h-10 w-12 rounded-xl border text-sm ${on ? "border-primary bg-primary/15 font-bold text-primary" : "border-[#26352c] text-on-surface-variant"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="self-end text-xs text-on-surface-variant sm:col-span-2">Oylik tashrif har oy boshlanish sanasidagi kunda bo&apos;ladi.</p>
              )}
              <Field label="Boshlanish sanasi">
                <input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Field>
              <Field label="Tugash sanasi">
                <input type="date" className={inputClass} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {[3, 6, 12, 24, 36].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, end_date: addMonths(form.start_date, m) })}
                    className="rounded-full border border-[#26352c] px-3 py-1 text-xs text-on-surface-variant hover:border-primary/40 hover:text-primary"
                  >
                    {m < 12 ? `${m} oy` : `${m / 12} yil`}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-medium text-on-surface-variant">Mas&apos;ul xodimlar</p>
                <div className="flex flex-wrap gap-2">
                  {(workers ?? []).map((w) => {
                    const on = form.assigned_worker_ids.includes(w.user.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            assigned_worker_ids: on
                              ? form.assigned_worker_ids.filter((x) => x !== w.user.id)
                              : [...form.assigned_worker_ids, w.user.id],
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/15 text-primary" : "border-[#26352c] text-on-surface-variant"}`}
                      >
                        {w.user.full_name || w.user.phone}
                      </button>
                    );
                  })}
                  {!workers?.length ? <span className="text-xs text-on-surface-variant">Faol xodim yo&apos;q</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-semibold text-primary">3. Moliya va shartlar</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Bir tashrif narxi (UZS)" required>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.price_per_visit}
                  onChange={(e) => setForm({ ...form, price_per_visit: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field label="To'lov tartibi">
                <select
                  className={inputClass}
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value as Form["payment_terms"] })}
                >
                  {(Object.keys(PAYMENT_LABEL) as (keyof typeof PAYMENT_LABEL)[]).map((k) => (
                    <option key={k} value={k}>{PAYMENT_LABEL[k]}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Qo'shimcha shartlar">
                  <textarea
                    rows={3}
                    className={inputClass}
                    placeholder="Ishlar ro'yxati, o'g'it/material kimdan, kafolat, jarimalar..."
                    value={form.terms}
                    onChange={(e) => setForm({ ...form, terms: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
              <div>
                <p className="text-[11px] text-on-surface-variant">Tashriflar</p>
                <p className="text-xl font-bold">{visits}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant">Jami summa</p>
                <p className="text-xl font-bold text-primary">{formatMoney(total)}</p>
              </div>
              <div>
                <p className="text-[11px] text-on-surface-variant">O&apos;rtacha oyiga</p>
                <p className="text-xl font-bold">{formatMoney(Math.round(total / months))}</p>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[#26352c] pt-4">
            <SecondaryButton onClick={() => setFormOpen(false)}>Bekor</SecondaryButton>
            {!editing || editing.status === "draft" ? (
              <SecondaryButton icon="save" disabled={busy} onClick={() => void save(true)}>
                Qoralama
              </SecondaryButton>
            ) : null}
            <PrimaryButton icon="send" disabled={busy} onClick={() => void save(false)}>
              {editing?.status === "pending" ? "Saqlash" : "E-Makon tasdig'iga yuborish"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
