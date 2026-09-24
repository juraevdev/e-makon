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
import type { AdminProfile } from "@/lib/api/types";
import { formatDate, formatPhone, pageNumbers } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/providers/AuthProvider";
import { useSearch } from "@/providers/SearchProvider";
import { useToast } from "@/providers/ToastProvider";

const emptyAdminForm = {
  phone: "+998",
  full_name: "",
  password: "",
  title: "Admin",
  can_manage_staff: true,
  can_manage_orders: true,
  can_view_analytics: true,
  is_active: true,
};

export default function AdministratorlarPage() {
  const { user } = useAuth();
  const { query } = useSearch();
  const { showSuccess, showError } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState(emptyAdminForm);
  const [busy, setBusy] = useState(false);

  // Toggle Confirm Dialog
  const [toggleTarget, setToggleTarget] = useState<AdminProfile | null>(null);
  const [busyToggle, setBusyToggle] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const raw = await api("/admin/admins/", {
      query: {
        page,
        page_size: 15,
        search: query || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
      },
    });
    return asPage<AdminProfile>(raw);
  }, [page, statusFilter, query]);

  const admins = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 15));

  function openCreate() {
    setEditing(null);
    setForm(emptyAdminForm);
    setModalOpen(true);
  }

  function openEdit(admin: AdminProfile) {
    setEditing(admin);
    setForm({
      phone: admin.user.phone,
      full_name: admin.user.full_name || "",
      password: "",
      title: admin.title || "Admin",
      can_manage_staff: admin.can_manage_staff,
      can_manage_orders: admin.can_manage_orders,
      can_view_analytics: admin.can_view_analytics,
      is_active: admin.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.phone.trim()) {
      showError("Telefon raqami majburiy");
      return;
    }
    if (!editing && !form.password.trim()) {
      showError("Admin uchun parol majburiy");
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: form.phone.trim(),
        full_name: form.full_name.trim(),
        title: form.title.trim() || "Admin",
        can_manage_staff: form.can_manage_staff,
        can_manage_orders: form.can_manage_orders,
        can_view_analytics: form.can_view_analytics,
        is_active: form.is_active,
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editing) {
        await api(`/admin/admins/${editing.id}/`, {
          method: "PATCH",
          body: payload,
        });
        showSuccess(`"${form.full_name || form.phone}" admin ma'lumotlari yangilandi`);
      } else {
        await api("/admin/admins/", {
          method: "POST",
          body: payload,
        });
        showSuccess(`"${form.full_name || form.phone}" administrator sifatida yaratildi`);
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
      await api(`/admin/admins/${toggleTarget.id}/`, {
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
          <Breadcrumbs items={[{ label: "Bosh sahifa", href: "/" }, { label: "Administratorlar" }]} />
          <h2 className="text-xl font-bold text-white tracking-tight">Administratorlar nazorati</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Boshqaruv paneliga kirish huquqiga ega administratorlar va ularning vakolatlari
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PrimaryButton icon="person_add" onClick={openCreate}>
            Yangi admin
          </PrimaryButton>
        </div>
      </div>

      {/* Filter Row */}
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

      {/* Admins Table */}
      {loading && !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <div className="rounded-2xl border border-error/40 bg-[#291113] p-6 text-center">
          <span className="material-symbols-outlined text-error text-3xl mb-2">error</span>
          <p className="text-sm font-semibold text-white">Administratorlarni yuklab bo&apos;lmadi</p>
          <p className="text-xs text-on-surface-variant mt-1">{error}</p>
          <div className="mt-4">
            <SecondaryButton icon="refresh" onClick={() => void reload()}>
              Qayta urinish
            </SecondaryButton>
          </div>
        </div>
      ) : admins.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-[#141816]">
          <EmptyState
            icon="admin_panel_settings"
            title="Administratorlar topilmadi"
            description="Tanlangan filtrlar bo'yicha adminlar mavjud emas."
            action={<PrimaryButton icon="person_add" onClick={openCreate}>Admin qo&apos;shish</PrimaryButton>}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-card-border bg-[#141816] overflow-hidden shadow-sm">
          <DataTable
            headers={["Ism / Familiya", "Telefon", "Lavozim", "Vakolatlar", "Holat", "Qo'shilgan sana", "Amallar"]}
            footer={
              <Pagination
                current={page}
                pages={pageNumbers(page, totalPages)}
                onPageChange={setPage}
                info={
                  <>
                    Jami <strong className="text-primary">{totalCount}</strong> ta administrator
                  </>
                }
              />
            }
          >
            {admins.map((admin) => (
              <tr key={admin.id} className="border-b border-[#26352c]/30 hover:bg-[#18211b]/50 transition-colors">
                <td className="px-4 py-3.5 text-xs font-semibold text-white">
                  {admin.user.full_name || "Ism ko'rsatilmagan"}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant font-mono">
                  {formatPhone(admin.user.phone)}
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface">
                  {admin.title || "Admin"}
                </td>
                <td className="px-4 py-3.5 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {admin.can_manage_orders && (
                      <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                        Buyurtmalar
                      </span>
                    )}
                    {admin.can_manage_staff && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        Xodimlar
                      </span>
                    )}
                    {admin.can_view_analytics && (
                      <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400 border border-purple-500/20">
                        Analitika
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs">
                  <StatusPill variant={admin.is_active ? "success" : "neutral"}>
                    {admin.is_active ? "Faol" : "Nofaol"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                  {formatDate(admin.created_at)}
                </td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(admin)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#26352c] bg-[#121614] px-2.5 py-1 text-xs font-medium text-on-surface hover:border-primary/50 hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      disabled={admin.user.id === user?.id}
                      onClick={() => setToggleTarget(admin)}
                      className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-semibold transition-all disabled:opacity-30 ${
                        admin.is_active
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title={
                        admin.user.id === user?.id
                          ? "O'zingizni deaktiv qila olmaysiz"
                          : admin.is_active
                            ? "Deaktiv qilish"
                            : "Faollashtirish"
                      }
                    >
                      {admin.is_active ? "Deaktiv" : "Faollashtirish"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {/* Create / Edit Admin Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Adminni tahrirlash: ${editing.user.full_name || editing.user.phone}` : "Yangi administrator qo'shish"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <Field label="To'liq ismi" required>
            <input
              type="text"
              placeholder="Masalan: Sardor Aliyev"
              className={inputClass}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>

          <Field label="Telefon raqami (kirish logini)" required>
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

          <Field label="Lavozim / Unvon">
            <input
              type="text"
              placeholder="Katta menejer, Operator"
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>

          <div className="rounded-xl border border-[#26352c] bg-[#101412] p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Admin vakolatlari
            </p>
            <label className="flex items-center gap-2.5 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.can_manage_orders}
                onChange={(e) => setForm({ ...form, can_manage_orders: e.target.checked })}
                className="rounded border-[#26352c] text-primary focus:ring-0"
              />
              <span>Buyurtmalarni boshqarish va holatini o&apos;zgartirish</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.can_manage_staff}
                onChange={(e) => setForm({ ...form, can_manage_staff: e.target.checked })}
                className="rounded border-[#26352c] text-primary focus:ring-0"
              />
              <span>Xodimlarni boshqarish va tayinlash</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.can_view_analytics}
                onChange={(e) => setForm({ ...form, can_view_analytics: e.target.checked })}
                className="rounded border-[#26352c] text-primary focus:ring-0"
              />
              <span>Analitika va hisobotlarni ko&apos;rish</span>
            </label>
          </div>

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

      {/* Toggle Confirm Dialog */}
      {toggleTarget && (
        <ConfirmDialog
          open={!!toggleTarget}
          variant={toggleTarget.is_active ? "danger" : "primary"}
          title={toggleTarget.is_active ? "Adminni deaktiv qilish" : "Adminni faollashtirish"}
          description={
            toggleTarget.is_active ? (
              <>
                <strong>{toggleTarget.user.full_name || toggleTarget.user.phone}</strong> tizimga kira olmaydi
                va admin amallarini bajara olmaydi.
              </>
            ) : (
              <>
                <strong>{toggleTarget.user.full_name || toggleTarget.user.phone}</strong> qayta faollashtiriladi
                va tizimga kirish huquqiga ega bo&apos;ladi.
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
