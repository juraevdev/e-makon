"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ExcelButton,
  Field,
  FilterChip,
  inputClass,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TabBar,
} from "@/components/ui";
import { InfoNote, MiniStat, PageBar } from "@/components/firm/PageBar";
import { localIso } from "@/components/firm/schedule";
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
import { downloadExcel } from "@/lib/excel";
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

type FilterId = "all" | "active" | "pending" | "paused" | "draft" | "rejected" | "archive";
type DetailTab = "visits" | "info" | "log";
type ActionId = "submit" | "pause" | "resume" | "complete" | "cancel";

const FILTERS: { id: FilterId; label: string; icon: string; statuses?: CareStatus[] }[] = [
  { id: "all", label: "Barchasi", icon: "list" },
  { id: "active", label: "Faol", icon: "verified", statuses: ["active"] },
  { id: "pending", label: "Tasdiqda", icon: "hourglass_top", statuses: ["pending"] },
  { id: "draft", label: "Qoralama", icon: "edit_note", statuses: ["draft"] },
  { id: "rejected", label: "Rad etilgan", icon: "block", statuses: ["rejected"] },
  { id: "paused", label: "To'xtatilgan", icon: "pause_circle", statuses: ["paused"] },
  { id: "archive", label: "Arxiv", icon: "inventory_2", statuses: ["completed", "cancelled"] },
];

const STATUS_GUIDE: Record<CareStatus, { icon: string; tone: "info" | "warning" | "error" | "success"; text: string }> = {
  draft: {
    icon: "edit_note",
    tone: "info",
    text: "Qoralama — hali hech kimga yuborilmagan. Shartlarni tekshiring va “E-MAKON tasdig'iga yuborish” tugmasini bosing.",
  },
  pending: {
    icon: "hourglass_top",
    tone: "warning",
    text: "E-MAKON ma'muriyati ko'rib chiqmoqda. Tasdiqlangach tashriflar jadvali avtomatik tuziladi va ilovadagi mijozga xabar boradi. Hozircha shartlarni tahrirlash mumkin.",
  },
  active: {
    icon: "verified",
    tone: "success",
    text: "Shartnoma faol. Har bir tashrifga xodim biriktiring, bajarilgach “Bajarildi” deb hisobot yozing — mijoz uni ilovada ko'radi.",
  },
  paused: {
    icon: "pause_circle",
    tone: "info",
    text: "Vaqtincha to'xtatilgan — tashriflar bajarilmaydi. Mijoz tayyor bo'lganda “Davom ettirish”ni bosing.",
  },
  completed: { icon: "task_alt", tone: "success", text: "Shartnoma yakunlangan. Barcha tashriflar va tarix saqlanib qoladi." },
  cancelled: { icon: "cancel", tone: "error", text: "Shartnoma bekor qilingan. Tarix saqlanib qoladi." },
  rejected: {
    icon: "block",
    tone: "error",
    text: "E-MAKON rad etdi. Quyidagi sababni o'qing, shartlarni tuzatib qayta yuboring.",
  },
};

const ACTIONS: Record<
  ActionId,
  { label: string; icon: string; hint: string; statuses: CareStatus[]; needsNote?: "optional" | "required"; danger?: boolean; primary?: boolean }
> = {
  submit: {
    label: "E-MAKON tasdig'iga yuborish",
    icon: "send",
    hint: "Ma'muriyat ko'rib chiqadi, tasdiqlansa jadval tuziladi",
    statuses: ["draft", "rejected"],
    primary: true,
  },
  resume: { label: "Davom ettirish", icon: "play_arrow", hint: "Tashriflar yana rejaga qaytadi", statuses: ["paused"], primary: true },
  pause: {
    label: "To'xtatish",
    icon: "pause",
    hint: "Mijoz safarda yoki mavsum tugadi — tashriflar vaqtincha to'xtaydi",
    statuses: ["active"],
    needsNote: "optional",
  },
  complete: {
    label: "Yakunlash",
    icon: "task_alt",
    hint: "Muddat tugadi yoki barcha ishlar bajarildi",
    statuses: ["active", "paused"],
    needsNote: "optional",
  },
  cancel: {
    label: "Bekor qilish",
    icon: "block",
    hint: "Kelishuv buzildi — sabab tarixda saqlanadi",
    statuses: ["pending", "active", "paused", "rejected"],
    needsNote: "required",
    danger: true,
  },
};

const PAYMENT_LABEL = { monthly: "Har oy", quarterly: "Har chorak", upfront: "Oldindan to'liq" } as const;

const EVENT_LABEL: Record<string, string> = {
  create: "Yaratildi",
  update: "Tahrirlandi",
  submit: "Tasdiqqa yuborildi",
  approve: "E-MAKON tasdiqladi",
  reject: "E-MAKON rad etdi",
  pause: "To'xtatildi",
  resume: "Davom ettirildi",
  complete: "Yakunlandi",
  cancel: "Bekor qilindi",
  comment: "Izoh",
};

const EVENT_ICON: Record<string, string> = {
  create: "add_circle",
  update: "edit",
  submit: "send",
  approve: "verified",
  reject: "block",
  pause: "pause_circle",
  resume: "play_circle",
  complete: "task_alt",
  cancel: "cancel",
  comment: "chat",
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

const VISIT_DOT: Record<CareVisitStatus, string> = {
  scheduled: "bg-sky-400",
  reminded: "bg-sky-400",
  approved: "bg-sky-400",
  postponed: "bg-amber-400",
  done: "bg-primary",
  not_done: "bg-error",
  rejected: "bg-error",
  awaiting_report: "bg-amber-400",
};

const CLOSED_VISIT: CareVisitStatus[] = ["done", "not_done", "rejected"];

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

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
  const start = localIso(new Date());
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

const weekday = (date: string) => WEEKDAY_SHORT[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

function nextVisit(c: CareContract, today: string) {
  return (c.visits ?? [])
    .filter((v) => v.visit_date >= today && !CLOSED_VISIT.includes(v.status))
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0];
}

function daysUntil(date: string, today: string) {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  if (diff === 0) return "bugun";
  if (diff === 1) return "ertaga";
  return `${diff} kundan keyin`;
}

function planText(c: Pick<CareContract, "frequency" | "preferred_weekdays">) {
  const days = c.frequency !== "monthly" && c.preferred_weekdays?.length ? ` · ${c.preferred_weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : "";
  return `${CARE_FREQUENCY_LABEL[c.frequency]}${days}`;
}

export default function ParvarishPage() {
  const { query, setQuery } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [clientType, setClientType] = useState<"" | CareClientType>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CareContract | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("visits");
  const [visitScope, setVisitScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [prompt, setPrompt] = useState<{ action: ActionId; note: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [report, setReport] = useState<{ visit: CareVisit; note: string } | null>(null);
  const [comment, setComment] = useState("");

  const { data, loading, error, updatedAt } = useAsync(
    async () =>
      fetchAll<CareContract>("/admin/care-contracts/", {
        search: query || undefined,
        client_type: clientType || undefined,
      }),
    [query, clientType],
    { keepPrevious: true },
  );
  const { data: summary } = useAsync(() => api<CareSummary>("/admin/care-contracts/summary/"), []);
  const { data: workers } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { employment_status: "active" }),
    [],
  );
  const { data: services } = useAsync(async () => fetchAll<Service>("/admin/services/"), []);
  const { data: detail, setData: setDetail } = useAsync(
    async () => (detailId ? api<CareContract>(`/admin/care-contracts/${detailId}/`) : null),
    [detailId],
    { keepPrevious: true },
  );

  const today = localIso(new Date());
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
  const needsAction = all.filter((c) => c.status === "draft" || c.status === "rejected").length;

  const visits = countVisits(form);
  const total = visits * Number(form.price_per_visit || 0);
  const months = Math.max(
    1,
    Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (30.44 * 864e5)),
  );

  function openDetail(c: CareContract) {
    setDetailId(c.id);
    setTab("visits");
    setVisitScope("upcoming");
    setPrompt(null);
  }

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

  async function save(asDraft: boolean) {
    if (!form.client_name.trim()) {
      return showError(form.client_type === "organization" ? "Tashkilot nomini kiriting" : "Mijoz ismini kiriting");
    }
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
      showSuccess(asDraft ? "Qoralama saqlandi" : "Shartnoma E-MAKON ma'muriyati tasdig'iga yuborildi");
      setDetailId(saved.id);
      setDetail(saved);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: ActionId, note = "") {
    if (!detail) return;
    setBusy(true);
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${detail.id}/${action}/`, { method: "POST", body: { note } });
      setDetail(fresh);
      setPrompt(null);
      showSuccess(`${ACTIONS[action].label}: bajarildi`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft() {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/admin/care-contracts/${detail.id}/`, { method: "DELETE" });
      setConfirmDelete(false);
      setDetailId(null);
      showSuccess("Qoralama o'chirildi");
    } catch (err) {
      showError(err instanceof Error ? err.message : "O'chirilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function updateVisit(v: CareVisit, body: Record<string, unknown>, okText = "Tashrif yangilandi") {
    if (!detail) return false;
    try {
      const fresh = await api<CareContract>(`/admin/care-contracts/${detail.id}/visits/${v.id}/`, { method: "POST", body });
      setDetail(fresh);
      showSuccess(okText);
      return true;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Tashrif yangilanmadi");
      return false;
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
    downloadExcel("parvarish-shartnomalari", [
      {
        name: "Shartnomalar",
        headers: [
          "ID",
          "Nomi",
          "Mijoz turi",
          "Mijoz",
          "Telefon",
          "Manzil",
          "Xizmat",
          "Jadval",
          "Boshlanish",
          "Tugash",
          "Tashrif narxi (UZS)",
          "Jami (UZS)",
          "Rejadagi tashriflar",
          "Bajarilgan",
          "Bajarilish %",
          "Keyingi tashrif",
          "Holat",
        ],
        rows: rows.map((c) => {
          const next = nextVisit(c, today);
          return [
            c.id,
            c.title,
            CARE_CLIENT_TYPE_LABEL[c.client_type],
            c.client_name || c.customer_name,
            c.phone_number || c.customer_phone,
            c.address,
            c.service_name,
            planText(c),
            formatDate(c.start_date),
            formatDate(c.end_date),
            Math.round(Number(c.price_per_visit)),
            Math.round(Number(c.total_amount)),
            c.planned_visits,
            c.visits_done,
            c.planned_visits ? Math.round((c.visits_done / c.planned_visits) * 100) : 0,
            next ? formatDate(next.visit_date) : "",
            CARE_STATUS_LABEL[c.status],
          ];
        }),
      },
      {
        name: "Tashriflar",
        headers: ["Shartnoma", "Mijoz", "Sana", "Kun", "Holat", "Xodim", "Hisobot"],
        rows: rows.flatMap((c) =>
          (c.visits ?? []).map((v) => [
            `#${c.id} ${c.title}`,
            c.client_name || c.customer_name,
            formatDate(v.visit_date),
            weekday(v.visit_date),
            CARE_VISIT_STATUS_LABEL[v.status],
            v.assigned_worker_name,
            v.report_notes,
          ]),
        ),
      },
    ]);
  }

  const visibleVisits = (detail?.visits ?? [])
    .filter((v) => (visitScope === "all" ? true : visitScope === "upcoming" ? v.visit_date >= today : v.visit_date < today))
    .sort((a, b) => (visitScope === "past" ? b.visit_date.localeCompare(a.visit_date) : a.visit_date.localeCompare(b.visit_date)));
  const visitGroups: { key: string; label: string; items: CareVisit[] }[] = [];
  for (const v of visibleVisits.slice(0, 80)) {
    const key = v.visit_date.slice(0, 7);
    const last = visitGroups[visitGroups.length - 1];
    if (last?.key === key) last.items.push(v);
    else visitGroups.push({ key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, items: [v] });
  }
  const workerName = (id: number) => workers?.find((w) => w.user.id === id)?.user.full_name || `#${id}`;
  const detailNext = detail ? nextVisit(detail, today) : undefined;
  const detailPct = detail?.planned_visits ? Math.round((detail.visits_done / detail.planned_visits) * 100) : 0;
  const availableActions = detail
    ? (Object.keys(ACTIONS) as ActionId[]).filter((a) => ACTIONS[a].statuses.includes(detail.status))
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <PageBar
        updatedAt={updatedAt}
        description="Uy xo'jaliklari va tashkilotlar bilan uzoq muddatli parvarish shartnomalari. Har bir shartnoma E-MAKON ma'muriyati vositachiligida tasdiqlanadi, tashriflar jadvali avtomatik tuziladi."
        actions={
          <>
            <ExcelButton onClick={exportTable} disabled={!rows.length} />
            <PrimaryButton icon="add" onClick={openCreate}>
              Yangi shartnoma
            </PrimaryButton>
          </>
        }
      />

      <ol className="grid grid-cols-2 gap-2 rounded-2xl border border-[#263b2a] bg-[#131b15]/90 p-3 text-sm lg:grid-cols-4">
        {[
          { icon: "edit_note", title: "1. Shartnoma tuzing", text: "Mijoz, jadval va narxni kiriting" },
          { icon: "send", title: "2. Tasdiqqa yuboring", text: "E-MAKON ma'muriyati tekshiradi" },
          { icon: "event_available", title: "3. Tashriflarni bajaring", text: "Xodim biriktiring, hisobot yozing" },
          { icon: "task_alt", title: "4. Yakunlang", text: "Muddat tugagach yoki ishlar bitgach" },
        ].map((s) => (
          <li key={s.title} className="flex min-w-0 items-start gap-2.5 rounded-xl p-2">
            <span className="material-symbols-outlined shrink-0 text-primary">{s.icon}</span>
            <span className="min-w-0">
              <span className="block font-semibold text-on-surface">{s.title}</span>
              <span className="block text-xs text-on-surface-variant">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat label="Faol shartnomalar" value={summary?.active ?? "—"} icon="verified" tone="primary" onClick={() => setFilter("active")} active={filter === "active"} />
        <MiniStat label="E-MAKON tasdig'ida" value={summary?.pending ?? "—"} icon="hourglass_top" tone="warning" onClick={() => setFilter("pending")} active={filter === "pending"} />
        <MiniStat
          label="Sizdan amal kutmoqda"
          value={needsAction}
          icon="pending_actions"
          tone={needsAction ? "error" : "default"}
          hint="Qoralama yoki rad etilgan"
        />
        <MiniStat label="Bugungi tashriflar" value={summary?.visits_today ?? "—"} icon="today" tone="primary" />
        <MiniStat label="7 kunlik tashriflar" value={summary?.visits_week ?? "—"} icon="date_range" hint={summary ? `${summary.households} uy · ${summary.organizations} tashkilot` : undefined} />
      </div>

      <div className="flex flex-col gap-3">
        <TabBar
          tabs={FILTERS.map((f) => ({ id: f.id, label: f.label, icon: f.icon, count: counts[f.id] ?? 0 }))}
          value={filter}
          onChange={setFilter}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Shartnoma, mijoz, telefon yoki manzil"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className={inputClass}
            value={clientType}
            aria-label="Mijoz turi"
            onChange={(e) => setClientType(e.target.value as "" | CareClientType)}
          >
            <option value="">Barcha mijoz turlari</option>
            <option value="household">Uy xo&apos;jaliklari</option>
            <option value="organization">Tashkilot / markazlar</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error && !data ? (
        <p className="text-sm text-error">{error}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-[#26352c] bg-[#141816]">
          <EmptyState
            icon="handshake"
            title="Shartnomalar yo'q"
            description="Uy egasi yoki tashkilot bilan uzoq muddatli parvarish shartnomasini tuzing — tashriflar jadvali avtomatik tuziladi."
            action={
              <PrimaryButton icon="add" onClick={openCreate}>
                Shartnoma tuzish
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => {
            const pct = c.planned_visits ? Math.round((c.visits_done / c.planned_visits) * 100) : 0;
            const next = nextVisit(c, today);
            const guide = STATUS_GUIDE[c.status];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openDetail(c)}
                className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#26352c] bg-[#141816] p-5 text-left transition hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined">{c.client_type === "organization" ? "apartment" : "home"}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-on-surface">{c.title || c.client_name}</p>
                      <p className="truncate text-sm text-on-surface-variant">
                        {c.client_name || c.customer_name} · {CARE_CLIENT_TYPE_LABEL[c.client_type]}
                      </p>
                    </div>
                  </div>
                  <StatusPill variant={CARE_STATUS_TONE[c.status]} pulse={c.status === "pending" || c.status === "active"}>
                    {CARE_STATUS_LABEL[c.status]}
                  </StatusPill>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-on-surface-variant">Jadval</p>
                    <p className="truncate font-semibold">{planText(c)}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xs text-on-surface-variant">Narx</p>
                    <p className="truncate font-semibold text-primary">
                      {formatMoney(c.price_per_visit)} <span className="text-xs font-normal text-on-surface-variant">/ tashrif</span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-on-surface-variant">Muddat</p>
                    <p className="truncate font-semibold">
                      {formatDate(c.start_date)} – {formatDate(c.end_date)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xs text-on-surface-variant">Keyingi tashrif</p>
                    <p className={`truncate font-semibold ${next ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {next ? `${formatDate(next.visit_date)} (${daysUntil(next.visit_date, today)})` : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-on-surface-variant">
                    <span>
                      Tashriflar: <b className="text-on-surface">{c.visits_done}</b> / {c.planned_visits}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#0e1210]">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <p
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    guide.tone === "error"
                      ? "bg-error/10 text-error"
                      : guide.tone === "warning"
                        ? "bg-amber-500/10 text-amber-100"
                        : "bg-[#0e1210] text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined shrink-0 text-[16px]">{guide.icon}</span>
                  <span className="line-clamp-2">
                    {c.status === "rejected" && c.rejection_reason ? `Rad sababi: ${c.rejection_reason}` : guide.text}
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={detailId !== null}
        size="xl"
        title={detail ? `Shartnoma #${detail.id}` : "Shartnoma"}
        description={detail ? detail.title || detail.client_name : undefined}
        onClose={() => setDetailId(null)}
        footer={<SecondaryButton onClick={() => setDetailId(null)}>Yopish</SecondaryButton>}
      >
        {!detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-on-surface">
                  {detail.client_name || detail.customer_name} · {CARE_CLIENT_TYPE_LABEL[detail.client_type]}
                </p>
                <p className="text-on-surface-variant">
                  {detail.phone_number ? (
                    <a href={`tel:${detail.phone_number}`} className="text-primary hover:underline">
                      {formatPhone(detail.phone_number)}
                    </a>
                  ) : null}
                  {detail.address ? ` · ${detail.address}` : ""}
                </p>
              </div>
              <StatusPill variant={CARE_STATUS_TONE[detail.status]} pulse={detail.status === "pending"}>
                {CARE_STATUS_LABEL[detail.status]}
              </StatusPill>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Jadval", planText(detail)],
                ["Keyingi tashrif", detailNext ? `${formatDate(detailNext.visit_date)} · ${daysUntil(detailNext.visit_date, today)}` : "—"],
                ["Bajarildi", `${detail.visits_done} / ${detail.planned_visits} (${detailPct}%)`],
                ["Jami summa", formatMoney(detail.total_amount)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2.5">
                  <p className="text-xs text-on-surface-variant">{label}</p>
                  <p className="truncate font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#0e1210]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary" style={{ width: `${detailPct}%` }} />
            </div>

            <InfoNote icon={STATUS_GUIDE[detail.status].icon} tone={STATUS_GUIDE[detail.status].tone}>
              {STATUS_GUIDE[detail.status].text}
              {detail.status === "rejected" ? (
                <p className="mt-1 font-semibold">Sabab: {detail.rejection_reason || "ko'rsatilmagan"}</p>
              ) : null}
            </InfoNote>
            {detail.platform_note ? (
              <InfoNote icon="campaign" tone="success">
                <b>E-MAKON izohi:</b> {detail.platform_note}
              </InfoNote>
            ) : null}

            {availableActions.length || ["draft", "pending", "rejected"].includes(detail.status) ? (
              <section className="rounded-2xl border border-[#263b2a] bg-[#0e1510] p-4">
                <h3 className="mb-3 text-base font-semibold">Amallar</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(["draft", "pending", "rejected"] as CareStatus[]).includes(detail.status) ? (
                    <ActionCard icon="edit" label="Tahrirlash" hint="Mijoz, jadval yoki narxni o'zgartirish" onClick={() => openEdit(detail)} />
                  ) : null}
                  {availableActions.map((a) => {
                    const conf = ACTIONS[a];
                    return (
                      <ActionCard
                        key={a}
                        icon={conf.icon}
                        label={conf.label}
                        hint={conf.hint}
                        danger={conf.danger}
                        primary={conf.primary}
                        active={prompt?.action === a}
                        disabled={busy}
                        onClick={() => (conf.needsNote ? setPrompt({ action: a, note: "" }) : void runAction(a))}
                      />
                    );
                  })}
                  {detail.status === "draft" ? (
                    <ActionCard icon="delete" label="O'chirish" hint="Qoralama butunlay o'chadi" danger onClick={() => setConfirmDelete(true)} />
                  ) : null}
                </div>
                {prompt ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-[#26352c] bg-[#121614] p-3">
                    <Field
                      label={ACTIONS[prompt.action].needsNote === "required" ? "Sabab" : "Izoh (ixtiyoriy)"}
                      required={ACTIONS[prompt.action].needsNote === "required"}
                    >
                      <textarea
                        rows={2}
                        className={inputClass}
                        value={prompt.note}
                        onChange={(e) => setPrompt({ ...prompt, note: e.target.value })}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <PrimaryButton
                        disabled={busy || (ACTIONS[prompt.action].needsNote === "required" && !prompt.note.trim())}
                        onClick={() => void runAction(prompt.action, prompt.note.trim())}
                      >
                        {ACTIONS[prompt.action].label}
                      </PrimaryButton>
                      <SecondaryButton onClick={() => setPrompt(null)}>Bekor</SecondaryButton>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <TabBar
              tabs={[
                { id: "visits" as DetailTab, label: "Tashriflar", icon: "event_available", count: detail.visits.length },
                { id: "info" as DetailTab, label: "Shartlar", icon: "description" },
                { id: "log" as DetailTab, label: "Tarix va izohlar", icon: "forum", count: detail.events.length },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "visits" ? (
              <div className="space-y-3">
                {!detail.visits.length ? (
                  <EmptyState
                    icon="event_upcoming"
                    title="Tashriflar hali yo'q"
                    description="Tashriflar jadvali shartnoma E-MAKON tomonidan tasdiqlangach avtomatik tuziladi."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(["upcoming", "past", "all"] as const).map((s) => (
                        <FilterChip
                          key={s}
                          label={s === "upcoming" ? "Kelgusi" : s === "past" ? "O'tgan" : "Barchasi"}
                          count={
                            s === "all"
                              ? detail.visits.length
                              : detail.visits.filter((v) => (s === "upcoming" ? v.visit_date >= today : v.visit_date < today)).length
                          }
                          active={visitScope === s}
                          onClick={() => setVisitScope(s)}
                        />
                      ))}
                    </div>
                    {detail.status !== "active" ? (
                      <p className="text-xs text-on-surface-variant">
                        Tashrif holatini faqat faol shartnomada o&apos;zgartirish mumkin.
                      </p>
                    ) : null}
                    <div className="max-h-[460px] space-y-5 overflow-y-auto pr-1">
                      {visitGroups.map((g) => (
                        <div key={g.key}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{g.label}</p>
                          <ol className="relative space-y-2 border-l border-[#26352c] pl-4">
                            {g.items.map((v) => {
                              const isToday = v.visit_date === today;
                              const editable = detail.status === "active" && !CLOSED_VISIT.includes(v.status);
                              return (
                                <li key={v.id} className="relative">
                                  <span
                                    className={`absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-[#151917] ${VISIT_DOT[v.status]} ${
                                      isToday ? "animate-pulse" : ""
                                    }`}
                                  />
                                  <div
                                    className={`rounded-xl border p-3 ${
                                      isToday ? "border-primary/50 bg-primary/5" : "border-[#26352c] bg-[#0e1210]"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold">{formatDate(v.visit_date)}</span>
                                      <span className="text-xs text-on-surface-variant">{weekday(v.visit_date)}</span>
                                      {isToday ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-black">Bugun</span> : null}
                                      <StatusPill variant={VISIT_TONE[v.status]}>{CARE_VISIT_STATUS_LABEL[v.status]}</StatusPill>
                                      <select
                                        className="ml-auto max-w-[180px] rounded-lg border border-[#26352c] bg-[#121614] px-2 py-1 text-xs"
                                        value={v.planned_worker ?? ""}
                                        aria-label="Xodim"
                                        disabled={!editable}
                                        onChange={(e) =>
                                          e.target.value &&
                                          void updateVisit(v, { planned_worker: Number(e.target.value) }, "Xodim biriktirildi")
                                        }
                                      >
                                        <option value="">{v.assigned_worker_name || "Xodim tanlang"}</option>
                                        {(workers ?? []).map((w) => (
                                          <option key={w.user.id} value={w.user.id}>
                                            {w.user.full_name || w.user.phone}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {v.report_notes ? (
                                      <p className="mt-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs text-on-surface-variant">
                                        <b className="text-on-surface">Hisobot:</b> {v.report_notes}
                                        {v.report_sent_at ? ` · ${formatDateTime(v.report_sent_at)}` : ""}
                                      </p>
                                    ) : null}
                                    {editable ? (
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                                          onClick={() => setReport({ visit: v, note: "" })}
                                        >
                                          <span className="material-symbols-outlined text-[16px]">task_alt</span>
                                          Bajarildi
                                        </button>
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 rounded-full border border-[#26352c] px-3 py-1 text-xs hover:border-error/50 hover:text-error"
                                          onClick={() => void updateVisit(v, { status: "not_done" }, "Bajarilmadi deb belgilandi")}
                                        >
                                          <span className="material-symbols-outlined text-[16px]">close</span>
                                          Bajarilmadi
                                        </button>
                                        <label className="inline-flex items-center gap-1 rounded-full border border-[#26352c] px-3 py-1 text-xs">
                                          <span className="material-symbols-outlined text-[16px]">event_repeat</span>
                                          Ko&apos;chirish:
                                          <input
                                            type="date"
                                            className="bg-transparent text-xs outline-none"
                                            min={today}
                                            onChange={(e) =>
                                              e.target.value &&
                                              void updateVisit(v, { visit_date: e.target.value, status: "scheduled" }, "Tashrif ko'chirildi")
                                            }
                                          />
                                        </label>
                                      </div>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                      {!visibleVisits.length ? (
                        <p className="py-4 text-center text-sm text-on-surface-variant">Bu bo&apos;limda tashrif yo&apos;q.</p>
                      ) : null}
                      {visibleVisits.length > 80 ? (
                        <p className="text-center text-xs text-on-surface-variant">Yana {visibleVisits.length - 80} ta tashrif bor</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {tab === "info" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Xizmat", detail.service_name || "Umumiy parvarish"],
                  ["Mas'ul shaxs", detail.contact_person || "—"],
                  ["Obyekt manzili", detail.address || "—"],
                  ["Maydon / hajm", detail.area_size || "—"],
                  ["Jadval", planText(detail)],
                  ["Muddat", `${formatDate(detail.start_date)} – ${formatDate(detail.end_date)}`],
                  ["Bir tashrif narxi", formatMoney(detail.price_per_visit)],
                  ["Jami summa", `${formatMoney(detail.total_amount)} (${detail.planned_visits} tashrif)`],
                  ["To'lov tartibi", PAYMENT_LABEL[detail.payment_terms] ?? detail.payment_terms],
                  ["Mas'ul xodimlar", detail.assigned_worker_ids?.length ? detail.assigned_worker_ids.map(workerName).join(", ") : "—"],
                  ["Ilovadagi mijoz", detail.customer ? "Bog'langan — tashriflar haqida xabar oladi" : "Bog'lanmagan"],
                  ["Tasdiqlangan", detail.approved_at ? formatDateTime(detail.approved_at) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3">
                    <p className="text-xs text-on-surface-variant">{label}</p>
                    <p className="break-words font-medium">{value}</p>
                  </div>
                ))}
                {mapsLink(detail.location_lat, detail.location_lng) ? (
                  <a
                    href={mapsLink(detail.location_lat, detail.location_lng)!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline sm:col-span-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">map</span>
                    Obyektni Google Mapsda ochish
                  </a>
                ) : null}
                {detail.terms ? (
                  <div className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 sm:col-span-2">
                    <p className="mb-1 text-xs text-on-surface-variant">Shartnoma shartlari</p>
                    {detail.terms}
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "log" ? (
              <div className="space-y-3">
                <ol className="relative max-h-[360px] space-y-3 overflow-y-auto border-l border-[#26352c] pl-5 pr-1">
                  {[...detail.events].reverse().map((e) => {
                    const platform = e.actor_role === "superadmin";
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                            platform ? "border-amber-500/50 bg-amber-500/20 text-amber-300" : "border-primary/40 bg-[#121614] text-primary"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">{EVENT_ICON[e.action] || "circle"}</span>
                        </span>
                        <div
                          className={`rounded-xl border px-3.5 py-2.5 ${
                            platform ? "border-amber-500/30 bg-amber-500/5" : "border-[#26352c] bg-[#0e1210]"
                          }`}
                        >
                          <p className="text-xs text-on-surface-variant">
                            <b className="text-on-surface">{EVENT_LABEL[e.action] || e.action}</b> · {platform ? "E-MAKON" : e.actor_name} ·{" "}
                            {formatDateTime(e.created_at)}
                          </p>
                          {e.note ? <p className="mt-1 whitespace-pre-line break-words">{e.note}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputClass}
                    placeholder="E-MAKON ma'muriyatiga izoh yoki savol..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendComment()}
                  />
                  <PrimaryButton icon="send" className="shrink-0 justify-center" disabled={!comment.trim()} onClick={() => void sendComment()}>
                    Yuborish
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={!!report}
        size="sm"
        title="Tashrif bajarildi"
        description={report ? `${formatDate(report.visit.visit_date)} · hisobot mijozga ilovada ko'rinadi` : undefined}
        onClose={() => setReport(null)}
        footer={
          <>
            <SecondaryButton onClick={() => setReport(null)}>Bekor</SecondaryButton>
            <PrimaryButton
              icon="task_alt"
              disabled={busy}
              onClick={async () => {
                if (!report) return;
                setBusy(true);
                const ok = await updateVisit(
                  report.visit,
                  { status: "done", report_notes: report.note.trim() },
                  "Tashrif bajarildi, mijozga hisobot yuborildi",
                );
                setBusy(false);
                if (ok) setReport(null);
              }}
            >
              Saqlash
            </PrimaryButton>
          </>
        }
      >
        {report ? (
          <Field label="Bajarilgan ishlar hisoboti" hint="Masalan: gazon o'rildi, 12 ta daraxt butaldi, o'g'it solindi">
            <textarea
              rows={4}
              className={inputClass}
              value={report.note}
              onChange={(e) => setReport({ ...report, note: e.target.value })}
              autoFocus
            />
          </Field>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Qoralama o'chirilsinmi?"
        description="Bu shartnoma qoralamasi butunlay o'chadi. Amalni qaytarib bo'lmaydi."
        confirmText="O'chirish"
        cancelText="Bekor"
        variant="danger"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void removeDraft()}
      />

      <Modal
        open={formOpen}
        size="lg"
        title={editing ? `Shartnomani tahrirlash #${editing.id}` : "Yangi parvarish shartnomasi"}
        description="Saqlangach E-MAKON ma'muriyati tekshiradi. Tasdiqlansa, tashriflar jadvali avtomatik tuziladi."
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <SecondaryButton onClick={() => setFormOpen(false)}>Bekor</SecondaryButton>
            {!editing || editing.status === "draft" ? (
              <SecondaryButton icon="save" disabled={busy} onClick={() => void save(true)}>
                Qoralama
              </SecondaryButton>
            ) : null}
            <PrimaryButton icon="send" disabled={busy} onClick={() => void save(false)}>
              {editing?.status === "pending" ? "Saqlash" : "E-MAKON tasdig'iga yuborish"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-base font-semibold text-primary">1. Hamkor</p>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={form.client_type === "organization" ? "Tashkilot / markaz nomi" : "Uy egasi (F.I.Sh)"} required>
                <input className={inputClass} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </Field>
              {form.client_type === "organization" ? (
                <Field label="Mas'ul shaxs">
                  <input className={inputClass} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                </Field>
              ) : null}
              <Field label="Aloqa telefoni">
                <input className={inputClass} inputMode="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </Field>
              <Field label="Ilovadagi akkaunt telefoni" hint="Ixtiyoriy — mijoz tashriflar haqida ilovada xabar oladi">
                <input
                  className={inputClass}
                  inputMode="tel"
                  placeholder="+998..."
                  value={form.customer_phone_input}
                  onChange={(e) => setForm({ ...form, customer_phone_input: e.target.value })}
                />
              </Field>
              <Field label="Obyekt manzili" required className="sm:col-span-2">
                <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="Kenglik (lat)">
                <input className={inputClass} inputMode="decimal" value={form.location_lat} onChange={(e) => setForm({ ...form, location_lat: e.target.value })} />
              </Field>
              <Field label="Uzunlik (lng)">
                <input className={inputClass} inputMode="decimal" value={form.location_lng} onChange={(e) => setForm({ ...form, location_lng: e.target.value })} />
              </Field>
            </div>
          </section>

          <section>
            <p className="mb-3 text-base font-semibold text-primary">2. Xizmat va jadval</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Xizmat">
                <select className={inputClass} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                  <option value="">Umumiy parvarish</option>
                  {(services ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
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
                    <option key={f} value={f}>
                      {CARE_FREQUENCY_LABEL[f]}
                    </option>
                  ))}
                </select>
              </Field>
              {form.frequency !== "monthly" ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-sm font-medium text-on-surface-variant">Tashrif kunlari</p>
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
                <p className="self-end text-xs text-on-surface-variant sm:col-span-2">
                  Oylik tashrif har oy boshlanish sanasidagi kunda bo&apos;ladi.
                </p>
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
                <p className="mb-1.5 text-sm font-medium text-on-surface-variant">Mas&apos;ul xodimlar</p>
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
            <p className="mb-3 text-base font-semibold text-primary">3. Moliya va shartlar</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <option key={k} value={k}>
                      {PAYMENT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qo'shimcha shartlar" className="sm:col-span-2">
                <textarea
                  rows={3}
                  className={inputClass}
                  placeholder="Ishlar ro'yxati, o'g'it/material kimdan, kafolat, jarimalar..."
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center sm:grid-cols-3">
              <div>
                <p className="text-xs text-on-surface-variant">Tashriflar</p>
                <p className="text-xl font-bold">{visits}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Jami summa</p>
                <p className="text-xl font-bold text-primary">{formatMoney(total)}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">O&apos;rtacha oyiga</p>
                <p className="text-xl font-bold">{formatMoney(Math.round(total / months))}</p>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  hint,
  danger,
  primary,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  hint: string;
  danger?: boolean;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10"
          : danger
            ? "border-error/30 hover:border-error/60 hover:bg-error/5"
            : primary
              ? "border-primary/40 bg-primary/5 hover:border-primary"
              : "border-[#26352c] hover:border-primary/40"
      }`}
    >
      <span className={`material-symbols-outlined shrink-0 ${danger ? "text-error" : "text-primary"}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${danger ? "text-error" : "text-on-surface"}`}>{label}</span>
        <span className="block text-xs text-on-surface-variant">{hint}</span>
      </span>
    </button>
  );
}
