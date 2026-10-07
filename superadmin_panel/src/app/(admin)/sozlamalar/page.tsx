"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EmptyState,
  ExcelButton,
  Field,
  inputClass,
  LiveBadge,
  LoadingBlock,
  PrimaryButton,
  StatusPill,
} from "@/components/ui";
import { api, asPage } from "@/lib/api/client";
import type { AdminProfile } from "@/lib/api/types";
import { ROLE_LABEL } from "@/lib/domain";
import { downloadExcel } from "@/lib/excel";
import { formatDate, formatPhone } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "@/components/people/api";

export default function SozlamalarPage() {
  const { user, refreshMe } = useAuth();
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
  });

  const { data, loading, error, updatedAt } = useAsync(async () => {
    const raw = await api("/admin/admins/", { query: { page_size: 100 } });
    return asPage<AdminProfile>(raw).results;
  }, []);

  async function saveProfile() {
    setBusy(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: profile });
      await refreshMe();
      showSuccess("Profil saqlandi");
    } catch (e) {
      showError(errorMessage(e, "Profilni saqlab bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  function exportExcel() {
    downloadExcel("administratorlar", {
      name: "Administratorlar",
      headers: ["ID", "Ism", "Rol", "Telefon", "Lavozim", "Buyurtmalar", "Xodimlar", "Analitika", "Holat", "Qo'shilgan"],
      rows: (data ?? []).map((a) => [
        a.id,
        a.user.full_name || "",
        ROLE_LABEL[a.user.role] ?? a.user.role,
        formatPhone(a.user.phone),
        a.title,
        a.can_manage_orders ? "Ha" : "Yo'q",
        a.can_manage_staff ? "Ha" : "Yo'q",
        a.can_view_analytics ? "Ha" : "Yo'q",
        a.is_active ? "Faol" : "Nofaol",
        formatDate(a.created_at),
      ]),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
        <h3 className="mb-4 text-xl font-semibold">Mening profilim</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Ism">
            <input className={inputClass} value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
          </Field>
          <Field label="Familiya">
            <input className={inputClass} value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className={inputClass} value={user?.phone || ""} disabled />
          </Field>
        </div>
        <div className="mt-4">
          <PrimaryButton disabled={busy} onClick={() => void saveProfile()}>Saqlash</PrimaryButton>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low">
        <div className="flex flex-col gap-4 border-b border-surface-container-highest/60 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold">Administratorlar</h3>
              <LiveBadge updatedAt={updatedAt || undefined} />
            </div>
            <p className="text-xs text-on-surface-variant">Panelga telefon + parol bilan kiradigan adminlar</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExcelButton onClick={exportExcel} disabled={!data?.length} />
            <Link
              href="/administratorlar"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              Boshqarish
            </Link>
          </div>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="p-6 text-error">{error}</p>
        ) : !data?.length ? (
          <EmptyState icon="admin_panel_settings" title="Adminlar ro'yxati bo'sh" />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-variant/40 text-xs uppercase text-on-surface-variant">
                {["Ism", "Rol", "Telefon", "Lavozim", "Holat"].map((h) => (
                  <th key={h} className="px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/20">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-4 font-medium whitespace-nowrap">{a.user.full_name || a.user.phone}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{ROLE_LABEL[a.user.role]}</td>
                  <td className="px-6 py-4 font-mono whitespace-nowrap text-on-surface-variant">{formatPhone(a.user.phone)}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{a.title}</td>
                  <td className="px-6 py-4">
                    <StatusPill variant={a.is_active ? "success" : "neutral"} pulse={a.is_active}>
                      {a.is_active ? "Faol" : "Nofaol"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
