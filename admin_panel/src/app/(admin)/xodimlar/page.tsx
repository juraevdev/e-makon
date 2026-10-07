"use client";

import { useMemo, useState } from "react";
import {
  Breadcrumbs,
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
import type { Employee, EmployeeCard, EmploymentStatus } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import {
  EMPLOYMENT_LABEL,
  EMPLOYMENT_TONE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  SPECIALTY_LABEL,
} from "@/lib/domain";
import { formatDate, formatMoney, formatPhone, initials } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

type FilterId = "all" | EmploymentStatus;

const SPECIALTIES = Object.entries(SPECIALTY_LABEL);

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
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();
  const [filter, setFilter] = useState<FilterId>("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [tab, setTab] = useState<"info" | "work" | "status">("info");
  const [statusAction, setStatusAction] = useState<{ status: EmploymentStatus; reason: string } | null>(null);

  const { data, loading, error, reload } = useAsync(
    async () => fetchAll<Employee>("/admin/employees/", { search: query || undefined }),
    [query],
    { keepPrevious: true },
  );

  const {
    data: card,
    loading: cardLoading,
    reload: reloadCard,
  } = useAsync(async () => (cardId ? api<EmployeeCard>(`/admin/employees/${cardId}/card/`) : null), [cardId]);

  const all = useMemo(() => data ?? [], [data]);
  const counts: Record<FilterId, number> = {
    all: all.length,
    active: all.filter((e) => e.employment_status === "active").length,
    on_leave: all.filter((e) => e.employment_status === "on_leave").length,
    dismissed: all.filter((e) => e.employment_status === "dismissed").length,
  };
  const rows = filter === "all" ? all : all.filter((e) => e.employment_status === filter);

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
    if (form.phone.replace(/\D/g, "").length < 12) return showError("Telefon raqamni to'liq kiriting");
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
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        notes: form.notes.trim(),
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (editing) {
        await api(`/admin/employees/${editing.id}/`, { method: "PATCH", body: payload });
        showSuccess("Xodim kartasi yangilandi");
      } else {
        await api("/admin/employees/", { method: "POST", body: payload });
        showSuccess("Xodim qo'shildi — u shu telefon va parol bilan kira oladi");
      }
      setFormOpen(false);
      await reload();
      if (cardId) await reloadCard();
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
      await Promise.all([reload(), reloadCard()]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  function exportTable() {
    downloadCsv(
      `xodimlar-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "F.I.Sh", "Telefon", "Lavozim", "Mutaxassislik", "Holat", "Ishga kirgan", "Bo'shagan", "Faol buyurtma", "Bajarilgan", "Reyting"],
      rows.map((e) => [
        e.id,
        e.user.full_name,
        e.user.phone,
        e.position,
        SPECIALTY_LABEL[e.specialty] || e.specialty,
        EMPLOYMENT_LABEL[e.employment_status],
        e.hired_at ?? "",
        e.dismissed_at ?? "",
        e.active_orders,
        e.completed_orders,
        e.rating,
      ]),
    );
  }

  const emp = card?.employee;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[#26352c]/40 pb-2 sm:flex-row sm:items-center">
        <div>
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Xodimlar" }]} />
          <h2 className="text-xl font-bold tracking-tight text-white">Xodimlar kartotekasi</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Har bir xodimning shaxsiy kartasi: ma&apos;lumotlari, ish faoliyati va holati (ishda, ta&apos;tilda, ishdan bo&apos;shagan).
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton icon="download" onClick={exportTable} disabled={!rows.length}>
            CSV
          </SecondaryButton>
          <PrimaryButton icon="person_add" onClick={() => openForm(null)}>
            Yangi xodim
          </PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["active", "on_leave", "dismissed", "all"] as FilterId[]).map((id) => (
          <FilterChip
            key={id}
            label={id === "all" ? "Barchasi" : EMPLOYMENT_LABEL[id]}
            count={counts[id]}
            active={filter === id}
            onClick={() => setFilter(id)}
          />
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-sm text-error">{error}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="badge"
            title="Xodimlar yo'q"
            description="Bu holatdagi xodim topilmadi."
            action={<PrimaryButton icon="person_add" onClick={() => openForm(null)}>Xodim qo&apos;shish</PrimaryButton>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => openCard(e)}
              className={`group flex flex-col gap-4 rounded-2xl border bg-[#141816] p-5 text-left transition hover:border-primary/50 hover:shadow-[0_0_20px_rgba(46,125,50,0.15)] ${
                e.employment_status === "dismissed" ? "border-[#26352c] opacity-70" : "border-card-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-container to-[#1b2a1e] text-lg font-bold text-white">
                  {initials(e.user.full_name || e.user.phone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{e.user.full_name || "Ism kiritilmagan"}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {e.position || SPECIALTY_LABEL[e.specialty] || "Xodim"}
                  </p>
                  <div className="mt-2">
                    <StatusPill variant={EMPLOYMENT_TONE[e.employment_status]} pulse={e.employment_status === "active"}>
                      {EMPLOYMENT_LABEL[e.employment_status]}
                    </StatusPill>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400">★ {Number(e.rating || 0).toFixed(1)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="text-lg font-bold text-primary">{e.active_orders}</p>
                  <p className="text-[10px] text-on-surface-variant">Faol</p>
                </div>
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="text-lg font-bold">{e.completed_orders}</p>
                  <p className="text-[10px] text-on-surface-variant">Bajargan</p>
                </div>
                <div className="rounded-xl bg-[#0e1210] py-2">
                  <p className="text-sm font-bold leading-7">{yearsSince(e.hired_at) ?? "—"}</p>
                  <p className="text-[10px] text-on-surface-variant">Staj</p>
                </div>
              </div>
              <p className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]">call</span>
                {formatPhone(e.user.phone)}
                <span className="ml-auto text-primary opacity-0 transition group-hover:opacity-100">Kartani ochish →</span>
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal open={cardId !== null} title="Xodim shaxsiy kartasi" onClose={() => setCardId(null)} wide>
        {cardLoading || !card || !emp ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-[#26352c] bg-gradient-to-br from-[#16221a] to-[#0e1210] p-5 sm:flex-row sm:items-center">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-container to-[#1b2a1e] text-2xl font-bold text-white">
                {initials(emp.user.full_name || emp.user.phone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-white">{emp.user.full_name || "Ism kiritilmagan"}</p>
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
              <SecondaryButton icon="edit" onClick={() => openForm(emp)}>
                Tahrirlash
              </SecondaryButton>
            </div>

            <div className="flex gap-2 border-b border-[#26352c] pb-2">
              {[
                { id: "info" as const, label: "Ma'lumotlar", icon: "person" },
                { id: "work" as const, label: "Ish faoliyati", icon: "work_history" },
                { id: "status" as const, label: "Holat", icon: "manage_accounts" },
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

            {tab === "info" ? (
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Ishga kirgan sana", emp.hired_at ? `${formatDate(emp.hired_at)} (${yearsSince(emp.hired_at)})` : "—"],
                  ["Tug'ilgan sana", formatDate(emp.birth_date)],
                  ["Yashash manzili", emp.address || "—"],
                  ["Favqulodda aloqa", emp.emergency_phone ? formatPhone(emp.emergency_phone) : "—"],
                  ["Tizimga qo'shilgan", formatDate(emp.created_at)],
                  ["Login", formatPhone(emp.user.phone)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3">
                    <p className="text-xs text-on-surface-variant">{label}</p>
                    <p className="font-medium">{value}</p>
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
                  <div className="whitespace-pre-line rounded-xl border border-[#26352c] bg-[#0e1210] px-4 py-3 text-xs sm:col-span-2">
                    <p className="mb-1 text-on-surface-variant">Qo&apos;shimcha izohlar</p>
                    {emp.notes}
                  </div>
                ) : null}
                {emp.employment_status === "dismissed" ? (
                  <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-xs sm:col-span-2">
                    <p className="font-semibold text-error">Ishdan bo&apos;shagan: {formatDate(emp.dismissed_at)}</p>
                    <p className="mt-1 text-on-surface-variant">Sabab: {emp.dismissal_reason || "—"}</p>
                  </div>
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
                    ["Bajargan ishlar summasi", formatMoney(card.stats.revenue)],
                    ["Parvarish tashriflari", card.stats.care_visits_done],
                    ["Rejadagi tashriflar", card.stats.care_visits_planned],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-[#26352c] bg-[#0e1210] p-3">
                      <p className="text-[11px] text-on-surface-variant">{label}</p>
                      <p className="text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">So&apos;nggi buyurtmalar</p>
                  {card.recent_orders.length ? (
                    <div className="space-y-2">
                      {card.recent_orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-xl border border-[#26352c] bg-[#0e1210] px-3 py-2 text-xs">
                          <div>
                            <p className="font-semibold">#{o.id} · {o.service_name}</p>
                            <p className="text-on-surface-variant">{o.customer_name} · {formatDate(o.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <StatusPill variant={ORDER_STATUS_TONE[o.status]}>{o.work_stage_label || ORDER_STATUS_LABEL[o.status]}</StatusPill>
                            <p className="mt-1 font-semibold">{formatMoney(o.quoted_price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant">Hali buyurtmaga biriktirilmagan.</p>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "status" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      { status: "active", icon: "work", title: "Ishga qaytarish", hint: "Buyurtmalarga biriktirish mumkin bo'ladi" },
                      { status: "on_leave", icon: "beach_access", title: "Ta'tilga chiqarish", hint: "Vaqtincha buyurtma berilmaydi" },
                      { status: "dismissed", icon: "person_off", title: "Ishdan bo'shatish", hint: "Tizimga kira olmaydi, tarix saqlanadi" },
                    ] as { status: EmploymentStatus; icon: string; title: string; hint: string }[]
                  )
                    .filter((a) => a.status !== emp.employment_status)
                    .map((a) => (
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
                    <Field label={statusAction.status === "dismissed" ? "Ishdan bo'shatish sababi" : "Izoh (ixtiyoriy)"} required={statusAction.status === "dismissed"}>
                      <textarea
                        rows={2}
                        className={inputClass}
                        value={statusAction.reason}
                        onChange={(e) => setStatusAction({ ...statusAction, reason: e.target.value })}
                      />
                    </Field>
                    {statusAction.status === "dismissed" && emp.active_orders > 0 ? (
                      <p className="text-xs text-amber-200">
                        Diqqat: xodimda {emp.active_orders} ta faol buyurtma bor — ularni boshqa xodimga o&apos;tkazing.
                      </p>
                    ) : null}
                    <div className="flex gap-2">
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

      <Modal open={formOpen} title={editing ? "Xodim kartasini tahrirlash" : "Yangi xodim"} onClose={() => setFormOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="To'liq ismi" required>
            <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Telefon (login)" required>
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={editing ? "Yangi parol (ixtiyoriy)" : "Parol"} required={!editing}>
            <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Lavozim">
            <input
              className={inputClass}
              placeholder="Brigadir, bog'bon, haydovchi..."
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </Field>
          <Field label="Mutaxassislik">
            <select className={inputClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
              {SPECIALTIES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Ishga kirgan sana">
            <input type="date" className={inputClass} value={form.hired_at} onChange={(e) => setForm({ ...form, hired_at: e.target.value })} />
          </Field>
          <Field label="Tug'ilgan sana">
            <input type="date" className={inputClass} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </Field>
          <Field label="Favqulodda aloqa telefoni">
            <input className={inputClass} value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Yashash manzili">
              <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Ko'nikmalar (vergul bilan)">
              <input
                className={inputClass}
                placeholder="Daraxt kesish, gazon, sug'orish tizimi"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Qo'shimcha izoh">
              <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={() => setFormOpen(false)}>Bekor</SecondaryButton>
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
