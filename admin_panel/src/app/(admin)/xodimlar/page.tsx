"use client";

import { useMemo, useState } from "react";
import {
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
import { api, fetchAll } from "@/lib/api/client";
import type { Employee, EmployeeCard, EmploymentStatus } from "@/lib/api/types";
import { downloadExcel } from "@/lib/excel";
import { EMPLOYMENT_LABEL, EMPLOYMENT_TONE, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SPECIALTY_LABEL } from "@/lib/domain";
import { formatDate, formatMoney, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId = "all" | EmploymentStatus;
type CardTab = "info" | "work" | "status";
type SortId = "name" | "rating" | "active" | "completed" | "hired";

const SPECIALTIES = Object.entries(SPECIALTY_LABEL);

const SORTS: { id: SortId; label: string }[] = [
  { id: "name", label: "Ism bo'yicha" },
  { id: "active", label: "Faol buyurtmalar ↓" },
  { id: "completed", label: "Bajargan ishlar ↓" },
  { id: "rating", label: "Reyting ↓" },
  { id: "hired", label: "Staj ↓" },
];

const STATUS_ACTIONS: { status: EmploymentStatus; icon: string; title: string; hint: string }[] = [
  { status: "active", icon: "work", title: "Ishga qaytarish", hint: "Buyurtmalarga biriktirish mumkin bo'ladi" },
  { status: "on_leave", icon: "beach_access", title: "Ta'tilga chiqarish", hint: "Vaqtincha buyurtma berilmaydi, bandlik sig'imi kamayadi" },
  { status: "dismissed", icon: "person_off", title: "Ishdan bo'shatish", hint: "Tizimga kira olmaydi, ish tarixi saqlanadi" },
];

const emptyForm = {
  phone: "+998",
  full_name: "",
  password: "",
  specialty: "general",
  position: "",
  hired_at: "",
  birth_date: "",
  address: "",
  emergency_phone: "",
  skills: "",
  notes: "",
};

function yearsSince(date: string | null) {
  if (!date) return null;
  const months = Math.floor((Date.now() - new Date(date).getTime()) / (30.44 * 24 * 3600 * 1000));
  if (months < 1) return "yangi";
  if (months < 12) return `${months} oy`;
  return `${Math.floor(months / 12)} yil ${months % 12 ? `${months % 12} oy` : ""}`.trim();
}

export default function XodimlarPage() {
  const { query, setQuery } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("active");
  const [specialty, setSpecialty] = useState("");
  const [sort, setSort] = useState<SortId>("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [tab, setTab] = useState<CardTab>("info");
  const [statusAction, setStatusAction] = useState<{ status: EmploymentStatus; reason: string } | null>(null);

  const { data, loading, error, updatedAt } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { search: query || undefined }),
    [query],
    { keepPrevious: true },
  );

  const { data: card, loading: cardLoading } = useAsync(
    async () => (cardId ? api<EmployeeCard>(`/admin/employees/${cardId}/card/`) : null),
    [cardId],
    { keepPrevious: true },
  );

  const all = useMemo(() => data ?? [], [data]);
  const bySpecialty = useMemo(() => (specialty ? all.filter((e) => e.specialty === specialty) : all), [all, specialty]);
  const counts: Record<FilterId, number> = {
    all: bySpecialty.length,
    active: bySpecialty.filter((e) => e.employment_status === "active").length,
    on_leave: bySpecialty.filter((e) => e.employment_status === "on_leave").length,
    dismissed: bySpecialty.filter((e) => e.employment_status === "dismissed").length,
  };
  const rows = useMemo(() => {
    const list = filter === "all" ? bySpecialty : bySpecialty.filter((e) => e.employment_status === filter);
    const name = (e: Employee) => (e.user.full_name || e.user.phone).toLowerCase();
    return [...list].sort((a, b) => {
      switch (sort) {
        case "rating":
          return Number(b.rating || 0) - Number(a.rating || 0);
        case "active":
          return b.active_orders - a.active_orders;
        case "completed":
          return b.completed_orders - a.completed_orders;
        case "hired":
          return (a.hired_at || "9999").localeCompare(b.hired_at || "9999");
        default:
          return name(a).localeCompare(name(b));
      }
    });
  }, [bySpecialty, filter, sort]);

  const activeStaff = all.filter((e) => e.employment_status === "active");
  const freeStaff = activeStaff.filter((e) => e.active_orders === 0).length;
  const activeOrders = activeStaff.reduce((s, e) => s + e.active_orders, 0);

  function openCard(emp: Employee) {
    setCardId(emp.id);
    setTab("info");
    setStatusAction(null);
  }

  function openForm(emp: Employee | null) {
    setEditing(emp);
    setForm(
      emp
        ? {
            phone: emp.user.phone,
            full_name: emp.user.full_name || "",
            password: "",
            specialty: emp.specialty,
            position: emp.position || "",
            hired_at: emp.hired_at || "",
            birth_date: emp.birth_date || "",
            address: emp.address || "",
            emergency_phone: emp.emergency_phone || "",
            skills: (emp.skills || []).join(", "),
            notes: emp.notes || "",
          }
        : emptyForm,
    );
    setFormOpen(true);
  }

  async function save() {
    if (!form.full_name.trim()) return showError("Xodimning to'liq ismini kiriting");
    if (form.phone.replace(/\D/g, "").length < 12) return showError("Telefon raqamni to'liq kiriting (+998 XX XXX XX XX)");
    if (!editing && form.password.trim().length < 6) return showError("Parol kamida 6 belgi bo'lsin");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: form.phone.trim(),
        full_name: form.full_name.trim(),
        specialty: form.specialty,
        position: form.position.trim(),
        hired_at: form.hired_at || null,
        birth_date: form.birth_date || null,
        address: form.address.trim(),
        emergency_phone: form.emergency_phone.trim(),
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        notes: form.notes.trim(),
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (editing) {
        await api(`/admin/employees/${editing.id}/`, { method: "PATCH", body: payload });
        showSuccess("Xodim kartasi yangilandi");
      } else {
        await api("/admin/employees/", { method: "POST", body: payload });
        showSuccess("Xodim qo'shildi — u shu telefon va parol bilan xodim ilovasiga kira oladi");
      }
      setFormOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus() {
    if (!statusAction || !cardId) return;
    if (statusAction.status === "dismissed" && !statusAction.reason.trim()) {
      return showError("Ishdan bo'shatish sababini yozing");
    }
    setBusy(true);
    try {
      await api(`/admin/employees/${cardId}/set-status/`, { method: "POST", body: statusAction });
      showSuccess(`Holat: ${EMPLOYMENT_LABEL[statusAction.status]}`);
      setStatusAction(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  function exportTable() {
    downloadExcel("xodimlar", {
      name: filter === "all" ? "Barcha xodimlar" : EMPLOYMENT_LABEL[filter],
      headers: [
        "ID",
        "F.I.Sh",
        "Telefon",
        "Lavozim",
        "Mutaxassislik",
        "Holat",
        "Ishga kirgan",
        "Staj",
        "Bo'shagan",
        "Faol buyurtma",
        "Bajarilgan",
        "Reyting",
        "Ko'nikmalar",
      ],
      rows: rows.map((e) => [
        e.id,
        e.user.full_name,
        formatPhone(e.user.phone),
        e.position,
        SPECIALTY_LABEL[e.specialty] || e.specialty,
        EMPLOYMENT_LABEL[e.employment_status],
        e.hired_at ? formatDate(e.hired_at) : "",
        yearsSince(e.hired_at) ?? "",
        e.dismissed_at ? formatDate(e.dismissed_at) : "",
        e.active_orders,
        e.completed_orders,
        Number(e.rating || 0),
        (e.skills || []).join(", "),
      ]),
    });
  }

  const emp = card?.employee;
  const set = (key: keyof typeof emptyForm) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      <PageBar
        updatedAt={updatedAt}
        description="Har bir xodimning shaxsiy kartasi: ma'lumotlari, ish faoliyati va holati. Faqat “Ishda” holatidagi xodimlar buyurtmalarga biriktiriladi va bandlik jadvalidagi soatlik sig'imni belgilaydi."
        actions={
          <>
            <ExcelButton onClick={exportTable} disabled={!rows.length} />
            <PrimaryButton icon="person_add" onClick={() => openForm(null)}>
              Yangi xodim
            </PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Ishda" value={counts.active} icon="engineering" tone="primary" hint="Soatlik sig'im shu songa teng" />
        <MiniStat label="Hozir bo'sh" value={freeStaff} icon="person_check" hint="Faol buyurtmasi yo'q xodimlar" />
        <MiniStat label="Faol buyurtmalar" value={activeOrders} icon="assignment" hint="Ishdagi xodimlarda" />
        <MiniStat label="Ta'tilda" value={counts.on_leave} icon="beach_access" tone={counts.on_leave ? "warning" : "default"} />
      </div>

      <div className="flex flex-col gap-3">
        <TabBar
          tabs={[
            { id: "active" as FilterId, label: EMPLOYMENT_LABEL.active, icon: "work", count: counts.active },
            { id: "on_leave" as FilterId, label: EMPLOYMENT_LABEL.on_leave, icon: "beach_access", count: counts.on_leave },
            { id: "dismissed" as FilterId, label: EMPLOYMENT_LABEL.dismissed, icon: "person_off", count: counts.dismissed },
            { id: "all" as FilterId, label: "Barchasi", icon: "groups", count: counts.all },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Ism, telefon yoki lavozim bo'yicha qidirish"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Mutaxassislik">
            <option value="">Barcha mutaxassisliklar</option>
            {SPECIALTIES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Saralash">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error && !data ? (
        <p className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-sm text-error">{error}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="badge"
            title="Xodimlar topilmadi"
            description={query || specialty ? "Qidiruv yoki filtrni o'zgartirib ko'ring." : "Bu holatdagi xodim yo'q."}
            action={
              <PrimaryButton icon="person_add" onClick={() => openForm(null)}>
                Xodim qo&apos;shish
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => openCard(e)}
              className={`group flex min-w-0 flex-col gap-4 rounded-2xl border bg-[#141816] p-5 text-left transition hover:border-primary/50 hover:shadow-[0_0_20px_rgba(46,125,50,0.15)] ${
                e.employment_status === "dismissed" ? "border-[#26352c] opacity-70" : "border-card-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-container to-[#1b2a1e] text-base font-bold text-white">
                  {initials(e.user.full_name || e.user.phone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-on-surface">{e.user.full_name || "Ism kiritilmagan"}</p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {e.position || SPECIALTY_LABEL[e.specialty] || "Xodim"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill variant={EMPLOYMENT_TONE[e.employment_status]} pulse={e.employment_status === "active"}>
                      {EMPLOYMENT_LABEL[e.employment_status]}
                    </StatusPill>
                    {e.employment_status === "active" ? (
                      <span className={`text-xs ${e.active_orders ? "text-amber-300" : "text-primary"}`}>
                        {e.active_orders ? "Band" : "Bo'sh"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-amber-400">★ {Number(e.rating || 0).toFixed(1)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="text-lg font-bold text-primary">{e.active_orders}</p>
                  <p className="text-xs text-on-surface-variant">Faol</p>
                </div>
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="text-lg font-bold">{e.completed_orders}</p>
                  <p className="text-xs text-on-surface-variant">Bajargan</p>
                </div>
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="truncate px-1 text-sm font-bold leading-7">{yearsSince(e.hired_at) ?? "—"}</p>
                  <p className="text-xs text-on-surface-variant">Staj</p>
                </div>
              </div>
              <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]">call</span>
                {formatPhone(e.user.phone)}
                <span className="ml-auto text-xs text-primary opacity-0 transition group-hover:opacity-100">Kartani ochish →</span>
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={cardId !== null}
        size="lg"
        title="Xodim shaxsiy kartasi"
        onClose={() => setCardId(null)}
        footer={<SecondaryButton onClick={() => setCardId(null)}>Yopish</SecondaryButton>}
      >
        {cardLoading || !card || !emp ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-col gap-4 rounded-2xl border border-[#26352c] bg-gradient-to-br from-[#16221a] to-[#0e1210] p-4 sm:flex-row sm:items-center sm:p-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-container to-[#1b2a1e] text-xl font-bold text-white">
                {initials(emp.user.full_name || emp.user.phone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-on-surface">{emp.user.full_name || "Ism kiritilmagan"}</p>
                <p className="text-sm text-on-surface-variant">
                  {emp.position || "Lavozim kiritilmagan"} · {SPECIALTY_LABEL[emp.specialty] || emp.specialty}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill variant={EMPLOYMENT_TONE[emp.employment_status]}>{EMPLOYMENT_LABEL[emp.employment_status]}</StatusPill>
                  <span className="text-xs text-amber-400">★ {Number(emp.rating || 0).toFixed(1)}</span>
                  <a href={`tel:${emp.user.phone}`} className="text-xs text-primary hover:underline">
                    {formatPhone(emp.user.phone)}
                  </a>
                </div>
              </div>
              <SecondaryButton icon="edit" className="self-start sm:self-center" onClick={() => openForm(emp)}>
                Tahrirlash
              </SecondaryButton>
            </div>

            <TabBar
              tabs={[
                { id: "info" as CardTab, label: "Ma'lumotlar", icon: "person" },
                { id: "work" as CardTab, label: "Ish faoliyati", icon: "work_history", count: card.stats.total_orders },
                { id: "status" as CardTab, label: "Holat", icon: "manage_accounts" },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "info" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Ishga kirgan sana", emp.hired_at ? `${formatDate(emp.hired_at)} (${yearsSince(emp.hired_at)})` : "—"],
                  ["Tug'ilgan sana", formatDate(emp.birth_date)],
                  ["Yashash manzili", emp.address || "—"],
                  ["Favqulodda aloqa", emp.emergency_phone ? formatPhone(emp.emergency_phone) : "—"],
                  ["Tizimga qo'shilgan", formatDate(emp.created_at)],
                  ["Login (telefon)", formatPhone(emp.user.phone)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3">
                    <p className="text-xs text-on-surface-variant">{label}</p>
                    <p className="break-words font-medium">{value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 sm:col-span-2">
                  <p className="mb-2 text-xs text-on-surface-variant">Ko&apos;nikmalar</p>
                  <div className="flex flex-wrap gap-2">
                    {emp.skills?.length ? (
                      emp.skills.map((s) => (
                        <span key={s} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-on-surface-variant">Kiritilmagan</span>
                    )}
                  </div>
                </div>
                {emp.notes ? (
                  <div className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 sm:col-span-2">
                    <p className="mb-1 text-xs text-on-surface-variant">Qo&apos;shimcha izohlar</p>
                    {emp.notes}
                  </div>
                ) : null}
                {emp.employment_status === "dismissed" ? (
                  <InfoNote icon="person_off" tone="error" className="sm:col-span-2">
                    <b>Ishdan bo&apos;shagan: {formatDate(emp.dismissed_at)}</b>
                    <br />
                    Sabab: {emp.dismissal_reason || "—"}
                  </InfoNote>
                ) : null}
              </div>
            ) : null}

            {tab === "work" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Jami buyurtma", card.stats.total_orders],
                    ["Faol", card.stats.active_orders],
                    ["Bajarilgan", card.stats.completed_orders],
                    ["Bekor", card.stats.cancelled_orders],
                    ["Bajargan ishlar", formatMoney(card.stats.revenue)],
                    ["Parvarish tashriflari", card.stats.care_visits_done],
                    ["Rejadagi tashriflar", card.stats.care_visits_planned],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="min-w-0 rounded-xl border border-[#26352c] bg-[#0e1210] p-3">
                      <p className="text-xs text-on-surface-variant">{label}</p>
                      <p className="truncate text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-base font-semibold">So&apos;nggi buyurtmalar</p>
                  {card.recent_orders.length ? (
                    <div className="space-y-2">
                      {card.recent_orders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              #{o.id} · {o.service_name}
                            </p>
                            <p className="truncate text-xs text-on-surface-variant">
                              {o.customer_name} · {formatDate(o.scheduled_date || o.created_at)}
                              {o.time_slot ? ` · ${o.time_slot}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusPill variant={ORDER_STATUS_TONE[o.status]}>
                              {o.work_stage_label || ORDER_STATUS_LABEL[o.status]}
                            </StatusPill>
                            <p className="mt-1 text-xs font-semibold">{formatMoney(o.quoted_price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">Hali buyurtmaga biriktirilmagan.</p>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "status" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {STATUS_ACTIONS.filter((a) => a.status !== emp.employment_status).map((a) => (
                    <button
                      key={a.status}
                      type="button"
                      onClick={() => setStatusAction({ status: a.status, reason: "" })}
                      className={`rounded-2xl border p-4 text-left transition ${
                        statusAction?.status === a.status
                          ? "border-primary bg-primary/10"
                          : a.status === "dismissed"
                            ? "border-error/30 hover:border-error/60"
                            : "border-[#26352c] hover:border-primary/40"
                      }`}
                    >
                      <span className={`material-symbols-outlined ${a.status === "dismissed" ? "text-error" : "text-primary"}`}>
                        {a.icon}
                      </span>
                      <p className="mt-2 text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-on-surface-variant">{a.hint}</p>
                    </button>
                  ))}
                </div>
                {statusAction ? (
                  <div className="space-y-3 rounded-2xl border border-[#26352c] bg-[#0e1210] p-4">
                    <Field
                      label={statusAction.status === "dismissed" ? "Ishdan bo'shatish sababi" : "Izoh (ixtiyoriy)"}
                      required={statusAction.status === "dismissed"}
                    >
                      <textarea
                        rows={2}
                        className={inputClass}
                        value={statusAction.reason}
                        onChange={(e) => setStatusAction({ ...statusAction, reason: e.target.value })}
                      />
                    </Field>
                    {statusAction.status !== "active" && emp.active_orders > 0 ? (
                      <InfoNote tone="warning" icon="warning">
                        Xodimda {emp.active_orders} ta faol buyurtma bor — ularni Buyurtmalar bo&apos;limida boshqa xodimga
                        o&apos;tkazing.
                      </InfoNote>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <PrimaryButton disabled={busy} onClick={() => void applyStatus()}>
                        Tasdiqlash
                      </PrimaryButton>
                      <SecondaryButton onClick={() => setStatusAction(null)}>Bekor</SecondaryButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        size="lg"
        title={editing ? "Xodim kartasini tahrirlash" : "Yangi xodim"}
        description={
          editing
            ? "O'zgarishlar darhol saqlanadi. Parolni bo'sh qoldirsangiz, eski parol o'zgarmaydi."
            : "Xodim shu telefon raqami va parol bilan xodim ilovasiga kiradi."
        }
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <SecondaryButton onClick={() => setFormOpen(false)}>Bekor</SecondaryButton>
            <PrimaryButton icon="save" disabled={busy} onClick={() => void save()}>
              {busy ? "Saqlanmoqda..." : "Saqlash"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-base font-semibold text-primary">Kirish ma&apos;lumotlari</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="To'liq ismi" required className="sm:col-span-2">
                <input className={inputClass} value={form.full_name} onChange={set("full_name")} placeholder="Familiya Ism" />
              </Field>
              <Field label="Telefon (login)" required>
                <input className={inputClass} inputMode="tel" value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label={editing ? "Yangi parol (ixtiyoriy)" : "Parol"} required={!editing} hint="Kamida 6 belgi">
                <input type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={set("password")} />
              </Field>
            </div>
          </section>
          <section>
            <p className="mb-3 text-base font-semibold text-primary">Ish ma&apos;lumotlari</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lavozim">
                <input className={inputClass} placeholder="Brigadir, bog'bon, haydovchi..." value={form.position} onChange={set("position")} />
              </Field>
              <Field label="Mutaxassislik">
                <select className={inputClass} value={form.specialty} onChange={set("specialty")}>
                  {SPECIALTIES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ishga kirgan sana">
                <input type="date" className={inputClass} value={form.hired_at} onChange={set("hired_at")} />
              </Field>
              <Field label="Ko'nikmalar" hint="Vergul bilan ajrating">
                <input className={inputClass} placeholder="Daraxt kesish, gazon, sug'orish" value={form.skills} onChange={set("skills")} />
              </Field>
            </div>
          </section>
          <section>
            <p className="mb-3 text-base font-semibold text-primary">Shaxsiy ma&apos;lumotlar</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tug'ilgan sana">
                <input type="date" className={inputClass} value={form.birth_date} onChange={set("birth_date")} />
              </Field>
              <Field label="Favqulodda aloqa telefoni">
                <input className={inputClass} inputMode="tel" value={form.emergency_phone} onChange={set("emergency_phone")} />
              </Field>
              <Field label="Yashash manzili" className="sm:col-span-2">
                <input className={inputClass} value={form.address} onChange={set("address")} />
              </Field>
              <Field label="Qo'shimcha izoh" className="sm:col-span-2">
                <textarea rows={3} className={inputClass} value={form.notes} onChange={set("notes")} />
              </Field>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
