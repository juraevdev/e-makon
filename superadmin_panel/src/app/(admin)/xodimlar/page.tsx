"use client";

import { useState } from "react";
import {
  Breadcrumbs,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FilterChip,
  inputClass,
  Modal,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TableSkeleton,
} from "@/components/ui";
import { api, ApiError, asPage } from "@/lib/api/client";
import type { Employee } from "@/lib/api/types";
import { SPECIALTY_LABEL } from "@/lib/domain";
import { formatDate, formatPhone, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const SPECIALTIES = [
  { id: "all", label: "Barcha mutaxassisliklar" },
  { id: "general", label: "Umumiy bog'bon" },
  { id: "landscape", label: "Landshaft dizayneri" },
  { id: "garden_care", label: "Bog' parvarishi" },
  { id: "ornamental", label: "Manzarali o'simliklar" },
  { id: "irrigation", label: "Sug'orish mutaxassisi" },
  { id: "pest_control", label: "Dorilash mutaxassisi" },
];

export default function XodimlarPage() {
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    phone: "",
    full_name: "",
    password: "",
    specialty: "general",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  // Deactivate confirm dialog
  const [toggleTarget, setToggleTarget] = useState<Employee | null>(null);
  const [busyToggle, setBusyToggle] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/employees/", {
      query: {
        page,
        page_size: 15,
        search: query || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
        specialty: specialtyFilter === "all" ? undefined : specialtyFilter,
      },
    });
    return asPage<Employee>(raw);
  }, [page, statusFilter, specialtyFilter, query]);

  const employees = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 15));

  function openCreate() {
    setEditing(null);
    setForm({
      phone: "+998",
      full_name: "",
      password: "",
      specialty: "general",
      notes: "",
    });
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      phone: emp.user.phone,
      full_name: emp.user.full_name || "",
      password: "",
      specialty: emp.specialty,
      notes: emp.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.phone.trim()) {
      showError("Telefon raqam kiritilishi shart");
      return;
    }
    if (!editing && !form.password.trim()) {
      showError("Yangi xodim uchun parol kiritilishi shart");
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: form.phone.trim(),
        full_name: form.full_name.trim(),
        specialty: form.specialty,
        notes: form.notes.trim(),
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editing) {
        await api(`/admin/employees/${editing.id}/`, {
          method: "PATCH",
          body: payload,
        });
        showSuccess(`"${form.full_name || form.phone}" xodim ma'lumotlari yangilandi`);
      } else {
        await api("/admin/employees/", {
          method: "POST",
          body: payload,
        });
        showSuccess(`"${form.full_name || form.phone}" xodimi tizimga qo'shildi`);
      }

      setModalOpen(false);
      await reload();
    } catch (e) {
      showError(e instanceof ApiError || e instanceof Error ? e.message : "Saqlashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus() {
    if (!toggleTarget) return;
    setBusyToggle(true);
    const nextStatus = !toggleTarget.is_active;
    try {
      await api(`/admin/employees/${toggleTarget.id}/`, {
        method: "PATCH",
        body: { is_active: nextStatus },
      });
      showSuccess(
        nextStatus
          ? `"${toggleTarget.user.full_name || toggleTarget.user.phone}" faollashtirildi`
          : `"${toggleTarget.user.full_name || toggleTarget.user.phone}" deaktiv qilindi`,
      );
      setToggleTarget(null);
      await reload();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Holatni o'zgartirib bo'lmadi");
    } finally {
      setBusyToggle(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#26352c]/40">
        <div>
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Xodimlar" }]} />
          <h2 className="text-xl font-bold text-white tracking-tight">Xodimlar boshqaruvi</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Buyurtmalarni joyida bajaruvchi mutaxassislar va ularning operatsion holati
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PrimaryButton icon="person_add" onClick={openCreate}>
            Yangi xodim
          </PrimaryButton>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all" as const, label: "Barchasi" },
            { id: "active" as const, label: "Faol" },
            { id: "inactive" as const, label: "Nofaol" },
          ].map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              active={statusFilter === f.id}
              onClick={() => {
                setStatusFilter(f.id);
                setPage(1);
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-[#26352c] bg-[#121614] px-3 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
            value={specialtyFilter}
            onChange={(e) => {
              setSpecialtyFilter(e.target.value);
              setPage(1);
            }}
          >
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      {loading && !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <div className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-center">
          <span className="material-symbols-outlined text-error text-3xl mb-2">error</span>
          <p className="text-sm font-semibold text-white">Xodimlarni yuklab bo&apos;lmadi</p>
          <p className="text-xs text-on-surface-variant mt-1">{error}</p>
          <div className="mt-4">
            <SecondaryButton icon="refresh" onClick={() => void reload()}>
              Qayta urinish
            </SecondaryButton>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="engineering"
            title="Xodimlar topilmadi"
            description="Tanlangan filtrlar bo'yicha hech qanday xodim mavjud emas."
            action={<PrimaryButton icon="person_add" onClick={openCreate}>Yangi xodim qo&apos;shish</PrimaryButton>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-card-border bg-[#141816] overflow-hidden shadow-sm">
          <DataTable
            headers={["Ism / Familiya", "Telefon", "Mutaxassislik", "Reyting", "Holat", "Qo'shilgan sana", "Amallar"]}
            footer={
              <Pagination
                current={page}
                pages={pageNumbers(page, totalPages)}
                onPageChange={setPage}
                info={
                  <>
                    Jami <strong className="text-primary">{totalCount}</strong> ta xodim
                  </>
                }
              />
            }
          >
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-[#26352c]/30 hover:bg-[#18211b]/50 transition-colors">
                <td className="px-4 py-3.5 text-xs font-semibold text-white">
                  {emp.user.full_name || "Ism kiritilmagan"}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant font-mono">
                  {formatPhone(emp.user.phone)}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface">
                  {SPECIALTY_LABEL[emp.specialty] || emp.specialty}
                </td>
                <td className="px-4 py-3.5 text-xs text-amber-400 font-semibold">
                  ★ {emp.rating || "0.0"}
                </td>
                <td className="px-4 py-3.5 text-xs">
                  <StatusPill variant={emp.is_active ? "success" : "neutral"}>
                    {emp.is_active ? "Faol" : "Nofaol"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                  {formatDate(emp.created_at)}
                </td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] bg-[#121614] px-2.5 py-1 text-xs font-medium text-on-surface hover:border-primary/50 hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      onClick={() => setToggleTarget(emp)}
                      className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                        emp.is_active
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title={emp.is_active ? "Deaktiv qilish" : "Faollashtirish"}
                    >
                      {emp.is_active ? "Deaktiv" : "Faollashtirish"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Xodimni tahrirlash: ${editing.user.full_name || editing.user.phone}` : "Yangi xodim qo'shish"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <Field label="To'liq ismi" required>
            <input
              type="text"
              placeholder="Masalan: Ali Valiyev"
              className={inputClass}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>

          <Field label="Telefon raqami" required>
            <input
              type="text"
              placeholder="+998901234567"
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>

          <Field label={editing ? "Yangi parol (o'zgartirish shart bo'lmasa bo'sh qoldiring)" : "Parol"} required={!editing}>
            <input
              type="password"
              placeholder="••••••••"
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          <Field label="Mutaxassislik" required>
            <select
              className={inputClass}
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            >
              {SPECIALTIES.filter((s) => s.id !== "all").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Qo'shimcha izoh">
            <textarea
              rows={2}
              placeholder="Xodim malakasi, sertifikatlari haqida qisqacha..."
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-[#26352c]/40">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#26352c] px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-white"
            >
              Bekor qilish
            </button>
            <PrimaryButton disabled={busy} onClick={() => void handleSave()}>
              {busy ? "Saqlanmoqda..." : "Saqlash"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Toggle Status Confirmation Dialog */}
      {toggleTarget && (
        <ConfirmDialog
          open={!!toggleTarget}
          variant={toggleTarget.is_active ? "warning" : "primary"}
          title={toggleTarget.is_active ? "Xodimni deaktiv qilish" : "Xodimni faollashtirish"}
          description={
            toggleTarget.is_active ? (
              <>
                <strong>{toggleTarget.user.full_name || toggleTarget.user.phone}</strong> deaktiv qilinadi
                va yangi operatsiyalarga tayinlanmaydi.
              </>
            ) : (
              <>
                <strong>{toggleTarget.user.full_name || toggleTarget.user.phone}</strong> faollashtiriladi
                va yangi buyurtmalarga tayinlanishi mumkin bo&apos;ladi.
              </>
            )
          }
          confirmText={toggleTarget.is_active ? "Deaktiv qilish" : "Faollashtirish"}
          cancelText="Bekor qilish"
          busy={busyToggle}
          onConfirm={() => void handleToggleStatus()}
          onCancel={() => setToggleTarget(null)}
        />
      )}
    </div>
  );
}
